"""Finlay Scott — Gap Identification Specialist (Quality department)."""

import logging
from datetime import datetime, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Fields to check for gaps (same as completeness scorer)
REQUIRED_FIELDS = [
    "title",
    "company_name",
    "description",
    "salary_min",
    "location",
    "source_url",
    "skills",
    "seniority",
    "contract_type",
    "sponsorship_score",
]

# Jobs below this completeness score are considered incomplete
INCOMPLETE_THRESHOLD = 80


class GapIdentifier(BaseSubAgent):
    name = "gap_identifier"
    persona = "Finlay Scott"
    title = "Gap Identification Specialist"
    agent_type = "DET"
    description = (
        "Identifies which fields are missing for jobs with completeness score "
        f"below {INCOMPLETE_THRESHOLD}. Writes gap details to job_gaps table."
    )

    @staticmethod
    def _find_missing_fields(job: dict) -> list[str]:
        """Return list of missing field names for a job."""
        missing = []
        for field in REQUIRED_FIELDS:
            value = job.get(field)
            if value is None or value == "" or value == []:
                missing.append(field)
        return missing

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]

        # Fetch incomplete jobs that haven't been gap-analysed
        fields = ", ".join(["id"] + REQUIRED_FIELDS)
        response = (
            supabase.table("jobs")
            .select(fields + ", completeness_score")
            .lt("completeness_score", INCOMPLETE_THRESHOLD)
            .is_("gaps_identified_at", "null")
            .limit(1000)
            .execute()
        )
        jobs = response.data or []

        if not jobs:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"analysed": 0, "total_gaps": 0},
                summary="No incomplete jobs to analyse.",
            )

        now = datetime.now(timezone.utc).isoformat()
        total_gaps = 0
        gap_frequency: dict[str, int] = {f: 0 for f in REQUIRED_FIELDS}

        for job in jobs:
            missing = self._find_missing_fields(job)
            total_gaps += len(missing)

            for field in missing:
                gap_frequency[field] += 1

            # Write gap record
            supabase.table("job_gaps").upsert(
                {
                    "job_id": job["id"],
                    "missing_fields": missing,
                    "gap_count": len(missing),
                    "identified_at": now,
                },
                on_conflict="job_id",
            ).execute()

            # Mark job as gap-analysed
            supabase.table("jobs").update(
                {"gaps_identified_at": now}
            ).eq("id", job["id"]).execute()

        # Sort gap frequency to find most common gaps
        sorted_gaps = sorted(gap_frequency.items(), key=lambda x: x[1], reverse=True)
        top_gaps = {k: v for k, v in sorted_gaps if v > 0}

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "analysed": len(jobs),
                "total_gaps": total_gaps,
                "gap_frequency": top_gaps,
            },
            summary=(
                f"Analysed {len(jobs)} incomplete jobs; "
                f"{total_gaps} total gaps found. "
                f"Most common: {', '.join(f'{k}({v})' for k, v in list(sorted_gaps)[:3] if v > 0)}."
            ),
        )
