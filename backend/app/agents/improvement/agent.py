"""Dr. Alex Thornton — Head of Platform Intelligence (Improvement & R&D department).

Leads the team that continuously optimizes the platform:
- Zara Mahmood analyses keyword effectiveness
- Tomas Garcia scouts for new job sources
- Ines Dubois calibrates sponsorship scoring
"""

import logging
from typing import Any

from app.agents.base import BaseAgent, SubAgentResult
from app.agents.registry import register_agent

from .keyword_optimizer import KeywordOptimizer
from .source_scout import SourceScout
from .scoring_calibrator import ScoringCalibrator

logger = logging.getLogger(__name__)


@register_agent("improvement")
class ImprovementAgent(BaseAgent):
    persona = "Dr. Alex Thornton"
    title = "Head of Platform Intelligence"
    department = "Improvement & R&D"
    name = "improvement"
    description = (
        "Leads a 3-person R&D team that continuously optimizes keyword strategy, "
        "discovers new data sources, and calibrates scoring accuracy."
    )

    def _register_sub_agents(self) -> None:
        self.register(KeywordOptimizer())
        self.register(SourceScout())
        self.register(ScoringCalibrator())

    async def run_pipeline(self, supabase: Any) -> dict[str, Any]:
        """Execute the full improvement pipeline.

        Steps:
            1. Zara analyses keyword effectiveness
            2. Tomas scouts for new sources
            3. Ines calibrates scoring weights
        """
        results: dict[str, Any] = {}

        logger.info("[R&D] Starting improvement pipeline — Dr. Alex Thornton")

        # Step 1 — Keyword optimization (Zara Mahmood)
        optimizer = self.get_sub_agent("keyword_optimizer")
        r = await optimizer.execute(supabase=supabase)
        results["keyword_optimizer"] = {
            "success": r.success,
            "duration_ms": r.duration_ms,
            "data": r.data,
        }
        logger.info(f"[R&D] Zara's keyword analysis: {'OK' if r.success else 'FAILED'}")

        # Step 2 — Source discovery (Tomas Garcia)
        scout = self.get_sub_agent("source_scout")
        r = await scout.execute(supabase=supabase)
        results["source_scout"] = {
            "success": r.success,
            "duration_ms": r.duration_ms,
            "data": r.data,
        }
        logger.info(f"[R&D] Tomas's source scout: {'OK' if r.success else 'FAILED'}")

        # Step 3 — Scoring calibration (Ines Dubois)
        calibrator = self.get_sub_agent("scoring_calibrator")
        r = await calibrator.execute(supabase=supabase)
        results["scoring_calibrator"] = {
            "success": r.success,
            "duration_ms": r.duration_ms,
            "data": r.data,
        }
        logger.info(f"[R&D] Ines's scoring calibration: {'OK' if r.success else 'FAILED'}")

        logger.info("[R&D] Improvement pipeline finished — Dr. Alex Thornton")
        return results
