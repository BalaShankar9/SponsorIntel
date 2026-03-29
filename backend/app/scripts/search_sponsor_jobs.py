"""
Targeted Sponsor Job Search.

Instead of searching by keyword ("visa sponsorship"), this searches job boards
BY COMPANY NAME for sponsors we know have a licence. Uses both registered names
and trading names from `company_profiles.name_variants`.

This is how we find jobs that never mention "sponsorship" in the listing but are
posted by companies with active sponsor licences.

Strategy:
1. Pick top sponsors (A-rated, major cities, recently active)
2. For each sponsor, get their registered name AND trading name
3. Search free job board APIs (Adzuna, Reed API, TheMuse) by company name
4. Match results back to the sponsor and save with sponsor_id pre-linked

Usage:
    python -m app.scripts.search_sponsor_jobs [--limit 200] [--source adzuna]
"""

import argparse
import asyncio
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sponsor_job_search")

# Free API sources that support company name search
SEARCHABLE_SOURCES = {
    "adzuna": {
        "module": "app.scrapers.adzuna_api",
        "class": "AdzunaAPIScraper",
        "search_method": "search_by_company",
    },
    "reed_api": {
        "module": "app.scrapers.reed_api",
        "class": "ReedAPIScraper",
        "search_method": "search_by_company",
    },
}


