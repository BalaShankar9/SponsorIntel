"""
Himalayas.app API scraper.

Uses the free public Himalayas API (no authentication required) to fetch
remote job listings. Paginates through results, filters for UK-relevant
positions based on locationRestrictions, and maps fields to the internal
Job model.

API endpoint: https://himalayas.app/jobs/api?limit=50&offset=0
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

# Pagination constants
PAGE_SIZE = 50
MAX_PAGES = 10

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

# Map Himalayas seniority strings to internal Seniority enum values
_SENIORITY_MAP: dict[str, str] = {
    "senior": Seniority.SENIOR.value,
    "mid-level": Seniority.MID.value,
    "junior": Seniority.ENTRY.value,
    "entry-level": Seniority.ENTRY.value,
    "lead": Seniority.LEAD.value,
    "principal": Seniority.LEAD.value,
    "director": Seniority.DIRECTOR.value,
    "vp": Seniority.DIRECTOR.value,
    "executive": Seniority.EXECUTIVE.value,
    "c-level": Seniority.EXECUTIVE.value,
}

_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _is_uk_relevant(location_restrictions: list[str]) -> bool:
    """
    Check if any value in locationRestrictions indicates UK relevance.

    An empty list is treated as unrestricted (i.e. open to all locations),
    which counts as relevant.
    """
    if not location_restrictions:
        return True
    for loc in location_restrictions:
        loc_lower = (loc or "").lower()
        if any(kw in loc_lower for kw in UK_LOCATION_KEYWORDS):
            return True
    return False


def _parse_unix_timestamp(ts) -> Optional[datetime]:
    """Convert a Unix timestamp (seconds) to a datetime."""
    if ts is None:
        return None
    try:
        return datetime.utcfromtimestamp(int(ts))
    except (ValueError, TypeError, OSError):
        return None


def _map_seniority(seniority_list: list[str]) -> Optional[str]:
    """
    Map the first recognised Himalayas seniority value to an internal
    Seniority enum value.  Returns None when no match is found.
    """
    if not seniority_list:
        return None
    for item in seniority_list:
        mapped = _SENIORITY_MAP.get(item.lower().strip())
        if mapped:
            return mapped
    return None


def _map_contract_type(employment_type: str) -> Optional[str]:
    """Map Himalayas employmentType to internal ContractType."""
    if not employment_type:
        return None
    t = employment_type.lower()
    if "full" in t or "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "freelance" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp" in t or "part" in t:
        return ContractType.TEMPORARY.value
    if "internship" in t or "apprentice" in t:
        return ContractType.APPRENTICESHIP.value
    return None


def _clean_category(category: str) -> str:
    """
    Convert a hyphenated Himalayas category to a clean skill name.

    Example: "Data-Migration" -> "Data Migration"
    """
    return category.replace("-", " ").strip()


def _detect_seniority_from_title(title: str) -> Optional[str]:
    """Fallback: detect seniority level from job title text."""
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


class HimalayasAPIScraper(BaseScraper):
    """
    Scrapes remote job listings from the Himalayas.app public API.

    No authentication required.  Returns paginated JSON results (50 per
    page).  Filters for UK-relevant jobs based on locationRestrictions.
    """

    name = "himalayas"
    base_url = "https://himalayas.app/jobs/api"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        """
        Scrape the Himalayas API for remote job listings.

        Args:
            keyword: Optional search keyword (used for post-filtering).
            location: Ignored (Himalayas is remote-only; we filter by
                      locationRestrictions).
        """
        all_jobs: list[dict] = []
        max_pages = kwargs.get("max_pages", MAX_PAGES)

        for page in range(max_pages):
            try:
                jobs, total_count = await self._fetch_page(page, keyword)
                all_jobs.extend(jobs)

                # Stop early if we have fetched all available jobs
                fetched_so_far = (page + 1) * PAGE_SIZE
                if fetched_so_far >= total_count:
                    logger.info(
                        "[%s] Reached end of results at page %d/%d (total=%d)",
                        self.name, page + 1, max_pages, total_count,
                    )
                    break

            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching page %d: %s",
                    self.name, page + 1, str(exc)[:200],
                )
                break

        # Enrich all jobs with classification and sponsorship detection
        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK-relevant jobs across %d pages",
            self.name, len(all_jobs), min(page + 1, max_pages),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scraper -- implemented to satisfy abstract method."""
        return []

    async def _fetch_page(self, page: int, keyword: str = "") -> tuple[list[dict], int]:
        """
        Fetch a single page of jobs from the Himalayas API.

        Returns:
            A tuple of (parsed_jobs, total_count).
        """
        offset = page * PAGE_SIZE
        url = f"{self.base_url}?limit={PAGE_SIZE}&offset={offset}"
        jobs: list[dict] = []
        total_count = 0

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
                    "[%s] HTTP %d for page %d (offset=%d)",
                    self.name, response.status_code, page + 1, offset,
                )
                return jobs, total_count

            data = response.json()
            total_count = data.get("totalCount", 0)
            raw_jobs = data.get("jobs", [])

            if not isinstance(raw_jobs, list):
                logger.warning(
                    "[%s] Unexpected 'jobs' type on page %d: %s",
                    self.name, page + 1, type(raw_jobs).__name__,
                )
                return jobs, total_count

            for raw in raw_jobs:
                try:
                    parsed = self._parse_job(raw, keyword)
                    if parsed:
                        jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job guid=%s: %s",
                        self.name, raw.get("guid", "?"), str(exc)[:200],
                    )

        except httpx.TimeoutException:
            logger.warning(
                "[%s] Timeout fetching page %d (offset=%d)",
                self.name, page + 1, offset,
            )
        except httpx.RequestError as exc:
            logger.warning(
                "[%s] Request error for page %d: %s",
                self.name, page + 1, str(exc)[:200],
            )
        except Exception as exc:
            logger.warning(
                "[%s] Unexpected error for page %d: %s",
                self.name, page + 1, str(exc)[:200],
            )

        return jobs, total_count

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        """Parse a single Himalayas API job object into internal format."""
        location_restrictions = raw.get("locationRestrictions") or []
        if not isinstance(location_restrictions, list):
            location_restrictions = [str(location_restrictions)]

        # Filter: only UK-relevant locations
        if not _is_uk_relevant(location_restrictions):
            return None

        title = raw.get("title", "") or ""
        company = raw.get("companyName", "") or ""
        description_html = raw.get("description", "") or ""
        description = _strip_html(description_html)
        excerpt = raw.get("excerpt", "") or ""

        # Optional keyword filter (post-fetch)
        if keyword:
            searchable = f"{title} {description} {company} {excerpt}".lower()
            if keyword.lower() not in searchable:
                return None

        # Source identifier -- prefer guid, fall back to applicationLink
        guid = raw.get("guid", "") or ""
        application_link = raw.get("applicationLink", "") or ""
        source_job_id = guid or application_link

        # Seniority: try explicit API field first, then title heuristic
        seniority_list = raw.get("seniority") or []
        if not isinstance(seniority_list, list):
            seniority_list = [str(seniority_list)]
        seniority = _map_seniority(seniority_list)

        # Contract type
        employment_type = raw.get("employmentType", "") or ""
        contract_type = _map_contract_type(employment_type)

        # Categories -> skills
        categories = raw.get("categories") or []
        parent_categories = raw.get("parentCategories") or []
        all_categories = categories + parent_categories
        skills = [_clean_category(c) for c in all_categories if c] or None

        # Salary
        salary_min = raw.get("minSalary")
        salary_max = raw.get("maxSalary")
        salary_currency = raw.get("currency") or None
        has_salary = salary_min is not None or salary_max is not None

        # Location string
        location_raw = ", ".join(location_restrictions) if location_restrictions else ""

        job: dict = {
            "source": JobSource.HIMALAYAS.value,
            "source_job_id": source_job_id,
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location_raw,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": application_link,
            "posted_date": _parse_unix_timestamp(raw.get("pubDate")),
            "expiry_date": _parse_unix_timestamp(raw.get("expiryDate")),
            "contract_type": contract_type,
            "seniority": seniority,
            "skills_extracted": skills,
            "location_is_remote": True,  # Himalayas is a remote-only platform
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": salary_currency,
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
            job["contract_type"] = _map_contract_type(combined)
        if not job.get("seniority"):
            job["seniority"] = _detect_seniority_from_title(title)

        # Sponsorship detection
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
