"""
Remotive.com API scraper.

Uses the free public Remotive API (no authentication required) to fetch
remote job listings. Filters results for UK-relevant positions and maps
fields to the internal Job model.

API docs: https://remotive.com/api/remote-jobs
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

# Categories available on the Remotive API
REMOTIVE_CATEGORIES = [
    "software-dev",
    "data",
    "qa",
    "devops",
    "product",
    "design",
    "finance",
    "marketing",
    "hr",
    "all-others",
]

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

_SALARY_RANGE_RE = re.compile(
    r"[\u00a3\$\u20ac]?\s*([\d,]+(?:\.\d+)?)\s*[-\u2013]+\s*[\u00a3\$\u20ac]?\s*([\d,]+(?:\.\d+)?)",
)
_SALARY_SINGLE_RE = re.compile(r"[\u00a3\$\u20ac]\s*([\d,]+(?:\.\d+)?)")


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _is_uk_relevant(location: str) -> bool:
    """Check if a location string indicates UK relevance."""
    if not location:
        return False
    loc_lower = location.lower()
    return any(kw in loc_lower for kw in UK_LOCATION_KEYWORDS)


def _parse_salary(salary_text: str) -> dict:
    """Parse salary text into min/max/raw fields."""
    result = {
        "salary_min": None,
        "salary_max": None,
        "salary_text_raw": salary_text.strip() if salary_text else None,
    }
    if not salary_text:
        return result

    m = _SALARY_RANGE_RE.search(salary_text)
    if m:
        result["salary_min"] = float(m.group(1).replace(",", ""))
        result["salary_max"] = float(m.group(2).replace(",", ""))
    else:
        m = _SALARY_SINGLE_RE.search(salary_text)
        if m:
            val = float(m.group(1).replace(",", ""))
            result["salary_min"] = val
            result["salary_max"] = val

    return result


def _detect_contract_type(job_type: str) -> Optional[str]:
    """Map Remotive job_type values to internal ContractType."""
    if not job_type:
        return None
    t = job_type.lower()
    if "full" in t or "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "freelance" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp" in t:
        return ContractType.TEMPORARY.value
    if "internship" in t or "apprentice" in t:
        return ContractType.APPRENTICESHIP.value
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


def _parse_posted_date(date_str: str) -> Optional[datetime]:
    """Parse Remotive publication_date (ISO 8601 format)."""
    if not date_str:
        return None
    # Remotive returns dates like "2024-01-15T12:00:00"
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str[:19], fmt)
        except ValueError:
            continue
    return None


class RemotiveAPIScraper(BaseScraper):
    """
    Scrapes remote job listings from the Remotive public API.

    No authentication required. Returns JSON directly, no HTML parsing needed.
    Filters for UK-relevant jobs based on candidate_required_location.
    """

    name = "remotive"
    base_url = "https://remotive.com/api/remote-jobs"
    requests_per_minute = 15
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        """
        Scrape Remotive API for remote job listings.

        Args:
            keyword: Optional search keyword (used for post-filtering).
            location: Ignored (Remotive is remote-only; we filter by location fields).
        """
        all_jobs: list[dict] = []
        categories = kwargs.get("categories", REMOTIVE_CATEGORIES)

        for category in categories:
            try:
                jobs = await self._fetch_category(category, keyword)
                all_jobs.extend(jobs)
            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching category '%s': %s",
                    self.name, category, str(exc)[:200],
                )

        # Enrich all jobs with classification and sponsorship detection
        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK-relevant jobs across %d categories",
            self.name, len(all_jobs), len(categories),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scraper -- implemented to satisfy abstract method."""
        return []

    async def _fetch_category(self, category: str, keyword: str = "") -> list[dict]:
        """Fetch jobs for a single Remotive category."""
        url = f"{self.base_url}?category={category}&limit=100"
        jobs: list[dict] = []

        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            ) as client:
                response = await client.get(url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "application/json",
                })

            if response.status_code != 200:
                logger.warning(
                    "[%s] HTTP %d for category '%s'",
                    self.name, response.status_code, category,
                )
                return jobs

            data = response.json()
            raw_jobs = data.get("jobs", [])

            for raw in raw_jobs:
                try:
                    parsed = self._parse_job(raw, keyword)
                    if parsed:
                        jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job id=%s: %s",
                        self.name, raw.get("id", "?"), str(exc)[:200],
                    )

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching category '%s'", self.name, category)
        except httpx.RequestError as exc:
            logger.warning(
                "[%s] Request error for category '%s': %s",
                self.name, category, str(exc)[:200],
            )
        except Exception as exc:
            logger.warning(
                "[%s] Unexpected error for category '%s': %s",
                self.name, category, str(exc)[:200],
            )

        return jobs

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        """Parse a single Remotive API job object into internal format."""
        location = raw.get("candidate_required_location", "") or ""

        # Filter: only UK-relevant locations
        if not _is_uk_relevant(location):
            return None

        # Optional keyword filter (post-fetch)
        if keyword:
            searchable = f"{raw.get('title', '')} {raw.get('description', '')} {' '.join(raw.get('tags', []))}".lower()
            if keyword.lower() not in searchable:
                return None

        title = raw.get("title", "")
        company = raw.get("company_name", "")
        description_html = raw.get("description", "") or ""
        description = _strip_html(description_html)
        salary_text = raw.get("salary", "") or ""
        salary = _parse_salary(salary_text)
        tags = raw.get("tags", []) or []
        job_type = raw.get("job_type", "") or ""

        job: dict = {
            "source": JobSource.REMOTIVE.value,
            "source_job_id": str(raw.get("id", "")),
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": raw.get("url", ""),
            "posted_date": _parse_posted_date(raw.get("publication_date")),
            "contract_type": _detect_contract_type(job_type),
            "skills_extracted": tags if tags else None,
            "is_remote": True,  # All Remotive jobs are remote
            "salary_min": salary.get("salary_min"),
            "salary_max": salary.get("salary_max"),
            "salary_text_raw": salary.get("salary_text_raw"),
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        """Add classification fields and run sponsorship detection."""
        title = job.get("title_raw", "")
        description = job.get("description_full", "") or ""

        if not job.get("seniority"):
            job["seniority"] = _detect_seniority(title)

        # Sponsorship detection
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
