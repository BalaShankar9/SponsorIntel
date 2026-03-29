"""Tariq Hussain — Spam Classification Specialist (Validation department)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Known spam patterns (deterministic fallback)
_SPAM_PATTERNS = [
    re.compile(r"\b(mlm|multi[\s-]?level[\s-]?marketing)\b", re.IGNORECASE),
    re.compile(r"\bpyramid\s+scheme\b", re.IGNORECASE),
    re.compile(r"\bearn\s+(money\s+)?from\s+home\b", re.IGNORECASE),
    re.compile(r"\bwork\s+from\s+home\s+\$?\d+k?\s*(per|a)\s*(day|week)\b", re.IGNORECASE),
    re.compile(r"\b(no\s+experience\s+needed|no\s+experience\s+required)\b", re.IGNORECASE),
    re.compile(r"\b(be\s+your\s+own\s+boss)\b", re.IGNORECASE),
    re.compile(r"\bunlimited\s+(earning|income)\s+potential\b", re.IGNORECASE),
    re.compile(r"\b(financial\s+freedom|passive\s+income)\b", re.IGNORECASE),
    re.compile(r"\b(join\s+(my|our)\s+team).{0,30}(dm|message|whatsapp|telegram)\b", re.IGNORECASE),
    re.compile(r"\bguaranteed\s+(income|earnings|salary)\b", re.IGNORECASE),
    re.compile(r"\b(click\s+here|act\s+now|limited\s+spots?)\b", re.IGNORECASE),
    re.compile(r"\bcrypto\s+trad(e|ing)\s+(opportunity|job)\b", re.IGNORECASE),
]

# Minimum spam pattern hits for deterministic classification
_SPAM_HIT_THRESHOLD = 2


class SpamClassifier(BaseSubAgent):
    """Classify jobs as spam/not-spam using LLM with deterministic regex fallback."""

    name = "spam_classifier"
    persona = "Tariq Hussain"
    title = "Spam Classification Specialist"
    agent_type = "LLM"
    description = (
        "Classifies job listings as spam or legitimate. Uses deterministic regex "
        "patterns for known spam (MLM, pyramid schemes, 'earn from home') and "
        "falls back to LLM classification for ambiguous cases."
    )

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])
        llm_client = kwargs.get("llm_client")  # Optional LLM client
        llm_calls = 0

        try:
            stats = {"spam": 0, "not_spam": 0, "uncertain": 0}

            for job in jobs:
                text = self._build_text(job)
                det_result = self._deterministic_classify(text)

                if det_result is not None:
                    job["spam"] = det_result
                    job["spam_method"] = "deterministic"
                    stats["spam" if det_result else "not_spam"] += 1
                elif llm_client is not None:
                    # LLM classification for ambiguous cases
                    try:
                        is_spam = await self._llm_classify(llm_client, text)
                        llm_calls += 1
                        job["spam"] = is_spam
                        job["spam_method"] = "llm"
                        stats["spam" if is_spam else "not_spam"] += 1
                    except Exception as llm_exc:
                        logger.warning("LLM spam classification failed: %s", llm_exc)
                        job["spam"] = False
                        job["spam_method"] = "default"
                        stats["uncertain"] += 1
                else:
                    # No LLM available, default to not spam
                    job["spam"] = False
                    job["spam_method"] = "default"
                    stats["uncertain"] += 1

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "SpamClassifier: %d spam, %d clean, %d uncertain (%d LLM calls) in %.1fms",
                stats["spam"],
                stats["not_spam"],
                stats["uncertain"],
                llm_calls,
                duration,
            )
            return SubAgentResult(
                success=True,
                data={"jobs": jobs, "stats": stats},
                duration_ms=duration,
                llm_calls=llm_calls,
            )

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("SpamClassifier failed: %s", exc)
            return SubAgentResult(
                success=False, data={"jobs": jobs}, error=str(exc), duration_ms=duration, llm_calls=llm_calls
            )

    # ------------------------------------------------------------------
    @staticmethod
    def _build_text(job: dict) -> str:
        parts = [
            job.get("title", ""),
            job.get("job_title", ""),
            job.get("company_name", ""),
            job.get("description_clean", "") or job.get("description", ""),
        ]
        return " ".join(p for p in parts if p)

    @staticmethod
    def _deterministic_classify(text: str) -> bool | None:
        """Return True (spam), False (clean), or None (uncertain)."""
        hits = sum(1 for pat in _SPAM_PATTERNS if pat.search(text))
        if hits >= _SPAM_HIT_THRESHOLD:
            return True
        if hits == 0 and len(text) > 100:
            return False
        return None

    @staticmethod
    async def _llm_classify(llm_client: Any, text: str) -> bool:
        """Use LLM to classify ambiguous job listings."""
        prompt = (
            "You are a spam detector for job listings. Classify this job as spam or legitimate.\n"
            "Spam indicators: MLM, pyramid schemes, unrealistic pay, vague descriptions, "
            "requests for upfront payment, crypto scams.\n\n"
            f"Job text (truncated to 500 chars):\n{text[:500]}\n\n"
            "Respond with exactly one word: SPAM or LEGITIMATE"
        )
        response = await llm_client.complete(prompt)
        return "spam" in response.strip().lower()
