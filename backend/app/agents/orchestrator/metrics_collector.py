"""Alice Thornton — Metrics Collection Analyst (Orchestrator department)."""

import logging
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)


class MetricsCollector(BaseSubAgent):
    name = "metrics_collector"
    persona = "Alice Thornton"
    title = "Metrics Collection Analyst"
    agent_type = "DET"
    description = (
        "Collects pipeline run metrics (job counts, scores, durations) and "
        "writes them to the swarm_metrics table for historical tracking."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        pipeline_results = kwargs.get("pipeline_results", {})
        now = datetime.now(timezone.utc)

        # Collect current state metrics from the database
        active_jobs_resp = (
            supabase.table("jobs")
            .select("id", count="exact")
            .eq("status", "active")
            .execute()
        )
        active_job_count = active_jobs_resp.count or 0

        expired_jobs_resp = (
            supabase.table("jobs")
            .select("id", count="exact")
            .eq("status", "expired")
            .execute()
        )
        expired_job_count = expired_jobs_resp.count or 0

        total_jobs_resp = (
            supabase.table("jobs")
            .select("id", count="exact")
            .execute()
        )
        total_job_count = total_jobs_resp.count or 0

        sponsors_resp = (
            supabase.table("sponsors")
            .select("id", count="exact")
            .execute()
        )
        sponsor_count = sponsors_resp.count or 0

        # Average completeness score
        scored_jobs_resp = (
            supabase.table("jobs")
            .select("completeness_score")
            .not_.is_("completeness_score", "null")
            .limit(5000)
            .execute()
        )
        scored_jobs = scored_jobs_resp.data or []
        avg_completeness = None
        if scored_jobs:
            scores = [j["completeness_score"] for j in scored_jobs]
            avg_completeness = round(sum(scores) / len(scores), 1)

        # Extract summary counts from pipeline_results
        pipeline_summary = {}
        for agent_name, result in pipeline_results.items():
            if hasattr(result, "data") and isinstance(result.data, dict):
                pipeline_summary[agent_name] = result.data

        metrics_record = {
            "recorded_at": now.isoformat(),
            "active_job_count": active_job_count,
            "expired_job_count": expired_job_count,
            "total_job_count": total_job_count,
            "sponsor_count": sponsor_count,
            "avg_completeness_score": avg_completeness,
            "pipeline_summary": pipeline_summary,
        }

        supabase.table("swarm_metrics").insert(metrics_record).execute()

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "active_jobs": active_job_count,
                "expired_jobs": expired_job_count,
                "total_jobs": total_job_count,
                "sponsors": sponsor_count,
                "avg_completeness": avg_completeness,
            },
            summary=(
                f"Metrics recorded: {active_job_count} active, "
                f"{expired_job_count} expired, {sponsor_count} sponsors, "
                f"avg completeness {avg_completeness}."
            ),
        )
