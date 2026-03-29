"""Sophie Laurent — Data Completeness Auditor (Quality Assurance department)."""

import logging
from typing import Any

from app.agents.base import BaseAgent, SubAgentResult
from app.agents.registry import register_agent

from .completeness_scorer import CompletenessScorer
from .gap_identifier import GapIdentifier
from .source_health_monitor import SourceHealthMonitor
from .hiring_score_updater import HiringScoreUpdater

logger = logging.getLogger(__name__)


@register_agent("quality")
class QualityAgent(BaseAgent):
    persona = "Sophie Laurent"
    title = "Data Completeness Auditor"
    department = "Quality Assurance"
    name = "quality"
    description = (
        "Audits every record for completeness, identifies missing fields, "
        "tracks source reliability, and scores sponsor hiring activity levels."
    )

    def _register_sub_agents(self) -> None:
        self.register(CompletenessScorer())
        self.register(GapIdentifier())
        self.register(SourceHealthMonitor())
        self.register(HiringScoreUpdater())

    async def run_pipeline(self, supabase: Any) -> dict[str, SubAgentResult]:
        """Execute the full quality pipeline in order.

        Steps:
            1. Score completeness on unscored jobs
            2. Identify field gaps on incomplete jobs
            3. Monitor source health across all sources
            4. Update hiring activity scores for sponsors with jobs
        """
        results: dict[str, SubAgentResult] = {}

        logger.info("[INSPECTOR] Starting quality pipeline")

        # Step 1 - Completeness scoring
        scorer = self.get_sub_agent("completeness_scorer")
        results["completeness_scorer"] = await scorer.run(supabase=supabase)
        logger.info(
            "[INSPECTOR] Completeness scoring complete: %s",
            results["completeness_scorer"].summary,
        )

        # Step 2 - Gap identification
        identifier = self.get_sub_agent("gap_identifier")
        results["gap_identifier"] = await identifier.run(supabase=supabase)
        logger.info(
            "[INSPECTOR] Gap identification complete: %s",
            results["gap_identifier"].summary,
        )

        # Step 3 - Source health monitoring
        monitor = self.get_sub_agent("source_health_monitor")
        results["source_health_monitor"] = await monitor.run(supabase=supabase)
        logger.info(
            "[INSPECTOR] Source health monitoring complete: %s",
            results["source_health_monitor"].summary,
        )

        # Step 4 - Hiring score updates
        updater = self.get_sub_agent("hiring_score_updater")
        results["hiring_score_updater"] = await updater.run(supabase=supabase)
        logger.info(
            "[INSPECTOR] Hiring score update complete: %s",
            results["hiring_score_updater"].summary,
        )

        logger.info("[INSPECTOR] Quality pipeline finished")
        return results
