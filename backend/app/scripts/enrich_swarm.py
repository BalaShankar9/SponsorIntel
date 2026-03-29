"""
Async enrichment swarm — processes thousands of profiles concurrently.

Uses asyncio with adaptive rate control:
- Companies House: semaphore + adaptive delay (backs off on 403, speeds up on success)
- Website analysis: runs at WEB_CONCURRENCY (no rate limit)
- CH + website run IN PARALLEL for each profile
- DB commits in batches of COMMIT_BATCH_SIZE

Usage:
    python -m app.scripts.enrich_swarm [--ch-concurrency 3] [--web-concurrency 100] [--limit 0]
"""

import argparse
import asyncio
import logging
import time
from datetime import datetime

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("enrich_swarm")
logger.setLevel(logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

CH_CONCURRENCY = 0         # 0 = skip CH entirely (use bulk matching instead)
WEB_CONCURRENCY = 100
COMMIT_BATCH_SIZE = 500


class AdaptiveThrottle:
    """Adaptive rate controller that backs off on failures."""

    def __init__(self, min_delay=0.3, max_delay=30.0, backoff_factor=2.0, recovery_factor=0.9):
        self.delay = min_delay
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.recovery_factor = recovery_factor
        self.consecutive_fails = 0
        self.paused_until = 0.0

    def record_success(self):
        self.consecutive_fails = 0
        self.delay = max(self.min_delay, self.delay * self.recovery_factor)

    def record_failure(self):
        self.consecutive_fails += 1
        self.delay = min(self.max_delay, self.delay * self.backoff_factor)
        if self.consecutive_fails >= 5:
            # Pause for 5 minutes
            self.paused_until = time.time() + 300
            logger.warning("CH PAUSED for 5 min (delay=%.1fs, %d consecutive fails)",
                         self.delay, self.consecutive_fails)

    async def wait(self):
        now = time.time()
        if now < self.paused_until:
            wait = self.paused_until - now
            logger.info("CH paused, waiting %.0fs...", wait)
            await asyncio.sleep(wait)
            self.consecutive_fails = 0
            self.delay = self.min_delay
        await asyncio.sleep(self.delay)


async def _do_ch(profile, sponsor_name, ch_scraper, ch_sem, throttle, stats):
    """Companies House enrichment for one profile."""
    if profile.companies_house_number or not sponsor_name:
        return

    async with ch_sem:
        await throttle.wait()
        try:
            search_results = await ch_scraper.search_company(sponsor_name)
        except Exception:
            throttle.record_failure()
            return

    if not search_results:
        throttle.record_failure()
        return

    throttle.record_success()
    best = search_results[0]
    company_number = best.get("companies_house_number") or best.get("company_number")
    if not company_number:
        return

    async with ch_sem:
        await throttle.wait()
        try:
            ch_profile = await ch_scraper.get_company_profile(company_number)
        except Exception:
            throttle.record_failure()
            ch_profile = None

    if not ch_profile:
        return

    throttle.record_success()
    profile.companies_house_number = company_number
    profile.company_status = ch_profile.get("company_status")
    profile.company_type = ch_profile.get("company_type")
    profile.sic_codes = ch_profile.get("sic_codes")

    if ch_profile.get("incorporation_date"):
        try:
            from dateutil.parser import parse as parse_date
            profile.incorporation_date = parse_date(ch_profile["incorporation_date"]).date()
        except Exception:
            pass

    if ch_profile.get("registered_address"):
        profile.registered_address = ch_profile["registered_address"]
    if ch_profile.get("confirmation_statement_overdue"):
        profile.confirmation_statement_overdue = True
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

    stats["ch_found"] += 1


async def _do_web(profile, wa_scraper, web_sem, stats):
    """Website analysis for one profile."""
    if not profile.website_url:
        return
    async with web_sem:
        try:
            wa_results = await wa_scraper.scrape(url=profile.website_url)
        except Exception:
            return
    if not wa_results:
        return
    wa_data = wa_results[0]
    if wa_data.get("has_careers_page") is not None:
        profile.has_careers_page = wa_data["has_careers_page"]
    if wa_data.get("social_links"):
        profile.social_links = wa_data["social_links"]
    if wa_data.get("tech_stack_detected"):
        profile.tech_stack_detected = wa_data["tech_stack_detected"]
    if wa_data.get("website_domain_age_days") is not None:
        profile.website_domain_age_days = wa_data["website_domain_age_days"]
    stats["web_done"] += 1


async def enrich_one(profile, sponsor_name, ch_scraper, wa_scraper, ch_sem, web_sem, throttle, stats):
    """Enrich a single profile — CH and website run in parallel."""
    try:
        tasks = [_do_web(profile, wa_scraper, web_sem, stats)]
        if ch_sem is not None:
            tasks.append(_do_ch(profile, sponsor_name, ch_scraper, ch_sem, throttle, stats))
        await asyncio.gather(*tasks)
        profile.enriched_at = datetime.utcnow()
        profile.enrichment_level = "LEVEL_1"
        stats["enriched"] += 1
    except Exception as e:
        profile.failure_count = (profile.failure_count or 0) + 1
        profile.last_error = str(e)[:500]
        stats["errors"] += 1


async def run_swarm(ch_concurrency: int, web_concurrency: int, limit: int):
    from sqlalchemy import select, func
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.orm import selectinload
    from app.core.config import get_settings
    from app.models.company import CompanyProfile
    from app.scrapers.companies_house import CompaniesHouseScraper
    from app.scrapers.website_analyser import WebsiteAnalyser

    settings = get_settings()
    engine = create_async_engine(
        settings.database_url, pool_size=20, max_overflow=10, echo=False,
    )
    SessionFactory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionFactory() as db:
        total_remaining = (await db.execute(
            select(func.count()).select_from(CompanyProfile).where(
                CompanyProfile.enriched_at.is_(None),
                CompanyProfile.failure_count < 3,
            )
        )).scalar()

    target = min(total_remaining, limit) if limit > 0 else total_remaining
    logger.info(
        "SWARM: %d profiles | CH=%d | Web=%d | batch=%d",
        target, ch_concurrency, web_concurrency, COMMIT_BATCH_SIZE,
    )

    ch_scraper = CompaniesHouseScraper()
    wa_scraper = WebsiteAnalyser()
    ch_sem = asyncio.Semaphore(ch_concurrency) if ch_concurrency > 0 else None
    web_sem = asyncio.Semaphore(web_concurrency)
    throttle = AdaptiveThrottle(min_delay=0.3, max_delay=30.0)

    stats = {"enriched": 0, "ch_found": 0, "web_done": 0, "errors": 0}
    start_time = time.time()
    processed = 0

    while processed < target:
        batch_size = min(COMMIT_BATCH_SIZE, target - processed)

        async with SessionFactory() as db:
            result = await db.execute(
                select(CompanyProfile)
                .options(selectinload(CompanyProfile.sponsor))
                .where(CompanyProfile.enriched_at.is_(None))
                .where(CompanyProfile.failure_count < 3)
                .order_by(CompanyProfile.enrichment_priority.desc().nullslast())
                .limit(batch_size)
            )
            profiles = list(result.scalars().all())

            if not profiles:
                logger.info("No more unenriched profiles found")
                break

            tasks = [
                enrich_one(p, p.sponsor.organisation_name if p.sponsor else None,
                          ch_scraper, wa_scraper, ch_sem, web_sem, throttle, stats)
                for p in profiles
            ]
            await asyncio.gather(*tasks)
            await db.commit()

        processed += len(profiles)
        elapsed = time.time() - start_time
        rate = processed / elapsed * 60 if elapsed > 0 else 0
        eta_min = (target - processed) / rate if rate > 0 else 0

        logger.info(
            "%d/%d (%.1f%%) | %.0f/min | CH=%d | Web=%d | err=%d | delay=%.1fs | ETA=%.0fm",
            processed, target, processed / target * 100,
            rate, stats["ch_found"], stats["web_done"], stats["errors"],
            throttle.delay, eta_min,
        )

    elapsed = time.time() - start_time
    logger.info(
        "DONE: %d enriched | %d CH | %d web | %d errors | %.1f min",
        stats["enriched"], stats["ch_found"], stats["web_done"], stats["errors"], elapsed / 60,
    )
    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Async enrichment swarm")
    parser.add_argument("--ch-concurrency", type=int, default=CH_CONCURRENCY)
    parser.add_argument("--web-concurrency", type=int, default=WEB_CONCURRENCY)
    parser.add_argument("--limit", type=int, default=0, help="Max profiles (0=all)")
    args = parser.parse_args()
    asyncio.run(run_swarm(args.ch_concurrency, args.web_concurrency, args.limit))


if __name__ == "__main__":
    main()
