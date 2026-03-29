"""
Build name alias mappings for sponsors using Companies House data.

The Home Office sponsor register uses REGISTERED company names, but companies
often trade under different names. This script:
1. Queries Companies House API for each sponsor's registered name
2. Extracts trading names, previous names, and domain from website
3. Stores aliases in Supabase `sponsor_name_aliases` table
4. These aliases are used by job scrapers to match jobs to sponsors

Usage:
    python -m app.scripts.enrich_name_aliases [--limit 500] [--tier 1]

Tiers:
    1: A-rated sponsors in major UK cities (~30K)
    2: All remaining A-rated sponsors
    3: B-rated sponsors with jobs
    4: All remaining B-rated sponsors
"""

import argparse
import asyncio
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("enrich_aliases")

MAJOR_CITIES = {
    "LONDON", "MANCHESTER", "BIRMINGHAM", "LEEDS", "GLASGOW", "EDINBURGH",
    "BRISTOL", "LIVERPOOL", "SHEFFIELD", "NOTTINGHAM", "NEWCASTLE UPON TYNE",
    "CARDIFF", "BELFAST", "LEICESTER", "COVENTRY", "CAMBRIDGE", "OXFORD",
    "READING", "BRIGHTON", "SOUTHAMPTON",
}


def normalize_name(name: str) -> str:
    """Normalize company name for matching."""
    name = name.upper().strip()
    # Split on trading-as indicators
    name = re.split(r'\s+T/A\s+|\s+TRADING AS\s+|\.T/A[- ]', name)[0]
    name = re.sub(r'-\d{6,}$', '', name)
    for suffix in [" LIMITED", " LTD", " LTD.", " PLC", " LLP", " LP", " INC",
                   " CORPORATION", " CORP", " CO.", " CO",
                   " CIC", " C.I.C", " C.I.C.", " UK"]:
        name = name.replace(suffix, "")
    name = re.sub(r"[^A-Z0-9 ]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def extract_trading_name(raw_name: str) -> Optional[str]:
    """
    Extract trading name from sponsor register name.

    Many sponsors are listed as "PARENT LTD T/A TRADING NAME" or
    "COMPANY NAME (TRADING AS BRAND)".
    """
    # Check for T/A pattern
    ta_match = re.search(r'\s+T/A\s+(.+)$', raw_name, re.I)
    if ta_match:
        return ta_match.group(1).strip()

    # Check for TRADING AS pattern
    ta_match = re.search(r'\s+TRADING AS\s+(.+)$', raw_name, re.I)
    if ta_match:
        return ta_match.group(1).strip()

    # Check for parenthetical trading name
    paren_match = re.search(r'\((?:TRADING AS|T/A|DBA)\s+(.+?)\)', raw_name, re.I)
    if paren_match:
        return paren_match.group(1).strip()

    return None


def extract_domain(url: str) -> Optional[str]:
    """Extract clean domain from a URL."""
    if not url:
        return None
    try:
        parsed = urlparse(url if url.startswith('http') else f'https://{url}')
        domain = parsed.netloc or parsed.path.split('/')[0]
        domain = domain.lower().strip()
        # Remove www prefix
        if domain.startswith('www.'):
            domain = domain[4:]
        return domain if domain else None
    except Exception:
        return None


async def get_supabase():
    """Get Supabase client."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


async def ensure_aliases_table(sb):
    """
    Check if sponsor_name_aliases table exists, create via SQL if not.
    """
    try:
        sb.table("sponsor_name_aliases").select("id").limit(1).execute()
        logger.info("sponsor_name_aliases table exists")
        return True
    except Exception:
        logger.warning("sponsor_name_aliases table does not exist — it needs to be created via Supabase SQL Editor:")
        logger.warning("""
CREATE TABLE IF NOT EXISTS sponsor_name_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    registered_name TEXT NOT NULL,
    trading_name TEXT,
    previous_names TEXT[],
    domain TEXT,
    ch_number TEXT,
    normalized_registered TEXT NOT NULL,
    normalized_trading TEXT,
    alias_source TEXT DEFAULT 'auto',
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sponsor_id)
);

