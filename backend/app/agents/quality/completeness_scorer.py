"""Amara Osei — Completeness Scoring Analyst (Quality department)."""

import logging
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Field weights for completeness score (must sum to 100)
FIELD_WEIGHTS: dict[str, int] = {
    "title": 10,
    "company_name": 10,
    "description": 15,
    "salary_min": 15,  # salary represented by salary_min presence
    "location": 10,
    "source_url": 5,
    "skills": 10,
    "seniority": 5,
    "contract_type": 5,
    "sponsorship_score": 15,
}


class CompletenessScorer(BaseSubAgent):
    name = "completeness_scorer"
    persona = "Amara Osei"
    title = "Completeness Scoring Analyst"
    agent_type = "DET"
    description = (
        "Scores job completeness from 0-100 based on which fields are populated. "
        "Fields: title(10), company(10), description(15), salary(15), location(10), "
        "source_url(5), skills(10), seniority(5), contract_type(5), sponsorship_score(15)."
    )

    @staticmethod
    def _compute_score(job: dict) -> int:
        """Compute completeness score for a single job."""
        score = 0
        for field, weight in FIELD_WEIGHTS.items():
            value = job.get(field)
            if value is not None and value != "" and value != []:
                score += weight
        return score

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]

        # Fetch jobs that have not been scored yet
        fields = ", ".join(["id"] + list(FIELD_WEIGHTS.keys()))
        response = (
            supabase.table("jobs")
            .select(fields)
            .is_("completeness_score", "null")
            .limit(1000)
            .execute()
        )
        jobs = response.data or []

        if not jobs:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"scored": 0},
                summary="No unscored jobs found.",
            )

        now = datetime.now(timezone.utc).isoformat()
        scored_count = 0
        total_score = 0

        for job in jobs:
            score = self._compute_score(job)
            supabase.table("jobs").update(
                {
                    "completeness_score": score,
                    "completeness_scored_at": now,
                }
            ).eq("id", job["id"]).execute()
            scored_count += 1
            total_score += score

        avg_score = round(total_score / scored_count, 1) if scored_count else 0

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "scored": scored_count,
                "average_score": avg_score,
            },
            summary=(
                f"Scored {scored_count} jobs; average completeness {avg_score}/100."
            ),
        )
