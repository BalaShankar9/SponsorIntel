"""Ravi Sharma — Salary Validation Analyst (Validation department)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Reasonable annual salary bounds (GBP)
MIN_ANNUAL = 10_000
MAX_ANNUAL = 500_000

# Period multipliers to convert to annual
_PERIOD_MULTIPLIERS = {
    "annual": 1,
    "annum": 1,
    "year": 1,
    "yearly": 1,
    "month": 12,
    "monthly": 12,
    "week": 52,
    "weekly": 52,
    "day": 260,
    "daily": 260,
    "hour": 2080,
    "hourly": 2080,
}

_SALARY_NUM = re.compile(r"[\d,]+(?:\.\d+)?")
_PERIOD_RE = re.compile(
    r"\b(annual|annum|year(?:ly)?|month(?:ly)?|week(?:ly)?|dai?l?y|hour(?:ly)?)\b",
    re.IGNORECASE,
)


class SalaryValidator(BaseSubAgent):
    """Validate salary ranges: min < max, reasonable bounds, period normalisation."""

    name = "salary_validator"
    persona = "Ravi Sharma"
    title = "Salary Validation Analyst"
    agent_type = "DET"
    description = (
        "Validates salary data: ensures min < max, values within GBP 10k-500k annual, "
        "and normalises pay periods to annual equivalents."
    )

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])

        try:
            stats = {"valid": 0, "invalid": 0, "missing": 0, "normalised": 0}

            for job in jobs:
                result = self._validate_job_salary(job)
                stats[result] += 1

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "SalaryValidator: %d valid, %d invalid, %d missing, %d normalised in %.1fms",
                stats["valid"],
                stats["invalid"],
                stats["missing"],
                stats["normalised"],
                duration,
            )
            return SubAgentResult(success=True, data={"jobs": jobs, "stats": stats}, duration_ms=duration, llm_calls=0)

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("SalaryValidator failed: %s", exc)
            return SubAgentResult(success=False, data={"jobs": jobs}, error=str(exc), duration_ms=duration, llm_calls=0)

    # ------------------------------------------------------------------
    def _validate_job_salary(self, job: dict) -> str:
        """Validate and normalise salary for a single job. Returns status key."""
        salary_min = job.get("salary_min")
        salary_max = job.get("salary_max")
        salary_raw = job.get("salary_raw") or job.get("salary", "")

        # If structured salary fields are present, validate directly
        if salary_min is not None and salary_max is not None:
            return self._validate_range(job, float(salary_min), float(salary_max))

        # Try to parse from raw salary string
        if not salary_raw:
            job["salary_valid"] = False
            job["salary_validation_note"] = "missing"
            return "missing"

        nums = [float(n.replace(",", "")) for n in _SALARY_NUM.findall(str(salary_raw))]
        if not nums:
            job["salary_valid"] = False
            job["salary_validation_note"] = "unparseable"
            return "missing"

        # Detect period
        period_match = _PERIOD_RE.search(str(salary_raw))
        period = period_match.group(1).lower() if period_match else "annual"
        multiplier = _PERIOD_MULTIPLIERS.get(period, 1)

        if len(nums) >= 2:
            sal_min = nums[0] * multiplier
            sal_max = nums[1] * multiplier
        else:
            sal_min = sal_max = nums[0] * multiplier

        job["salary_min_annual"] = round(sal_min, 2)
        job["salary_max_annual"] = round(sal_max, 2)
        job["salary_period_detected"] = period

        result = self._validate_range(job, sal_min, sal_max)
        if result == "valid" and multiplier != 1:
            return "normalised"
        return result

    # ------------------------------------------------------------------
    @staticmethod
    def _validate_range(job: dict, sal_min: float, sal_max: float) -> str:
        issues: list[str] = []

        if sal_min > sal_max:
            issues.append("min > max")

        if sal_min < MIN_ANNUAL:
            issues.append(f"min below {MIN_ANNUAL}")

        if sal_max > MAX_ANNUAL:
            issues.append(f"max above {MAX_ANNUAL}")

        if issues:
            job["salary_valid"] = False
            job["salary_validation_note"] = "; ".join(issues)
            return "invalid"

        job["salary_valid"] = True
        job["salary_validation_note"] = "ok"
        return "valid"
