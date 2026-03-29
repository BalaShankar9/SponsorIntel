"""Megan Lloyd — Similarity Scoring Analyst (Validation department)."""

from __future__ import annotations

import logging
import time
from typing import Any

from rapidfuzz import fuzz

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Dimension weights (must sum to 1.0)
_WEIGHTS = {
    "title": 0.30,
    "company": 0.25,
    "location": 0.20,
    "salary": 0.10,
    "description": 0.15,
}


class SimilarityScorer(BaseSubAgent):
    """Score similarity between two job records across 5 dimensions."""

    name = "similarity_scorer"
    persona = "Megan Lloyd"
    title = "Similarity Scoring Analyst"
    agent_type = "DET"
    description = (
        "Uses rapidfuzz to compute a weighted similarity score between two job "
        "records across title, company, location, salary, and description."
    )

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])

        try:
            n = len(jobs)
            scores: list[dict] = []

            for i in range(n):
                for j in range(i + 1, n):
                    score = self._score_pair(jobs[i], jobs[j])
                    scores.append({"i": i, "j": j, "score": score})

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "SimilarityScorer computed %d pair scores in %.1fms",
                len(scores),
                duration,
            )
            return SubAgentResult(success=True, data=scores, duration_ms=duration, llm_calls=0)

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("SimilarityScorer failed: %s", exc)
            return SubAgentResult(success=False, data=[], error=str(exc), duration_ms=duration, llm_calls=0)

    # ------------------------------------------------------------------
    def _score_pair(self, a: dict, b: dict) -> float:
        """Return a weighted similarity score (0-100) for two jobs."""
        total = 0.0

        for dim, weight in _WEIGHTS.items():
            val_a = self._get_field(a, dim)
            val_b = self._get_field(b, dim)
            if not val_a or not val_b:
                continue
            if dim == "salary":
                sim = self._salary_similarity(val_a, val_b)
            else:
                sim = fuzz.token_sort_ratio(val_a, val_b)
            total += sim * weight

        return round(total, 2)

    # ------------------------------------------------------------------
    @staticmethod
    def _get_field(job: dict, dim: str) -> str:
        """Extract the relevant string for a given dimension."""
        mapping = {
            "title": ("title", "job_title"),
            "company": ("company_name_normalised", "company_name", "company"),
            "location": ("location", "city"),
            "salary": ("salary_raw", "salary"),
            "description": ("description_clean", "description"),
        }
        for key in mapping.get(dim, (dim,)):
            val = job.get(key)
            if val:
                return str(val)
        return ""

    @staticmethod
    def _salary_similarity(a: str, b: str) -> float:
        """Simple string similarity for salary fields."""
        return fuzz.ratio(a, b)
