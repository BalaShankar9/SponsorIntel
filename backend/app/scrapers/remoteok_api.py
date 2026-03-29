"""
Remote OK API scraper.

Uses the free public Remote OK API (no authentication required) to fetch
remote job listings. Filters results for UK-relevant positions and maps
fields to the internal Job model.

API endpoint: https://remoteok.com/api
Returns a JSON array where the first element is metadata (no ``id`` field)
and the remaining elements are job objects.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import httpx

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# Location substrings that indicate UK relevance
UK_LOCATION_KEYWORDS = [
    "uk",
    "united kingdom",
    "london",
    "manchester",
    "birmingham",
    "edinburgh",
    "glasgow",
    "bristol",
    "leeds",
    "liverpool",
    "worldwide",
    "anywhere",
    "europe",
    "emea",
    "global",
]

_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _is_uk_relevant(location: str) -> bool:
    """
    Check if a location string indicates UK relevance.

    An empty or None location is treated as unrestricted (worldwide),
    which counts as relevant.
    """
    if not location:
        return True
    loc_lower = location.lower()
    return any(kw in loc_lower for kw in UK_LOCATION_KEYWORDS)


def _parse_epoch(epoch) -> Optional[datetime]:
    """Convert a Unix epoch timestamp (seconds) to a datetime."""
    if epoch is None:
        return None
    try:
        return datetime.utcfromtimestamp(int(epoch))
    except (ValueError, TypeError, OSError):
        return None


def _detect_contract_type(text: str) -> Optional[str]:
    """Detect contract type from title or description text."""
    if not text:
        return None
    t = text.lower()
    if "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "freelance" in t or "fixed term" in t or "fixed-term" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp " in t:
        return ContractType.TEMPORARY.value
    if "apprentice" in t or "internship" in t:
        return ContractType.APPRENTICESHIP.value
    if "full-time" in t or "full time" in t:
        return ContractType.PERMANENT.value
    return None


def _detect_seniority(title: str) -> Optional[str]:
    """Detect seniority level from job title."""
    if not title:
        return None
    t = title.lower()
    if any(k in t for k in ("director", "vp ", "vice president")):
        return Seniority.DIRECTOR.value
    if any(k in t for k in ("head of", "chief", "cto", "cfo", "ceo", "c-suite")):
        return Seniority.EXECUTIVE.value
    if any(k in t for k in ("lead ", "lead,", "principal", "staff ")):
        return Seniority.LEAD.value
    if any(k in t for k in ("senior", "sr ", "sr.", "experienced")):
        return Seniority.SENIOR.value
    if any(k in t for k in ("mid ", "mid-level", "intermediate")):
        return Seniority.MID.value
    if any(k in t for k in ("junior", "jr ", "jr.", "entry", "graduate", "intern", "trainee")):
        return Seniority.ENTRY.value
    return None


def _detect_remote(title: str, location: str) -> bool:
    """Detect if a job is remote from title/location text."""
    combined = f"{title or ''} {location or ''}".lower()
    return any(k in combined for k in ("remote", "work from home", "wfh", "home based", "home-based"))


class RemoteOKAPIScraper(BaseScraper):
    """
    Scrapes remote job listings from the Remote OK public API.

    No authentication required. Returns a JSON array directly (first
    element is metadata, remaining elements are jobs). Filters for
    UK-relevant jobs based on the location field.
    """

    name = "remoteok"
    base_url = "https://remoteok.com/api"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        """
        Scrape Remote OK API for remote job listings.

        Args:
            keyword: Optional search keyword (used for post-filtering).
            location: Ignored (Remote OK is remote-only; we filter by location fields).
        """
        all_jobs: list[dict] = []

        try:
            raw_jobs = await self._fetch_jobs()

            for raw in raw_jobs:
                try:
                    parsed = self._parse_job(raw, keyword)
                    if parsed:
                        all_jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job id=%s: %s",
                        self.name, raw.get("id", "?"), str(exc)[:200],
                    )

        except Exception as exc:
            logger.warning(
                "[%s] Error fetching jobs: %s",
                self.name, str(exc)[:200],
            )

        # Enrich all jobs with classification and sponsorship detection
        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK-relevant jobs from Remote OK",
            self.name, len(all_jobs),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scraper -- implemented to satisfy abstract method."""
        return []

    async def _fetch_jobs(self) -> list[dict]:
        """
        Fetch all jobs from the Remote OK API.

        The API returns a JSON array where the first element is metadata
        (identified by the absence of an ``id`` field). This element is
        skipped; the remaining elements are returned as raw job dicts.
        """
        url = self.base_url
        headers = {"User-Agent": "SponsorIntel/1.0", "Accept": "application/json"}

        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            ) as client:
                response = await client.get(url, headers=headers)

            if response.status_code != 200:
                logger.warning(
                    "[%s] HTTP %d from Remote OK API",
                    self.name, response.status_code,
                )
                return []

            data = response.json()

            if not isinstance(data, list):
                logger.warning(
                    "[%s] Unexpected response type: %s",
                    self.name, type(data).__name__,
                )
                return []

            # First element is metadata (no 'id' field) -- skip it
            jobs = [item for item in data if isinstance(item, dict) and item.get("id")]
            return jobs

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching Remote OK API", self.name)
        except httpx.RequestError as exc:
            logger.warning(
                "[%s] Request error: %s",
                self.name, str(exc)[:200],
            )
        except Exception as exc:
            logger.warning(
                "[%s] Unexpected error: %s",
                self.name, str(exc)[:200],
            )

        return []

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        """Parse a single Remote OK API job object into internal format."""
        location = raw.get("location", "") or ""

        # Filter: only UK-relevant locations (empty/None also qualifies)
        if not _is_uk_relevant(location):
            return None

        title = raw.get("position", "") or ""
        company = raw.get("company", "") or ""
        description_html = raw.get("description", "") or ""
        description = _strip_html(description_html)
        tags = raw.get("tags", []) or []

        # Optional keyword filter (post-fetch)
        if keyword:
            searchable = f"{title} {description} {company} {' '.join(tags)}".lower()
            if keyword.lower() not in searchable:
                return None

        # Parse salary fields (0 means no salary data)
        salary_min = 0
        salary_max = 0
        try:
            salary_min = int(raw.get("salary_min", 0) or 0)
        except (ValueError, TypeError):
            salary_min = 0
        try:
            salary_max = int(raw.get("salary_max", 0) or 0)
        except (ValueError, TypeError):
            salary_max = 0

        has_salary = salary_min > 0 or salary_max > 0

        job: dict = {
            "source": JobSource.REMOTEOK.value,
            "source_job_id": str(raw.get("id", "")),
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": raw.get("url", ""),
            "posted_date": _parse_epoch(raw.get("epoch")),
            "contract_type": _detect_contract_type(title),
            "seniority": _detect_seniority(title),
            "skills_extracted": tags if tags else None,
            "location_is_remote": True,
            "salary_min": salary_min if salary_min > 0 else None,
            "salary_max": salary_max if salary_max > 0 else None,
            "salary_currency": "USD",
            "salary_period": "ANNUAL" if has_salary else None,
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        """Add classification fields and run sponsorship detection."""
        title = job.get("title_raw", "")
        description = job.get("description_full", "") or ""
        combined = f"{title} {description}"

        if not job.get("contract_type"):
            job["contract_type"] = _detect_contract_type(combined)
        if not job.get("seniority"):
            job["seniority"] = _detect_seniority(title)

        # Sponsorship detection
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
