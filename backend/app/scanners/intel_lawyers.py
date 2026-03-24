"""
Intel scanner: OISC + SRA lawyer registers.

Scrapes official registers weekly, enriches with review data.
Stores/updates in intel_lawyers table.
"""

import logging
import re

import httpx

logger = logging.getLogger(__name__)

OISC_SEARCH_URL = "https://home.oisc.gov.uk/adviser_finder/finder.aspx"
SRA_SEARCH_URL = "https://www.sra.org.uk/consumers/register/organisation/"


async def scrape_oisc_register(http_client) -> list[dict]:
    """Scrape OISC adviser register for immigration advisers."""
    advisers = []
    try:
        # OISC has a search page; query for immigration advisers
        resp = await http_client.get(OISC_SEARCH_URL, timeout=30)
        resp.raise_for_status()
        html = resp.text

        # Parse results - OISC register has a simple table format
        # Look for adviser entries in the HTML
        rows = re.findall(
            r'<tr[^>]*>(.*?)</tr>',
            html, re.DOTALL
        )

        for row in rows:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if len(cells) >= 4:
                name = re.sub(r'<[^>]+>', '', cells[0]).strip()
                firm = re.sub(r'<[^>]+>', '', cells[1]).strip()
                reg_num = re.sub(r'<[^>]+>', '', cells[2]).strip()
                level_text = re.sub(r'<[^>]+>', '', cells[3]).strip()

                if not name or not reg_num:
                    continue

                # Parse OISC level
                level = None
                level_match = re.search(r'Level\s*(\d)', level_text)
                if level_match:
                    level = int(level_match.group(1))

                advisers.append({
                    "name": name,
                    "firm_name": firm or None,
                    "registration_type": "oisc",
                    "registration_number": reg_num,
                    "oisc_level": level,
                    "practising_status": "active",
                    "practice_areas": ["Immigration"],
                    "is_active": True,
                })

    except Exception as e:
        logger.error(f"OISC register scrape failed: {e}")

    return advisers


async def scrape_sra_register(http_client) -> list[dict]:
    """Scrape SRA solicitors register for immigration solicitors."""
    solicitors = []
    try:
        # SRA has an API-like search
        params = {"Type": "Immigration", "Page": 1, "PageSize": 50}
        resp = await http_client.get(
            "https://www.sra.org.uk/consumers/register/organisation/",
            params=params, timeout=30
        )
        resp.raise_for_status()
        html = resp.text

        # Parse SRA results
        blocks = re.findall(r'<div class="[^"]*result[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
        for block in blocks[:50]:
            name_match = re.search(r'<h[23][^>]*>(.*?)</h[23]>', block, re.DOTALL)
            if not name_match:
                continue
            name = re.sub(r'<[^>]+>', '', name_match.group(1)).strip()

            sra_match = re.search(r'SRA\s*(?:ID|Number)[:\s]*(\d+)', block)
            reg_num = sra_match.group(1) if sra_match else ""

            city_match = re.search(r'(?:City|Location)[:\s]*([^<]+)', block)
            city = city_match.group(1).strip() if city_match else None

            solicitors.append({
                "name": name,
                "firm_name": name,
                "registration_type": "sra",
                "registration_number": reg_num,
                "oisc_level": None,
                "practising_status": "active",
                "practice_areas": ["Immigration"],
                "city": city,
                "is_active": True,
            })

    except Exception as e:
        logger.error(f"SRA register scrape failed: {e}")

    return solicitors


async def scan_lawyer_registers(supabase_client) -> dict:
    """Scan OISC + SRA registers and upsert lawyers."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_updated": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        # OISC
        oisc_lawyers = await scrape_oisc_register(client)
        stats["items_fetched"] += len(oisc_lawyers)

        for lawyer in oisc_lawyers:
            existing = supabase_client.table("intel_lawyers").select("id").eq(
                "registration_number", lawyer["registration_number"]
            ).eq("registration_type", "oisc").limit(1).execute()

            if existing.data:
                supabase_client.table("intel_lawyers").update({
                    "practising_status": lawyer["practising_status"],
                    "last_verified_at": "now()",
                }).eq("id", existing.data[0]["id"]).execute()
                stats["items_updated"] += 1
            else:
                supabase_client.table("intel_lawyers").insert(lawyer).execute()
                stats["items_new"] += 1

        # SRA
        sra_lawyers = await scrape_sra_register(client)
        stats["items_fetched"] += len(sra_lawyers)

        for lawyer in sra_lawyers:
            existing = supabase_client.table("intel_lawyers").select("id").eq(
                "registration_number", lawyer["registration_number"]
            ).eq("registration_type", "sra").limit(1).execute()

            if existing.data:
                supabase_client.table("intel_lawyers").update({
                    "practising_status": lawyer["practising_status"],
                    "last_verified_at": "now()",
                }).eq("id", existing.data[0]["id"]).execute()
                stats["items_updated"] += 1
            else:
                supabase_client.table("intel_lawyers").insert(lawyer).execute()
                stats["items_new"] += 1

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
