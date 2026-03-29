"""
The Muse public API scraper.

Uses the free public The Muse API (no authentication required) to fetch
job listings across multiple UK-relevant location filters.  Deduplicates
results by job ID, paginates up to 10 pages per filter, and maps fields
to the internal Job model.

API base: https://www.themuse.com/api/public/jobs
"""

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import quote

import httpx

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Maximum pages to fetch per location filter (20 results per page).
MAX_PAGES_PER_LOCATION = 10

# Location filters sent as the `location` query parameter.
LOCATION_FILTERS = [
    "London, United Kingdom",
    "United Kingdom",
    "Flexible / Remote",
]

# Headers for API requests -- lightweight; anti-detection headers cause
# gzip issues with this particular API.
_API_HEADERS = {
    "User-Agent": "SponsorIntel/1.0",
    "Accept": "application/json",
}

# ---------------------------------------------------------------------------
# Regex helpers
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^<]+?>")

_SALARY_RANGE_RE = re.compile(
    r"[\u00a3\$\u20ac]?\s*([\d,]+(?:\.\d+)?)\s*[-\u2013]+\s*"
    r"[\u00a3\$\u20ac]?\s*([\d,]+(?:\.\d+)?)",
)
_SALARY_SINGLE_RE = re.compile(r"[\u00a3\$\u20ac]\s*([\d,]+(?:\.\d+)?)")

# ---------------------------------------------------------------------------
# Muse levels -> Seniority enum mapping
# ---------------------------------------------------------------------------

_MUSE_LEVEL_MAP: dict[str, str] = {
    "senior level": Seniority.SENIOR.value,
    "mid level": Seniority.MID.value,
    "entry level": Seniority.ENTRY.value,
    "management": Seniority.DIRECTOR.value,
    "internship": Seniority.ENTRY.value,
}

# ---------------------------------------------------------------------------
# Pure helper functions
# ---------------------------------------------------------------------------


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


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
    return any(
        k in combined
        for k in ("remote", "work from home", "wfh", "home based", "home-based", "flexible")
    )


