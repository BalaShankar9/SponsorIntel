"""Priscilla Adu — LinkedIn Research Analyst (Discovery department)."""

import re
import logging
from typing import Any

from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

STRIP_SUFFIXES = re.compile(
    r"\b(ltd|limited|plc|llp|inc|corp|corporation|group|holdings|uk)\b",
    re.IGNORECASE,
)
NON_ALNUM = re.compile(r"[^a-z0-9\s-]")
MULTI_SPACE = re.compile(r"\s+")


def _normalise_to_linkedin_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = STRIP_SUFFIXES.sub("", slug)
    slug = NON_ALNUM.sub("", slug)
    slug = MULTI_SPACE.sub("-", slug).strip("-")
    return slug


class LinkedInFinderAgent(BaseSubAgent):
    name = "linkedin_finder"
    persona = "Priscilla Adu"
    title = "LinkedIn Research Analyst"
    agent_type = "DET"
    description = "Constructs LinkedIn company page URLs from company names"

    async def run(self, **kwargs: Any) -> dict:
        company_name: str = kwargs["company_name"]

        slug = _normalise_to_linkedin_slug(company_name)
        if not slug:
            return {"linkedin_url": None, "confidence": 0.0}

        linkedin_url = f"https://www.linkedin.com/company/{slug}"
        return {"linkedin_url": linkedin_url, "confidence": 0.6}
