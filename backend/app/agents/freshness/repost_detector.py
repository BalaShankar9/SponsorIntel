"""Samir Iqbal — Repost Detection Specialist (Freshness department)."""

import logging
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.85
REPOST_WINDOW_DAYS = 30


class RepostDetector(BaseSubAgent):
    name = "repost_detector"
    persona = "Samir Iqbal"
    title = "Repost Detection Specialist"
    agent_type = "DET"
    description = (
        "Detects reposted jobs by finding entries from the same company with "
        "similar titles posted within a 30-day window. Updates repost_count "
        "and repost_of_job_id on detected reposts."
    )

    @staticmethod
    def _title_similarity(a: str, b: str) -> float:
        """Return similarity ratio between two job titles."""
        return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]

        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=REPOST_WINDOW_DAYS)
        ).isoformat()

        # Fetch recently posted active jobs that haven't been repost-checked yet
        response = (
            supabase.table("jobs")
            .select("id, company_name, title, posted_at")
            .eq("status", "active")
            .is_("repost_checked_at", "null")
            .gte("posted_at", cutoff)
            .order("posted_at", desc=True)
            .limit(500)
            .execute()
        )
        unchecked_jobs = response.data or []

        if not unchecked_jobs:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"checked": 0, "reposts_found": 0},
                summary="No unchecked jobs in repost window.",
            )

        # Group by company for efficient comparison
        company_groups: dict[str, list[dict]] = {}
        for job in unchecked_jobs:
            company = (job.get("company_name") or "").lower().strip()
            if company:
                company_groups.setdefault(company, []).append(job)

        reposts_found = 0
        now = datetime.now(timezone.utc).isoformat()

        for company, jobs in company_groups.items():
            # Also fetch older jobs from this company to compare against
            older_response = (
                supabase.table("jobs")
                .select("id, title, posted_at, repost_count")
                .eq("company_name", company)
                .gte("posted_at", cutoff)
                .not_.is_("repost_checked_at", "null")
                .order("posted_at", desc=False)
                .execute()
            )
            older_jobs = older_response.data or []

            all_candidates = older_jobs + sorted(
                jobs, key=lambda j: j.get("posted_at", "")
            )

            for job in jobs:
                title = job.get("title", "")
                if not title:
                    continue

                original_id = None
                for candidate in all_candidates:
                    if candidate["id"] == job["id"]:
                        continue
                    # Candidate must be older
                    if candidate.get("posted_at", "") >= job.get("posted_at", ""):
                        continue

                    similarity = self._title_similarity(title, candidate.get("title", ""))
                    if similarity >= SIMILARITY_THRESHOLD:
                        original_id = candidate["id"]
                        break

                update_data: dict[str, Any] = {"repost_checked_at": now}
                if original_id:
                    reposts_found += 1
                    update_data["repost_of_job_id"] = original_id

                    # Increment repost_count on the original
                    orig = (
                        supabase.table("jobs")
                        .select("repost_count")
                        .eq("id", original_id)
                        .single()
                        .execute()
                    )
                    current_count = (orig.data or {}).get("repost_count", 0) or 0
                    supabase.table("jobs").update(
                        {"repost_count": current_count + 1}
                    ).eq("id", original_id).execute()

                supabase.table("jobs").update(update_data).eq("id", job["id"]).execute()

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "checked": len(unchecked_jobs),
                "reposts_found": reposts_found,
            },
            summary=(
                f"Checked {len(unchecked_jobs)} jobs; "
                f"{reposts_found} reposts detected."
            ),
        )
