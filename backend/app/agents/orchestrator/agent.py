"""Raj Patel — Chief Operations Coordinator (Operations department)."""

import logging
from typing import Any

from app.agents.base import BaseAgent, SubAgentResult
from app.agents.registry import register_agent

from .metrics_collector import MetricsCollector
from .anomaly_detector import AnomalyDetector
from .alert_publisher import AlertPublisher

logger = logging.getLogger(__name__)


@register_agent("orchestrator")
class OrchestratorAgent(BaseAgent):
    persona = "Raj Patel"
    title = "Chief Operations Coordinator"
    department = "Operations"
    name = "orchestrator"
    description = (
        "The person who keeps everything running. Collects performance metrics "
        "from all teams, spots anomalies, and raises the alarm when something breaks."
    )

    def _register_sub_agents(self) -> None:
        self.register(MetricsCollector())
        self.register(AnomalyDetector())
        self.register(AlertPublisher())

    async def run_pipeline(
        self,
        supabase: Any,
        pipeline_results: dict[str, Any] | None = None,
    ) -> dict[str, SubAgentResult]:
        """Execute the orchestrator pipeline.

        Args:
            supabase: Supabase client instance.
            pipeline_results: Optional results from other agent pipelines
                (freshness, quality, etc.) to record as metrics.

        Steps:
            1. Collect and write pipeline metrics to swarm_metrics
            2. Detect anomalies by comparing against 7-day rolling average
            3. Publish any detected alerts to swarm_alerts
        """
        results: dict[str, SubAgentResult] = {}

        logger.info("[NEXUS] Starting orchestrator pipeline")

        # Step 1 - Metrics collection
        collector = self.get_sub_agent("metrics_collector")
        results["metrics_collector"] = await collector.run(
            supabase=supabase,
            pipeline_results=pipeline_results or {},
        )
        logger.info(
            "[NEXUS] Metrics collection complete: %s",
            results["metrics_collector"].summary,
        )

        # Step 2 - Anomaly detection
        detector = self.get_sub_agent("anomaly_detector")
        results["anomaly_detector"] = await detector.run(supabase=supabase)
        logger.info(
            "[NEXUS] Anomaly detection complete: %s",
            results["anomaly_detector"].summary,
        )

        # Step 3 - Alert publishing (pass anomalies from step 2)
        anomalies = results["anomaly_detector"].data.get("anomalies", [])
        publisher = self.get_sub_agent("alert_publisher")
        results["alert_publisher"] = await publisher.run(
            supabase=supabase,
            anomalies=anomalies,
        )
        logger.info(
            "[NEXUS] Alert publishing complete: %s",
            results["alert_publisher"].summary,
        )

        logger.info("[NEXUS] Orchestrator pipeline finished")
        return results
