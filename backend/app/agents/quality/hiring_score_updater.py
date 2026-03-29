"""Kwame Asante — Hiring Score Analyst (Quality department)."""

import logging
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Scoring tiers: (minimum active jobs, score)
SCORE_TIERS = [
    (20, 95),
    (10, 80),
    (5, 65),
    (1, 50),
    (0, 25),
]


class HiringScoreUpdater(BaseSubAgent):
    name = "hiring_score_updater"
    persona = "Kwame Asante"
    title = "Hiring Score Analyst"
    agent_type = "DET"
    description = (
        "Updates sponsor_scores.hiring_activity_score based on active job count. "
        "Tiers: >=20 jobs -> 95, >=10 -> 80, >=5 -> 65, >=1 -> 50, 0 -> 25."
    )

    @staticmethod
    def _calculate_score(active_job_count: int) -> int:
        """Return hiring activity score based on active job count."""
        for threshold, score in SCORE_TIERS:
            if active_job_count >= threshold:
                return score
        return 25  # fallback

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        now = datetime.now(timezone.utc).isoformat()

        # Fetch all sponsors
        sponsors_response = (
            supabase.table("sponsors")
            .select("id, company_name")
            .execute()
        )
        sponsors = sponsors_response.data or []

        if not sponsors:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"updated": 0},
                summary="No sponsors found.",
            )

        updated_count = 0
        score_distribution: dict[int, int] = {}

        for sponsor in sponsors:
            sponsor_id = sponsor["id"]
            company_name = sponsor.get("company_name", "")

            # Count active jobs for this sponsor
            count_response = (
                supabase.table("jobs")
                .select("id", count="exact")
                .eq("company_name", company_name)
                .eq("status", "active")
                .execute()
            )
            active_count = count_response.count or 0

            score = self._calculate_score(active_count)
            score_distribution[score] = score_distribution.get(score, 0) + 1

            # Upsert into sponsor_scores
            supabase.table("sponsor_scores").upsert(
                {
                    "sponsor_id": sponsor_id,
                    "hiring_activity_score": score,
                    "active_job_count": active_count,
                    "updated_at": now,
                },
                on_conflict="sponsor_id",
            ).execute()
            updated_count += 1

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "updated": updated_count,
                "score_distribution": score_distribution,
            },
            summary=(
                f"Updated hiring scores for {updated_count} sponsors. "
                f"Distribution: {score_distribution}."
            ),
        )
