"""
Celery tasks for scraping, enrichment, scoring, and alerting.

Each task is designed to run independently and handles its own
database session lifecycle and error handling.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Redis channel for real-time job notifications
JOBS_CHANNEL = "new_jobs"


def _run_async(coro):
    """Run an async coroutine in a new event loop (for Celery tasks)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_session():
    """Create a fresh async session factory for Celery worker processes.

    asyncpg connections are not fork-safe, so the module-level engine
    from app.core.database can't be reused across Celery prefork workers.
    Each call creates a fresh engine with its own connection pool.
    """
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from app.core.config import get_settings

    settings = get_settings()
    task_engine = create_async_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=5,
        echo=False,
    )
    return async_sessionmaker(task_engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Scraper registry
# ---------------------------------------------------------------------------

SCRAPER_MAP = {
    "reed": "app.scrapers.reed.ReedScraper",
    "adzuna": "app.scrapers.adzuna_api.AdzunaAPIScraper",
    "jooble": "app.scrapers.jooble_api.JoobleAPIScraper",
    "indeed": "app.scrapers.indeed.IndeedScraper",
    "linkedin": "app.scrapers.linkedin_jobs.LinkedInJobsScraper",
    "totaljobs": "app.scrapers.totaljobs.TotalJobsScraper",
    "cwjobs": "app.scrapers.cwjobs.CWJobsScraper",
    "findajob": "app.scrapers.gov_findajob.FindAJobScraper",
    "nhs": "app.scrapers.nhs_jobs.NHSJobsScraper",
    "glassdoor": "app.scrapers.glassdoor_jobs.GlassdoorJobsScraper",
    "guardian": "app.scrapers.guardian_jobs.GuardianJobsScraper",
    "reed_api": "app.scrapers.reed_api.ReedAPIScraper",
    "remotive": "app.scrapers.remotive_api.RemotiveAPIScraper",
    "arbeitnow": "app.scrapers.arbeitnow_api.ArbeitnowAPIScraper",
    "jobicy": "app.scrapers.jobicy_api.JobicyAPIScraper",
    "themuse": "app.scrapers.themuse_api.TheMuseAPIScraper",
    "himalayas": "app.scrapers.himalayas_api.HimalayasAPIScraper",
    "remoteok": "app.scrapers.remoteok_api.RemoteOKAPIScraper",
    "wwr": "app.scrapers.wwr_rss.WWRRSSScraper",
    "teaching_vacancies": "app.scrapers.teaching_vacancies_api.TeachingVacanciesAPIScraper",
    "devitjobs": "app.scrapers.devitjobs_api.DevITJobsAPIScraper",
    "hn_hiring": "app.scrapers.hn_hiring_api.HNHiringAPIScraper",
    "charityjob": "app.scrapers.charityjob_feed.CharityJobFeedScraper",
    "career_page": "app.scrapers.career_page_scraper.CareerPageScraper",
    # NEW sources
    "jobs_ac_uk": "app.scrapers.jobsac_rss.JobsAcUKScraper",
    "workinstartups": "app.scrapers.workinstartups_rss.WorkInStartupsScraper",
    "nofluffjobs": "app.scrapers.nofluffjobs_api.NoFluffJobsAPIScraper",
    "escapecity": "app.scrapers.escapecity_rss.EscapeCityScraper",
    "cvlibrary": "app.scrapers.cvlibrary_scraper.CVLibraryScraper",
    "efinancial": "app.scrapers.efinancial_scraper.EFinancialScraper",
    "bmj_careers": "app.scrapers.bmj_scraper.BMJCareersScraper",
    "civilservice": "app.scrapers.civilservice_scraper.CivilServiceScraper",
}

# Default search keywords for job scraping — sponsorship-first strategy.
# Sponsorship-specific terms are prioritised to surface jobs that explicitly
# offer visa sponsorship, followed by shortage occupations and high-demand roles.
DEFAULT_KEYWORDS = [
    # Sponsorship-specific (highest priority)
    "visa sponsorship",
    "skilled worker visa",
    "sponsor visa",
    "tier 2 visa",
    "certificate of sponsorship",
    "sponsorship available",
    "international candidates welcome",
    # UK shortage occupations
    "software engineer",
    "data engineer",
    "registered nurse",
    "care worker",
    "civil engineer",
    "accountant",
    "teacher",
    "pharmacist",
    "chef",
    "mechanical engineer",
    # High-demand professional roles
    "data analyst",
    "project manager",
    "business analyst",
    "devops engineer",
    "product manager",
    "full stack developer",
    "healthcare assistant",
    "quantity surveyor",
    "financial analyst",
    "machine learning engineer",
]


def _get_scraper_class(source: str):
    """Dynamically import and return the scraper class for a source."""
    import importlib

    dotted_path = SCRAPER_MAP.get(source)
    if not dotted_path:
        raise ValueError(f"Unknown scraper source: {source}")

    module_path, class_name = dotted_path.rsplit(".", 1)
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


# ---------------------------------------------------------------------------
# Quick sponsor matching for inline job processing
# ---------------------------------------------------------------------------

# Module-level cache for sponsor matching (rebuilt periodically)
_sponsor_match_cache = {"norm": {}, "built_at": 0}


def _quick_match_sponsor(sb, company_name: str) -> Optional[str]:
    """
    Fast inline sponsor match using a cached normalized-name index.

    The cache rebuilds every 30 minutes to pick up new sponsors/variants.
    Falls back to a direct DB query if cache is empty.
    """
    import re as _re
    import time as _time

    if not company_name or not company_name.strip():
        return None

    # Normalize the company name (loop to strip multiple suffixes)
    norm = company_name.upper().strip()
    changed = True
    while changed:
        changed = False
        for suf in [" LIMITED", " LTD", " LTD.", " PLC", " LLP", " LP", " INC",
                    " INC.", " LLC", " CORPORATION", " CORP", " CORP.",
                    " CO.", " CO", " CIC", " C.I.C", " C.I.C.",
                    " UK", " (UK)", " GROUP", " HOLDINGS", " INTERNATIONAL",
                    " SERVICES", " SOLUTIONS", " CONSULTING"]:
            if norm.endswith(suf):
                norm = norm[:-len(suf)]
                changed = True
    norm = _re.sub(r"[^A-Z0-9 ]", "", norm)
    norm = _re.sub(r"\s+", " ", norm).strip()

    if not norm:
        return None

    # Build/refresh cache if stale (>30 min)
    now = _time.time()
    if now - _sponsor_match_cache["built_at"] > 1800 or not _sponsor_match_cache["norm"]:
        try:
            cache = {}
            page = 0
            while True:
                resp = sb.table("sponsors").select(
                    "id, organisation_name_normalised"
                ).range(page * 1000, (page + 1) * 1000 - 1).execute()
                if not resp.data:
                    break
                for row in resp.data:
                    raw_n = row.get("organisation_name_normalised")
                    if raw_n:
                        # Store both raw and re-normalized for maximum matching
                        cache[raw_n] = row["id"]
                        # Re-normalize to strip suffixes consistently
                        n2 = raw_n
                        _changed = True
                        while _changed:
                            _changed = False
                            for _s in [" LIMITED", " LTD", " PLC", " LLP", " LP",
                                       " INC", " LLC", " CORPORATION", " CORP",
                                       " UK", " GROUP", " HOLDINGS", " INTERNATIONAL"]:
                                if n2.endswith(_s):
                                    n2 = n2[:-len(_s)]
                                    _changed = True
                        n2 = _re.sub(r"[^A-Z0-9 ]", "", n2)
                        n2 = _re.sub(r"\s+", " ", n2).strip()
                        if n2 and n2 != raw_n:
                            cache[n2] = row["id"]
                if len(resp.data) < 1000:
                    break
                page += 1
            # Also load trading names from company_profiles
            page = 0
            while True:
                resp = sb.table("company_profiles").select(
                    "sponsor_id, name_variants"
                ).not_("name_variants", "is", "null").range(
                    page * 1000, (page + 1) * 1000 - 1
                ).execute()
                if not resp.data:
                    break
                for row in resp.data:
                    variants = row.get("name_variants") or {}
                    trading = variants.get("trading_name")
                    if trading and row.get("sponsor_id"):
                        tn = trading.upper().strip()
                        if tn:
                            cache[tn] = row["sponsor_id"]
                        tn_norm = _re.sub(r"[^A-Z0-9 ]", "", tn)
                        tn_norm = _re.sub(r"\s+", " ", tn_norm).strip()
                        if tn_norm and tn_norm != tn:
                            cache[tn_norm] = row["sponsor_id"]
                if len(resp.data) < 1000:
                    break
                page += 1
            _sponsor_match_cache["norm"] = cache
            _sponsor_match_cache["built_at"] = now
            logger.info("Sponsor match cache rebuilt: %d entries", len(cache))
        except Exception:
            pass

    cache = _sponsor_match_cache["norm"]

    # Exact match
    if norm in cache:
        return cache[norm]

    # Prefix match: check if any sponsor name starts with our normalized name
    if len(norm) >= 4:
        for sponsor_norm, sid in cache.items():
            if sponsor_norm.startswith(norm) and len(sponsor_norm) - len(norm) < 30:
                return sid

    return None


# ---------------------------------------------------------------------------
# Alert type to event type mapping
# ---------------------------------------------------------------------------

_ALERT_EVENT_MAP = {
    "new_sponsor": ["sponsor_added"],
    "rating_change": ["rating_change"],
    "new_job": ["new_job_detected"],
    "company_news": ["news_detected"],
    "risk_flag": ["risk_flag_raised"],
    "sponsor_removed": ["sponsor_removed"],
    "score_change": ["score_changed"],
}


# ---------------------------------------------------------------------------
# Task: Scrape GOV.UK Sponsor Register
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_register", bind=True, max_retries=3, default_retry_delay=300)
def scrape_register(self):
    """
    Sync the GOV.UK sponsor register CSV against our Supabase database.

    Downloads the latest CSV from gov.uk, diffs against existing sponsors,
    and applies changes: new sponsors, removals, rating changes, route changes.
    Creates empty company_profiles for new sponsors to queue them for enrichment.
    """
    try:
        return _run_async(_sync_register_async())
    except Exception as exc:
        logger.exception("scrape_register failed")
        self.retry(exc=exc, countdown=300)


async def _sync_register_async():
    from app.scripts.sync_register import download_register, sync, get_supabase

    records = await download_register()
    if not records:
        logger.warning("No records downloaded from GOV.UK register")
        return {"status": "no_data"}

    sb = await get_supabase()
    stats, changes = await sync(sb, records, dry_run=False)

    logger.info(
        "sync_register: register=%d new=%d removed=%d rating_changes=%d route_changes=%d errors=%d",
        len(records), stats["new_sponsors"], stats["removed_sponsors"],
        stats["rating_changes"], stats["route_changes"], stats["errors"],
    )

    return {
        "status": "synced",
        "register_size": len(records),
        **stats,
    }


# ---------------------------------------------------------------------------
# Task: Scrape Jobs from a Source
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_jobs", bind=True, max_retries=3, default_retry_delay=300)
def scrape_jobs(self, source: str):
    """
    Scrape jobs from a specific job board.

    Dispatches to the appropriate scraper, saves to Supabase directly.
    Falls back to PostgreSQL ORM if available.
    Circuit breaker: skips paused sources, records success/failure.
    """
    from app.agents.circuit_breaker import is_paused, record_success, record_failure

    # Circuit breaker check
    if is_paused(source):
        logger.info("scrape_jobs(%s) SKIPPED — source paused by circuit breaker", source)
        return {"status": "paused", "source": source}

    try:
        # Try Supabase-direct path first (works on Railway without PostgreSQL)
        result = _run_async(_scrape_jobs_supabase(source))
        record_success(source)
        return result
    except Exception as exc:
        error_msg = str(exc)[:500]
        was_paused = record_failure(source, error_msg)
        if was_paused:
            from app.agents.notifications import notify_source_paused
            notify_source_paused(source, error_msg)
        logger.exception("scrape_jobs(%s) failed", source)
        self.retry(exc=exc, countdown=600)


async def _scrape_jobs_supabase(source: str):
    """Scrape jobs and save directly to Supabase. No PostgreSQL needed."""
    from datetime import datetime, timezone
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        # Fallback to old PostgreSQL method
        return await _scrape_jobs_async(source)

    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    scraper_cls = _get_scraper_class(source)
    scraper = scraper_cls()

    total_scraped = 0
    total_saved = 0

    # Use fewer keywords for faster cycles
    keywords = DEFAULT_KEYWORDS[:8]

    for keyword in keywords:
        try:
            # Some scrapers have scrape_with_delay, others just scrape
            if hasattr(scraper, 'scrape_with_delay'):
                results = await scraper.scrape_with_delay(keyword=keyword, location="United Kingdom")
            else:
                results = await scraper.scrape(keyword=keyword, location="United Kingdom")
        except Exception as e:
            logger.warning("Error scraping %s for '%s': %s", source, keyword, str(e)[:200])
            continue

        if not results:
            continue

        total_scraped += len(results)

        for raw_job in results:
            try:
                title = raw_job.get("title") or raw_job.get("title_raw") or ""
                company = raw_job.get("company") or raw_job.get("company_name_raw") or raw_job.get("company_name") or ""
                if not title:
                    continue

                source_job_id = str(raw_job.get("source_job_id") or raw_job.get("id") or "")

                # Dedup check
                if source_job_id:
                    existing = sb.table("jobs").select("id").eq(
                        "source", source
                    ).eq("source_job_id", source_job_id).execute()
                    if existing.data:
                        # Update last_seen
                        sb.table("jobs").update({
                            "last_seen_at": datetime.now(timezone.utc).isoformat()
                        }).eq("id", existing.data[0]["id"]).execute()
                        continue

                # Sponsorship scoring
                description = raw_job.get("description_full", "") or raw_job.get("description_snippet", "") or raw_job.get("description", "") or ""
                text = f"{title} {description}".lower()
                score = 15
                signals = []

                POSITIVE = ["visa sponsorship", "sponsor visa", "skilled worker",
                           "certificate of sponsorship", "sponsorship available",
                           "willing to sponsor", "can sponsor", "will sponsor",
                           "international candidates", "overseas candidates"]
                NEGATIVE = ["no sponsorship", "cannot sponsor", "won't sponsor",
                           "must have right to work", "no visa", "uk residents only"]

                for sig in POSITIVE:
                    if sig in text:
                        score += 15
                        signals.append(f"+{sig}")
                for sig in NEGATIVE:
                    if sig in text:
                        score -= 30
                        signals.append(f"-{sig}")

                score = max(0, min(100, score))

                # Try to match company to sponsor immediately
                sponsor_id = _quick_match_sponsor(sb, company)

                # If matched to a sponsor, boost sponsorship score
                if sponsor_id:
                    score = max(score, 40)
                    signals.append("+sponsor_register_match")

                company_norm = company.upper().strip()
                import re as _re
                for suf in [" LIMITED", " LTD", " LTD.", " PLC", " LLP"]:
                    if company_norm.endswith(suf):
                        company_norm = company_norm[:-len(suf)]
                company_norm = _re.sub(r"[^A-Z0-9 ]", "", company_norm)
                company_norm = _re.sub(r"\s+", " ", company_norm).strip()

                record = {
                    "source": source,
                    "source_job_id": source_job_id or None,
                    "source_url": raw_job.get("url") or raw_job.get("source_url"),
                    "title_raw": title,
                    "company_name_raw": company,
                    "company_name_normalised": company_norm or None,
                    "location_raw": raw_job.get("location") or raw_job.get("location_raw"),
                    "location_is_remote": raw_job.get("remote", False) or raw_job.get("location_is_remote", False),
                    "salary_min": raw_job.get("salary_min"),
                    "salary_max": raw_job.get("salary_max"),
                    "salary_currency": raw_job.get("salary_currency", "GBP"),
                    "salary_text_raw": raw_job.get("salary_text") or raw_job.get("salary_text_raw"),
                    "description_full": description[:10000] if description else None,
                    "description_snippet": description[:500] if description else None,
                    "contract_type": raw_job.get("contract_type") or raw_job.get("employment_type"),
                    "posted_date": raw_job.get("posted_date") or raw_job.get("publication_date"),
                    "sponsor_id": sponsor_id,
                    "sponsorship_likelihood": score,
                    "sponsorship_signals": signals,
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "first_seen_at": datetime.now(timezone.utc).isoformat(),
                    "last_seen_at": datetime.now(timezone.utc).isoformat(),
                }

                sb.table("jobs").insert(record).execute()
                total_saved += 1
            except Exception as e:
                if "duplicate" not in str(e).lower():
                    logger.debug("Insert error for %s: %s", source, str(e)[:100])

    logger.info("scrape_jobs(%s): scraped=%d, saved=%d", source, total_scraped, total_saved)
    return {"source": source, "scraped": total_scraped, "saved": total_saved}


async def _scrape_jobs_async(source: str):
    from app.core.database import async_session
    from app.models.job import Job
    from app.models.enums import JobSource
    from app.services.sponsorship_detector import detect_sponsorship
    from app.services.entity_resolution import resolve_entity

    scraper_cls = _get_scraper_class(source)
    scraper = scraper_cls()

    total_scraped = 0
    total_saved = 0

    async with async_session() as db:
        for keyword in DEFAULT_KEYWORDS:
            try:
                results = await scraper.scrape_with_delay(
                    keyword=keyword,
                    location="United Kingdom",
                )
            except Exception as e:
                logger.warning(
                    "Error scraping %s for '%s': %s",
                    source, keyword, str(e)[:200],
                )
                continue

            total_scraped += len(results)

            for raw_job in results:
                try:
                    # Map source string to enum
                    job_source = _map_source_to_enum(source)

                    # Check for existing job
                    source_job_id = raw_job.get("source_job_id")
                    if source_job_id:
                        from sqlalchemy import select
                        existing = await db.execute(
                            select(Job).where(
                                Job.source == job_source,
                                Job.source_job_id == source_job_id,
                            )
                        )
                        if existing.scalar_one_or_none():
                            continue

                    # Detect sponsorship signals
                    description = raw_job.get("description_full", "") or raw_job.get("description_snippet", "")
                    likelihood = raw_job.get("sponsorship_likelihood", 0)
                    signals = raw_job.get("sponsorship_signals", [])
                    if description and not signals:
                        likelihood, signals = detect_sponsorship(description)

                    # Entity resolution - try to link to a known sponsor
                    company_name = raw_job.get("company_name_raw", "") or raw_job.get("company_name", "")
                    sponsor_id = None
                    if company_name:
                        try:
                            sponsor_id, confidence = await resolve_entity(
                                db, company_name, source,
                                additional_info={"city": raw_job.get("location_raw", "")},
                            )
                            if sponsor_id:
                                likelihood, signals = detect_sponsorship(
                                    description, is_known_sponsor=True,
                                )
                        except Exception:
                            pass

                    job = Job(
                        id=uuid.uuid4(),
                        sponsor_id=sponsor_id,
                        source=job_source,
                        source_job_id=source_job_id,
                        title_raw=raw_job.get("title_raw") or raw_job.get("title", "Unknown"),
                        company_name_raw=company_name or "Unknown",
                        location_raw=raw_job.get("location_raw") or raw_job.get("location"),
                        salary_text_raw=raw_job.get("salary_text_raw") or raw_job.get("salary_text"),
                        salary_min=raw_job.get("salary_min"),
                        salary_max=raw_job.get("salary_max"),
                        description_full=raw_job.get("description_full"),
                        description_snippet=raw_job.get("description_snippet"),
                        sponsorship_likelihood=likelihood,
                        sponsorship_signals=signals,
                        posted_date=raw_job.get("posted_date"),
                        source_url=raw_job.get("source_url"),
                        contract_type=raw_job.get("contract_type"),
                        location_is_remote=raw_job.get("location_is_remote", False),
                        first_seen_at=datetime.utcnow(),
                        last_seen_at=datetime.utcnow(),
                        scraped_at=datetime.utcnow(),
                    )
                    db.add(job)
                    total_saved += 1

                except Exception as e:
                    logger.warning("Error saving job from %s: %s", source, str(e)[:200])
                    continue

        await db.commit()

    # Publish new job count to Redis for real-time WebSocket push
    if total_saved > 0:
        try:
            await _publish_new_jobs(source, total_saved)
        except Exception:
            logger.warning("Failed to publish new jobs notification for %s", source)

    logger.info(
        "scrape_jobs(%s): scraped=%d, saved=%d",
        source, total_scraped, total_saved,
    )
    return {"source": source, "scraped": total_scraped, "saved": total_saved}


async def _publish_new_jobs(source: str, count: int):
    """Publish new job notification to Redis pub/sub for WebSocket clients."""
    import redis.asyncio as aioredis
    from app.core.config import get_settings

    settings = get_settings()
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    try:
        await r.publish(JOBS_CHANNEL, json.dumps({
            "type": "new_jobs",
            "source": source,
            "count": count,
            "timestamp": datetime.utcnow().isoformat(),
        }))
        # Also publish to the general events channel for the existing WebSocket
        await r.publish("events", json.dumps({
            "event_type": "new_job_detected",
            "severity": "info",
            "title": f"{count} new jobs from {source}",
            "description": f"Scraped {count} new job listings from {source}",
            "created_at": datetime.utcnow().isoformat(),
        }))
    finally:
        await r.close()


def _map_source_to_enum(source: str):
    """Map source string to JobSource enum."""
    from app.models.enums import JobSource

    mapping = {
        "reed": JobSource.REED,
        "adzuna": JobSource.ADZUNA,
        "jooble": JobSource.JOOBLE,
        "indeed": JobSource.INDEED,
        "linkedin": JobSource.LINKEDIN,
        "totaljobs": JobSource.TOTALJOBS,
        "cwjobs": JobSource.CWJOBS,
        "findajob": JobSource.GOV_FINDAJOB,
        "nhs": JobSource.NHS_JOBS,
        "glassdoor": JobSource.GLASSDOOR,
        "guardian": JobSource.GUARDIAN,
        "reed_api": JobSource.REED,
        "remotive": JobSource.REMOTIVE,
        "arbeitnow": JobSource.ARBEITNOW,
        "jobicy": JobSource.JOBICY,
        "themuse": JobSource.THEMUSE,
        "himalayas": JobSource.HIMALAYAS,
        "remoteok": JobSource.REMOTEOK,
        "wwr": JobSource.WWR,
        "teaching_vacancies": JobSource.TEACHING_VACANCIES,
        "devitjobs": JobSource.DEVITJOBS,
        "hn_hiring": JobSource.HN_HIRING,
        "charityjob": JobSource.CHARITYJOB,
        "career_page": JobSource.CAREER_PAGE,
    }
    return mapping[source]


# ---------------------------------------------------------------------------
# Zero-auth sources that can be scraped without API keys
# ---------------------------------------------------------------------------

FREE_SOURCES = [
    "remotive",
    "arbeitnow",
    "jobicy",
    "themuse",
    "himalayas",
    "remoteok",
    "wwr",
    "teaching_vacancies",
    "devitjobs",
    "hn_hiring",
    "charityjob",
]


# ---------------------------------------------------------------------------
# Task: Scrape All Free Sources
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_all_free", bind=True, max_retries=1, default_retry_delay=600)
def scrape_all_free(self):
    """
    Fan-out task: dispatches scrape_jobs for every zero-auth source.

    Each source runs as a separate sub-task via Celery group, so they
    execute in parallel across workers. Use this for a full daily refresh.
    """
    from celery import group

    job_group = group(
        scrape_jobs.s(source) for source in FREE_SOURCES
    )
    result = job_group.apply_async()
    logger.info(
        "scrape_all_free: dispatched %d scrape tasks",
        len(FREE_SOURCES),
    )
    return {
        "status": "dispatched",
        "sources": FREE_SOURCES,
        "task_count": len(FREE_SOURCES),
    }


# ---------------------------------------------------------------------------
# Task: Bootstrap Profiles (one-time)
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.bootstrap_profiles", bind=True, max_retries=1, default_retry_delay=60)
def bootstrap_profiles(self):
    """Create CompanyProfile records for all sponsors that don't have one."""
    try:
        return _run_async(_bootstrap_profiles_async())
    except Exception as exc:
        logger.exception("bootstrap_profiles failed")
        self.retry(exc=exc, countdown=60)


async def _bootstrap_profiles_async():
    from app.core.database import async_session
    from app.models.company import CompanyProfile
    from app.models.enums import EnrichmentLevel
    from app.models.sponsor import Sponsor
    from sqlalchemy import func, select

    async with async_session() as db:
        subq = select(CompanyProfile.sponsor_id)
        result = await db.execute(
            select(Sponsor.id).where(Sponsor.id.not_in(subq))
        )
        sponsor_ids = [row[0] for row in result.all()]

        if not sponsor_ids:
            return {"status": "all_profiles_exist", "created": 0}

        for i, sid in enumerate(sponsor_ids):
            profile = CompanyProfile(
                id=uuid.uuid4(),
                sponsor_id=sid,
                enrichment_level=EnrichmentLevel.LEVEL_0,
                enrichment_priority=0,
                failure_count=0,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(profile)
            if (i + 1) % 1000 == 0:
                await db.flush()

        await db.commit()

    logger.info("bootstrap_profiles: created %d profiles", len(sponsor_ids))
    return {"status": "created", "created": len(sponsor_ids)}


# ---------------------------------------------------------------------------
# Task: Scan Career Pages (the swarm)
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scan_career_pages", bind=True, max_retries=2, default_retry_delay=300)
def scan_career_pages(self, batch_size: int = 200):
    """
    Scan sponsor career pages for job listings.

    Picks sponsors that have has_careers_page=True or website_url set,
    ordered by enrichment_priority, and scrapes their career pages
    for jobs. Detects ATS platforms (Greenhouse, Lever, etc.) automatically.
    """
    try:
        return _run_async(_scan_career_pages_async(batch_size))
    except Exception as exc:
        logger.exception("scan_career_pages failed")
        self.retry(exc=exc, countdown=600)


async def _scan_career_pages_async(batch_size: int = 200):
    from app.core.database import async_session
    from app.models.company import CompanyProfile
    from app.models.job import Job
    from app.models.enums import JobSource
    from app.models.sponsor import Sponsor
    from app.scrapers.career_page_scraper import CareerPageScraper
    from sqlalchemy import select, or_

    scraper = CareerPageScraper()

    async with async_session() as db:
        # Get sponsors with career pages or websites, ordered by priority
        result = await db.execute(
            select(
                CompanyProfile.sponsor_id,
                CompanyProfile.website_url,
                CompanyProfile.has_careers_page,
                Sponsor.organisation_name,
            )
            .join(Sponsor, Sponsor.id == CompanyProfile.sponsor_id)
            .where(
                or_(
                    CompanyProfile.has_careers_page == True,  # noqa: E712
                    CompanyProfile.website_url.isnot(None),
                )
            )
            .order_by(CompanyProfile.enrichment_priority.desc().nullslast())
            .limit(batch_size)
        )
        candidates = result.all()

        if not candidates:
            return {"status": "no_candidates", "scanned": 0, "jobs_found": 0}

        total_jobs = 0
        scanned = 0

        for sponsor_id, website_url, has_careers, company_name in candidates:
            if not website_url:
                continue

            try:
                careers_url = website_url
                if has_careers:
                    # Try common career paths
                    from urllib.parse import urlparse
                    parsed = urlparse(website_url)
                    careers_url = f"{parsed.scheme}://{parsed.netloc}/careers"

                raw_jobs = await scraper.scrape(
                    careers_url=careers_url,
                    website_url=website_url,
                    company_name=company_name,
                    sponsor_id=sponsor_id,
                )

                for raw_job in raw_jobs:
                    source_job_id = raw_job.get("source_job_id")
                    if source_job_id:
                        existing = await db.execute(
                            select(Job.id).where(
                                Job.source == JobSource.CAREER_PAGE,
                                Job.source_job_id == source_job_id,
                            )
                        )
                        if existing.scalar_one_or_none():
                            continue

                    job = Job(
                        id=uuid.uuid4(),
                        sponsor_id=sponsor_id,
                        source=JobSource.CAREER_PAGE,
                        source_job_id=source_job_id,
                        title_raw=raw_job.get("title_raw", "Unknown"),
                        company_name_raw=raw_job.get("company_name_raw", company_name),
                        location_raw=raw_job.get("location_raw"),
                        description_full=raw_job.get("description_full"),
                        description_snippet=raw_job.get("description_snippet"),
                        sponsorship_likelihood=raw_job.get("sponsorship_likelihood", 0),
                        sponsorship_signals=raw_job.get("sponsorship_signals", {}),
                        posted_date=raw_job.get("posted_date"),
                        source_url=raw_job.get("source_url"),
                        location_is_remote=False,
                        first_seen_at=datetime.utcnow(),
                        last_seen_at=datetime.utcnow(),
                        scraped_at=datetime.utcnow(),
                    )
                    db.add(job)
                    total_jobs += 1

                scanned += 1

            except Exception as e:
                logger.warning(
                    "Error scanning career page for %s: %s",
                    company_name, str(e)[:200],
                )

        await db.commit()

    # Publish notification
    if total_jobs > 0:
        try:
            await _publish_new_jobs("career_page", total_jobs)
        except Exception:
            pass

    logger.info(
        "scan_career_pages: scanned=%d, jobs_found=%d",
        scanned, total_jobs,
    )
    return {"scanned": scanned, "jobs_found": total_jobs}


# ---------------------------------------------------------------------------
# Task: Enrich Companies
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.enrich_companies", bind=True, max_retries=1, default_retry_delay=60)
def enrich_companies(self, total_batches: int = 50, batch_size: int = 25):
    """
    Swarm dispatcher: fans out parallel enrich_company_batch tasks.

    Fetches unenriched profile IDs and dispatches many batch tasks
    so all Celery workers process enrichment concurrently.
    """
    try:
        return _run_async(_dispatch_enrichment_swarm(total_batches, batch_size))
    except Exception as exc:
        logger.exception("enrich_companies dispatcher failed")
        self.retry(exc=exc, countdown=60)


async def _dispatch_enrichment_swarm(total_batches: int, batch_size: int):
    from app.models.company import CompanyProfile
    from sqlalchemy import select

    session_factory = _make_session()
    async with session_factory() as db:
        # Fetch IDs of unenriched profiles (enriched_at IS NULL)
        result = await db.execute(
            select(CompanyProfile.id)
            .where(CompanyProfile.enriched_at.is_(None))
            .where(CompanyProfile.failure_count < 3)
            .order_by(CompanyProfile.enrichment_priority.desc().nullslast())
            .limit(total_batches * batch_size)
        )
        all_ids = [str(row[0]) for row in result.all()]

    if not all_ids:
        logger.info("enrich_companies: no unenriched profiles found")
        return {"status": "nothing_to_enrich"}

    # Split into batches and dispatch as parallel tasks
    from celery import group
    batches = [all_ids[i : i + batch_size] for i in range(0, len(all_ids), batch_size)]
    job = group(enrich_company_batch.s(batch) for batch in batches)
    job.apply_async()

    logger.info(
        "enrich_companies: dispatched %d batch tasks (%d profiles total)",
        len(batches), len(all_ids),
    )
    return {"dispatched_batches": len(batches), "total_profiles": len(all_ids)}


@celery_app.task(name="tasks.enrich_company_batch", bind=True, max_retries=2, default_retry_delay=120)
def enrich_company_batch(self, profile_ids: list[str]):
    """
    Enrich a batch of company profiles with Companies House + website data.

    Each worker picks up a batch and processes it independently.
    """
    try:
        return _run_async(_enrich_batch_async(profile_ids))
    except Exception as exc:
        logger.exception("enrich_company_batch failed (%d profiles)", len(profile_ids))
        self.retry(exc=exc, countdown=120)


async def _enrich_batch_async(profile_ids: list[str]):
    from app.models.company import CompanyProfile
    from app.scrapers.companies_house import CompaniesHouseScraper
    from app.scrapers.website_analyser import WebsiteAnalyser
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    session_factory = _make_session()
    async with session_factory() as db:
        uuids = [uuid.UUID(pid) for pid in profile_ids]
        result = await db.execute(
            select(CompanyProfile)
            .options(selectinload(CompanyProfile.sponsor))
            .where(CompanyProfile.id.in_(uuids))
        )
        profiles = list(result.scalars().all())

        if not profiles:
            return {"enriched": 0, "total": 0}

        ch_scraper = CompaniesHouseScraper()
        wa_scraper = WebsiteAnalyser()
        enriched_count = 0

        for profile in profiles:
            try:
                sponsor = profile.sponsor
                if not sponsor:
                    continue

                # --- Companies House enrichment ---
                if not profile.companies_house_number:
                    search_results = await ch_scraper.search_company(
                        sponsor.organisation_name
                    )

                    if search_results:
                        best = search_results[0]
                        company_number = best.get("companies_house_number") or best.get("company_number")

                        if company_number:
                            ch_profile = await ch_scraper.get_company_profile(company_number)
                            if ch_profile:
                                profile.companies_house_number = company_number
                                profile.company_status = ch_profile.get("company_status")
                                profile.company_type = ch_profile.get("company_type")
                                profile.sic_codes = ch_profile.get("sic_codes")

                                if ch_profile.get("incorporation_date"):
                                    try:
                                        from dateutil.parser import parse as parse_date
                                        profile.incorporation_date = parse_date(
                                            ch_profile["incorporation_date"]
                                        ).date()
                                    except Exception:
                                        pass

                                if ch_profile.get("registered_address"):
                                    profile.registered_address = ch_profile["registered_address"]

                                if ch_profile.get("confirmation_statement_overdue"):
                                    profile.confirmation_statement_overdue = True

                                # Use profile page indicators (avoids slow /insolvency endpoint)
                                if ch_profile.get("has_insolvency_history") is not None:
                                    profile.has_insolvency_history = ch_profile["has_insolvency_history"]

                                if ch_profile.get("has_charges") is not None:
                                    profile.has_charges = ch_profile["has_charges"]
                                if ch_profile.get("charge_count") is not None:
                                    profile.charge_count = ch_profile["charge_count"]

                                if ch_profile.get("accounts_overdue"):
                                    profile.accounts_overdue = True
                                if ch_profile.get("last_accounts_date"):
                                    profile.last_accounts_date = ch_profile["last_accounts_date"]

                # --- Website Analyser enrichment ---
                if profile.website_url:
                    try:
                        wa_results = await wa_scraper.scrape(url=profile.website_url)
                        if wa_results:
                            wa_data = wa_results[0]
                            if wa_data.get("has_careers_page") is not None:
                                profile.has_careers_page = wa_data["has_careers_page"]
                            if wa_data.get("social_links"):
                                profile.social_links = wa_data["social_links"]
                            if wa_data.get("tech_stack_detected"):
                                profile.tech_stack_detected = wa_data["tech_stack_detected"]
                            if wa_data.get("website_domain_age_days") is not None:
                                profile.website_domain_age_days = wa_data["website_domain_age_days"]
                    except Exception as e:
                        logger.warning(
                            "Error analysing website for profile %s: %s",
                            profile.id, str(e)[:200],
                        )

                profile.enriched_at = datetime.utcnow()
                profile.enrichment_level = "LEVEL_1"
                enriched_count += 1

            except Exception as e:
                logger.warning(
                    "Error enriching profile %s: %s",
                    profile.id, str(e)[:200],
                )
                profile.failure_count += 1
                profile.last_error = str(e)[:500]

        await db.commit()

    logger.info("enrich_company_batch: enriched=%d/%d", enriched_count, len(profiles))
    return {"enriched": enriched_count, "total": len(profiles)}


# ---------------------------------------------------------------------------
# Task: Recompute Scores
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.recompute_scores", bind=True, max_retries=3, default_retry_delay=300)
def recompute_scores(self):
    """
    Batch recompute SponsorScore records for sponsors with stale scores
    (>24h old or never scored).
    """
    try:
        return _run_async(_recompute_scores_async())
    except Exception as exc:
        logger.exception("recompute_scores failed")
        self.retry(exc=exc, countdown=600)


async def _recompute_scores_async():
    from app.core.database import async_session
    from app.models.sponsor import Sponsor
    from app.models.scoring import SponsorScore
    from app.services.scoring import compute_sponsor_score
    from sqlalchemy import select, func

    stale_cutoff = datetime.utcnow() - timedelta(hours=24)

    async with async_session() as db:
        # Subquery: latest score per sponsor
        latest_score_subq = (
            select(
                SponsorScore.sponsor_id,
                func.max(SponsorScore.computed_at).label("latest_computed"),
            )
            .group_by(SponsorScore.sponsor_id)
            .subquery()
        )

        # Find active sponsors that either:
        # 1. Have never been scored (no entry in subquery)
        # 2. Have a stale score (latest computed_at > 24h ago)
        never_scored = await db.execute(
            select(Sponsor.id)
            .outerjoin(latest_score_subq, Sponsor.id == latest_score_subq.c.sponsor_id)
            .where(
                Sponsor.is_active == True,  # noqa: E712
                (latest_score_subq.c.latest_computed.is_(None))
                | (latest_score_subq.c.latest_computed < stale_cutoff),
            )
        )
        sponsor_ids = [row[0] for row in never_scored.all()]

        scored = 0
        errors = 0

        for sponsor_id in sponsor_ids:
            try:
                await compute_sponsor_score(db, sponsor_id)
                scored += 1
            except Exception as e:
                logger.warning("Error scoring sponsor %s: %s", sponsor_id, str(e)[:200])
                errors += 1

        await db.commit()

    logger.info("recompute_scores: scored=%d, errors=%d, total=%d", scored, errors, len(sponsor_ids))
    return {"scored": scored, "errors": errors, "total": len(sponsor_ids)}


# ---------------------------------------------------------------------------
# Task: Evaluate Alerts
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.evaluate_alerts", bind=True, max_retries=3, default_retry_delay=300)
def evaluate_alerts(self):
    """
    Check recent events against user alert configurations.

    Matches events from the last hour to active user alerts and
    creates AlertHistory notification records.
    """
    try:
        return _run_async(_evaluate_alerts_async())
    except Exception as exc:
        logger.exception("evaluate_alerts failed")
        self.retry(exc=exc, countdown=300)


async def _evaluate_alerts_async():
    from app.core.database import async_session
    from app.models.event import Event
    from app.models.user import Alert, AlertHistory
    from sqlalchemy import select

    async with async_session() as db:
        # Fetch events from the last hour
        since = datetime.utcnow() - timedelta(hours=1)
        result = await db.execute(
            select(Event)
            .where(Event.created_at >= since)
            .order_by(Event.created_at.desc())
        )
        recent_events = list(result.scalars().all())

        if not recent_events:
            return {"status": "no_new_events", "alerts_triggered": 0}

        # Fetch all active alerts
        alerts_result = await db.execute(
            select(Alert).where(Alert.is_active == True)  # noqa: E712
        )
        active_alerts = list(alerts_result.scalars().all())

        if not active_alerts:
            return {"status": "no_active_alerts", "events_checked": len(recent_events), "alerts_triggered": 0}

        alerts_triggered = 0

        for alert in active_alerts:
            # Get the event types this alert cares about
            alert_type_value = alert.alert_type.value if hasattr(alert.alert_type, "value") else str(alert.alert_type)
            matching_event_types = _ALERT_EVENT_MAP.get(alert_type_value, [])

            if not matching_event_types:
                continue

            for event in recent_events:
                event_type_value = event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type)

                if event_type_value not in matching_event_types:
                    continue

                # Check alert config filters (e.g. specific sponsor_id)
                if not _event_matches_alert_config(event, alert):
                    continue

                # Skip if this alert was already triggered for this event recently
                # (within the last hour, to avoid duplicates)
                if alert.last_triggered and alert.last_triggered >= since:
                    continue

                # Create AlertHistory entry
                alert_history = AlertHistory(
                    id=uuid.uuid4(),
                    alert_id=alert.id,
                    triggered_at=datetime.utcnow(),
                    payload={
                        "event_id": str(event.id),
                        "event_type": event_type_value,
                        "entity_type": event.entity_type,
                        "entity_id": str(event.entity_id),
                        "event_payload": event.payload,
                        "severity": event.severity.value if hasattr(event.severity, "value") else str(event.severity),
                    },
                    read=False,
                )
                db.add(alert_history)

                # Update last_triggered on the alert
                alert.last_triggered = datetime.utcnow()
                alerts_triggered += 1

                # Only trigger once per alert per evaluation cycle
                break

        await db.commit()

    logger.info(
        "evaluate_alerts: events_checked=%d, alerts_triggered=%d",
        len(recent_events), alerts_triggered,
    )
    return {
        "events_checked": len(recent_events),
        "alerts_triggered": alerts_triggered,
    }


def _event_matches_alert_config(event, alert) -> bool:
    """
    Check if an event matches the alert's config filters.

    Alert config can specify:
    - sponsor_id: only trigger for events on a specific sponsor
    - severity: minimum severity level
    """
    config = alert.config or {}

    # If config specifies a sponsor_id, only match events for that sponsor
    if "sponsor_id" in config:
        if event.entity_type != "sponsor":
            return False
        if str(event.entity_id) != str(config["sponsor_id"]):
            return False

    # If config specifies minimum severity
    if "min_severity" in config:
        severity_order = {"info": 0, "warning": 1, "critical": 2}
        event_severity = event.severity.value if hasattr(event.severity, "value") else str(event.severity)
        min_sev = config["min_severity"]
        if severity_order.get(event_severity, 0) < severity_order.get(min_sev, 0):
            return False

    return True


# ---------------------------------------------------------------------------
# Task: Deduplicate Jobs
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.deduplicate_jobs", bind=True, max_retries=3, default_retry_delay=300)
def deduplicate_jobs(self):
    """Run job deduplication service on jobs from the last 7 days."""
    try:
        return _run_async(_deduplicate_jobs_async())
    except Exception as exc:
        logger.exception("deduplicate_jobs failed")
        self.retry(exc=exc, countdown=600)


async def _deduplicate_jobs_async():
    from app.core.database import async_session
    from app.services.job_dedup import deduplicate_jobs as dedup

    async with async_session() as db:
        # The dedup service already fetches unclustered jobs ordered by scraped_at desc.
        # We pass a batch_size that corresponds to recent jobs (last 7 days worth).
        # The service handles the actual logic of fetching unclustered jobs.
        stats = await dedup(db, batch_size=5000)
        await db.commit()

    logger.info(
        "deduplicate_jobs: processed=%d, clustered=%d, new_clusters=%d",
        stats.get("jobs_processed", 0),
        stats.get("jobs_clustered", 0),
        stats.get("clusters_created", 0),
    )
    return stats


# ---------------------------------------------------------------------------
# Task: Scrape News
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_news", bind=True, max_retries=3, default_retry_delay=300)
def scrape_news(self):
    """Scrape Google News for top 100 sponsors (by score)."""
    try:
        return _run_async(_scrape_news_async())
    except Exception as exc:
        logger.exception("scrape_news failed")
        self.retry(exc=exc, countdown=600)


async def _scrape_news_async():
    from app.core.database import async_session
    from app.models.company import CompanyNews, CompanyProfile
    from app.models.scoring import SponsorScore
    from app.models.sponsor import Sponsor
    from app.scrapers.google_news import GoogleNewsScraper
    from sqlalchemy import select, func

    scraper = GoogleNewsScraper()

    async with async_session() as db:
        # Subquery: latest score per sponsor
        latest_score_subq = (
            select(
                SponsorScore.sponsor_id,
                func.max(SponsorScore.computed_at).label("latest_computed"),
            )
            .group_by(SponsorScore.sponsor_id)
            .subquery()
        )

        latest_scores = (
            select(
                SponsorScore.sponsor_id,
                SponsorScore.overall_score,
            )
            .join(
                latest_score_subq,
                (SponsorScore.sponsor_id == latest_score_subq.c.sponsor_id)
                & (SponsorScore.computed_at == latest_score_subq.c.latest_computed),
            )
            .subquery()
        )

        # Get top 100 sponsors by score, joined with their profiles
        result = await db.execute(
            select(
                Sponsor.id,
                Sponsor.organisation_name,
                CompanyProfile.id,
            )
            .join(CompanyProfile, CompanyProfile.sponsor_id == Sponsor.id)
            .join(latest_scores, latest_scores.c.sponsor_id == Sponsor.id)
            .where(Sponsor.is_active == True)  # noqa: E712
            .order_by(latest_scores.c.overall_score.desc())
            .limit(100)
        )
        sponsors = result.all()

        if not sponsors:
            # Fallback: if no scores exist yet, just get top 100 active sponsors with profiles
            result = await db.execute(
                select(
                    Sponsor.id,
                    Sponsor.organisation_name,
                    CompanyProfile.id,
                )
                .join(CompanyProfile, CompanyProfile.sponsor_id == Sponsor.id)
                .where(Sponsor.is_active == True)  # noqa: E712
                .limit(100)
            )
            sponsors = result.all()

        articles_saved = 0
        for sponsor_id, name, profile_id in sponsors:
            try:
                articles = await scraper.scrape_with_delay(company_name=name)
                for article in articles[:5]:  # Limit per company
                    news = CompanyNews(
                        id=uuid.uuid4(),
                        profile_id=profile_id,
                        headline=article.get("headline", "")[:500],
                        source=article.get("news_source"),
                        url=article.get("url"),
                        sentiment=article.get("sentiment"),
                        sentiment_score=article.get("sentiment_score"),
                        is_risk_signal=article.get("is_risk_signal", False),
                        created_at=datetime.utcnow(),
                    )
                    db.add(news)
                    articles_saved += 1
            except Exception as e:
                logger.warning("Error scraping news for %s: %s", name, str(e)[:200])

        await db.commit()

    logger.info("scrape_news: sponsors_checked=%d, articles_saved=%d", len(sponsors), articles_saved)
    return {"sponsors_checked": len(sponsors), "articles_saved": articles_saved}


# ---------------------------------------------------------------------------
# Task: Scrape Reviews
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_reviews", bind=True, max_retries=3, default_retry_delay=300)
def scrape_reviews(self):
    """Scrape Trustpilot and Glassdoor for top 200 sponsors (weekly)."""
    try:
        return _run_async(_scrape_reviews_async())
    except Exception as exc:
        logger.exception("scrape_reviews failed")
        self.retry(exc=exc, countdown=3600)


async def _scrape_reviews_async():
    from app.core.database import async_session
    from app.models.company import CompanyProfile, CompanyReview
    from app.models.enums import ReviewSource
    from app.scrapers.trustpilot import TrustpilotScraper
    from app.scrapers.glassdoor_company import GlassdoorCompanyScraper
    from sqlalchemy import select

    tp_scraper = TrustpilotScraper()
    gd_scraper = GlassdoorCompanyScraper()

    async with async_session() as db:
        result = await db.execute(
            select(CompanyProfile)
            .order_by(CompanyProfile.enrichment_priority.desc().nullslast())
            .limit(200)
        )
        profiles = list(result.scalars().all())

        if not profiles:
            return {"status": "no_profiles", "profiles_checked": 0, "reviews_saved": 0}

        reviews_saved = 0
        tp_updated = 0
        gd_updated = 0

        for profile in profiles:
            # --- Trustpilot ---
            if profile.website_url:
                try:
                    tp_results = await tp_scraper.scrape_with_delay(
                        domain=profile.website_url
                    )
                    if tp_results and tp_results[0].get("rating"):
                        tp_data = tp_results[0]
                        profile.trustpilot_rating = tp_data["rating"]
                        profile.trustpilot_review_count = tp_data.get("review_count")
                        tp_updated += 1

                        # Save individual reviews
                        for review_data in tp_data.get("reviews", []):
                            review = CompanyReview(
                                id=uuid.uuid4(),
                                profile_id=profile.id,
                                source=ReviewSource.TRUSTPILOT,
                                rating=review_data.get("rating"),
                                title=review_data.get("title", "")[:500] if review_data.get("title") else None,
                                text_snippet=review_data.get("text", "")[:1000] if review_data.get("text") else None,
                                mentions_visa=False,
                                mentions_sponsorship=False,
                                sentiment=None,
                                review_date=None,
                                created_at=datetime.utcnow(),
                            )
                            db.add(review)
                            reviews_saved += 1
                except Exception as e:
                    logger.warning(
                        "Error scraping Trustpilot for profile %s: %s",
                        profile.id, str(e)[:200],
                    )

            # --- Glassdoor ---
            try:
                sponsor = profile.sponsor
                company_name = sponsor.organisation_name if sponsor else None
                if company_name:
                    gd_results = await gd_scraper.scrape_with_delay(
                        company_name=company_name
                    )
                    if gd_results:
                        gd_data = gd_results[0]
                        if gd_data.get("rating"):
                            profile.glassdoor_rating = gd_data["rating"]
                            profile.glassdoor_review_count = gd_data.get("review_count")
                            if gd_data.get("ceo_approval_pct"):
                                profile.glassdoor_ceo_approval = gd_data["ceo_approval_pct"]
                            if gd_data.get("recommend_pct"):
                                profile.glassdoor_recommend_pct = gd_data["recommend_pct"]
                            gd_updated += 1

                        # Save individual reviews
                        for review_data in gd_data.get("reviews", []):
                            review = CompanyReview(
                                id=uuid.uuid4(),
                                profile_id=profile.id,
                                source=ReviewSource.GLASSDOOR,
                                rating=review_data.get("rating"),
                                title=review_data.get("title", "")[:500] if review_data.get("title") else None,
                                text_snippet=(review_data.get("pros", "") + " | " + review_data.get("cons", ""))[:1000] or None,
                                mentions_visa=review_data.get("mentions_visa", False),
                                mentions_sponsorship=review_data.get("mentions_sponsorship", False),
                                sentiment=None,
                                review_date=None,
                                created_at=datetime.utcnow(),
                            )
                            db.add(review)
                            reviews_saved += 1
            except Exception as e:
                logger.warning(
                    "Error scraping Glassdoor for profile %s: %s",
                    profile.id, str(e)[:200],
                )

        await db.commit()

    logger.info(
        "scrape_reviews: profiles_checked=%d, tp_updated=%d, gd_updated=%d, reviews_saved=%d",
        len(profiles), tp_updated, gd_updated, reviews_saved,
    )
    return {
        "profiles_checked": len(profiles),
        "trustpilot_updated": tp_updated,
        "glassdoor_updated": gd_updated,
        "reviews_saved": reviews_saved,
    }


# ---------------------------------------------------------------------------
# Task: Match Jobs to Sponsors
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.match_jobs_to_sponsors", bind=True, max_retries=2, default_retry_delay=120)
def match_jobs_to_sponsors(self, limit: int = 10000):
    """
    Match unlinked jobs to sponsors using multi-strategy name resolution.

    Uses normalized names, trading names, domains, prefix matching,
    and token overlap to link jobs to their sponsoring companies.
    """
    try:
        return _run_async(_match_jobs_async(limit))
    except Exception as exc:
        logger.exception("match_jobs_to_sponsors failed")
        self.retry(exc=exc, countdown=120)


async def _match_jobs_async(limit: int):
    from app.scripts.match_jobs_to_sponsors import (
        build_lookup_indexes, match_jobs, get_supabase,
    )

    sb = await get_supabase()
    indexes = await build_lookup_indexes(sb)
    stats = await match_jobs(sb, indexes, limit, dry_run=False)

    total_matched = sum(stats[k] for k in stats if k.startswith("matched_"))
    logger.info(
        "match_jobs: processed=%d matched=%d unmatched=%d errors=%d",
        stats["processed"], total_matched, stats["unmatched"], stats["errors"],
    )
    return {"status": "completed", **stats}
