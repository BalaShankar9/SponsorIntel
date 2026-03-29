#!/usr/bin/env python3
"""
SponsorIntel Army Deployment Script
====================================
Deploys all 56 employees to gather complete company and job data.

Runs directly against Supabase — no Docker/Celery needed.

Usage:
    cd backend
    source .venv/bin/activate
    python deploy_army.py
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone, timedelta

# Setup
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ARMY")

# Supabase client
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def banner(text: str):
    width = 60
    logger.info("=" * width)
    logger.info(f"  {text}")
    logger.info("=" * width)


async def phase_1_free_api_scraping():
    """Phase 1: Aria Singh's team — scrape all free API job sources."""
    banner("PHASE 1: Aria Singh — Job Sourcing (Free APIs)")

    # Import free API scrapers
    scrapers = []
    scraper_configs = [
        # Fast sources first, remotive skipped (returns 0 UK jobs)
        ("devitjobs", "app.scrapers.devitjobs_api", "DevITJobsAPIScraper"),
        ("hn_hiring", "app.scrapers.hn_hiring_api", "HNHiringAPIScraper"),
        ("himalayas", "app.scrapers.himalayas_api", "HimalayasAPIScraper"),
        ("remoteok", "app.scrapers.remoteok_api", "RemoteOKAPIScraper"),
        ("arbeitnow", "app.scrapers.arbeitnow_api", "ArbeitnowAPIScraper"),
        ("jobicy", "app.scrapers.jobicy_api", "JobicyAPIScraper"),
    ]

    # Search keywords focused on UK sponsorship
    keywords = [
        "visa sponsorship",
        "software engineer",
        "data engineer",
        "nurse",
        "accountant",
    ]

    total_found = 0
    total_inserted = 0

    # Pre-load all existing source_job_ids to avoid per-job HTTP lookups
    logger.info("  Loading existing job IDs for dedup...")
    existing_ids = set()
    page = 0
    while True:
        batch = sb.table("jobs").select("source, source_job_id").range(
            page * 1000, (page + 1) * 1000 - 1
        ).execute()
        if not batch.data:
            break
        for j in batch.data:
            if j.get("source_job_id"):
                existing_ids.add(f"{j['source']}:{j['source_job_id']}")
        if len(batch.data) < 1000:
            break
        page += 1
    logger.info(f"  Loaded {len(existing_ids)} existing job IDs")

    for source_name, module_path, class_name in scraper_configs:
        try:
            import importlib
            module = importlib.import_module(module_path)
            scraper_cls = getattr(module, class_name)
            scraper = scraper_cls()

            source_jobs = 0
            skipped = 0
            logger.info(f"  [{source_name.upper()}] Starting scrape...")

            for keyword in keywords:
                try:
                    results = await scraper.scrape(keyword=keyword, location="United Kingdom")
                    if not results:
                        continue

                    new_jobs = []
                    for job in results:
                        title = job.get("title") or job.get("title_raw") or ""
                        company = job.get("company") or job.get("company_name_raw") or job.get("company_name") or ""
                        if not title or not company:
                            continue

                        source_job_id = str(job.get("source_job_id") or job.get("id") or "")
                        dedup_key = f"{source_name}:{source_job_id}"

                        if dedup_key in existing_ids:
                            skipped += 1
                            continue

                        new_jobs.append({
                            "source": source_name,
                            "source_job_id": source_job_id or None,
                            "source_url": job.get("url") or job.get("source_url"),
                            "title_raw": title,
                            "company_name_raw": company,
                            "location_raw": job.get("location") or job.get("location_raw"),
                            "location_city": job.get("location_city"),
                            "location_is_remote": job.get("remote", False) or job.get("location_is_remote", False),
                            "salary_min": job.get("salary_min"),
                            "salary_max": job.get("salary_max"),
                            "salary_currency": job.get("salary_currency", "GBP"),
                            "salary_text_raw": job.get("salary_text") or job.get("salary_text_raw"),
                            "description_full": job.get("description") or job.get("description_full"),
                            "description_snippet": (job.get("description") or job.get("description_full") or "")[:500],
                            "contract_type": job.get("contract_type") or job.get("employment_type"),
                            "posted_date": job.get("posted_date") or job.get("publication_date"),
                            "scraped_at": datetime.now(timezone.utc).isoformat(),
                            "first_seen_at": datetime.now(timezone.utc).isoformat(),
                            "last_seen_at": datetime.now(timezone.utc).isoformat(),
                        })
                        existing_ids.add(dedup_key)

                    # Batch insert new jobs
                    if new_jobs:
                        try:
                            sb.table("jobs").insert(new_jobs).execute()
                            source_jobs += len(new_jobs)
                            total_inserted += len(new_jobs)
                        except Exception as e:
                            # Fall back to one-by-one on batch failure
                            for record in new_jobs:
                                try:
                                    sb.table("jobs").insert(record).execute()
                                    source_jobs += 1
                                    total_inserted += 1
                                except Exception:
                                    pass

                    total_found += len(results)

                except Exception as e:
                    logger.debug(f"    [{source_name}] Keyword '{keyword}' error: {str(e)[:100]}")
                    continue

                await asyncio.sleep(0.5)

            logger.info(f"  [{source_name.upper()}] Done — {source_jobs} new, {skipped} existing")

        except Exception as e:
            logger.warning(f"  [{source_name.upper()}] Scraper failed: {str(e)[:200]}")
            continue

        await asyncio.sleep(1)

    logger.info(f"  PHASE 1 COMPLETE: {total_found} found, {total_inserted} new jobs inserted")
    return {"found": total_found, "inserted": total_inserted}


