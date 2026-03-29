"""Nadia Osman — Premium API Specialist (Acquisition department)."""

import asyncio
import logging
from app.agents.base import BaseSubAgent
from app.core.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_KEYWORDS = [
    "software engineer", "data analyst", "project manager",
    "registered nurse", "accountant", "teacher",
    "marketing manager", "mechanical engineer",
]


class APIKeyHunter(BaseSubAgent):
    name = "api_key_hunter"
    persona = "Nadia Osman"
    title = "Premium API Specialist"
    agent_type = "DET"
    description = "Runs API-key-required scrapers (Reed, Adzuna, Jooble)"

    async def run(self, keywords: list[str] | None = None, **kwargs) -> list[dict]:
        """Run API-key scrapers concurrently."""
        settings = get_settings()
        kws = keywords or DEFAULT_KEYWORDS
        all_jobs = []
        scrapers = []

        # Only include scrapers that have API keys configured
        if settings.reed_api_key:
            from app.scrapers.reed_api import ReedAPIScraper
            scrapers.append(ReedAPIScraper())

        if settings.adzuna_app_id and settings.adzuna_app_key:
            from app.scrapers.adzuna_api import AdzunaAPIScraper
            scrapers.append(AdzunaAPIScraper())

        if settings.jooble_api_key:
            from app.scrapers.jooble_api import JoobleAPIScraper
            scrapers.append(JoobleAPIScraper())

        if not scrapers:
            logger.warning("No API keys configured for API-key scrapers")
            return []

        async def _scrape_source(scraper):
            source_jobs = []
            try:
                for kw in kws[:5]:
                    try:
                        jobs = await scraper.scrape(keyword=kw, location="UK")
                        if jobs:
                            source_jobs.extend(jobs)
                    except Exception as e:
                        logger.warning(f"[{scraper.name}] keyword '{kw}': {e}")
                logger.info(f"[{scraper.name}] Found {len(source_jobs)} jobs")
            except Exception as e:
                logger.error(f"[{scraper.name}] Failed: {e}")
            return source_jobs

        results = await asyncio.gather(
            *[_scrape_source(s) for s in scrapers],
            return_exceptions=True,
        )

        for result in results:
            if isinstance(result, list):
                all_jobs.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"API-key scraper exception: {result}")

        logger.info(f"APIKeyHunter total: {len(all_jobs)} jobs from {len(scrapers)} sources")
        return all_jobs
