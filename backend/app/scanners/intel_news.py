"""
Intel scanner: News media RSS feeds.

Scans BBC, Guardian, Reuters, Financial Times, The Times
for immigration-related articles using RSS feeds + keyword filtering.
"""

import logging
import re
import xml.etree.ElementTree as ET

import httpx

from app.scanners.intel_gov import is_immigration_relevant

logger = logging.getLogger(__name__)

NEWS_RSS_SOURCES = {
    "bbc": {
        "feed_url": "https://feeds.bbci.co.uk/news/uk/rss.xml",
        "source_name": "BBC News",
    },
    "guardian": {
        "feed_url": "https://www.theguardian.com/uk/immigration/rss",
        "source_name": "The Guardian",
    },
    "guardian_politics": {
        "feed_url": "https://www.theguardian.com/politics/immigration/rss",
        "source_name": "The Guardian",
    },
    "reuters": {
        "feed_url": "https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best",
        "source_name": "Reuters",
    },
    "ft": {
        "feed_url": "https://www.ft.com/immigration?format=rss",
        "source_name": "Financial Times",
    },
    "times": {
        "feed_url": "https://www.thetimes.co.uk/topic/immigration?format=rss",
        "source_name": "The Times",
    },
}


def parse_rss2_entry(item_el, source_name: str) -> dict:
    """Parse a single <item> from an RSS 2.0 feed."""
    def text_or_none(tag: str) -> str | None:
        el = item_el.find(tag)
        return el.text.strip() if el is not None and el.text else None

    return {
        "title": text_or_none("title") or "",
        "source_url": text_or_none("link"),
        "published_at": text_or_none("pubDate"),
        "content_snippet": (text_or_none("description") or "")[:500],
        "source_name": source_name,
        "source_category": "news",
        "guid": text_or_none("guid"),
    }


def parse_rss2_feed(xml_text: str, source_name: str) -> list[dict]:
    """Parse full RSS 2.0 feed XML into list of items."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse RSS XML from {source_name}: {e}")
        return []

    items = []
    for item_el in root.findall(".//item"):
        parsed = parse_rss2_entry(item_el, source_name)
        if parsed["title"]:
            # Strip HTML from snippet
            parsed["content_snippet"] = re.sub(
                r'<[^>]+>', '', parsed.get("content_snippet") or ""
            ).strip()[:500]
            items.append(parsed)
    return items


async def scan_news_feeds(supabase_client) -> dict:
    """Scan all news RSS feeds and insert immigration-relevant items."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        for key, config in NEWS_RSS_SOURCES.items():
            try:
                resp = await client.get(config["feed_url"])
                resp.raise_for_status()
                items = parse_rss2_feed(resp.text, config["source_name"])
                stats["items_fetched"] += len(items)

                for item in items:
                    if not is_immigration_relevant(item["title"], item.get("content_snippet")):
                        stats["items_filtered"] += 1
                        continue

                    # Dedup by source_url or guid
                    dedup_field = "source_url"
                    dedup_value = item.get("source_url") or item.get("guid")
                    if not dedup_value:
                        continue

                    existing = supabase_client.table("intel_items").select("id").eq(
                        dedup_field, dedup_value
                    ).limit(1).execute()
                    if existing.data:
                        continue

                    supabase_client.table("intel_items").insert({
                        "title": item["title"],
                        "source_name": item["source_name"],
                        "source_url": item.get("source_url"),
                        "source_category": item["source_category"],
                        "published_at": item.get("published_at"),
                        "content_snippet": item.get("content_snippet"),
                        "status": "raw",
                        "scanner_agent": "intel_scan_news",
                    }).execute()
                    stats["items_new"] += 1

            except Exception as e:
                logger.error(f"Failed scanning news source {key}: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