async def phase_2_reed_adzuna():
    """Phase 2: Nadia Osman — scrape API-key sources (Reed, Adzuna)."""
    banner("PHASE 2: Nadia Osman — Premium API Sources")

    reed_key = os.getenv("REED_API_KEY", "")
    adzuna_id = os.getenv("ADZUNA_APP_ID", "")
    adzuna_key = os.getenv("ADZUNA_APP_KEY", "")

    total_inserted = 0

    if reed_key:
        try:
            from app.scrapers.reed_api import ReedAPIScraper
            scraper = ReedAPIScraper()
            keywords = ["visa sponsorship", "skilled worker visa", "sponsor"]
            for kw in keywords:
                results = await scraper.scrape(keyword=kw, location="United Kingdom")
                for job in (results or []):
                    title = job.get("title") or job.get("title_raw") or ""
                    company = job.get("company") or job.get("company_name_raw") or ""
                    if not title or not company:
                        continue
                    record = {
                        "source": "reed_api",
                        "source_job_id": str(job.get("source_job_id", "")),
                        "source_url": job.get("url") or job.get("source_url"),
                        "title_raw": title,
                        "company_name_raw": company,
                        "location_raw": job.get("location") or job.get("location_raw"),
                        "salary_min": job.get("salary_min"),
                        "salary_max": job.get("salary_max"),
                        "description_full": job.get("description") or job.get("description_full"),
                        "description_snippet": (job.get("description") or "")[:500],
                        "scraped_at": datetime.now(timezone.utc).isoformat(),
                        "first_seen_at": datetime.now(timezone.utc).isoformat(),
                        "last_seen_at": datetime.now(timezone.utc).isoformat(),
                    }
                    try:
                        sb.table("jobs").insert(record).execute()
                        total_inserted += 1
                    except Exception:
                        pass
                await asyncio.sleep(2)
            logger.info(f"  [REED] {total_inserted} jobs inserted")
        except Exception as e:
            logger.warning(f"  [REED] Failed: {str(e)[:200]}")
    else:
        logger.info("  [REED] Skipped — no REED_API_KEY set")

    if adzuna_id and adzuna_key:
        try:
            from app.scrapers.adzuna_api import AdzunaAPIScraper
            scraper = AdzunaAPIScraper()
            results = await scraper.scrape(keyword="visa sponsorship", location="United Kingdom")
            adzuna_count = 0
            for job in (results or []):
                title = job.get("title") or job.get("title_raw") or ""
                company = job.get("company") or job.get("company_name_raw") or ""
                if not title or not company:
                    continue
                record = {
                    "source": "adzuna",
                    "source_url": job.get("url") or job.get("source_url"),
                    "title_raw": title,
                    "company_name_raw": company,
                    "location_raw": job.get("location") or job.get("location_raw"),
                    "salary_min": job.get("salary_min"),
                    "salary_max": job.get("salary_max"),
                    "description_snippet": (job.get("description") or "")[:500],
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "first_seen_at": datetime.now(timezone.utc).isoformat(),
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                }
                try:
                    sb.table("jobs").insert(record).execute()
                    adzuna_count += 1
                except Exception:
                    pass
            logger.info(f"  [ADZUNA] {adzuna_count} jobs inserted")
            total_inserted += adzuna_count
        except Exception as e:
            logger.warning(f"  [ADZUNA] Failed: {str(e)[:200]}")
    else:
        logger.info("  [ADZUNA] Skipped — no ADZUNA_APP_ID/KEY set")

    logger.info(f"  PHASE 2 COMPLETE: {total_inserted} premium API jobs inserted")
    return {"inserted": total_inserted}


