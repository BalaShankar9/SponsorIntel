"""Kofi Mensah — Market Velocity Analyst (Freshness department)."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

VELOCITY_WINDOW_DAYS = 90


class MarketVelocityCalculator(BaseSubAgent):
    name = "market_velocity_calculator"
    persona = "Kofi Mensah"
    title = "Market Velocity Analyst"
    agent_type = "DET"
    description = (
        "Calculates avg_days_to_fill, new_postings_per_week, and churn_rate "
        "per industry and city. Writes results to the market_velocity table."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        now = datetime.now(timezone.utc)
        window_start = (now - timedelta(days=VELOCITY_WINDOW_DAYS)).isoformat()
        weeks_in_window = VELOCITY_WINDOW_DAYS / 7.0

        # Fetch jobs within the velocity window
        response = (
            supabase.table("jobs")
            .select(
                "id, industry, city, status, posted_at, expired_at, last_seen_at"
            )
            .gte("posted_at", window_start)
            .execute()
        )
        jobs = response.data or []

        if not jobs:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"segments_updated": 0},
                summary="No jobs found in velocity window.",
            )

        # Group by (industry, city)
        segments: dict[tuple[str, str], list[dict]] = {}
        for job in jobs:
            industry = job.get("industry") or "Unknown"
            city = job.get("city") or "Unknown"
            key = (industry, city)
            segments.setdefault(key, []).append(job)

        records_written = 0

        for (industry, city), segment_jobs in segments.items():
            total_jobs = len(segment_jobs)
            expired_jobs = [j for j in segment_jobs if j.get("status") == "expired"]

            # avg_days_to_fill: average time from posted_at to expired_at for filled jobs
            days_to_fill_values: list[float] = []
            for job in expired_jobs:
                posted = job.get("posted_at")
                expired = job.get("expired_at")
                if posted and expired:
                    try:
                        posted_dt = datetime.fromisoformat(posted.replace("Z", "+00:00"))
                        expired_dt = datetime.fromisoformat(expired.replace("Z", "+00:00"))
                        delta = (expired_dt - posted_dt).total_seconds() / 86400.0
                        if delta > 0:
                            days_to_fill_values.append(delta)
                    except (ValueError, TypeError):
                        continue

            avg_days_to_fill = (
                round(sum(days_to_fill_values) / len(days_to_fill_values), 1)
                if days_to_fill_values
                else None
            )

            # new_postings_per_week
            new_postings_per_week = round(total_jobs / weeks_in_window, 2)

            # churn_rate: expired / total in the window
            churn_rate = (
                round(len(expired_jobs) / total_jobs, 4) if total_jobs > 0 else 0.0
            )

            # Upsert into market_velocity table
            record = {
                "industry": industry,
                "city": city,
                "avg_days_to_fill": avg_days_to_fill,
                "new_postings_per_week": new_postings_per_week,
                "churn_rate": churn_rate,
                "total_jobs_in_window": total_jobs,
                "expired_jobs_in_window": len(expired_jobs),
                "window_days": VELOCITY_WINDOW_DAYS,
                "calculated_at": now.isoformat(),
            }

            supabase.table("market_velocity").upsert(
                record, on_conflict="industry,city"
            ).execute()
            records_written += 1

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "segments_updated": records_written,
                "total_jobs_analysed": len(jobs),
            },
            summary=(
                f"Updated {records_written} industry/city segments "
                f"from {len(jobs)} jobs."
            ),
        )
