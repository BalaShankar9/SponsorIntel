"""Tom Fletcher — Careers Page Detective (Discovery department)."""

import re
import logging
from typing import Any

import httpx

from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

CAREER_PATHS = [
    "/careers",
    "/jobs",
    "/vacancies",
    "/work-with-us",
    "/join-us",
    "/recruitment",
    "/opportunities",
    "/current-vacancies",
    "/job-openings",
]

ATS_PATTERNS = {
    "greenhouse": re.compile(r"greenhouse\.io|boards\.greenhouse", re.IGNORECASE),
    "lever": re.compile(r"lever\.co|jobs\.lever", re.IGNORECASE),
    "workable": re.compile(r"workable\.com|apply\.workable", re.IGNORECASE),
    "breezy": re.compile(r"breezy\.hr", re.IGNORECASE),
    "workday": re.compile(r"myworkdayjobs\.com|workday\.com", re.IGNORECASE),
    "icims": re.compile(r"icims\.com", re.IGNORECASE),
    "taleo": re.compile(r"taleo\.net", re.IGNORECASE),
    "smartrecruiters": re.compile(r"smartrecruiters\.com", re.IGNORECASE),
    "ashby": re.compile(r"ashbyhq\.com", re.IGNORECASE),
    "teamtailor": re.compile(r"teamtailor\.com", re.IGNORECASE),
}

REQUEST_TIMEOUT = 5.0


class CareersPageDetectorAgent(BaseSubAgent):
    name = "careers_detector"
    persona = "Tom Fletcher"
    title = "Careers Page Detective"
    agent_type = "DET"
    description = "Detects careers pages and ATS platforms on company websites"

    async def run(self, **kwargs: Any) -> dict:
        website_url: str = kwargs["website_url"]
        base = website_url.rstrip("/")

        result = {
            "has_careers_page": False,
            "careers_url": None,
            "ats_platform": None,
        }

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            verify=False,
        ) as client:
            # Check common career paths
            for path in CAREER_PATHS:
                url = f"{base}{path}"
                try:
                    resp = await client.head(url)
                    if resp.status_code < 400:
                        result["has_careers_page"] = True
                        result["careers_url"] = str(resp.url)
                        break
                except (httpx.HTTPError, httpx.InvalidURL):
                    continue

            # Check homepage HTML for ATS platform links
            try:
                resp = await client.get(base, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code < 400:
                    html = resp.text[:50_000]
                    for platform, pattern in ATS_PATTERNS.items():
                        if pattern.search(html):
                            result["ats_platform"] = platform
                            if not result["has_careers_page"]:
                                match = pattern.search(html)
                                if match:
                                    result["has_careers_page"] = True
                            break
            except (httpx.HTTPError, httpx.InvalidURL):
                pass

        return result
