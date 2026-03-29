"""
Jobicy.com API scraper.

Uses the free public Jobicy API v2 (no authentication required) to fetch
remote job listings. Scrapes multiple geographic filters (uk, europe,
worldwide) and maps fields to the internal Job model.

API docs: https://jobicy.com/api/v2/remote-jobs
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
    "uk", "united kingdom", "london", "manchester", "birmingham",
    "edinburgh", "glasgow", "bristol", "leeds", "liverpool",
    "worldwide", "anywhere", "europe", "emea", "global",
]

_HTML_TAG_RE = re.compile(r"<[^<]+?>")

_SALARY_RANGE_RE = re.compile(
    r"[\u00a3\$\u20ac]?\s*([\d,]+(?:\.\d+)?)\s*[-\u2013]+\s*[\u00a3\$\u20ac]?\s*([\d,]+(?:\.\d+)?)",
)


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _parse_pub_date(date_str: str) -> Optional[datetime]:
    """Parse Jobicy pubDate field into datetime."""
    if not date_str:
        return None
    # Jobicy returns various date formats
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
    ):
        try:
            return datetime.strptime(date_str.strip()[:19], fmt)
        except ValueError:
            continue
    # Try with dateutil-like fallback for ISO formats
    try:
        # Handle "2024-01-15T12:00:00+00:00" by stripping timezone
        cleaned = date_str.strip()
        if "+" in cleaned:
            cleaned = cleaned.split("+")[0]
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1]
        return datetime.strptime(cleaned[:19], "%Y-%m-%dT%H:%M:%S")
    except (ValueError, IndexError):
        pass
    return None


def _detect_contract_type(job_type: str) -> Optional[str]:
    """Map Jobicy jobType values to internal ContractType."""
    if not job_type:
        return None
    t = job_type.lower()
    if "full" in t or "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "freelance" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp" in t or "part" in t:
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
    return any(k in combined for k in ("remote", "work from home", "wfh", "home based", "home-based", "anywhere"))


def _build_salary_text(sal_min, sal_max) -> Optional[str]:
    """Build a human-readable salary text from min/max values."""
    if sal_min and sal_max:
        return f"${sal_min:,.0f} - ${sal_max:,.0f}"
    if sal_min:
        return f"${sal_min:,.0f}"
    if sal_max:
        return f"${sal_max:,.0f}"
    return None


def _parse_salary_value(val) -> Optional[float]:
    """Safely parse a salary value to float."""
    if val is None:
        return None
    try:
        parsed = float(str(val).replace(",", "").strip())
        return parsed if parsed > 0 else None
    except (ValueError, TypeError):
        return None


class JobicyAPIScraper(BaseScraper):
    """
    Scrapes remote job listings from the Jobicy public API v2.

    No authentication required. Queries multiple geo values (uk, europe,
    worldwide) to maximise UK-relevant results.
    """

    name = "jobicy"
    base_url = "https://jobicy.com/api/v2/remote-jobs"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        """
        Scrape Jobicy API for remote job listings.

        Args:
            keyword: Optional search keyword (used for post-filtering).
            location: Ignored (we filter by jobGeo field in response).
        """
        all_jobs: list[dict] = []

        try:
            jobs = await self._fetch_jobs(keyword)
            all_jobs.extend(jobs)
        except Exception as exc:
            logger.warning(
                "[%s] Error fetching jobs: %s",
                self.name, str(exc)[:200],
            )

        # Enrich all jobs with classification and sponsorship detection
        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK-relevant jobs",
            self.name, len(all_jobs),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scraper -- implemented to satisfy abstract method."""
        return []

    async def _fetch_jobs(self, keyword: str = "") -> list[dict]:
        """Fetch jobs from Jobicy API and filter for UK relevance."""
        url = f"{self.base_url}?count=50"
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
                logger.warning("[%s] HTTP %d", self.name, response.status_code)
                return jobs

            data = response.json()
            raw_jobs = data.get("jobs", [])

            if not isinstance(raw_jobs, list):
                logger.warning("[%s] Unexpected 'jobs' type: %s", self.name, type(raw_jobs).__name__)
                return jobs

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
            logger.warning("[%s] Timeout fetching jobs", self.name)
        except httpx.RequestError as exc:
            logger.warning("[%s] Request error: %s", self.name, str(exc)[:200])
        except Exception as exc:
            logger.warning("[%s] Unexpected error: %s", self.name, str(exc)[:200])

        return jobs

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        """Parse a single Jobicy API job object into internal format."""
        title = raw.get("jobTitle", "") or ""
        company = raw.get("companyName", "") or ""
        geo_val = raw.get("jobGeo", "")
        if isinstance(geo_val, list):
            location_raw = ", ".join(str(g) for g in geo_val)
        else:
            location_raw = str(geo_val) if geo_val else ""

        # Filter: only UK-relevant locations
        if location_raw and not any(kw in location_raw.lower() for kw in UK_LOCATION_KEYWORDS):
            return None
        description_html = raw.get("jobDescription", "") or ""
        description = _strip_html(description_html)
        job_type_val = raw.get("jobType", "")
        job_type = ", ".join(job_type_val) if isinstance(job_type_val, list) else str(job_type_val or "")
        source_url = raw.get("url", "") or ""
        job_industry = raw.get("jobIndustry", []) or []

        # Optional keyword filter (post-fetch)
        if keyword:
            searchable = f"{title} {description} {company}".lower()
            if keyword.lower() not in searchable:
                return None

        # Parse salary fields
        salary_min = _parse_salary_value(raw.get("annualSalaryMin"))
        salary_max = _parse_salary_value(raw.get("annualSalaryMax"))
        salary_text = _build_salary_text(salary_min, salary_max)

        # Extract skills from jobIndustry
        skills: list[str] = []
        if isinstance(job_industry, list):
            skills = [str(item) for item in job_industry if item]
        elif isinstance(job_industry, str) and job_industry:
            skills = [job_industry]

        is_remote = _detect_remote(title, location_raw)

        job: dict = {
            "source": JobSource.JOBICY.value,
            "source_job_id": str(raw.get("id", "")),
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location_raw,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": source_url,
            "posted_date": _parse_pub_date(raw.get("pubDate")),
            "contract_type": _detect_contract_type(job_type),
            "skills_extracted": skills if skills else None,
            "is_remote": is_remote or True,  # Jobicy is a remote-jobs site
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_text_raw": salary_text,
            "salary_currency": "USD",  # Jobicy salaries are typically in USD
            "salary_period": "ANNUAL" if (salary_min or salary_max) else None,
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