CREATE INDEX idx_aliases_normalized ON sponsor_name_aliases(normalized_registered);
CREATE INDEX idx_aliases_trading ON sponsor_name_aliases(normalized_trading) WHERE normalized_trading IS NOT NULL;
CREATE INDEX idx_aliases_domain ON sponsor_name_aliases(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_aliases_ch ON sponsor_name_aliases(ch_number) WHERE ch_number IS NOT NULL;
        """)
        return False


async def fetch_sponsors_for_tier(sb, tier: int, limit: int) -> list[dict]:
    """Fetch sponsors for a given enrichment tier."""
    logger.info("Fetching Tier %d sponsors (limit=%d)...", tier, limit)

    if tier == 1:
        # A-rated in major cities
        cities_list = list(MAJOR_CITIES)
        results = []
        for city in cities_list:
            resp = sb.table("sponsors").select("id, organisation_name, town_city, rating, route").eq(
                "rating", "A"
            ).eq("is_active", True).ilike("town_city", f"%{city}%").limit(limit - len(results)).execute()
            results.extend(resp.data or [])
            if len(results) >= limit:
                break
        return results[:limit]

    elif tier == 2:
        # All remaining A-rated
        resp = sb.table("sponsors").select("id, organisation_name, town_city, rating, route").eq(
            "rating", "A"
        ).eq("is_active", True).limit(limit).execute()
        return resp.data or []

    elif tier == 3:
        # B-rated with jobs
        job_sponsors = sb.table("jobs").select("sponsor_id").not_.is_("sponsor_id", "null").limit(5000).execute()
        sponsor_ids = list(set(r["sponsor_id"] for r in (job_sponsors.data or [])))
        if not sponsor_ids:
            return []
        results = []
        for i in range(0, len(sponsor_ids), 50):
            batch = sponsor_ids[i:i+50]
            resp = sb.table("sponsors").select("id, organisation_name, town_city, rating, route").eq(
                "rating", "B"
            ).in_("id", batch).limit(limit - len(results)).execute()
            results.extend(resp.data or [])
            if len(results) >= limit:
                break
        return results[:limit]

    else:
        # All remaining B-rated
        resp = sb.table("sponsors").select("id, organisation_name, town_city, rating, route").eq(
            "rating", "B"
        ).eq("is_active", True).limit(limit).execute()
        return resp.data or []


async def enrich_aliases(sb, sponsors: list[dict], ch_api=None):
    """
    Build name aliases for each sponsor.

    For each sponsor:
    1. Extract trading name from raw register name (T/A, TRADING AS patterns)
    2. Look up website domain from company_profiles table
    3. Optionally query Companies House for previous names
    4. Store all aliases in sponsor_name_aliases table
    """
    stats = {"processed": 0, "aliases_created": 0, "with_trading": 0, "with_domain": 0, "errors": 0}
    start = time.time()

    # Pre-fetch existing aliases to skip
    existing = set()
    page = 0
    while True:
        resp = sb.table("sponsor_name_aliases").select("sponsor_id").range(
            page * 1000, (page + 1) * 1000 - 1
        ).execute()
        if not resp.data:
            break
        for row in resp.data:
            existing.add(row["sponsor_id"])
        if len(resp.data) < 1000:
            break
        page += 1
    logger.info("Found %d existing aliases — will skip these", len(existing))

    sponsors = [s for s in sponsors if s["id"] not in existing]
    logger.info("Processing %d sponsors after filtering existing...", len(sponsors))

    for i, sponsor in enumerate(sponsors):
        sid = sponsor["id"]
        org_name = sponsor["organisation_name"]
        norm_registered = normalize_name(org_name)

        # Extract trading name from register format
        trading_name = extract_trading_name(org_name)
        norm_trading = normalize_name(trading_name) if trading_name else None

        # Look up domain from company_profiles
        domain = None
        try:
            profile_resp = sb.table("company_profiles").select(
                "website_url, companies_house_number"
            ).eq("sponsor_id", sid).limit(1).execute()
            if profile_resp.data:
                profile = profile_resp.data[0]
                domain = extract_domain(profile.get("website_url"))
                ch_number = profile.get("companies_house_number")
            else:
                ch_number = None
        except Exception:
            ch_number = None

        # Query Companies House for previous names if API available
        previous_names = []
        if ch_api and ch_number:
            try:
                import httpx
                async with httpx.AsyncClient(
                    auth=(ch_api, ""), timeout=httpx.Timeout(10)
                ) as client:
                    resp = await client.get(
                        f"https://api.company-information.service.gov.uk/company/{ch_number}"
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for prev in data.get("previous_company_names", []):
                            prev_name = prev.get("name", "")
                            if prev_name and prev_name != org_name:
                                previous_names.append(prev_name)
                await asyncio.sleep(0.1)  # Rate limiting
            except Exception as e:
                logger.debug("CH API error for %s: %s", ch_number, str(e)[:60])

        # Upsert alias record
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "sponsor_id": sid,
            "registered_name": org_name,
            "trading_name": trading_name,
            "previous_names": previous_names if previous_names else None,
            "domain": domain,
            "ch_number": ch_number,
            "normalized_registered": norm_registered,
            "normalized_trading": norm_trading,
            "alias_source": "auto",
            "verified": False,
            "updated_at": now,
        }

        try:
            sb.table("sponsor_name_aliases").upsert(
                record, on_conflict="sponsor_id"
            ).execute()
            stats["aliases_created"] += 1
            if trading_name:
                stats["with_trading"] += 1
            if domain:
                stats["with_domain"] += 1
        except Exception as e:
            stats["errors"] += 1
            if stats["errors"] <= 5:
                logger.warning("Insert error for %s: %s", org_name[:40], str(e)[:80])

        stats["processed"] += 1

        if (i + 1) % 100 == 0:
            elapsed = time.time() - start
            rate = stats["processed"] / elapsed
            logger.info(
                "Progress: %d/%d (%.1f/sec) | aliases=%d trading=%d domains=%d errors=%d",
                i + 1, len(sponsors), rate,
                stats["aliases_created"], stats["with_trading"],
                stats["with_domain"], stats["errors"],
            )

    elapsed = time.time() - start
    logger.info(
        "DONE in %.1fs | processed=%d aliases=%d trading=%d domains=%d errors=%d",
        elapsed, stats["processed"], stats["aliases_created"],
        stats["with_trading"], stats["with_domain"], stats["errors"],
    )
    return stats


async def main():
    parser = argparse.ArgumentParser(description="Build sponsor name aliases")
    parser.add_argument("--tier", type=int, default=1, help="Enrichment tier (1-4)")
    parser.add_argument("--limit", type=int, default=500, help="Max sponsors to process")
    args = parser.parse_args()

    sb = await get_supabase()

    # Check table exists
    table_ok = await ensure_aliases_table(sb)
    if not table_ok:
        logger.error("Please create the table first, then re-run this script.")
        return

    # Get CH API key if available
    ch_api_key = os.environ.get("COMPANIES_HOUSE_API_KEY")
    if ch_api_key:
        logger.info("Companies House API key found — will fetch previous names")
    else:
        logger.info("No CH API key — skipping previous name lookups")

    sponsors = await fetch_sponsors_for_tier(sb, args.tier, args.limit)
    logger.info("Got %d sponsors for Tier %d", len(sponsors), args.tier)

    if not sponsors:
        logger.info("No sponsors to process")
        return

    await enrich_aliases(sb, sponsors, ch_api=ch_api_key)


if __name__ == "__main__":
    asyncio.run(main())
