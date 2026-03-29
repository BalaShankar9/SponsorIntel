"""Omar Farah — Anomaly Detection Specialist (Orchestrator department)."""

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

ROLLING_WINDOW_DAYS = 7
STD_DEV_THRESHOLD = 2.0

# Metrics to monitor for anomalies
MONITORED_METRICS = [
    "active_job_count",
    "expired_job_count",
    "total_job_count",
    "sponsor_count",
    "avg_completeness_score",
]


class AnomalyDetector(BaseSubAgent):
    name = "anomaly_detector"
    persona = "Omar Farah"
    title = "Anomaly Detection Specialist"
    agent_type = "DET"
    description = (
        "Compares the current pipeline run metrics against a 7-day rolling average. "
        "Raises alerts if any metric deviates by more than 2 standard deviations."
    )

    @staticmethod
    def _mean(values: list[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    @staticmethod
    def _std_dev(values: list[float], mean: float) -> float:
        if len(values) < 2:
            return 0.0
        variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
        return math.sqrt(variance)

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(days=ROLLING_WINDOW_DAYS)).isoformat()

        # Fetch historical metrics from the rolling window
        history_resp = (
            supabase.table("swarm_metrics")
            .select(", ".join(["recorded_at"] + MONITORED_METRICS))
            .gte("recorded_at", window_start)
            .order("recorded_at", desc=True)
            .execute()
        )
        history = history_resp.data or []

        if len(history) < 3:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"anomalies": [], "history_points": len(history)},
                summary=(
                    f"Insufficient history ({len(history)} points) for anomaly detection; "
                    f"need at least 3."
                ),
            )

        # The most recent entry is the current run
        current = history[0]
        previous = history[1:]

        anomalies: list[dict[str, Any]] = []

        for metric in MONITORED_METRICS:
            current_value = current.get(metric)
            if current_value is None:
                continue

            historical_values = [
                r[metric] for r in previous if r.get(metric) is not None
            ]
            if len(historical_values) < 2:
                continue

            mean = self._mean(historical_values)
            std = self._std_dev(historical_values, mean)

            if std == 0:
                continue

            z_score = (current_value - mean) / std

            if abs(z_score) > STD_DEV_THRESHOLD:
                direction = "above" if z_score > 0 else "below"
                anomaly = {
                    "metric": metric,
                    "current_value": current_value,
                    "rolling_mean": round(mean, 2),
                    "rolling_std": round(std, 2),
                    "z_score": round(z_score, 2),
                    "direction": direction,
                    "severity": "critical" if abs(z_score) > 3 else "warning",
                    "detected_at": now.isoformat(),
                }
                anomalies.append(anomaly)
                logger.warning(
                    "Anomaly detected: %s is %.2f (mean=%.2f, std=%.2f, z=%.2f)",
                    metric,
                    current_value,
                    mean,
                    std,
                    z_score,
                )

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "anomalies": anomalies,
                "metrics_checked": len(MONITORED_METRICS),
                "history_points": len(previous),
            },
            summary=(
                f"Checked {len(MONITORED_METRICS)} metrics against "
                f"{len(previous)}-point history; "
                f"{len(anomalies)} anomalies detected."
            ),
        )
