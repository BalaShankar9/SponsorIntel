"""Ruby Sinclair — Alert Publishing Coordinator (Orchestrator department)."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)


class AlertPublisher(BaseSubAgent):
    name = "alert_publisher"
    persona = "Ruby Sinclair"
    title = "Alert Publishing Coordinator"
    agent_type = "DET"
    description = (
        "Publishes detected anomalies and pipeline alerts to the swarm_alerts table "
        "for downstream consumption by dashboards and notification systems."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        anomalies: list[dict[str, Any]] = kwargs.get("anomalies", [])

        if not anomalies:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"alerts_published": 0},
                summary="No anomalies to publish.",
            )

        now = datetime.now(timezone.utc).isoformat()
        published_count = 0

        for anomaly in anomalies:
            metric = anomaly.get("metric", "unknown")
            severity = anomaly.get("severity", "warning")
            direction = anomaly.get("direction", "unknown")
            current_value = anomaly.get("current_value")
            rolling_mean = anomaly.get("rolling_mean")
            z_score = anomaly.get("z_score")

            title = (
                f"[{severity.upper()}] {metric} is {direction} normal "
                f"(z-score: {z_score})"
            )
            message = (
                f"Metric '{metric}' has a current value of {current_value}, "
                f"which is {direction} the 7-day rolling mean of {rolling_mean} "
                f"by {abs(z_score):.1f} standard deviations."
            )

            alert_record = {
                "id": str(uuid.uuid4()),
                "title": title,
                "message": message,
                "severity": severity,
                "metric": metric,
                "current_value": current_value,
                "rolling_mean": rolling_mean,
                "z_score": z_score,
                "status": "open",
                "created_at": now,
            }

            try:
                supabase.table("swarm_alerts").insert(alert_record).execute()
                published_count += 1
            except Exception as exc:
                logger.error("Failed to publish alert for %s: %s", metric, exc)

        severity_counts: dict[str, int] = {}
        for anomaly in anomalies:
            sev = anomaly.get("severity", "warning")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "alerts_published": published_count,
                "severity_counts": severity_counts,
            },
            summary=(
                f"Published {published_count} alerts. "
                f"Severities: {severity_counts}."
            ),
        )
