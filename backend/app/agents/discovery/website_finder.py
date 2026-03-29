"""Jack Reeves — Website Discovery Specialist (Discovery department)."""

import re
import logging
from typing import Any

import httpx

from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

STRIP_SUFFIXES = re.compile(
    r"\b(ltd|limited|plc|llp|inc|corp|corporation|group|holdings|uk)\b",
    re.IGNORECASE,
)
NON_ALNUM = re.compile(r"[^a-z0-9\s-]")
MULTI_SPACE = re.compile(r"\s+")
REQUEST_TIMEOUT = 5.0


def _normalise_to_slug(name: str) -> str:
    """Turn a company name into a plausible domain slug."""
    slug = name.lower().strip()
    slug = STRIP_SUFFIXES.sub("", slug)
    slug = NON_ALNUM.sub("", slug)
    slug = MULTI_SPACE.sub("-", slug).strip("-")
    return slug


class WebsiteFinderAgent(BaseSubAgent):
    name = "website_finder"
    persona = "Jack Reeves"
    title = "Website Discovery Specialist"
    agent_type = "DET"
    description = "Discovers website URLs for sponsor companies via domain guessing"

    async def run(self, **kwargs: Any) -> dict:
        company_name: str = kwargs["company_name"]
        town_city: str | None = kwargs.get("town_city")

        slug = _normalise_to_slug(company_name)
        if not slug:
            return {"website_url": None, "method": None, "confidence": 0.0}

        candidates = [
            f"https://www.{slug}.co.uk",
            f"https://www.{slug}.com",
            f"https://{slug}.co.uk",
            f"https://{slug}.com",
        ]

        # Also try without hyphens
        slug_no_hyphens = slug.replace("-", "")
        if slug_no_hyphens != slug:
            candidates.extend([
                f"https://www.{slug_no_hyphens}.co.uk",
                f"https://www.{slug_no_hyphens}.com",
            ])

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            verify=False,
        ) as client:
            for url in candidates:
                try:
                    resp = await client.head(url)
                    if resp.status_code < 400:
                        final_url = str(resp.url)
                        return {
                            "website_url": final_url,
                            "method": "domain_guess",
                            "confidence": 0.7,
                        }
                except (httpx.HTTPError, httpx.InvalidURL):
                    continue

        return {"website_url": None, "method": None, "confidence": 0.0}
