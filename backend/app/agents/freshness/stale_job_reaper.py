"""Evie Donovan — Stale Listing Reaper (Freshness department)."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

STALE_THRESHOLD_DAYS = 60


class StaleJobReaper(BaseSubAgent):
    name = "stale_job_reaper"
    persona = "Evie Donovan"
    title = "Stale Listing Reaper"
    agent_type = "DET"
    description = (
        "Marks jobs as expired if they have not been seen for more than 60 days "
        "or if a closing signal has been detected."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        now = datetime.now(timezone.utc).isoformat()
        stale_cutoff = (
            datetime.now(timezone.utc) - timedelta(days=STALE_THRESHOLD_DAYS)
        ).isoformat()

        # 1. Expire jobs not seen for > 60 days
        stale_response = (
            supabase.table("jobs")
            .update({"status": "expired", "expired_at": now, "expiry_reason": "stale"})
            .eq("status", "active")
            .lt("last_seen_at", stale_cutoff)
            .execute()
        )
        stale_count = len(stale_response.data or [])

        # 2. Expire jobs with closing_signal = true
        closing_response = (
            supabase.table("jobs")
            .update(
                {
                    "status": "expired",
                    "expired_at": now,
                    "expiry_reason": "closing_signal",
                }
            )
            .eq("status", "active")
            .eq("closing_signal", True)
            .execute()
        )
        closing_count = len(closing_response.data or [])

        total = stale_count + closing_count

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "stale_expired": stale_count,
                "closing_signal_expired": closing_count,
                "total_expired": total,
            },
            summary=(
                f"Expired {total} jobs: {stale_count} stale (>{STALE_THRESHOLD_DAYS}d), "
                f"{closing_count} closing signal."
            ),
        )
