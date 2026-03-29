"""Liam Foster — Free API Specialist (Acquisition department)."""

import asyncio
import logging
from app.agents.base import BaseSubAgent
from app.scrapers.remotive_api import RemotiveAPIScraper
from app.scrapers.arbeitnow_api import ArbeitnowAPIScraper
from app.scrapers.jobicy_api import JobicyAPIScraper
from app.scrapers.themuse_api import TheMuseAPIScraper
from app.scrapers.himalayas_api import HimalayasAPIScraper
from app.scrapers.remoteok_api import RemoteOKAPIScraper
from app.scrapers.wwr_rss import WWRRSSScraper
from app.scrapers.devitjobs_api import DevITJobsAPIScraper
from app.scrapers.hn_hiring_api import HNHiringAPIScraper
from app.scrapers.teaching_vacancies_api import TeachingVacanciesAPIScraper
from app.scrapers.charityjob_feed import CharityJobFeedScraper

logger = logging.getLogger(__name__)

# Sponsorship-first keywords — these surface jobs that explicitly offer
# visa sponsorship, which is the platform's core value proposition.
SPONSORSHIP_KEYWORDS = [
    "visa sponsorship",
    "skilled worker visa",
    "sponsor visa",
    "tier 2 visa",
    "certificate of sponsorship",
    "sponsorship available",
    "international candidates",
]

# High-demand roles that commonly offer sponsorship in the UK
ROLE_KEYWORDS = [
    "software engineer", "data engineer", "registered nurse",
    "care worker", "civil engineer", "accountant",
    "teacher", "pharmacist", "data scientist",
    "devops engineer", "product manager", "mechanical engineer",
    "business analyst", "project manager", "healthcare assistant",
    "chef", "quantity surveyor", "financial analyst",
    "full stack developer", "machine learning engineer",
    "clinical psychologist", "radiographer", "midwife",
]


class FreeAPIHunter(BaseSubAgent):
    name = "free_api_hunter"
    persona = "Liam Foster"
    title = "Free API Specialist"
    agent_type = "DET"
    description = "Runs all 11 zero-auth API scrapers concurrently"

    SCRAPERS = [
        RemotiveAPIScraper,
        ArbeitnowAPIScraper,
        JobicyAPIScraper,
        TheMuseAPIScraper,
        HimalayasAPIScraper,
        RemoteOKAPIScraper,
        WWRRSSScraper,
        DevITJobsAPIScraper,
        HNHiringAPIScraper,
        TeachingVacanciesAPIScraper,
        CharityJobFeedScraper,
    ]

    async def run(self, keywords: list[str] | None = None, **kwargs) -> list[dict]:
        """Run all free API scrapers concurrently with sponsorship-first keywords."""
        kws = keywords or (SPONSORSHIP_KEYWORDS + ROLE_KEYWORDS)
        all_jobs = []

        async def _scrape_source(scraper_cls):
            scraper = scraper_cls()
            source_jobs = []
            seen_ids = set()
            try:
                # Use up to 15 keywords per source for maximum coverage
                for kw in kws[:15]:
                    try:
                        jobs = await scraper.scrape(keyword=kw)
                        if jobs:
                            for job in jobs:
                                # Dedup within this scrape run
                                jid = job.get("source_job_id")
                                if jid and jid in seen_ids:
                                    continue
                                if jid:
                                    seen_ids.add(jid)
                                source_jobs.append(job)
                    except Exception as e:
                        logger.warning(f"[{scraper.name}] keyword '{kw}': {e}")
                logger.info(f"[{scraper.name}] Found {len(source_jobs)} unique jobs")
            except Exception as e:
                logger.error(f"[{scraper.name}] Failed: {e}")
            return source_jobs

        results = await asyncio.gather(
            *[_scrape_source(cls) for cls in self.SCRAPERS],
            return_exceptions=True,
        )

        for result in results:
            if isinstance(result, list):
                all_jobs.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"Scraper exception: {result}")

        logger.info(f"FreeAPIHunter total: {len(all_jobs)} jobs from {len(self.SCRAPERS)} sources")
        return all_jobs