async def phase_3_entity_resolution():
    """Phase 3: Declan Murphy — match jobs to sponsor companies."""
    banner("PHASE 3: Declan Murphy — Entity Resolution")

    # Load sponsor cache
    logger.info("  Loading sponsor name cache...")
    cache = {}
    page = 0
    while True:
        result = sb.table("sponsors").select(
            "id, organisation_name"
        ).range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not result.data:
            break
        for s in result.data:
            name = s["organisation_name"].strip().upper()
            cache[name] = s["id"]
            # Also add without common suffixes
            for suffix in [" LIMITED", " LTD", " PLC", " LLP", " INC", " CORP"]:
                if name.endswith(suffix):
                    cache[name[:-len(suffix)].strip()] = s["id"]
        if len(result.data) < 1000:
            break
        page += 1

    logger.info(f"  Loaded {len(cache)} sponsor name variants")

    # Match unmatched jobs
    unmatched = sb.table("jobs").select(
        "id, company_name_raw"
    ).is_("sponsor_id", "null").limit(5000).execute()

    matched_count = 0
    for job in (unmatched.data or []):
        company = (job.get("company_name_raw") or "").strip().upper()
        sponsor_id = cache.get(company)

        # Try without suffixes
        if not sponsor_id:
            for suffix in [" LIMITED", " LTD", " PLC", " LLP", " INC", " CORP"]:
                if company.endswith(suffix):
                    sponsor_id = cache.get(company[:-len(suffix)].strip())
                    if sponsor_id:
                        break

        if sponsor_id:
            try:
                sb.table("jobs").update({
                    "sponsor_id": sponsor_id,
                    "sponsorship_likelihood": 75,  # On the register = high likelihood
                }).eq("id", job["id"]).execute()
                matched_count += 1
            except Exception:
                pass

    logger.info(f"  PHASE 3 COMPLETE: {matched_count}/{len(unmatched.data or [])} jobs matched to sponsors")
    return {"matched": matched_count, "total": len(unmatched.data or [])}


async def phase_4_sponsorship_scoring():
    """Phase 4: Priya Kapoor's team — score all jobs for sponsorship likelihood."""
    banner("PHASE 4: Priya Kapoor — Sponsorship Scoring")

    # Sponsorship signal keywords
    POSITIVE_SIGNALS = [
        "visa sponsorship", "sponsor visa", "skilled worker",
        "certificate of sponsorship", "cos", "sponsorship available",
        "willing to sponsor", "can sponsor", "will sponsor",
        "international candidates", "overseas candidates",
        "right to work assistance", "immigration support",
        "tier 2", "work permit",
    ]

    NEGATIVE_SIGNALS = [
        "no sponsorship", "cannot sponsor", "won't sponsor",
        "must have right to work", "no visa", "uk residents only",
        "british passport", "eu passport only",
    ]

    # Get unscored jobs
    unscored = sb.table("jobs").select(
        "id, title_raw, description_full, description_snippet, company_name_raw, sponsor_id, salary_min"
    ).is_("sponsorship_likelihood", "null").limit(5000).execute()

    scored_count = 0
    for job in (unscored.data or []):
        text = f"{job.get('title_raw', '')} {job.get('description_full', '') or job.get('description_snippet', '')}".lower()

        score = 15  # Base score
        signals = []

        # Positive signals
        for signal in POSITIVE_SIGNALS:
            if signal in text:
                score += 15
                signals.append(f"+{signal}")

        # Negative signals
        for signal in NEGATIVE_SIGNALS:
            if signal in text:
                score -= 30
                signals.append(f"-{signal}")

        # On sponsor register bonus
        if job.get("sponsor_id"):
            score += 25
            signals.append("+on_register")

        # Salary threshold (skilled worker minimum ~£26,200 for 2025)
        salary_min = job.get("salary_min")
        if salary_min and salary_min >= 26200:
            score += 10
            signals.append("+meets_salary_threshold")

        # Clamp
        score = max(0, min(100, score))

        try:
            sb.table("jobs").update({
                "sponsorship_likelihood": score,
                "sponsorship_signals": signals,
            }).eq("id", job["id"]).execute()
            scored_count += 1
        except Exception:
            pass

    logger.info(f"  PHASE 4 COMPLETE: {scored_count} jobs scored for sponsorship likelihood")
    return {"scored": scored_count}


