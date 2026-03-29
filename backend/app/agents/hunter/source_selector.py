"""Callum Hughes — Source Selection Analyst (Acquisition department)."""

import logging
from datetime import datetime, timezone
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

# Source tiers with their scrape intervals (hours)
SOURCE_TIERS = {
    "free_apis": {"interval_hours": 2, "sources": [
        "remotive", "arbeitnow", "jobicy", "themuse", "himalayas",
        "remoteok", "wwr", "devitjobs", "hn_hiring",
    ]},
    "api_key": {"interval_hours": 4, "sources": [
        "reed", "adzuna", "jooble",
    ]},
    "gov": {"interval_hours": 12, "sources": [
        "gov_findajob", "nhs_jobs", "teaching_vacancies", "charityjob",
    ]},
    "browser": {"interval_hours": 8, "sources": [
        "indeed", "linkedin", "glassdoor", "totaljobs", "cwjobs",
        "guardian",
    ]},
}


class SourceSelector(BaseSubAgent):
    name = "source_selector"
    persona = "Callum Hughes"
    title = "Source Selection Analyst"
    agent_type = "DET"
    description = "Selects which source groups are due for scraping"

    async def run(self, force: list[str] | None = None, **kwargs) -> list[str]:
        """Return list of source group names due for scraping."""
        if force:
            return force

        now = datetime.now(timezone.utc)
        due = []

        for tier_name, tier_config in SOURCE_TIERS.items():
            # Check last scrape time from Redis if available
            if self.redis:
                key = f"last_scrape:{tier_name}"
                last = await self.redis.get(key)
                if last:
                    try:
                        last_dt = datetime.fromisoformat(last.decode() if isinstance(last, bytes) else last)
                        elapsed_hours = (now - last_dt).total_seconds() / 3600
                        if elapsed_hours < tier_config["interval_hours"]:
                            continue
                    except (ValueError, AttributeError):
                        pass

            due.append(tier_name)

        if not due:
            # Always run at least free_apis
            due = ["free_apis"]

        logger.info(f"[SourceSelector] Due source groups: {due}")
        return due
