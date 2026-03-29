#!/usr/bin/env python3
"""
SponsorIntel Scout Army — Company Reconnaissance (v4 Production)
=================================================================
Phase 1: Fast domain verification (confirmed live domains, not guesses)
Phase 2: Career page discovery on found websites
Phase 3: Indeed/Reed job search for each company
Phase 4: Results report

Usage:
    cd backend && source .venv/bin/activate && python deploy_scouts.py
"""

import asyncio
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse, quote_plus

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("SCOUTS")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

MAX_CONCURRENT = 200
BATCH_SIZE = 100
TIMEOUT = 5

stats = {
    "processed": 0, "websites": 0, "careers": 0, "jobs_found": 0,
    "batches": 0, "total_batches": 0, "start": 0,
}


def normalize(name: str) -> str:
    name = name.strip().upper()
    for suffix in [
        " LIMITED", " LTD", " LTD.", " PLC", " LLP", " INC", " CORP",
        " CORPORATION", " CO.", " COMPANY", " GROUP", " HOLDINGS",
        " INTERNATIONAL", " (UK)", " UK", " SERVICES", " SOLUTIONS",
        " CONSULTING", " CONSULTANTS", " PARTNERS", " & CO", " & CO.",
        " RECRUITMENT", " STAFFING", " HEALTHCARE", " CARE",
        " EDUCATION", " ACADEMY", " TRUST", " FOUNDATION",
        " ENGINEERING", " TECHNOLOGIES", " TECHNOLOGY", " TECH",
    ]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name


def name_to_domains(name: str) -> list[str]:
    clean = normalize(name).lower()
    slug = re.sub(r'[^a-z0-9\s]', '', clean).strip()
    parts = slug.split()
    if not parts:
        return []

    concat = ''.join(parts)
    hyphen = '-'.join(parts)
    first = parts[0]

    domains = []
    for base in [concat, hyphen]:
        if len(base) >= 3:
            domains.extend([
                f"{base}.co.uk", f"{base}.com", f"{base}.org.uk",
                f"{base}.org", f"{base}.uk", f"{base}.net",
            ])
    if first != concat and len(first) >= 3:
        domains.extend([f"{first}.co.uk", f"{first}.com"])

    return domains[:12]


async def check_url(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        r = await client.head(url, follow_redirects=True, timeout=TIMEOUT)
        if r.status_code < 400:
            final = str(r.url)
            # Filter parked/placeholder domains
            bad = ["parked", "forsale", "buydomainnames", "sedoparking",
                   "hugedomains", "domainmarket", "afternic"]
            if any(b in final.lower() for b in bad):
                return None
            return final
    except Exception:
        pass
    return None


async def find_website(client: httpx.AsyncClient, name: str) -> Optional[str]:
    domains = name_to_domains(name)
    # Try HTTPS first
    tasks = [check_url(client, f"https://{d}") for d in domains]
    results = await asyncio.gather(*tasks)
    for r in results:
        if r:
            return r
    # HTTP fallback for first 4
    tasks2 = [check_url(client, f"http://{d}") for d in domains[:4]]
    results2 = await asyncio.gather(*tasks2)
    for r in results2:
        if r:
            return r
    return None


async def find_careers(client: httpx.AsyncClient, website_url: str) -> Optional[str]:
    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    paths = ["/careers", "/jobs", "/vacancies", "/join-us", "/work-with-us",
             "/career", "/en/careers", "/about/careers", "/opportunities"]
    tasks = [check_url(client, f"{base}{p}") for p in paths]
    results = await asyncio.gather(*tasks)
    for r in results:
        if r:
            return r
    return None


async def process_batch(
    batch_id: int,
    companies: list[dict],
    sponsors_map: dict,
    semaphore: asyncio.Semaphore,
):
    updates = []

    async with httpx.AsyncClient(
        follow_redirects=True,
        limits=httpx.Limits(max_connections=30, max_keepalive_connections=15),
        headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/1.0)"},
    ) as client:

        async def scout_one(company: dict):
            async with semaphore:
                sponsor = sponsors_map.get(company["sponsor_id"], {})
                name = sponsor.get("organisation_name", "")
                if not name:
                    return

                data = {}

                website = await find_website(client, name)
                if website:
                    data["website_url"] = website
                    stats["websites"] += 1

                    careers = await find_careers(client, website)
                    if careers:
                        data["careers_page_url"] = careers
                        data["has_careers_page"] = True
                        stats["careers"] += 1
                    else:
                        data["has_careers_page"] = False

                if data:
                    updates.append((company["id"], data))
                stats["processed"] += 1

        tasks = [scout_one(c) for c in companies]
        await asyncio.gather(*tasks, return_exceptions=True)

    # Save to Supabase
    for company_id, data in updates:
        try:
            sb.table("company_profiles").update(data).eq("id", company_id).execute()
        except Exception as e:
            logger.debug(f"  Update error for {company_id}: {str(e)[:100]}")

    stats["batches"] += 1
    if stats["batches"] % 10 == 0 or stats["batches"] == stats["total_batches"]:
        elapsed = time.time() - stats["start"]
        rate = stats["processed"] / max(1, elapsed)
        remaining = (stats.get("total", 0) - stats["processed"]) / max(0.01, rate)
        logger.info(
            f"  Batch {stats['batches']}/{stats['total_batches']} | "
            f"{stats['processed']:,}/{stats.get('total',0):,} | "
            f"W:{stats['websites']:,} C:{stats['careers']:,} | "
            f"{rate:.1f}/s | ETA {remaining/60:.0f}m"
        )


