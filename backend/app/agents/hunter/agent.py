"""Aria Singh — Head of Job Sourcing (Acquisition department)."""

import logging
from app.agents.base import BaseAgent
from app.agents.registry import register_agent

logger = logging.getLogger(__name__)


@register_agent("hunter")
class HunterAgent(BaseAgent):
    persona = "Aria Singh"
    title = "Head of Job Sourcing"
    department = "Acquisition"
    name = "hunter"
    description = (
        "Leads a team of 5 that sweeps 23+ UK job boards and APIs every hour "
        "to discover every visa-sponsorship opportunity before anyone else."
    )

    def _register_sub_agents(self):
        from .free_api_hunter import FreeAPIHunter
        from .api_key_hunter import APIKeyHunter
        from .source_selector import SourceSelector
        from .search_prioritiser import SearchPrioritiser
        from .entity_resolver import EntityResolver

        self.register(FreeAPIHunter())
        self.register(APIKeyHunter())
        self.register(SourceSelector())
        self.register(SearchPrioritiser())
        self.register(EntityResolver())

    async def run_pipeline(self, sources: list[str] | None = None, **kwargs) -> dict:
        """Run the hunting pipeline for specified sources."""
        results = {"jobs_found": 0, "errors": [], "sources_scraped": [], "raw_jobs": []}

        # Determine which sources to scrape
        selector = self.get_sub_agent("source_selector")
        if not sources:
            sel_result = await selector.execute()
            sources = sel_result.data or ["free_apis"]

        # Run free API hunter
        if "free_apis" in sources:
            hunter = self.get_sub_agent("free_api_hunter")
            result = await hunter.execute(keywords=kwargs.get("keywords"))
            if result.success:
                jobs = result.data or []
                results["jobs_found"] += len(jobs)
                results["raw_jobs"].extend(jobs)
                results["sources_scraped"].append("free_apis")
            else:
                results["errors"].append(f"free_apis: {result.error}")

        # Run API-key hunter (Reed, Adzuna, Jooble)
        if "api_key" in sources:
            hunter = self.get_sub_agent("api_key_hunter")
            result = await hunter.execute(keywords=kwargs.get("keywords"))
            if result.success:
                jobs = result.data or []
                results["jobs_found"] += len(jobs)
                results["raw_jobs"].extend(jobs)
                results["sources_scraped"].append("api_key")
            else:
                results["errors"].append(f"api_key: {result.error}")

        logger.info(
            f"[Hunter] Pipeline complete: {results['jobs_found']} jobs from {len(results['sources_scraped'])} source groups"
        )
        return results
