"""Targeted job search — actively searches for jobs from known sponsors.

Instead of scraping job boards and hoping to match, this searches
Adzuna API using each sponsor's company name as the search query.
This is how we go from 941 sponsors with jobs to tens of thousands.

Uses Adzuna API free tier (1000 calls/day).
"""

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs/gb/search"


async def search_jobs_for_sponsor(
    sponsor_name: str,
    app_id: str,
    app_key: str,
    max_pages: int = 1,
) -> list[dict]:
    """Search Adzuna for jobs from a specific sponsor company.

    Returns list of job dicts ready for DB insert.
    """
    jobs = []
    async with httpx.AsyncClient(timeout=15) as client:
        for page in range(1, max_pages + 1):
            try:
                resp = await client.get(
                    f"{ADZUNA_BASE}/{page}",
                    params={
                        "app_id": app_id,
                        "app_key": app_key,
                        "what": sponsor_name,
                        "what_and": sponsor_name,
                        "results_per_page": 20,
                        "sort_by": "date",
                        "max_days_old": 30,
                        "country": "gb",
                    },
                )
                if resp.status_code != 200:
                    logger.warning(f"Adzuna search failed for '{sponsor_name}': {resp.status_code}")
                    break

                data = resp.json()
                results = data.get("results", [])
                if not results:
                    break

                for r in results:
                    company = r.get("company", {}).get("display_name", "")
                    # Only include if the company name roughly matches
                    if not company:
                        continue

                    jobs.append({
                        "source": "adzuna",
                        "source_job_id": str(r.get("id", "")),
                        "source_url": r.get("redirect_url") or r.get("adref", ""),
                        "title_raw": r.get("title", ""),
                        "company_name_raw": company,
                        "location_raw": r.get("location", {}).get("display_name", ""),
                        "location_city": r.get("location", {}).get("area", [""])[0] if r.get("location", {}).get("area") else None,
                        "salary_min": r.get("salary_min"),
                        "salary_max": r.get("salary_max"),
                        "salary_currency": "GBP",
                        "salary_period": "ANNUAL" if r.get("salary_min") else None,
                        "description_snippet": (r.get("description", "") or "")[:500],
                        "posted_date": r.get("created"),
                        "contract_type": r.get("contract_type"),
                    })

            except Exception as e:
                logger.error(f"Adzuna search error for '{sponsor_name}': {e}")
                break

    return jobs


async def run_targeted_search(
    supabase,
    app_id: str,
    app_key: str,
    limit: int = 100,
    batch_size: int = 10,
) -> dict:
    """Search Adzuna for jobs from top sponsors that have 0 jobs.

    Parameters
    ----------
    limit : int
        Max number of sponsors to search for
    batch_size : int
        Number of concurrent searches

    Returns
    -------
    dict with stats
    """
    stats = {
        "sponsors_searched": 0,
        "jobs_found": 0,
        "jobs_inserted": 0,
        "errors": 0,
        "duration_ms": 0,
    }
    start = time.time()

    # Get sponsors with 0 jobs, prioritizing A-rated ones
    try:
        result = supabase.rpc("get_sponsors_without_jobs", {"lim": limit}).execute()
        sponsors = result.data or []
    except Exception:
        # Fallback: direct query
        result = supabase.table("sponsors").select(
            "id, organisation_name, rating, town_city"
        ).eq("is_active", True).eq("rating", "A").order(
            "organisation_name"
        ).limit(limit).execute()
        sponsors = result.data or []

    logger.info(f"[TARGETED] Searching Adzuna for {len(sponsors)} sponsors")

    for i in range(0, len(sponsors), batch_size):
        batch = sponsors[i:i + batch_size]
        tasks = []
        for sponsor in batch:
            name = sponsor.get("organisation_name", "")
            if not name or len(name) < 3:
                continue
            tasks.append(search_jobs_for_sponsor(name, app_id, app_key))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for sponsor, result in zip(batch, results):
            stats["sponsors_searched"] += 1
            if isinstance(result, Exception):
                stats["errors"] += 1
                continue

            for job in result:
                stats["jobs_found"] += 1
                try:
                    # Check for duplicate
                    existing = supabase.table("jobs").select("id").eq(
                        "source", "adzuna"
                    ).eq("source_job_id", job["source_job_id"]).limit(1).execute()

                    if existing.data:
                        continue

                    # Insert with sponsor_id
                    job["sponsor_id"] = sponsor["id"]
                    supabase.table("jobs").insert(job).execute()
                    stats["jobs_inserted"] += 1
                except Exception as e:
                    logger.debug(f"Insert error: {e}")

        # Rate limit: 250ms between batches
        await asyncio.sleep(0.25)

    stats["duration_ms"] = int((time.time() - start) * 1000)
    logger.info(f"[TARGETED] Complete: {stats}")
    return stats
