"""Hannah Whitfield — Job Title Normaliser (Validation department)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Regex for stripping emoji
_EMOJI_RE = re.compile(
    "["
    "\U0001f600-\U0001f64f"  # emoticons
    "\U0001f300-\U0001f5ff"  # symbols & pictographs
    "\U0001f680-\U0001f6ff"  # transport & map
    "\U0001f1e0-\U0001f1ff"  # flags
    "\U00002700-\U000027bf"  # dingbats
    "\U0001f900-\U0001f9ff"  # supplemental symbols
    "\U0001fa00-\U0001fa6f"  # chess symbols
    "\U0001fa70-\U0001faff"  # symbols extended-A
    "\U00002600-\U000026ff"  # misc symbols
    "]+",
    flags=re.UNICODE,
)

# Special characters to strip (keep hyphens, slashes, ampersands, parentheses)
_SPECIAL_CHARS = re.compile(r"[^\w\s\-/&().,'+#]")
_MULTI_SPACE = re.compile(r"\s{2,}")

# Common title noise to remove
_NOISE_PATTERNS = [
    re.compile(r"\b(urgent|asap|immediate\s+start|start\s+immediately)\b", re.IGNORECASE),
    re.compile(r"\b(apply\s+now|new|hot)\b", re.IGNORECASE),
    re.compile(r"\*+", re.IGNORECASE),
    re.compile(r"!{2,}"),
    re.compile(r"\bref\s*:?\s*\w+\b", re.IGNORECASE),
]


class TitleNormaliser(BaseSubAgent):
    """Normalise job titles using LLM with deterministic fallback."""

    name = "title_normaliser"
    persona = "Hannah Whitfield"
    title = "Job Title Normaliser"
    agent_type = "LLM"
    description = (
        "Normalises job titles: strips emoji and special characters, removes noise "
        "words, normalises casing. Falls back to deterministic cleaning when no LLM available."
    )

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])
        llm_client = kwargs.get("llm_client")  # Optional LLM client
        llm_calls = 0

        try:
            for job in jobs:
                raw = job.get("title") or job.get("job_title", "")
                if not raw:
                    job["title_normalised"] = ""
                    continue

                # Always apply deterministic cleaning first
                cleaned = self._deterministic_clean(raw)

                # Use LLM for further normalisation if available
                if llm_client is not None and self._needs_llm(cleaned):
                    try:
                        cleaned = await self._llm_normalise(llm_client, cleaned)
                        llm_calls += 1
                        job["title_normalise_method"] = "llm"
                    except Exception as llm_exc:
                        logger.warning("LLM title normalisation failed: %s", llm_exc)
                        job["title_normalise_method"] = "deterministic"
                else:
                    job["title_normalise_method"] = "deterministic"

                job["title_normalised"] = cleaned

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "TitleNormaliser processed %d jobs (%d LLM calls) in %.1fms",
                len(jobs),
                llm_calls,
                duration,
            )
            return SubAgentResult(success=True, data=jobs, duration_ms=duration, llm_calls=llm_calls)

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("TitleNormaliser failed: %s", exc)
            return SubAgentResult(success=False, data=jobs, error=str(exc), duration_ms=duration, llm_calls=llm_calls)

    # ------------------------------------------------------------------
    @staticmethod
    def _deterministic_clean(title: str) -> str:
        """Apply deterministic cleaning rules."""
        title = _EMOJI_RE.sub("", title)
        title = _SPECIAL_CHARS.sub(" ", title)

        for pat in _NOISE_PATTERNS:
            title = pat.sub("", title)

        title = _MULTI_SPACE.sub(" ", title).strip()

        # Title case normalisation
        title = title.title()

        # Fix common acronyms that should stay uppercase
        acronyms = ["IT", "HR", "QA", "UI", "UX", "AI", "ML", "NLP", "API", "CTO", "CEO", "CFO", "COO", "VP", "NHS"]
        for acr in acronyms:
            title = re.sub(rf"\b{acr.title()}\b", acr, title)

        return title

    @staticmethod
    def _needs_llm(title: str) -> bool:
        """Heuristic: does this title need LLM normalisation beyond deterministic cleaning?"""
        # Titles with excessive length or mixed languages may benefit from LLM
        if len(title) > 80:
            return True
        # Multiple slashes suggest combined roles that LLM can disambiguate
        if title.count("/") > 2:
            return True
        return False

    @staticmethod
    async def _llm_normalise(llm_client: Any, title: str) -> str:
        """Use LLM to produce a clean, standardised job title."""
        prompt = (
            "Normalise this job title into a clean, standard format. "
            "Keep it concise and professional. Remove redundancy. "
            "Use standard UK English job title conventions.\n\n"
            f"Input: {title}\n\n"
            "Output the normalised title only, nothing else."
        )
        response = await llm_client.complete(prompt)
        normalised = response.strip().strip('"').strip("'")
        return normalised if normalised else title
