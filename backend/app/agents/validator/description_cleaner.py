"""Olivia Barnes — Description Cleaning Specialist (Validation department)."""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

_HTML_TAG = re.compile(r"<[^>]+>")
_HTML_ENTITY = re.compile(r"&[a-zA-Z]+;|&#\d+;")
_MULTI_NEWLINE = re.compile(r"\n{3,}")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")

# Common boilerplate patterns found in job listings
_BOILERPLATE_PATTERNS = [
    re.compile(r"equal\s+opportunit(y|ies)\s+employer", re.IGNORECASE),
    re.compile(r"we\s+are\s+an?\s+equal\s+opportunit(y|ies)", re.IGNORECASE),
    re.compile(r"click\s+(here\s+)?to\s+apply", re.IGNORECASE),
    re.compile(r"apply\s+now\s+at\s+https?://\S+", re.IGNORECASE),
    re.compile(r"powered\s+by\s+\S+", re.IGNORECASE),
    re.compile(r"this\s+job\s+was\s+posted\s+by", re.IGNORECASE),
    re.compile(r"advertis(ed|ing)\s+on\s+behalf\s+of", re.IGNORECASE),
    re.compile(r"privacy\s+policy\s*:", re.IGNORECASE),
    re.compile(r"cookie\s+policy", re.IGNORECASE),
]


class DescriptionCleaner(BaseSubAgent):
    """Strip HTML tags, boilerplate text, and normalise whitespace in descriptions."""

    name = "description_cleaner"
    persona = "Olivia Barnes"
    title = "Description Cleaning Specialist"
    agent_type = "DET"
    description = "Cleans job descriptions by removing HTML, boilerplate, and normalising whitespace."

    # ------------------------------------------------------------------
    async def run(self, **kwargs: Any) -> SubAgentResult:
        start = time.perf_counter()
        jobs: list[dict] = kwargs.get("jobs", [])

        try:
            cleaned_count = 0
            for job in jobs:
                raw = job.get("description", "")
                if not raw:
                    job["description_clean"] = ""
                    continue
                job["description_clean"] = self._clean(raw)
                cleaned_count += 1

            duration = (time.perf_counter() - start) * 1000
            logger.info(
                "DescriptionCleaner cleaned %d/%d descriptions in %.1fms",
                cleaned_count,
                len(jobs),
                duration,
            )
            return SubAgentResult(success=True, data=jobs, duration_ms=duration, llm_calls=0)

        except Exception as exc:
            duration = (time.perf_counter() - start) * 1000
            logger.exception("DescriptionCleaner failed: %s", exc)
            return SubAgentResult(success=False, data=jobs, error=str(exc), duration_ms=duration, llm_calls=0)

    # ------------------------------------------------------------------
    @staticmethod
    def _clean(text: str) -> str:
        # Strip HTML tags and entities
        text = _HTML_TAG.sub(" ", text)
        text = _HTML_ENTITY.sub(" ", text)

        # Remove boilerplate lines
        lines = text.split("\n")
        filtered: list[str] = []
        for line in lines:
            is_boilerplate = any(p.search(line) for p in _BOILERPLATE_PATTERNS)
            if not is_boilerplate:
                filtered.append(line)
        text = "\n".join(filtered)

        # Normalise whitespace
        text = _MULTI_SPACE.sub(" ", text)
        text = _MULTI_NEWLINE.sub("\n\n", text)
        text = text.strip()

        return text
