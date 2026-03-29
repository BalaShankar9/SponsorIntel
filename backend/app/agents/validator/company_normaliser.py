"""Idris Kamara — Company Name Normaliser (Validation department)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Suffixes to strip (case-insensitive)
_SUFFIXES = re.compile(
    r"\b(ltd|limited|plc|llp|inc|incorporated|corp|corporation|co|company"
    r"|gmbh|ag|sa|sas|sarl|bv|nv|pty|proprietary)\b\.?",
    re.IGNORECASE,
)
_MULTI_SPACE = re.compile(r"\s{2,}")


class CompanyNormaliser(BaseSubAgent):
    """Strip legal suffixes, lowercase, and collapse whitespace."""

    name = "company_normaliser"
    persona = "Idris Kamara"
    title = "Company Name Normaliser"
    agent_type = "DET"
    description = "Normalises company names by stripping legal suffixes, lowercasing, and deduplicating whitespace."

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])

        try:
            for job in jobs:
                raw = job.get("company_name") or job.get("company", "")
                if not raw:
                    continue
                normalised = self._normalise(raw)
                job["company_name_normalised"] = normalised

            duration = (time.perf_counter() - start) * 1000
            logger.info("CompanyNormaliser processed %d jobs in %.1fms", len(jobs), duration)
            return SubAgentResult(success=True, data=jobs, duration_ms=duration, llm_calls=0)

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("CompanyNormaliser failed: %s", exc)
            return SubAgentResult(success=False, data=jobs, error=str(exc), duration_ms=duration, llm_calls=0)

    # ------------------------------------------------------------------
    @staticmethod
    def _normalise(name: str) -> str:
        name = name.strip()
        name = _SUFFIXES.sub("", name)
        name = _MULTI_SPACE.sub(" ", name)
        name = name.strip(" .,")
        return name.lower()
