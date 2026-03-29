"""
Reed.co.uk job scraper using the official Reed Developer API.

Uses HTTP Basic Auth (API key as username, empty password) against
https://www.reed.co.uk/api/1.0 to search and fetch job details.

Falls back gracefully (returns empty list) when no API key is configured.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import get_settings
from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Salary-period mapping from Reed API salaryType values
# ---------------------------------------------------------------------------

_SALARY_TYPE_MAP = {
    "annum": "ANNUAL",
    "year": "ANNUAL",
    "month": "MONTHLY",
    "week": "WEEKLY",
    "day": "DAILY",
    "hour": "HOURLY",
}

# ---------------------------------------------------------------------------
# Reuse classification helpers from the HTML scraper
# ---------------------------------------------------------------------------

from app.scrapers.reed import detect_contract_type, detect_remote, detect_seniority


class ReedAPIScraper(BaseScraper):
    """
    Scrapes job listings from Reed.co.uk via the official Developer API.

    API docs: https://www.reed.co.uk/developers/jobseeker

    Auth is HTTP Basic with the API key as username and an empty password.
    Pagination uses ``resultsToSkip`` in increments of ``resultsToTake``.
    For the top results the detail endpoint ``/jobs/{jobId}`` is also called
    to retrieve the full job description.
    """

    name = "reed_api"
    base_url = "https://www.reed.co.uk/api/1.0"
    requests_per_minute = 20  # API is more tolerant than HTML scraping
    max_retries = 3
    use_proxy = False  # not needed for the official API
    timeout = 30

    # Maximum results per search page (API cap)
    _PAGE_SIZE = 100
    # How many pages to paginate through at most
    _MAX_PAGES = 10
    # Fetch detail endpoint for the first N results per keyword
    _DETAIL_LIMIT = 50

    def __init__(self) -> None:
        super().__init__()
        settings = get_settings()
        self._api_key: str = settings.reed_api_key

    # ------------------------------------------------------------------
    # Public interface (BaseScraper contract)
    # ------------------------------------------------------------------

    async def scrape(self, keyword: str = "", location: str = "United Kingdom", **kwargs) -> list[dict]:
        """
        Search Reed API for *keyword* in *location*, paginate, fetch details,
        and return a list of dicts ready for the Job model.
        """
        if not self._api_key:
            logger.warning("[%s] No Reed API key configured (settings.reed_api_key). Returning empty list.", self.name)
            return []

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        max_pages = kwargs.get("pages", self._MAX_PAGES)
        detail_limit = kwargs.get("detail_limit", self._DETAIL_LIMIT)

        all_jobs: list[dict] = []
        results_to_skip = 0

        for page in range(1, max_pages + 1):
            params = {
                "keywords": keyword,
                "location": location,
                "resultsToTake": self._PAGE_SIZE,
                "resultsToSkip": results_to_skip,
            }

            data = await self._api_get("/search", params=params)
            if data is None:
                logger.warning("[%s] API returned no data on page %d", self.name, page)
                break

            results = data.get("results", [])
            if not results:
                logger.info("[%s] No results on page %d, stopping pagination", self.name, page)
                break

            for raw in results:
                job = self._map_search_result(raw)
                if job and job.get("title_raw"):
                    all_jobs.append(job)

            # If we got fewer results than page size, we've reached the end
            if len(results) < self._PAGE_SIZE:
                break

            results_to_skip += self._PAGE_SIZE

        # Fetch detail pages for the first N jobs to get full descriptions
        detail_count = 0
        for job in all_jobs:
            if detail_count >= detail_limit:
                break
            job_id = job.get("source_job_id")
            if not job_id:
                continue
            detail = await self._fetch_detail(job_id)
            if detail:
                # Merge detail fields — only overwrite if the detail has a value
                # and the search result field is missing
                for key, value in detail.items():
                    if value is not None and not job.get(key):
                        job[key] = value
                detail_count += 1

        # Enrich every job with classification and sponsorship signals
        for job in all_jobs:
            self._enrich_job(job)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API-based scraping. Returns empty list."""
        return []

    # ------------------------------------------------------------------
    # API helpers
    # ------------------------------------------------------------------

    async def _api_get(self, path: str, params: dict | None = None) -> dict | None:
        """
        Make an authenticated GET request to the Reed API.

        Uses HTTP Basic Auth with the API key as username and empty password.
        Includes retry logic with exponential back-off.
        """
        url = f"{self.base_url}{path}"
        auth = httpx.BasicAuth(username=self._api_key, password="")

        await self._rate_limiter.acquire()

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout),
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url, params=params, auth=auth)

                if response.status_code == 200:
                    return response.json()

                if response.status_code == 401:
                    logger.error("[%s] API returned 401 Unauthorized. Check your reed_api_key.", self.name)
                    return None

                if response.status_code == 429:
                    wait = 2 ** attempt * 5
                    logger.warning(
                        "[%s] Rate limited (429) on %s. Waiting %ds (attempt %d/%d)",
                        self.name, url[:80], wait, attempt, self.max_retries,
                    )
                    await asyncio.sleep(wait)
                    continue

                logger.warning(
                    "[%s] HTTP %d on %s (attempt %d/%d)",
                    self.name, response.status_code, url[:80], attempt, self.max_retries,
                )

            except httpx.TimeoutException:
                logger.warning(
                    "[%s] Timeout on %s (attempt %d/%d)",
                    self.name, url[:80], attempt, self.max_retries,
                )
            except httpx.RequestError as exc:
                logger.warning(
                    "[%s] Request error on %s: %s (attempt %d/%d)",
                    self.name, url[:80], str(exc)[:100], attempt, self.max_retries,
                )

            if attempt < self.max_retries:
                await asyncio.sleep(2 ** attempt)

        logger.error("[%s] All %d retries exhausted for %s", self.name, self.max_retries, url[:80])
        return None

    async def _fetch_detail(self, job_id: str) -> dict | None:
        """Fetch full job details via /jobs/{jobId}."""
        data = await self._api_get(f"/jobs/{job_id}")
        if data is None:
            return None
        return self._map_detail_result(data)

    # ------------------------------------------------------------------
    # Field mapping
    # ------------------------------------------------------------------

    def _map_search_result(self, raw: dict) -> dict:
        """Map a Reed API search result to our internal Job field names."""
        return {
            "source": JobSource.REED.value,
            "source_job_id": str(raw.get("jobId", "")),
            "title_raw": raw.get("jobTitle"),
            "company_name_raw": raw.get("employerName") or "Unknown",
            "location_raw": raw.get("locationName"),
            "salary_min": _to_float(raw.get("minimumSalary")),
            "salary_max": _to_float(raw.get("maximumSalary")),
            "salary_currency": raw.get("currency") or "GBP",
            "salary_period": _map_salary_period(raw.get("salaryType")),
            "salary_text_raw": _build_salary_text(raw),
            "description_snippet": _strip_html(raw.get("jobDescription", ""))[:500] if raw.get("jobDescription") else None,
            "posted_date": _parse_api_date(raw.get("datePosted")),
            "expiry_date": _parse_api_date(raw.get("expirationDate")),
            "source_url": raw.get("jobUrl"),
        }

    def _map_detail_result(self, raw: dict) -> dict:
        """Map a Reed API detail result, focusing on the full description."""
        return {
            "description_full": _strip_html(raw.get("jobDescription", "")),
            "salary_min": _to_float(raw.get("minimumSalary")),
            "salary_max": _to_float(raw.get("maximumSalary")),
            "salary_currency": raw.get("currency") or "GBP",
            "salary_period": _map_salary_period(raw.get("salaryType")),
            "posted_date": _parse_api_date(raw.get("datePosted")),
            "expiry_date": _parse_api_date(raw.get("expirationDate")),
            "source_url": raw.get("jobUrl"),
        }

    # ------------------------------------------------------------------
    # Enrichment (classification + sponsorship)
    # ------------------------------------------------------------------

    @staticmethod
    def _enrich_job(job: dict) -> None:
        """Add classification fields and run sponsorship detection."""
        title = job.get("title_raw", "")
        location = job.get("location_raw", "")
        description = job.get("description_full", "") or job.get("description_snippet", "")
        combined = f"{title} {description}"

        if not job.get("contract_type"):
            job["contract_type"] = detect_contract_type(combined)
        if not job.get("seniority"):
            job["seniority"] = detect_seniority(title)

        job["is_remote"] = detect_remote(title, location)

        # Sponsorship detection
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals

        # Ensure snippet exists
        if not job.get("description_snippet") and description:
            job["description_snippet"] = description[:500]


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


