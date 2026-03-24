"""
Intel scanner: Legal blogs and tribunal decisions.

Scans Free Movement, Colin Yeo, Law Society (RSS),
ILPA, Upper Tribunal (page scrape), and Hansard API.
"""

import logging
import re
import xml.etree.ElementTree as ET

import httpx

logger = logging.getLogger(__name__)

LEGAL_RSS_SOURCES = {
    "free_movement": {
        "feed_url": "https://freemovement.org.uk/feed/",
        "source_name": "Free Movement Blog",
    },
    "colin_yeo": {
        "feed_url": "https://www.immigrationbarrister.co.uk/feed/",
        "source_name": "Immigration Barrister (Colin Yeo)",
    },
    "law_society": {
        "feed_url": "https://www.lawsociety.org.uk/campaigns/immigration/rss",
        "source_name": "Law Society Immigration",
    },
}

LEGAL_SCRAPE_SELECTORS = {
    "ilpa": {
        "url": "https://ilpa.org.uk/resources/",
        "list_pattern": r'<article[^>]*>(.*?)</article>',
        "title_pattern": r'<h[23][^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
        "date_pattern": r'<time[^>]*datetime="([^"]*)"',
        "source_name": "ILPA",
    },
    "upper_tribunal": {
        "url": "https://www.judiciary.uk/judgments/?search=immigration&court=upper-tribunal-immigration-and-asylum-chamber",
        "list_pattern": r'<li[^>]*class="[^"]*judgment[^"]*"[^>]*>(.*?)</li>',
        "title_pattern": r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
        "date_pattern": r'<time[^>]*datetime="([^"]*)"',
        "source_name": "Upper Tribunal IAC",
    },
}

HANSARD_API_BASE = "https://hansard-api.parliament.uk"


def parse_legal_rss(xml_text: str, source_name: str) -> list[dict]:
    """Parse RSS 2.0 legal blog feed."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse legal RSS from {source_name}: {e}")
        return []

    items = []
    for item_el in root.findall(".//item"):
        title_el = item_el.find("title")
        link_el = item_el.find("link")
        pub_el = item_el.find("pubDate")
        desc_el = item_el.find("description")

        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        if not title:
            continue

        snippet = ""
        if desc_el is not None and desc_el.text:
            snippet = re.sub(r'<[^>]+>', '', desc_el.text).strip()[:500]

        items.append({
            "title": title,
            "source_url": link_el.text.strip() if link_el is not None and link_el.text else "",
            "published_at": pub_el.text.strip() if pub_el is not None and pub_el.text else None,
            "content_snippet": snippet,
            "source_name": source_name,
            "source_category": "legal",
        })
    return items


async def scrape_legal_page(source_key: str, http_client) -> list[dict]:
    """Scrape a legal source that lacks RSS using regex patterns."""
    config = LEGAL_SCRAPE_SELECTORS[source_key]
    try:
        response = await http_client.get(config["url"], timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch {config['url']}: {e}")
        return []

    html = response.text
    items = []

    # Find all article/list-item blocks
    blocks = re.findall(config["list_pattern"], html, re.DOTALL)
    for block in blocks[:30]:  # Limit to 30 items
        title_match = re.search(config["title_pattern"], block, re.DOTALL)
        date_match = re.search(config["date_pattern"], block)

        if not title_match:
            continue

        href = title_match.group(1)
        title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
        if not href.startswith("http"):
            href = config["url"].rstrip("/") + "/" + href.lstrip("/")

        items.append({
            "title": title,
            "source_url": href,
            "published_at": date_match.group(1) if date_match else None,
            "content_snippet": None,
            "source_name": config["source_name"],
            "source_category": "legal",
        })

    return items


async def fetch_hansard_debates(http_client, date_from: str) -> list[dict]:
    """Fetch recent immigration-related parliamentary debates."""
    params = {
        "q": 'immigration OR visa OR migration OR "home office"',
        "startDate": date_from,
        "house": "Commons",
        "take": 20,
    }
    try:
        response = await http_client.get(
            f"{HANSARD_API_BASE}/search.json", params=params, timeout=30
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.error(f"Hansard API failed: {e}")
        return []

    items = []
    for result in data.get("Results", []):
        highlights = result.get("SearchResultHighlights", [])
        snippet = highlights[0].get("Value", "")[:500] if highlights else ""

        items.append({
            "title": result.get("Title", ""),
            "source_url": f"https://hansard.parliament.uk{result.get('Url', '')}",
            "published_at": result.get("Date"),
            "content_snippet": snippet,
            "source_name": "Parliament Hansard",
            "source_category": "government",
        })
    return items


async def scan_legal_sources(supabase_client) -> dict:
    """Scan all legal RSS feeds, page scrapes, and Hansard."""
    import time
    from datetime import datetime, timedelta

    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        # RSS feeds
        for key, config in LEGAL_RSS_SOURCES.items():
            try:
                resp = await client.get(config["feed_url"])
                resp.raise_for_status()
                items = parse_legal_rss(resp.text, config["source_name"])
                stats["items_fetched"] += len(items)

                for item in items:
                    if not item.get("source_url"):
                        continue
                    existing = supabase_client.table("intel_items").select("id").eq(
                        "source_url", item["source_url"]
                    ).limit(1).execute()
                    if existing.data:
                        continue

                    supabase_client.table("intel_items").insert({
                        **item, "status": "raw", "scanner_agent": "intel_scan_legal",
                    }).execute()
                    stats["items_new"] += 1
            except Exception as e:
                logger.error(f"Failed scanning legal RSS {key}: {e}")

        # Page scrapes
        for source_key in LEGAL_SCRAPE_SELECTORS:
            try:
                items = await scrape_legal_page(source_key, client)
                stats["items_fetched"] += len(items)
                for item in items:
                    if not item.get("source_url"):
                        continue
                    existing = supabase_client.table("intel_items").select("id").eq(
                        "source_url", item["source_url"]
                    ).limit(1).execute()
                    if existing.data:
                        continue
                    supabase_client.table("intel_items").insert({
                        **item, "status": "raw", "scanner_agent": "intel_scan_legal",
                    }).execute()
                    stats["items_new"] += 1
            except Exception as e:
                logger.error(f"Failed scraping legal page {source_key}: {e}")

        # Hansard
        try:
            date_from = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
            hansard_items = await fetch_hansard_debates(client, date_from)
            stats["items_fetched"] += len(hansard_items)
            for item in hansard_items:
                if not item.get("source_url"):
                    continue
                existing = supabase_client.table("intel_items").select("id").eq(
                    "source_url", item["source_url"]
                ).limit(1).execute()
                if existing.data:
                    continue
                supabase_client.table("intel_items").insert({
                    **item, "status": "raw", "scanner_agent": "intel_scan_legal",
                }).execute()
                stats["items_new"] += 1
        except Exception as e:
            logger.error(f"Hansard scan failed: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
