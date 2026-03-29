"""
Jooble API job scraper.

Uses Jooble's free POST API to fetch UK job listings.
Docs: https://jooble.org/api/about
Free tier: register at jooble.org/api for an API key.
"""

import hashlib
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
# Helpers
# ---------------------------------------------------------------------------

_SALARY_RANGE_RE = re.compile(
    r"[\u00a3\$]?\s*([\d,]+(?:\.\d+)?)\s*[-\u2013]+\s*[\u00a3\$]?\s*([\d,]+(?:\.\d+)?)",
)
_SALARY_SINGLE_RE = re.compile(r"[\u00a3\$]\s*([\d,]+(?:\.\d+)?)")
_SALARY_PERIOD_RE = re.compile(
    r"(per\s+annum|per\s+year|p\.?a\.?|annual|yearly|per\s+month|per\s+day|per\s+hour|per\s+week)",
    re.I,
)


def _parse_salary_text(text: Optional[str]) -> dict:
    """
    Parse Jooble's salary string into min, max, currency, period, and raw text.

    Jooble returns salary as a freeform string (e.g. "£45,000 - £55,000 per annum").
    """
    result: dict = {
        "salary_min": None,
        "salary_max": None,
        "salary_currency": "GBP",
        "salary_period": None,
        "salary_text_raw": text.strip() if text else None,
    }
    if not text:
        return result

    # Currency detection
    if "$" in text:
        result["salary_currency"] = "USD"
    elif "\u20ac" in text:
        result["salary_currency"] = "EUR"

    # Range (e.g. "£45,000 - £55,000")
    m = _SALARY_RANGE_RE.search(text)
    if m:
        result["salary_min"] = float(m.group(1).replace(",", ""))
        result["salary_max"] = float(m.group(2).replace(",", ""))
    else:
        # Single value (e.g. "£50,000")
        m = _SALARY_SINGLE_RE.search(text)
        if m:
            val = float(m.group(1).replace(",", ""))
            result["salary_min"] = val
            result["salary_max"] = val

    # Period detection
    pm = _SALARY_PERIOD_RE.search(text)
    if pm:
        raw_period = pm.group(1).lower()
        if any(k in raw_period for k in ("annum", "year", "annual", "yearly", "p.a", "pa")):
            result["salary_period"] = "ANNUAL"
        elif "month" in raw_period:
            result["salary_period"] = "MONTHLY"
        elif "week" in raw_period:
            result["salary_period"] = "WEEKLY"
        elif "day" in raw_period:
            result["salary_period"] = "DAILY"
        elif "hour" in raw_period:
            result["salary_period"] = "HOURLY"
    else:
        # Heuristic: values >= 1000 are likely annual
        if result["salary_min"] and result["salary_min"] >= 1000:
            result["salary_period"] = "ANNUAL"

    return result


def _detect_contract_type(type_str: Optional[str], title: str = "") -> Optional[str]:
    """Map Jooble type field or title text to ContractType enum value."""
    if type_str:
        t = type_str.lower()
        if "permanent" in t:
            return ContractType.PERMANENT.value
        if "contract" in t or "fixed" in t:
            return ContractType.CONTRACT.value
        if "temporary" in t or "temp" in t:
            return ContractType.TEMPORARY.value
        if "apprentice" in t:
            return ContractType.APPRENTICESHIP.value

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


def _generate_source_job_id(link: str) -> str:
    """Generate a stable source_job_id from the job link URL using MD5 hash."""
    return hashlib.md5(link.encode("utf-8")).hexdigest()


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse Jooble's 'updated' date field. Supports ISO 8601 and common formats."""
    if not date_str:
        return None
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# Jooble API Scraper
# ---------------------------------------------------------------------------