async def main():
    stats["start"] = time.time()

    logger.info("=" * 60)
    logger.info("  SCOUT ARMY v4 — DOMAIN VERIFICATION + CAREER DISCOVERY")
    logger.info("=" * 60)

    # Load sponsors
    logger.info("  Loading sponsor register...")
    sponsors_map = {}
    page = 0
    while True:
        result = sb.table("sponsors").select(
            "id, organisation_name"
        ).range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not result.data:
            break
        for s in result.data:
            sponsors_map[s["id"]] = s
        if len(result.data) < 1000:
            break
        page += 1
    logger.info(f"  Loaded {len(sponsors_map):,} sponsors")

    # Load profiles needing recon (no website_url yet)
    logger.info("  Loading profiles needing reconnaissance...")
    profiles = []
    page = 0
    while True:
        result = sb.table("company_profiles").select(
            "id, sponsor_id"
        ).is_("website_url", "null").range(
            page * 1000, (page + 1) * 1000 - 1
        ).execute()
        if not result.data:
            break
        profiles.extend(result.data)
        if len(result.data) < 1000:
            break
        page += 1
    logger.info(f"  Loaded {len(profiles):,} profiles to process")
    stats["total"] = len(profiles)

    if not profiles:
        logger.info("  Nothing to do!")
        return

    batches = [profiles[i:i + BATCH_SIZE] for i in range(0, len(profiles), BATCH_SIZE)]
    stats["total_batches"] = len(batches)

    logger.info(f"  Agents: {len(batches):,} (1 per {BATCH_SIZE} companies)")
    logger.info(f"  Concurrent HTTP: {MAX_CONCURRENT}")
    logger.info("=" * 60)

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    AGENTS_AT_ONCE = 20
    for group_start in range(0, len(batches), AGENTS_AT_ONCE):
        group = batches[group_start:group_start + AGENTS_AT_ONCE]
        tasks = [
            process_batch(group_start + i + 1, batch, sponsors_map, semaphore)
            for i, batch in enumerate(group)
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    elapsed = time.time() - stats["start"]

    logger.info("=" * 60)
    logger.info("  SCOUT ARMY v4 — FINAL REPORT")
    logger.info("=" * 60)
    logger.info(f"  Processed:      {stats['processed']:,}")
    logger.info(f"  Websites found: {stats['websites']:,}")
    logger.info(f"  Careers pages:  {stats['careers']:,}")
    logger.info(f"  Time:           {elapsed/60:.1f} min")
    logger.info(f"  Rate:           {stats['processed']/max(1,elapsed):.1f} companies/sec")
    logger.info(f"  Hit rate:       {stats['websites']*100/max(1,stats['processed']):.1f}%")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
