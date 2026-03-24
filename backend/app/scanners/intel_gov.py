"""
Intel scanner: GOV.UK government sources.

Scans 4 Atom RSS feeds (UKVI, Home Office, MAC, ONS)
plus 11 Immigration Rules pages via content-hash diffing.
"""

import hashlib
import json
import logging
import xml.etree.ElementTree as ET
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

ATOM_NS = "{http://www.w3.org/2005/Atom}"

GOV_UK_FEEDS = {
    "ukvi": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=uk-visas-and-immigration&order=updated-newest",
        "source_name": "GOV.UK UKVI",
    },
    "home_office": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=home-office&order=updated-newest",
        "source_name": "GOV.UK Home Office",
    },
    "mac": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=migration-advisory-committee&order=updated-newest",
        "source_name": "GOV.UK MAC",
    },
    "ons_migration": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=office-for-national-statistics&topics[]=population-and-migration",
        "source_name": "GOV.UK ONS Migration",
    },
}

GOV_UK_IMMIGRATION_RULES_PAGES = [
    "https://www.gov.uk/guidance/immigration-rules",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-worker",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-global-talent",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-graduate-route",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-innovator-founder",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-high-potential-individual",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-scale-up",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-occupations",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-immigration-salary-list",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-part-1-leave-to-enter-or-stay-in-the-uk",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-part-6a-the-points-based-system",
]

IMMIGRATION_KEYWORDS = [
    "immigration", "immigrant", "visa", "visas", "sponsor", "sponsorship",
    "home office", "ukvi", "skilled worker", "points-based", "points based",
    "right to work", "migrant", "migration", "asylum", "deportation",
    "windrush", "tier 2", "tier 5", "global talent", "graduate visa",
    "innovator founder", "shortage occupation", "sol review", "mac report",
    "immigration rules", "statement of changes", "net migration",
    "biometric residence", "brp", "ics", "cos", "certificate of sponsorship",
    "settled status", "pre-settled", "eu settlement", "indefinite leave",
    "ilr", "naturalisation", "citizenship", "border force",
]


def is_immigration_relevant(title: str, snippet: str | None = None) -> bool:
    """Quick keyword check before sending to LLM classifier."""
    text = (title + " " + (snippet or "")).lower()
    return any(kw in text for kw in IMMIGRATION_KEYWORDS)


def parse_govuk_atom(xml_text: str, source_name: str) -> list[dict]:
    """Parse GOV.UK Atom feed into raw intel items."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse Atom XML from {source_name}: {e}")
        return []

    items = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        title_el = entry.find(f"{ATOM_NS}title")
        link_el = entry.find(f"{ATOM_NS}link")
        updated_el = entry.find(f"{ATOM_NS}updated")
        summary_el = entry.find(f"{ATOM_NS}summary")

        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        snippet = (summary_el.text or "")[:500] if summary_el is not None else None

        if not title:
            continue

        items.append({
            "title": title,
            "source_url": link_el.attrib.get("href", "") if link_el is not None else "",
            "published_at": updated_el.text if updated_el is not None else None,
            "content_snippet": snippet,
            "source_name": source_name,
            "source_category": "government",
        })
    return items


async def check_page_diff(url: str, redis_client, http_client) -> dict | None:
    """Fetch page, compare hash with stored version, extract changed sections."""
    import difflib

    try:
        response = await http_client.get(url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return None

    html = response.text
    current_hash = hashlib.sha256(html.encode()).hexdigest()
    stored_hash = await redis_client.get(f"intel:page_hash:{url}")

    if stored_hash and stored_hash.decode() == current_hash:
        return None  # No change

    # Extract sections using regex (avoid selectolax dependency for plan simplicity)
    import re
    sections: dict[str, str] = {}
    current_heading = "preamble"
    # Simple heading extraction
    parts = re.split(r'<h[23][^>]*>(.*?)</h[23]>', html, flags=re.DOTALL)
    for i, part in enumerate(parts):
        cleaned = re.sub(r'<[^>]+>', '', part).strip()
        if i % 2 == 1:  # This is a heading
            current_heading = cleaned
        else:
            if cleaned:
                sections[current_heading] = cleaned[:2000]

    # Compare with stored sections
    stored_sections_raw = await redis_client.get(f"intel:page_sections:{url}")
    changed_sections: dict[str, dict] = {}

    if stored_sections_raw:
        stored_sections = json.loads(stored_sections_raw)
        all_keys = set(list(stored_sections.keys()) + list(sections.keys()))
        for key in all_keys:
            old_text = stored_sections.get(key, "")
            new_text = sections.get(key, "")
            if old_text != new_text:
                diff = list(difflib.unified_diff(
                    old_text.splitlines(), new_text.splitlines(),
                    fromfile="before", tofile="after", lineterm=""
                ))
                changed_sections[key] = {
                    "before": old_text[:1000],
                    "after": new_text[:1000],
                    "diff_lines": diff[:50],
                    "is_new_section": key not in stored_sections,
                    "is_removed_section": key not in sections,
                }

    # Store new hash and sections
    await redis_client.set(f"intel:page_hash:{url}", current_hash, ex=86400 * 7)
    await redis_client.set(f"intel:page_sections:{url}", json.dumps(sections), ex=86400 * 7)

    if not changed_sections:
        return None

    return {
        "url": url,
        "changed_sections": changed_sections,
        "total_sections_changed": len(changed_sections),
    }


async def scan_gov_feeds(supabase_client, redis_client) -> dict:
    """Scan all GOV.UK RSS feeds and insert new items."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        for key, config in GOV_UK_FEEDS.items():
            try:
                resp = await client.get(config["feed_url"])
                resp.raise_for_status()
                items = parse_govuk_atom(resp.text, config["source_name"])
                stats["items_fetched"] += len(items)

                for item in items:
                    if not is_immigration_relevant(item["title"], item.get("content_snippet")):
                        stats["items_filtered"] += 1
                        continue

                    # Dedup by source_url
                    existing = supabase_client.table("intel_items").select("id").eq(
                        "source_url", item["source_url"]
                    ).limit(1).execute()
                    if existing.data:
                        continue

                    supabase_client.table("intel_items").insert({
                        "title": item["title"],
                        "source_name": item["source_name"],
                        "source_url": item["source_url"],
                        "source_category": item["source_category"],
                        "published_at": item["published_at"],
                        "content_snippet": item["content_snippet"],
                        "status": "raw",
                        "scanner_agent": "intel_scan_gov",
                    }).execute()
                    stats["items_new"] += 1

            except Exception as e:
                logger.error(f"Failed scanning {key}: {e}")

    # Scan Immigration Rules pages for diffs
    async with httpx.AsyncClient(timeout=30) as client:
        for url in GOV_UK_IMMIGRATION_RULES_PAGES:
            try:
                diff_result = await check_page_diff(url, redis_client, client)
                if diff_result:
                    title = f"Immigration Rules Update: {diff_result['total_sections_changed']} section(s) changed"
                    supabase_client.table("intel_items").insert({
                        "title": title,
                        "source_name": "GOV.UK Immigration Rules",
                        "source_url": url,
                        "source_category": "government",
                        "published_at": datetime.utcnow().isoformat(),
                        "content_snippet": f"Detected changes in {diff_result['total_sections_changed']} sections",
                        "content_text": json.dumps(diff_result["changed_sections"])[:5000],
                        "status": "raw",
                        "scanner_agent": "intel_scan_gov",
                    }).execute()
                    stats["items_new"] += 1
            except Exception as e:
                logger.error(f"Failed checking page diff for {url}: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