class JoobleAPIScraper(BaseScraper):
    """
    Scrapes job listings from the Jooble API.

    Uses a POST request with the API key embedded in the URL path.
    Paginates through up to 5 pages of results.
    """

    name = "jooble"
    base_url = "https://jooble.org/api"
    requests_per_minute = 15  # Conservative for free tier
    max_retries = 3
    use_proxy = False  # API access, no need for proxy
    timeout = 30

    def __init__(self) -> None:
        super().__init__()
        settings = get_settings()
        self._api_key = settings.jooble_api_key

    async def scrape(self, keyword: str = "", location: str = "United Kingdom", **kwargs) -> list[dict]:
        """
        Scrape Jooble API for job listings.

        Args:
            keyword: Search keyword (required).
            location: Location filter (default: United Kingdom).

        Returns:
            List of job dicts mapped to the Job model fields.
        """
        if not self._api_key:
            logger.warning(
                "[%s] Jooble API key not configured (jooble_api_key). "
                "Register free at https://jooble.org/api/about and set the environment variable.",
                self.name,
            )
            return []

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        max_pages = kwargs.get("pages", 5)
        all_jobs: list[dict] = []
        seen_links: set[str] = set()  # Deduplicate within this scrape run

        for page in range(1, max_pages + 1):
            try:
                page_jobs, total_count = await self._fetch_page(keyword, location, page)
            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching page %d for '%s': %s",
                    self.name, page, keyword, str(exc)[:200],
                )
                break

            if not page_jobs:
                logger.info("[%s] No results on page %d for '%s', stopping pagination", self.name, page, keyword)
                break

            # Deduplicate by link within this scrape run
            for job in page_jobs:
                link = job.get("source_url", "")
                if link and link not in seen_links:
                    seen_links.add(link)
                    all_jobs.append(job)

            # Stop if we have fetched all available results
            if total_count and len(all_jobs) >= total_count:
                logger.info("[%s] Reached total count (%d), stopping pagination", self.name, total_count)
                break

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
    ) -> tuple[list[dict], Optional[int]]:
        """
        Fetch a single page of Jooble results via POST.

        Returns:
            Tuple of (list of job dicts, total result count or None).
        """
        await self._rate_limiter.acquire()

        url = f"{self.base_url}/{self._api_key}"
        payload = {
            "keywords": keyword,
            "location": location,
            "page": page,
        }

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(self.timeout),
                    follow_redirects=True,
                ) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )

                if response.status_code == 200:
                    data = response.json()
                    jobs_list = data.get("jobs", [])
                    total_count = data.get("totalCount")
                    if isinstance(total_count, str):
                        try:
                            total_count = int(total_count)
                        except ValueError:
                            total_count = None
                    parsed = [self._map_job(j) for j in jobs_list if j]
                    return parsed, total_count

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
                        "[%s] Authentication failed (%d). Check jooble_api_key.",
                        self.name, response.status_code,
                    )
                    return [], None

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
        return [], None

    # ------------------------------------------------------------------
    # Result mapping
    # ------------------------------------------------------------------

    def _map_job(self, job: dict) -> dict:
        """Map a single Jooble API job object to the Job model field convention."""
        title = (job.get("title") or "").strip()
        company = (job.get("company") or "").strip() or "Unknown"
        location = (job.get("location") or "").strip()
        link = (job.get("link") or "").strip()
        snippet = (job.get("snippet") or "").strip()
        source_site = (job.get("source") or "").strip()  # e.g. "Reed", "Indeed" -- metadata
        job_type = (job.get("type") or "").strip()
        updated = (job.get("updated") or "").strip()
        salary_text = (job.get("salary") or "").strip()

        # Parse salary from freeform text
        salary_data = _parse_salary_text(salary_text)

        # Generate stable source_job_id from link
        source_job_id = _generate_source_job_id(link) if link else None

        # Contract type
        contract_type = _detect_contract_type(job_type, title)

        # Posted date
        posted_date = _parse_date(updated)

        return {
            "source": JobSource.JOOBLE.value,
            "source_job_id": source_job_id,
            "title_raw": title or "Unknown",
            "company_name_raw": company,
            "location_raw": location,
            "salary_min": salary_data["salary_min"],
            "salary_max": salary_data["salary_max"],
            "salary_currency": salary_data["salary_currency"],
            "salary_period": salary_data["salary_period"],
            "salary_text_raw": salary_data["salary_text_raw"],
            "description_snippet": snippet[:500] if snippet else None,
            "description_full": None,  # Jooble only provides snippets
            "contract_type": contract_type,
            "posted_date": posted_date,
            "source_url": link,
            "source_site": source_site,  # Additional metadata: original aggregated source
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
