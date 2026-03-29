"""Tomas Garcia — Source Discovery Scout (Improvement & R&D department).

Discovers and tests new job boards, RSS feeds, and API endpoints
that might have UK sponsorship jobs. Evaluates their quality.
"""

import logging
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

# Known potential sources to evaluate
CANDIDATE_SOURCES = [
    {"name": "Workable", "url": "https://jobs.workable.com", "type": "ats_aggregator"},
    {"name": "Greenhouse", "url": "https://boards.greenhouse.io", "type": "ats_aggregator"},
    {"name": "Lever", "url": "https://jobs.lever.co", "type": "ats_aggregator"},
    {"name": "Startup Jobs", "url": "https://startup.jobs/api", "type": "api"},
    {"name": "EuroJobs", "url": "https://eurojobs.com", "type": "website"},
    {"name": "CivilServiceJobs", "url": "https://www.civilservicejobs.service.gov.uk", "type": "gov"},
    {"name": "Escape the City", "url": "https://www.escapethecity.org", "type": "website"},
    {"name": "Technojobs", "url": "https://www.technojobs.co.uk", "type": "website"},
    {"name": "Jobs.ac.uk", "url": "https://www.jobs.ac.uk", "type": "academic"},
    {"name": "Charity Jobs UK", "url": "https://www.charityjob.co.uk", "type": "charity"},
]


class SourceScout(BaseSubAgent):
    name = "source_scout"
    persona = "Tomas Garcia"
    title = "Source Discovery Scout"
    agent_type = "DET"
    description = "Discovers and evaluates new job sources for UK visa sponsorship coverage."

    async def run(self, supabase=None, **kwargs):
        """Evaluate potential new sources and check existing source coverage.

        1. Check which known sources we're NOT yet scraping
        2. Test if candidate sources have UK sponsorship content
        3. Report on source coverage gaps
        """
        if not supabase:
            return {"status": "no_supabase", "findings": []}

        import httpx

        findings = []

        # Check current source coverage
        try:
            result = supabase.table("jobs").select(
                "source"
            ).execute()
            active_sources = set()
            for job in (result.data or []):
                active_sources.add(job.get("source", ""))
        except Exception:
            active_sources = set()

        # Test candidate sources
        for candidate in CANDIDATE_SOURCES:
            try:
                async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                    resp = await client.get(candidate["url"])
                    is_reachable = resp.status_code < 400

                    # Quick check for sponsorship-related content
                    content = resp.text.lower()
                    has_sponsorship = any(
                        term in content
                        for term in ["visa", "sponsor", "skilled worker", "immigration"]
                    )

                    findings.append({
                        "source": candidate["name"],
                        "url": candidate["url"],
                        "type": candidate["type"],
                        "reachable": is_reachable,
                        "has_sponsorship_content": has_sponsorship,
                        "already_scraping": candidate["name"].lower().replace(" ", "_") in active_sources,
                        "recommendation": "integrate" if is_reachable and has_sponsorship else "skip",
                    })

            except Exception as e:
                findings.append({
                    "source": candidate["name"],
                    "url": candidate["url"],
                    "reachable": False,
                    "error": str(e)[:200],
                    "recommendation": "skip",
                })

        # Log findings
        try:
            supabase.table("improvement_log").insert({
                "agent": self.name,
                "persona": self.persona,
                "analysis_type": "source_discovery",
                "recommendations": findings,
                "active_sources_count": len(active_sources),
            }).execute()
        except Exception as e:
            logger.debug(f"[{self.persona}] Could not log to improvement_log: {e}")

        integrate_count = sum(1 for f in findings if f.get("recommendation") == "integrate")
        logger.info(
            f"[{self.persona}] Source scout: {len(findings)} sources evaluated, "
            f"{integrate_count} recommended for integration"
        )

        return {
            "findings": findings,
            "active_sources": len(active_sources),
            "recommended_integrations": integrate_count,
        }