def _to_float(value) -> Optional[float]:
    """Safely convert a value to float, returning None on failure."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _map_salary_period(salary_type: Optional[str]) -> Optional[str]:
    """Map Reed API salaryType string to our period enum value."""
    if not salary_type:
        return None
    return _SALARY_TYPE_MAP.get(salary_type.lower().strip())


def _parse_api_date(date_str: Optional[str]) -> Optional[datetime]:
    """
    Parse a date string from the Reed API.

    The API returns dates in formats like ``"21/01/2025"`` or
    ISO-style ``"2025-01-21T00:00:00"``.
    """
    if not date_str:
        return None

    for fmt in (
        "%d/%m/%Y",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue

    return None


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string (lightweight, no dependency)."""
    import re
    clean = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _build_salary_text(raw: dict) -> Optional[str]:
    """Build a human-readable salary string from API fields."""
    min_sal = raw.get("minimumSalary")
    max_sal = raw.get("maximumSalary")
    currency = raw.get("currency", "GBP")
    period = raw.get("salaryType", "")

    if min_sal is None and max_sal is None:
        return None

    symbol = "\u00a3" if currency == "GBP" else "$" if currency == "USD" else currency + " "

    if min_sal is not None and max_sal is not None and min_sal != max_sal:
        text = f"{symbol}{min_sal:,.0f} - {symbol}{max_sal:,.0f}"
    elif min_sal is not None:
        text = f"{symbol}{min_sal:,.0f}"
    else:
        text = f"{symbol}{max_sal:,.0f}"

    if period:
        text += f" per {period}"

    return text
