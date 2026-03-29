"""
Adzuna API job scraper.

Uses Adzuna's free REST API to fetch UK job listings.
Docs: https://developer.adzuna.com/
Free tier: ~250 requests/day.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import httpx

from app.core.config import get_settings
from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.scrapers.anti_detection import random_delay
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers (shared patterns from reed.py)
# ---------------------------------------------------------------------------

_CONTRACT_TYPE_MAP = {
    "permanent": ContractType.PERMANENT.value,
    "contract": ContractType.CONTRACT.value,
    "temporary": ContractType.TEMPORARY.value,
    "apprenticeship": ContractType.APPRENTICESHIP.value,
}

_CONTRACT_TIME_MAP = {
    "full_time": "FULL_TIME",
    "part_time": "PART_TIME",
}


def _detect_contract_type(contract_type_raw: Optional[str], title: str = "") -> Optional[str]:
    """Map Adzuna contract_type field (or title text) to ContractType enum value."""
    if contract_type_raw:
        mapped = _CONTRACT_TYPE_MAP.get(contract_type_raw.lower())
        if mapped:
            return mapped

    # Fallback: detect from title
    if title:
        t = title.lower()
        if "permanent" in t:
            return ContractType.PERMANENT.value
        if "contract" in t or "fixed term" in t or "fixed-term" in t:
            return ContractType.CONTRACT.value
        if "temporary" in t or "temp " in t:
            return ContractType.TEMPORARY.value
        if "apprentice" in t:
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


def _parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 date string from the Adzuna 'created' field."""
    if not date_str:
        return None
    # Adzuna returns dates like "2024-01-15T12:34:56Z"
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Adzuna API Scraper
# ---------------------------------------------------------------------------


