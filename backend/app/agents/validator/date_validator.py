"""Chloe Brennan — Date Validation Analyst (Validation department)."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

MAX_AGE_DAYS = 90


class DateValidator(BaseSubAgent):
    """Validate dates: not future, not older than 90 days, normalise to UTC."""

    name = "date_validator"
    persona = "Chloe Brennan"
    title = "Date Validation Analyst"
    agent_type = "DET"
    description = (
        "Validates posting dates: rejects future dates, flags stale listings "
        "(>90 days), and normalises all timestamps to UTC."
    )

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])
        now = datetime.now(timezone.utc)

        try:
            stats = {"valid": 0, "invalid": 0, "missing": 0}

            for job in jobs:
                result = self._validate_job_date(job, now)
                stats[result] += 1

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "DateValidator: %d valid, %d invalid, %d missing in %.1fms",
                stats["valid"],
                stats["invalid"],
                stats["missing"],
                duration,
            )
            return SubAgentResult(success=True, data={"jobs": jobs, "stats": stats}, duration_ms=duration, llm_calls=0)

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("DateValidator failed: %s", exc)
            return SubAgentResult(success=False, data={"jobs": jobs}, error=str(exc), duration_ms=duration, llm_calls=0)

    # ------------------------------------------------------------------
    def _validate_job_date(self, job: dict, now: datetime) -> str:
        raw = job.get("posted_date") or job.get("date_posted") or job.get("created_at")
        if not raw:
            job["date_valid"] = False
            job["date_validation_note"] = "missing"
            return "missing"

        dt = self._parse_date(raw)
        if dt is None:
            job["date_valid"] = False
            job["date_validation_note"] = "unparseable"
            return "invalid"

        # Normalise to UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        job["posted_date_utc"] = dt.isoformat()

        issues: list[str] = []

        if dt > now + timedelta(hours=24):
            issues.append("future date")

        age = now - dt
        if age.days > MAX_AGE_DAYS:
            issues.append(f"older than {MAX_AGE_DAYS} days ({age.days}d)")

        if issues:
            job["date_valid"] = False
            job["date_validation_note"] = "; ".join(issues)
            return "invalid"

        job["date_valid"] = True
        job["date_validation_note"] = "ok"
        return "valid"

    # ------------------------------------------------------------------
    @staticmethod
    def _parse_date(raw: Any) -> datetime | None:
        if isinstance(raw, datetime):
            return raw

        raw_str = str(raw).strip()
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d %b %Y",
            "%d %B %Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(raw_str, fmt)
            except ValueError:
                continue
        return None