def _parse_posted_date(date_str: str) -> Optional[datetime]:
    """Parse The Muse publication_date (ISO 8601 format)."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str[:20].rstrip("Z"), fmt.replace("Z", ""))
        except ValueError:
            continue
    # Fallback: strip timezone suffix and retry
    try:
        cleaned = date_str.strip()
        if "+" in cleaned:
            cleaned = cleaned.split("+")[0]
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1]
        return datetime.strptime(cleaned[:19], "%Y-%m-%dT%H:%M:%S")
    except (ValueError, IndexError):
        pass
    return None


def _parse_salary_from_description(text: str) -> tuple[Optional[float], Optional[float]]:
    """
    Attempt to extract a salary range from free-text description.

    The Muse API does not provide structured salary fields, so we fall back
    to regex extraction from the description body.
    """
    if not text:
        return None, None

    m = _SALARY_RANGE_RE.search(text)
    if m:
        try:
            sal_min = float(m.group(1).replace(",", ""))
            sal_max = float(m.group(2).replace(",", ""))
            return sal_min, sal_max
        except (ValueError, TypeError):
            pass

    m = _SALARY_SINGLE_RE.search(text)
    if m:
        try:
            val = float(m.group(1).replace(",", ""))
            return val, val
        except (ValueError, TypeError):
            pass

    return None, None


def _map_muse_levels(levels: list[dict]) -> Optional[str]:
    """
    Map The Muse ``levels`` list to an internal Seniority value.

    Uses the first recognised level. Returns ``None`` if nothing matches.
    """
    if not levels:
        return None
    for level in levels:
        name = (level.get("name") or "").strip().lower()
        if name in _MUSE_LEVEL_MAP:
            return _MUSE_LEVEL_MAP[name]
    return None


# ---------------------------------------------------------------------------
# Scraper class
# ---------------------------------------------------------------------------


class TheMuseAPIScraper(BaseScraper):
    """
    Scrapes job listings from The Muse public API.

    No authentication required. Queries multiple UK-relevant location
    filters, paginates up to ``MAX_PAGES_PER_LOCATION`` pages each
    (20 results per page), and deduplicates by job ID.
    """

    name = "themuse"
    base_url = "https://www.themuse.com/api/public/jobs"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        """
        Scrape The Muse API for job listings.

        Args:
            keyword: Optional search keyword (currently unused by the API
                     -- kept for interface compatibility).
            location: Ignored; we iterate ``LOCATION_FILTERS`` instead.
        """
        all_jobs: list[dict] = []
        seen_ids: set[str] = set()
        max_pages = kwargs.get("max_pages", MAX_PAGES_PER_LOCATION)
        location_filters = kwargs.get("locations", LOCATION_FILTERS)

        for loc_filter in location_filters:
            try:
                jobs = await self._fetch_location(loc_filter, max_pages, seen_ids)
                all_jobs.extend(jobs)
            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching location '%s': %s",
                    self.name, loc_filter, str(exc)[:200],
                )

        # Enrich all jobs with classification and sponsorship detection
        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d unique jobs across %d location filters",
            self.name, len(all_jobs), len(location_filters),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scraper -- implemented to satisfy abstract method."""
        return []

    # ------------------------------------------------------------------
    # Internal fetching
    # ------------------------------------------------------------------

    async def _fetch_location(
        self,
        loc_filter: str,
        max_pages: int,
        seen_ids: set[str],
    ) -> list[dict]:
        """Paginate through results for a single location filter."""
        jobs: list[dict] = []

        for page in range(1, max_pages + 1):
            try:
                page_jobs, page_count = await self._fetch_page(loc_filter, page, seen_ids)
                jobs.extend(page_jobs)

                if page >= page_count:
                    logger.debug(
                        "[%s] Reached last page %d/%d for '%s'",
                        self.name, page, page_count, loc_filter,
                    )
                    break

            except Exception as exc:
                logger.warning(
                    "[%s] Error on page %d for '%s': %s",
                    self.name, page, loc_filter, str(exc)[:200],
                )
                break

        logger.info(
            "[%s] Fetched %d jobs for location '%s'",
            self.name, len(jobs), loc_filter,
        )
        return jobs

    async def _fetch_page(
        self,
        loc_filter: str,
        page: int,
        seen_ids: set[str],
    ) -> tuple[list[dict], int]:
        """
        Fetch a single page from the API and return (parsed_jobs, page_count).
        """
        url = f"{self.base_url}?location={quote(loc_filter)}&page={page}"
        jobs: list[dict] = []
        page_count = 1

        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            ) as client:
                response = await client.get(url, headers=_API_HEADERS)

            if response.status_code != 200:
                logger.warning(
                    "[%s] HTTP %d for location='%s' page=%d",
                    self.name, response.status_code, loc_filter, page,
                )
                return jobs, page_count

            data = response.json()
            page_count = data.get("page_count", 1)
            raw_jobs = data.get("results", [])

            for raw in raw_jobs:
                try:
                    job_id = str(raw.get("id", ""))
                    if not job_id:
                        continue
                    if job_id in seen_ids:
                        continue
                    seen_ids.add(job_id)

                    parsed = self._parse_job(raw)
                    if parsed:
                        jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job id=%s: %s",
                        self.name, raw.get("id", "?"), str(exc)[:200],
                    )

        except httpx.TimeoutException:
            logger.warning(
                "[%s] Timeout fetching location='%s' page=%d",
                self.name, loc_filter, page,
            )
        except httpx.RequestError as exc:
            logger.warning(
                "[%s] Request error for location='%s' page=%d: %s",
                self.name, loc_filter, page, str(exc)[:200],
            )
        except Exception as exc:
            logger.warning(
                "[%s] Unexpected error for location='%s' page=%d: %s",
                self.name, loc_filter, page, str(exc)[:200],
            )

        return jobs, page_count

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse_job(self, raw: dict) -> Optional[dict]:
        """Parse a single The Muse API job object into internal format."""
        name = (raw.get("name") or "").strip()
        company_data = raw.get("company") or {}
        company = (company_data.get("name") or "").strip()

        # Build location string from locations list
        locations = raw.get("locations") or []
        location_str = ", ".join(
            loc.get("name", "") for loc in locations if loc.get("name")
        )

        # Description (HTML -> plain text)
        description_html = raw.get("contents") or ""
        description = _strip_html(description_html)

        # Source URL
        refs = raw.get("refs") or {}
        url = refs.get("landing_page") or ""

        # Categories -> skills list
        categories = raw.get("categories") or []
        categories_list = [
            cat.get("name", "") for cat in categories if cat.get("name")
        ] or None

        # Levels -> seniority
        levels = raw.get("levels") or []
        seniority_value = _map_muse_levels(levels)

        # Contract type detection from title + description
        combined_text = f"{name} {description}"
        contract_type_value = _detect_contract_type(combined_text)

        # Remote detection
        is_remote = _detect_remote(name, location_str)

        # Posted date
        parsed_date = _parse_posted_date(raw.get("publication_date"))

        # Salary extraction from description text
        salary_min, salary_max = _parse_salary_from_description(description)

        job: dict = {
            "source": JobSource.THEMUSE.value,
            "source_job_id": str(raw.get("id", "")),
            "title_raw": name,
            "company_name_raw": company,
            "location_raw": location_str,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": url,
            "posted_date": parsed_date,
            "contract_type": contract_type_value,
            "seniority": seniority_value,
            "skills_extracted": categories_list,
            "location_is_remote": is_remote,
            "salary_min": salary_min,
            "salary_max": salary_max,
        }

        return job

    # ------------------------------------------------------------------
    # Enrichment
    # ------------------------------------------------------------------

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
