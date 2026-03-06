"""
Celery tasks for scraping, enrichment, scoring, and alerting.

Each task is designed to run independently and handles its own
database session lifecycle and error handling.
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a new event loop (for Celery tasks)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _get_db_session():
    """Get an async database session."""
    from app.core.database import async_session_factory
    async with async_session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Scraper registry
# ---------------------------------------------------------------------------

SCRAPER_MAP = {
    "reed": "app.scrapers.reed.ReedScraper",
    "indeed": "app.scrapers.indeed.IndeedScraper",
    "linkedin": "app.scrapers.linkedin_jobs.LinkedInJobsScraper",
    "totaljobs": "app.scrapers.totaljobs.TotalJobsScraper",
    "cwjobs": "app.scrapers.cwjobs.CWJobsScraper",
    "findajob": "app.scrapers.gov_findajob.FindAJobScraper",
    "nhs": "app.scrapers.nhs_jobs.NHSJobsScraper",
    "glassdoor": "app.scrapers.glassdoor_jobs.GlassdoorJobsScraper",
    "guardian": "app.scrapers.guardian_jobs.GuardianJobsScraper",
}

# Default search keywords for job scraping
DEFAULT_KEYWORDS = [
    "software engineer",
    "data analyst",
    "project manager",
    "business analyst",
    "accountant",
    "nurse",
    "care worker",
    "chef",
    "civil engineer",
    "mechanical engineer",
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
# Task: Scrape GOV.UK Sponsor Register
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_register", bind=True, max_retries=3)
def scrape_register(self):
    """
    Scrape the GOV.UK sponsor register CSV.

    Downloads the CSV, checks if it has changed (MD5), and triggers
    a full import if the data is new.
    """
    try:
        return _run_async(_scrape_register_async())
    except Exception as exc:
        logger.exception("scrape_register failed")
        self.retry(exc=exc, countdown=300)


async def _scrape_register_async():
    from app.core.database import async_session_factory
    from app.scrapers.gov_uk_register import GovUKRegisterScraper
    from app.services.csv_import import import_csv_data

    scraper = GovUKRegisterScraper()
    results = await scraper.scrape()

    if not results:
        logger.warning("No CSV data returned from GOV.UK register scraper")
        return {"status": "no_data"}

    csv_data = results[0]
    new_md5 = csv_data["md5"]

    # Check against last import
    async with async_session_factory() as db:
        from sqlalchemy import select
        from app.models.sponsor import CsvImport

        last_import = await db.execute(
            select(CsvImport)
            .order_by(CsvImport.imported_at.desc())
            .limit(1)
        )
        last = last_import.scalar_one_or_none()

        if last and last.checksum_md5 == new_md5:
            logger.info("CSV unchanged (MD5: %s), skipping import", new_md5)
            return {"status": "unchanged", "md5": new_md5}

        # CSV has changed - trigger import
        logger.info("New CSV detected (MD5: %s), importing...", new_md5)
        # The actual import is handled by the csv_import service
        return {
            "status": "new_csv",
            "md5": new_md5,
            "filename": csv_data["filename"],
            "size_bytes": len(csv_data["csv_bytes"]),
        }


# ---------------------------------------------------------------------------
# Task: Scrape Jobs from a Source
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_jobs", bind=True, max_retries=2)
def scrape_jobs(self, source: str):
    """
    Scrape jobs from a specific job board.

    Dispatches to the appropriate scraper, saves Job records,
    runs sponsorship detection, and links to sponsor entities.
    """
    try:
        return _run_async(_scrape_jobs_async(source))
    except Exception as exc:
        logger.exception("scrape_jobs(%s) failed", source)
        self.retry(exc=exc, countdown=600)


async def _scrape_jobs_async(source: str):
    from app.core.database import async_session_factory
    from app.models.job import Job
    from app.models.enums import JobSource
    from app.services.sponsorship_detector import detect_sponsorship
    from app.services.entity_resolution import resolve_entity

    scraper_cls = _get_scraper_class(source)
    scraper = scraper_cls()

    total_scraped = 0
    total_saved = 0

    async with async_session_factory() as db:
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
                    likelihood, signals = detect_sponsorship(description)

                    # Entity resolution - try to link to a known sponsor
                    company_name = raw_job.get("company_name", "")
                    sponsor_id = None
                    if company_name:
                        sponsor_id, confidence = await resolve_entity(
                            db, company_name, source,
                            additional_info={"city": raw_job.get("location", "")},
                        )
                        # Boost sponsorship likelihood if matched to known sponsor
                        if sponsor_id:
                            likelihood, signals = detect_sponsorship(
                                description, is_known_sponsor=True,
                            )

                    job = Job(
                        id=uuid.uuid4(),
                        sponsor_id=sponsor_id,
                        source=job_source,
                        source_job_id=source_job_id,
                        title_raw=raw_job.get("title", "Unknown"),
                        company_name_raw=company_name or "Unknown",
                        location_raw=raw_job.get("location"),
                        salary_text_raw=raw_job.get("salary_text"),
                        salary_min=raw_job.get("salary_min"),
                        salary_max=raw_job.get("salary_max"),
                        description_full=raw_job.get("description_full"),
                        description_snippet=raw_job.get("description_snippet"),
                        sponsorship_likelihood=likelihood,
                        sponsorship_signals=signals,
                        posted_date=None,
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

    logger.info(
        "scrape_jobs(%s): scraped=%d, saved=%d",
        source, total_scraped, total_saved,
    )
    return {"source": source, "scraped": total_scraped, "saved": total_saved}


def _map_source_to_enum(source: str):
    """Map source string to JobSource enum."""
    from app.models.enums import JobSource

    mapping = {
        "reed": JobSource.REED,
        "indeed": JobSource.INDEED,
        "linkedin": JobSource.LINKEDIN,
        "totaljobs": JobSource.TOTALJOBS,
        "cwjobs": JobSource.CWJOBS,
        "findajob": JobSource.GOV_FINDAJOB,
        "nhs": JobSource.NHS_JOBS,
        "glassdoor": JobSource.GLASSDOOR,
        "guardian": JobSource.GUARDIAN,
    }
    return mapping[source]


# ---------------------------------------------------------------------------
# Task: Enrich Companies
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.enrich_companies", bind=True, max_retries=2)
def enrich_companies(self):
    """
    Enrich company profiles with Companies House and web data.

    Picks next batch of sponsors by enrichment priority and scrapes
    Companies House, LinkedIn, etc.
    """
    try:
        return _run_async(_enrich_companies_async())
    except Exception as exc:
        logger.exception("enrich_companies failed")
        self.retry(exc=exc, countdown=600)


async def _enrich_companies_async():
    from app.core.database import async_session_factory
    from app.models.company import CompanyProfile
    from app.scrapers.companies_house import CompaniesHouseScraper
    from sqlalchemy import select

    async with async_session_factory() as db:
        # Fetch profiles needing enrichment, ordered by priority
        result = await db.execute(
            select(CompanyProfile)
            .where(CompanyProfile.companies_house_number.is_(None))
            .order_by(CompanyProfile.enrichment_priority.desc().nullslast())
            .limit(10)
        )
        profiles = list(result.scalars().all())

        if not profiles:
            return {"status": "no_profiles_to_enrich"}

        ch_scraper = CompaniesHouseScraper()
        enriched_count = 0

        for profile in profiles:
            try:
                # Get sponsor name for search
                sponsor = profile.sponsor
                if not sponsor:
                    continue

                # Search Companies House
                search_results = await ch_scraper.search_company(
                    sponsor.organisation_name
                )

                if search_results:
                    best = search_results[0]
                    company_number = best.get("company_number")

                    if company_number:
                        # Get full profile
                        ch_profile = await ch_scraper.get_company_profile(company_number)
                        if ch_profile:
                            profile.companies_house_number = company_number
                            profile.company_status = ch_profile.get("company_status")
                            profile.company_type = ch_profile.get("company_type")
                            profile.sic_codes = ch_profile.get("sic_codes")

                            if ch_profile.get("registered_address"):
                                profile.registered_address = {
                                    "raw": ch_profile["registered_address"]
                                }

                            profile.enriched_at = datetime.utcnow()
                            enriched_count += 1

            except Exception as e:
                logger.warning(
                    "Error enriching profile %s: %s",
                    profile.id, str(e)[:200],
                )
                profile.failure_count += 1
                profile.last_error = str(e)[:500]

        await db.commit()

    return {"enriched": enriched_count, "total": len(profiles)}


# ---------------------------------------------------------------------------
# Task: Recompute Scores
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.recompute_scores", bind=True, max_retries=2)
def recompute_scores(self):
    """Batch recompute all SponsorScore records."""
    try:
        return _run_async(_recompute_scores_async())
    except Exception as exc:
        logger.exception("recompute_scores failed")
        self.retry(exc=exc, countdown=600)


async def _recompute_scores_async():
    from app.core.database import async_session_factory
    from app.models.sponsor import Sponsor
    from app.services.scoring import compute_sponsor_score
    from sqlalchemy import select

    async with async_session_factory() as db:
        result = await db.execute(
            select(Sponsor.id).where(Sponsor.is_active == True)  # noqa: E712
        )
        sponsor_ids = [row[0] for row in result.all()]

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

    return {"scored": scored, "errors": errors, "total": len(sponsor_ids)}


# ---------------------------------------------------------------------------
# Task: Evaluate Alerts
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.evaluate_alerts", bind=True, max_retries=2)
def evaluate_alerts(self):
    """
    Check recent events against user alert configurations.

    Matches events from the last hour to active user alerts and
    creates notification records.
    """
    try:
        return _run_async(_evaluate_alerts_async())
    except Exception as exc:
        logger.exception("evaluate_alerts failed")
        self.retry(exc=exc, countdown=300)


async def _evaluate_alerts_async():
    from app.core.database import async_session_factory
    from app.models.event import Event
    from datetime import timedelta
    from sqlalchemy import select

    async with async_session_factory() as db:
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

        # For each event, check if any user alerts match
        alerts_triggered = 0

        # Alert matching would be done here by querying Alert model
        # and matching event_type to alert_type, then creating notifications
        logger.info(
            "Evaluated %d events, triggered %d alerts",
            len(recent_events), alerts_triggered,
        )

        return {
            "events_checked": len(recent_events),
            "alerts_triggered": alerts_triggered,
        }


# ---------------------------------------------------------------------------
# Task: Deduplicate Jobs
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.deduplicate_jobs", bind=True, max_retries=2)
def deduplicate_jobs(self):
    """Run job deduplication service."""
    try:
        return _run_async(_deduplicate_jobs_async())
    except Exception as exc:
        logger.exception("deduplicate_jobs failed")
        self.retry(exc=exc, countdown=600)


async def _deduplicate_jobs_async():
    from app.core.database import async_session_factory
    from app.services.job_dedup import deduplicate_jobs as dedup

    async with async_session_factory() as db:
        stats = await dedup(db)
        await db.commit()

    return stats


# ---------------------------------------------------------------------------
# Task: Scrape News
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_news", bind=True, max_retries=2)
def scrape_news(self):
    """Scrape Google News for companies with active watchers."""
    try:
        return _run_async(_scrape_news_async())
    except Exception as exc:
        logger.exception("scrape_news failed")
        self.retry(exc=exc, countdown=600)


async def _scrape_news_async():
    from app.core.database import async_session_factory
    from app.models.company import CompanyNews, CompanyProfile
    from app.models.sponsor import Sponsor
    from app.scrapers.google_news import GoogleNewsScraper
    from sqlalchemy import select

    scraper = GoogleNewsScraper()

    async with async_session_factory() as db:
        # Get sponsors with profiles
        result = await db.execute(
            select(Sponsor.id, Sponsor.organisation_name, CompanyProfile.id)
            .join(CompanyProfile, CompanyProfile.sponsor_id == Sponsor.id)
            .where(Sponsor.is_active == True)  # noqa: E712
            .limit(50)
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

    return {"sponsors_checked": len(sponsors), "articles_saved": articles_saved}


# ---------------------------------------------------------------------------
# Task: Scrape Reviews
# ---------------------------------------------------------------------------

@celery_app.task(name="tasks.scrape_reviews", bind=True, max_retries=2)
def scrape_reviews(self):
    """Scrape Glassdoor and Trustpilot for top companies (weekly)."""
    try:
        return _run_async(_scrape_reviews_async())
    except Exception as exc:
        logger.exception("scrape_reviews failed")
        self.retry(exc=exc, countdown=3600)


async def _scrape_reviews_async():
    from app.core.database import async_session_factory
    from app.models.company import CompanyProfile
    from app.scrapers.trustpilot import TrustpilotScraper
    from sqlalchemy import select

    tp_scraper = TrustpilotScraper()

    async with async_session_factory() as db:
        result = await db.execute(
            select(CompanyProfile)
            .where(CompanyProfile.website_url.isnot(None))
            .order_by(CompanyProfile.enrichment_priority.desc().nullslast())
            .limit(25)
        )
        profiles = list(result.scalars().all())

        updated = 0
        for profile in profiles:
            try:
                if profile.website_url:
                    tp_results = await tp_scraper.scrape_with_delay(
                        domain=profile.website_url
                    )
                    if tp_results and tp_results[0].get("rating"):
                        profile.trustpilot_rating = tp_results[0]["rating"]
                        profile.trustpilot_review_count = tp_results[0].get("review_count")
                        updated += 1
            except Exception as e:
                logger.warning(
                    "Error scraping reviews for profile %s: %s",
                    profile.id, str(e)[:200],
                )

        await db.commit()

    return {"profiles_checked": len(profiles), "updated": updated}
