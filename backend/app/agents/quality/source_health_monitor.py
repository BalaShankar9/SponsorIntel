"""Isla Mckenzie — Source Health Monitor (Quality department)."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

HEALTH_WINDOW_DAYS = 7


class SourceHealthMonitor(BaseSubAgent):
    name = "source_health_monitor"
    persona = "Isla Mckenzie"
    title = "Source Health Monitor"
    agent_type = "DET"
    description = (
        "Checks per-source metrics including success rate, average jobs returned, "
        "and average completeness. Writes results to source_health_log table."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(days=HEALTH_WINDOW_DAYS)).isoformat()

        # Fetch all jobs from the health window grouped by source
        response = (
            supabase.table("jobs")
            .select("id, source, completeness_score, status, scraped_at")
            .gte("scraped_at", window_start)
            .execute()
        )
        jobs = response.data or []

        if not jobs:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"sources_checked": 0},
                summary="No jobs in health window to analyse.",
            )

        # Fetch scrape run logs to calculate success rate
        scrape_response = (
            supabase.table("scrape_runs")
            .select("id, source, status, jobs_found")
            .gte("started_at", window_start)
            .execute()
        )
        scrape_runs = scrape_response.data or []

        # Group scrape runs by source
        source_runs: dict[str, list[dict]] = {}
        for run in scrape_runs:
            source = run.get("source", "unknown")
            source_runs.setdefault(source, []).append(run)

        # Group jobs by source
        source_jobs: dict[str, list[dict]] = {}
        for job in jobs:
            source = job.get("source", "unknown")
            source_jobs.setdefault(source, []).append(job)

        all_sources = set(source_runs.keys()) | set(source_jobs.keys())
        records_written = 0

        for source in all_sources:
            runs = source_runs.get(source, [])
            s_jobs = source_jobs.get(source, [])

            # Success rate from scrape runs
            total_runs = len(runs)
            successful_runs = sum(
                1 for r in runs if r.get("status") == "success"
            )
            success_rate = (
                round(successful_runs / total_runs, 4) if total_runs > 0 else None
            )

            # Average jobs returned per successful run
            jobs_per_run_values = [
                r.get("jobs_found", 0) for r in runs if r.get("status") == "success"
            ]
            avg_jobs_returned = (
                round(sum(jobs_per_run_values) / len(jobs_per_run_values), 1)
                if jobs_per_run_values
                else None
            )

            # Average completeness of jobs from this source
            completeness_values = [
                j["completeness_score"]
                for j in s_jobs
                if j.get("completeness_score") is not None
            ]
            avg_completeness = (
                round(sum(completeness_values) / len(completeness_values), 1)
                if completeness_values
                else None
            )

            record = {
                "source": source,
                "window_days": HEALTH_WINDOW_DAYS,
                "total_runs": total_runs,
                "successful_runs": successful_runs,
                "success_rate": success_rate,
                "avg_jobs_returned": avg_jobs_returned,
                "total_jobs": len(s_jobs),
                "avg_completeness": avg_completeness,
                "checked_at": now.isoformat(),
            }

            supabase.table("source_health_log").insert(record).execute()
            records_written += 1

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "sources_checked": records_written,
                "total_jobs_in_window": len(jobs),
                "total_scrape_runs": len(scrape_runs),
            },
            summary=(
                f"Monitored {records_written} sources; "
                f"{len(jobs)} jobs and {len(scrape_runs)} scrape runs in window."
            ),
        )