class AdzunaAPIScraper(BaseScraper):
    """
    Scrapes job listings from the Adzuna API (GB).

    Uses app_id and app_key query parameters for authentication.
    Paginates through up to 5 pages of 50 results each.
    """

    name = "adzuna"
    base_url = "https://api.adzuna.com/v1/api/jobs/gb/search"
    requests_per_minute = 15  # Conservative to stay within free tier
    max_retries = 3
    use_proxy = False  # API access, no need for proxy
    timeout = 30

    def __init__(self) -> None:
        super().__init__()
        settings = get_settings()
        self._app_id = settings.adzuna_app_id
        self._app_key = settings.adzuna_app_key

    async def scrape(self, keyword: str = "", location: str = "United Kingdom", **kwargs) -> list[dict]:
        """
        Scrape Adzuna API for job listings.

        Args:
            keyword: Search keyword (required).
            location: Location filter (default: United Kingdom).

        Returns:
            List of job dicts mapped to the Job model fields.
        """
        if not self._app_id or not self._app_key:
            logger.warning(
                "[%s] Adzuna API credentials not configured (adzuna_app_id / adzuna_app_key). "
                "Register free at https://developer.adzuna.com/ and set environment variables.",
                self.name,
            )
            return []

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        max_pages = kwargs.get("pages", 5)
        results_per_page = kwargs.get("results_per_page", 50)
        all_jobs: list[dict] = []

        for page in range(1, max_pages + 1):
            try:
                page_jobs = await self._fetch_page(keyword, location, page, results_per_page)
            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching page %d for '%s': %s",
                    self.name, page, keyword, str(exc)[:200],
                )
                break

            if not page_jobs:
                logger.info("[%s] No results on page %d for '%s', stopping pagination", self.name, page, keyword)
                break

            all_jobs.extend(page_jobs)

            # Polite delay between pages
            if page < max_pages:
                await random_delay(1.0, 2.5)

        # Enrich each job with classification and sponsorship signals
        for job in all_jobs:
            self._enrich_job(job)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scrapers -- exists to satisfy the abstract interface."""
        return []

    # ------------------------------------------------------------------
    # API request
    # ------------------------------------------------------------------

    async def _fetch_page(
        self,
        keyword: str,
        location: str,
        page: int,
        results_per_page: int,
    ) -> list[dict]:
        """Fetch a single page of Adzuna search results and parse into job dicts."""
        await self._rate_limiter.acquire()

        url = f"{self.base_url}/{page}"
        params = {
            "app_id": self._app_id,
            "app_key": self._app_key,
            "results_per_page": results_per_page,
            "what": keyword,
            "where": location,
            "content-type": "application/json",
        }

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout),
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url, params=params)

                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])
                    return [self._map_result(r) for r in results if r]

                if response.status_code == 429:
                    wait = 2 ** attempt * 5
                    logger.warning(
                        "[%s] Rate limited (429) on page %d. Waiting %ds (attempt %d/%d)",
                        self.name, page, wait, attempt, self.max_retries,
                    )
                    import asyncio
                    await asyncio.sleep(wait)
                    continue

                if response.status_code in (401, 403):
                    logger.error(
                        "[%s] Authentication failed (%d). Check adzuna_app_id and adzuna_app_key.",
                        self.name, response.status_code,
                    )
                    return []

                logger.warning(
                    "[%s] HTTP %d on page %d (attempt %d/%d)",
                    self.name, response.status_code, page, attempt, self.max_retries,
                )

            except httpx.TimeoutException:
                logger.warning(
                    "[%s] Timeout on page %d (attempt %d/%d)",
                    self.name, page, attempt, self.max_retries,
                )
            except httpx.RequestError as exc:
                logger.warning(
                    "[%s] Request error on page %d: %s (attempt %d/%d)",
                    self.name, page, str(exc)[:100], attempt, self.max_retries,
                )

            # Exponential backoff
            if attempt < self.max_retries:
                import asyncio
                await asyncio.sleep(2 ** attempt)

        logger.error("[%s] All retries exhausted for page %d", self.name, page)
        return []

    # ------------------------------------------------------------------
    # Result mapping
    # ------------------------------------------------------------------

    def _map_result(self, result: dict) -> dict:
        """Map a single Adzuna API result to the Job model field convention."""
        title = result.get("title", "").strip()
        company_name = (result.get("company", {}) or {}).get("display_name", "").strip() or "Unknown"

        # Location
        location_obj = result.get("location", {}) or {}
        location_display = location_obj.get("display_name", "")
        location_areas = location_obj.get("area", [])
        location_city = None
        location_region = None
        if location_areas:
            # Adzuna area is ordered broadest -> most specific
            # e.g. ["UK", "England", "London", "Central London"]
            if len(location_areas) >= 3:
                location_region = location_areas[1]  # e.g. "England"
                location_city = location_areas[-1]  # most specific
            elif len(location_areas) == 2:
                location_region = location_areas[0]
                location_city = location_areas[1]
            elif len(location_areas) == 1:
                location_city = location_areas[0]

        # Salary
        salary_min = result.get("salary_min")
        salary_max = result.get("salary_max")
        salary_text_parts = []
        if salary_min is not None:
            salary_text_parts.append(f"\u00a3{salary_min:,.0f}")
        if salary_max is not None and salary_max != salary_min:
            salary_text_parts.append(f"\u00a3{salary_max:,.0f}")
        salary_text_raw = " - ".join(salary_text_parts) if salary_text_parts else None

        # Description
        description = result.get("description", "") or ""
        description_snippet = description[:500] if description else None

        # Contract type
        contract_type_raw = result.get("contract_type")
        contract_type = _detect_contract_type(contract_type_raw, title)

        # Posted date
        posted_date = _parse_iso_date(result.get("created"))

        # Category
        category = (result.get("category", {}) or {}).get("label", "")

        # Source job ID
        source_job_id = str(result.get("id", "")) if result.get("id") else None

        return {
            "source": JobSource.ADZUNA.value,
            "source_job_id": source_job_id,
            "title_raw": title or "Unknown",
            "company_name_raw": company_name,
            "location_raw": location_display,
            "location_city": location_city,
            "location_region": location_region,
            "salary_min": float(salary_min) if salary_min is not None else None,
            "salary_max": float(salary_max) if salary_max is not None else None,
            "salary_currency": "GBP",
            "salary_period": "ANNUAL" if salary_min and salary_min >= 1000 else None,
            "salary_text_raw": salary_text_raw,
            "description_full": description,
            "description_snippet": description_snippet,
            "contract_type": contract_type,
            "posted_date": posted_date,
            "source_url": result.get("redirect_url", ""),
            "category_label": category,
        }

    # ------------------------------------------------------------------
    # Enrichment
    # ------------------------------------------------------------------

    @staticmethod
    def _enrich_job(job: dict) -> None:
        """Add classification fields and run sponsorship detection."""
        title = job.get("title_raw", "")
        location = job.get("location_raw", "")
        description = job.get("description_full", "") or job.get("description_snippet", "")
        combined = f"{title} {description}"

        # Contract type (if not already set from API data)
        if not job.get("contract_type"):
            job["contract_type"] = _detect_contract_type(None, combined)

        # Seniority
        if not job.get("seniority"):
            job["seniority"] = _detect_seniority(title)

        # Remote detection
        job["is_remote"] = _detect_remote(title, location)

        # Sponsorship detection
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals

        # Ensure snippet exists
        if not job.get("description_snippet") and description:
            job["description_snippet"] = description[:500]
