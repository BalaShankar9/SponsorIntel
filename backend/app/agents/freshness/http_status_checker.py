"""Beth Crawford — HTTP Status Checker (Freshness department)."""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

EXPIRED_STATUS_CODES = {404, 410}
REQUEST_TIMEOUT = 10.0


class HttpStatusChecker(BaseSubAgent):
    name = "http_status_checker"
    persona = "Beth Crawford"
    title = "HTTP Status Checker"
    agent_type = "DET"
    description = (
        "Performs HEAD requests against job source URLs to verify they are still live. "
        "Marks jobs with 404/410 responses as expired."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        supabase = kwargs["supabase"]
        batch_size = kwargs.get("batch_size", 100)

        # Fetch the oldest-checked jobs that are still active
        response = (
            supabase.table("jobs")
            .select("id, source_url")
            .eq("status", "active")
            .order("last_http_check_at", desc=False, nullsfirst=True)
            .limit(batch_size)
            .execute()
        )
        jobs = response.data or []

        if not jobs:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={"checked": 0, "expired": 0},
                summary="No active jobs to check.",
            )

        expired_ids: list[str] = []
        checked_count = 0
        errors = 0
        now = datetime.now(timezone.utc).isoformat()

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:
            for job in jobs:
                job_id = job["id"]
                url = job.get("source_url")
                if not url:
                    continue

                try:
                    resp = await client.head(url)
                    checked_count += 1

                    if resp.status_code in EXPIRED_STATUS_CODES:
                        expired_ids.append(job_id)

                    # Update last_http_check_at regardless of result
                    supabase.table("jobs").update(
                        {
                            "last_http_check_at": now,
                            "last_http_status": resp.status_code,
                        }
                    ).eq("id", job_id).execute()

                except httpx.HTTPError as exc:
                    errors += 1
                    logger.warning(
                        "HTTP check failed for job %s (%s): %s", job_id, url, exc
                    )

        # Batch-mark expired jobs
        if expired_ids:
            supabase.table("jobs").update(
                {"status": "expired", "expired_at": now}
            ).in_("id", expired_ids).execute()

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "checked": checked_count,
                "expired": len(expired_ids),
                "errors": errors,
                "expired_ids": expired_ids,
            },
            summary=(
                f"Checked {checked_count} jobs; "
                f"{len(expired_ids)} marked expired, {errors} errors."
            ),
        )