def normalize_company(name: str) -> str:
    """Normalize company name."""
    if not name:
        return ""
    n = name.upper().strip()
    changed = True
    while changed:
        changed = False
        for suffix in [
            " LIMITED", " LTD", " LTD.", " PLC", " LLP", " LP", " INC",
            " INC.", " LLC", " CORPORATION", " CORP", " CORP.",
            " CO.", " CO", " CIC", " C.I.C", " C.I.C.",
            " UK", " (UK)", " GROUP", " HOLDINGS", " INTERNATIONAL",
            " SERVICES", " SOLUTIONS", " CONSULTING",
        ]:
            if n.endswith(suffix):
                n = n[:-len(suffix)]
                changed = True
    n = re.sub(r"[^A-Z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


async def get_supabase():
    """Get Supabase client."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


async def get_top_sponsors(sb, limit: int = 200) -> list[dict]:
    """
    Get top sponsors to search for jobs.

    Priority: A-rated sponsors with known trading names in major cities.
    """
    logger.info("Fetching top sponsors for targeted search...")

    # Get sponsors that have name_variants with trading names
    sponsors_with_trading = []
    page = 0
    batch_size = 500

    while len(sponsors_with_trading) < limit:
        resp = sb.table("sponsors").select(
            "id, organisation_name, organisation_name_normalised, town_city, rating"
        ).eq("is_active", True).eq("rating", "A").range(
            page * batch_size, (page + 1) * batch_size - 1
        ).execute()

        if not resp.data:
            break

        for sponsor in resp.data:
            # Look up name variants for this sponsor
            profile_resp = sb.table("company_profiles").select(
                "name_variants"
            ).eq("sponsor_id", sponsor["id"]).limit(1).execute()

            variants = {}
            if profile_resp.data:
                variants = profile_resp.data[0].get("name_variants") or {}

            trading_name = variants.get("trading_name")
            search_names = set()

            # Always search by normalized registered name
            norm = sponsor.get("organisation_name_normalised") or normalize_company(
                sponsor["organisation_name"]
            )
            if norm:
                search_names.add(norm)

            # Also search by trading name if different
            if trading_name:
                search_names.add(trading_name.strip())
                search_names.add(normalize_company(trading_name))

            sponsors_with_trading.append({
                "id": sponsor["id"],
                "organisation_name": sponsor["organisation_name"],
                "search_names": list(search_names),
                "town_city": sponsor.get("town_city"),
            })

            if len(sponsors_with_trading) >= limit:
                break

        if len(resp.data) < batch_size:
            break
        page += 1

    logger.info("Got %d sponsors for targeted search", len(sponsors_with_trading))
    return sponsors_with_trading


async def search_adzuna_for_company(company_name: str, location: str = "uk") -> list[dict]:
    """Search Adzuna API by company name."""
    import httpx

    app_id = os.environ.get("ADZUNA_APP_ID")
    app_key = os.environ.get("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://api.adzuna.com/v1/api/jobs/gb/search/1",
                params={
                    "app_id": app_id,
                    "app_key": app_key,
                    "what_and": company_name,
                    "where": location if location != "uk" else "",
                    "results_per_page": 20,
                    "sort_by": "date",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("results", [])
    except Exception as e:
        logger.debug("Adzuna search error for '%s': %s", company_name, str(e)[:80])

    return []


async def search_jobs_for_sponsors(sb, sponsors: list[dict]):
    """Search for jobs posted by each sponsor across free APIs."""
    now = datetime.now(timezone.utc).isoformat()
    stats = {
        "sponsors_searched": 0,
        "jobs_found": 0,
        "jobs_saved": 0,
        "duplicates": 0,
        "errors": 0,
    }
    start = time.time()

    for i, sponsor in enumerate(sponsors):
        sid = sponsor["id"]
        search_names = sponsor["search_names"]

        for search_name in search_names[:2]:  # Max 2 names per sponsor
            results = await search_adzuna_for_company(search_name)

            for raw_job in results:
                stats["jobs_found"] += 1

                title = raw_job.get("title", "")
                company = raw_job.get("company", {}).get("display_name", "")
                job_id = raw_job.get("id", "")

                if not title:
                    continue

                # Verify the company name actually matches our sponsor
                company_norm = normalize_company(company)
                sponsor_norm = normalize_company(sponsor["organisation_name"])
                name_match = (
                    company_norm == sponsor_norm
                    or company_norm.startswith(sponsor_norm)
                    or sponsor_norm.startswith(company_norm)
                    or normalize_company(search_name) in company_norm
                )

                if not name_match:
                    continue

                # Dedup check
                source_job_id = f"adzuna-{job_id}" if job_id else ""
                if source_job_id:
                    existing = sb.table("jobs").select("id").eq(
                        "source", "adzuna"
                    ).eq("source_job_id", source_job_id).execute()
                    if existing.data:
                        stats["duplicates"] += 1
                        continue

                # Sponsorship scoring — this job is from a known sponsor
                description = raw_job.get("description", "")
                text = f"{title} {description}".lower()
                score = 40  # Base score: company is on sponsor register
                signals = ["+sponsor_register_match"]

                POSITIVE = ["visa sponsorship", "sponsor visa", "skilled worker",
                           "sponsorship available", "willing to sponsor"]
                for sig in POSITIVE:
                    if sig in text:
                        score += 15
                        signals.append(f"+{sig}")

                score = min(100, score)

                try:
                    record = {
                        "source": "adzuna",
                        "source_job_id": source_job_id or None,
                        "source_url": raw_job.get("redirect_url"),
                        "title_raw": title,
                        "company_name_raw": company,
                        "company_name_normalised": company_norm,
                        "location_raw": raw_job.get("location", {}).get("display_name"),
                        "salary_min": raw_job.get("salary_min"),
                        "salary_max": raw_job.get("salary_max"),
                        "salary_currency": "GBP",
                        "description_snippet": description[:500] if description else None,
                        "sponsor_id": sid,
                        "sponsorship_likelihood": score,
                        "sponsorship_signals": signals,
                        "posted_date": raw_job.get("created"),
                        "scraped_at": now,
                        "first_seen_at": now,
                        "last_seen_at": now,
                    }
                    sb.table("jobs").insert(record).execute()
                    stats["jobs_saved"] += 1
                except Exception as e:
                    if "duplicate" not in str(e).lower():
                        stats["errors"] += 1
                        if stats["errors"] <= 5:
                            logger.warning("Insert error: %s", str(e)[:80])

            # Rate limiting
            await asyncio.sleep(0.5)

        stats["sponsors_searched"] += 1

        if (i + 1) % 50 == 0:
            elapsed = time.time() - start
            logger.info(
                "Progress: %d/%d sponsors, %d found, %d saved, %d dupes (%.1fs)",
                i + 1, len(sponsors), stats["jobs_found"],
                stats["jobs_saved"], stats["duplicates"], elapsed,
            )

    return stats


async def main():
    parser = argparse.ArgumentParser(description="Search for jobs by sponsor name")
    parser.add_argument("--limit", type=int, default=200, help="Max sponsors to search")
    args = parser.parse_args()

    logger.info("=== TARGETED SPONSOR JOB SEARCH ===")

    sb = await get_supabase()
    sponsors = await get_top_sponsors(sb, args.limit)

    if not sponsors:
        logger.info("No sponsors to search")
        return

    start = time.time()
    stats = await search_jobs_for_sponsors(sb, sponsors)
    elapsed = time.time() - start

    logger.info("\n=== SEARCH COMPLETE (%.1fs) ===", elapsed)
    for k, v in stats.items():
        logger.info("  %s: %d", k, v)


if __name__ == "__main__":
    asyncio.run(main())
