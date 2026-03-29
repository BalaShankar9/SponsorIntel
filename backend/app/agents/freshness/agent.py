"""James Okafor — Listings Lifecycle Manager (Operations department)."""

import logging
from typing import Any

from app.agents.base import BaseAgent, SubAgentResult
from app.agents.registry import register_agent

from .http_status_checker import HttpStatusChecker
from .repost_detector import RepostDetector
from .stale_job_reaper import StaleJobReaper
from .market_velocity_calculator import MarketVelocityCalculator

logger = logging.getLogger(__name__)


@register_agent("freshness")
class FreshnessAgent(BaseAgent):
    persona = "James Okafor"
    title = "Listings Lifecycle Manager"
    department = "Operations"
    name = "freshness"
    description = (
        "Keeps the job board fresh — checks if listings are still live, catches "
        "reposts, removes stale jobs older than 60 days, and tracks market velocity."
    )

    def _register_sub_agents(self) -> None:
        self.register(HttpStatusChecker())
        self.register(RepostDetector())
        self.register(StaleJobReaper())
        self.register(MarketVelocityCalculator())

    async def run_pipeline(self, supabase: Any) -> dict[str, SubAgentResult]:
        """Execute the full freshness pipeline in order.

        Steps:
            1. Check HTTP status of oldest-checked jobs (batch of 100)
            2. Detect reposts (same company + similar title within 30 days)
            3. Reap stale jobs (last_seen_at > 60 days or closing_signal)
            4. Calculate market velocity metrics per industry/city
        """
        results: dict[str, SubAgentResult] = {}

        logger.info("[PULSE] Starting freshness pipeline")

        # Step 1 - HTTP status check
        checker = self.get_sub_agent("http_status_checker")
        results["http_status_checker"] = await checker.run(supabase=supabase, batch_size=100)
        logger.info(
            "[PULSE] HTTP status check complete: %s",
            results["http_status_checker"].summary,
        )

        # Step 2 - Repost detection
        detector = self.get_sub_agent("repost_detector")
        results["repost_detector"] = await detector.run(supabase=supabase)
        logger.info(
            "[PULSE] Repost detection complete: %s",
            results["repost_detector"].summary,
        )

        # Step 3 - Stale job reaping
        reaper = self.get_sub_agent("stale_job_reaper")
        results["stale_job_reaper"] = await reaper.run(supabase=supabase)
        logger.info(
            "[PULSE] Stale job reaping complete: %s",
            results["stale_job_reaper"].summary,
        )

        # Step 4 - Market velocity calculation
        calculator = self.get_sub_agent("market_velocity_calculator")
        results["market_velocity_calculator"] = await calculator.run(supabase=supabase)
        logger.info(
            "[PULSE] Market velocity calculation complete: %s",
            results["market_velocity_calculator"].summary,
        )

        logger.info("[PULSE] Freshness pipeline finished")
        return results