async def phase_5_company_enrichment():
    """Phase 5: Elena Volkov — check which companies have enriched profiles."""
    banner("PHASE 5: Elena Volkov — Company Profile Status")

    result = {}
    total = sb.table("company_profiles").select("id", count="exact", head=True).execute()
    result["total"] = total.count
    logger.info(f"  Total profiles:     {total.count}")

    # Check each column — some may not exist yet
    for col_name, label in [
        ("website_url", "With website"),
        ("linkedin_url", "With LinkedIn"),
        ("careers_url", "With careers page"),
        ("companies_house_number", "With CH number"),
    ]:
        try:
            r = sb.table("company_profiles").select("id", count="exact", head=True).not_.is_(col_name, "null").execute()
            result[col_name] = r.count
            logger.info(f"  {label:20s} {r.count}")
        except Exception:
            logger.info(f"  {label:20s} (column not yet created)")
            result[col_name] = 0

    return result


async def phase_6_final_report():
    """Phase 6: Raj Patel — final status report."""
    banner("PHASE 6: Raj Patel — Final Status Report")

    jobs_total = sb.table("jobs").select("id", count="exact", head=True).execute()
    jobs_scored = sb.table("jobs").select("id", count="exact", head=True).not_.is_("sponsorship_likelihood", "null").execute()
    jobs_matched = sb.table("jobs").select("id", count="exact", head=True).not_.is_("sponsor_id", "null").execute()
    jobs_high = sb.table("jobs").select("id", count="exact", head=True).gte("sponsorship_likelihood", 60).execute()
    sponsors = sb.table("sponsors").select("id", count="exact", head=True).execute()

    # Jobs by source
    recent = sb.table("jobs").select("source").order("first_seen_at", desc=True).limit(5000).execute()
    by_source = {}
    for j in (recent.data or []):
        src = j.get("source", "unknown")
        by_source[src] = by_source.get(src, 0) + 1

    logger.info(f"")
    logger.info(f"  TOTAL SPONSORS:        {sponsors.count:,}")
    logger.info(f"  TOTAL JOBS:            {jobs_total.count:,}")
    logger.info(f"  JOBS SCORED:           {jobs_scored.count:,}")
    logger.info(f"  JOBS MATCHED:          {jobs_matched.count:,}")
    logger.info(f"  HIGH LIKELIHOOD (60+): {jobs_high.count:,}")
    logger.info(f"")
    logger.info(f"  JOBS BY SOURCE:")
    for src, count in sorted(by_source.items(), key=lambda x: -x[1]):
        logger.info(f"    {src:25s} {count:,}")

    return {
        "total_sponsors": sponsors.count,
        "total_jobs": jobs_total.count,
        "scored": jobs_scored.count,
        "matched": jobs_matched.count,
        "high_likelihood": jobs_high.count,
        "by_source": by_source,
    }


async def main():
    start = time.time()

    banner("SPONSORINTEL ARMY DEPLOYMENT")
    logger.info("  56 employees reporting for duty")
    logger.info(f"  Supabase: {SUPABASE_URL[:40]}...")
    logger.info("")

    # Initial count
    initial_jobs = sb.table("jobs").select("id", count="exact", head=True).execute()
    logger.info(f"  Starting job count: {initial_jobs.count}")

    # Deploy phases
    p1 = await phase_1_free_api_scraping()
    p2 = await phase_2_reed_adzuna()
    p3 = await phase_3_entity_resolution()
    p4 = await phase_4_sponsorship_scoring()
    p5 = await phase_5_company_enrichment()
    report = await phase_6_final_report()

    elapsed = time.time() - start
    banner(f"DEPLOYMENT COMPLETE — {elapsed:.0f}s")
    logger.info(f"  New jobs added: {p1.get('inserted', 0) + p2.get('inserted', 0)}")
    logger.info(f"  Jobs matched to sponsors: {p3.get('matched', 0)}")
    logger.info(f"  Jobs scored: {p4.get('scored', 0)}")
    logger.info(f"  Total jobs now: {report.get('total_jobs', 0)}")


if __name__ == "__main__":
    asyncio.run(main())
