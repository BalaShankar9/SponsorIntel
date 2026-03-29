"""
Arbeitnow.com API scraper.

Uses the free public Arbeitnow job board API (no authentication required)
to fetch job listings. Paginates through results and filters for
UK/Europe/Remote-relevant positions.

API docs: https://www.arbeitnow.com/api/job-board-api
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

# Maximum pages to scrape per run
MAX_PAGES = 10

# Location substrings that indicate UK/Europe/Remote relevance
RELEVANT_LOCATION_KEYWORDS = [
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
    "europe",
    "emea",
    "worldwide",
    "anywhere",
    "global",
    "remote",
    "germany",
    "france",
    "netherlands",
    "ireland",
    "spain",
    "italy",
    "sweden",
    "denmark",
    "norway",
    "finland",
    "switzerland",
    "austria",
    "belgium",
    "portugal",
    "poland",
]

_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _strip_html(html: str) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _is_relevant_location(location: str, is_remote: bool) -> bool:
    """Check if a job is relevant based on location or remote status."""
    if is_remote:
        return True
    if not location:
        return False
    loc_lower = location.lower()
    return any(kw in loc_lower for kw in RELEVANT_LOCATION_KEYWORDS)


def _parse_unix_timestamp(ts) -> Optional[datetime]:
    """Convert Unix timestamp to datetime."""
    if ts is None:
        return None
    try:
        return datetime.utcfromtimestamp(int(ts))
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
    # Default assumption for full-time listings
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


def _detect_remote(title: str, location: str, is_remote_flag: bool) -> bool:
    """Detect if a job is remote from title/location text or remote flag."""
    if is_remote_flag:
        return True
    combined = f"{title or ''} {location or ''}".lower()
    return any(k in combined for k in ("remote", "work from home", "wfh", "home based", "home-based"))


class ArbeitnowAPIScraper(BaseScraper):
    """
    Scrapes job listings from the Arbeitnow public API.

    No authentication required. Returns paginated JSON results.
    Filters for UK/Europe/Remote-relevant jobs.
    """

    name = "arbeitnow"
    base_url = "https://www.arbeitnow.com/api/job-board-api"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        """
        Scrape Arbeitnow API for job listings.

        Args:
            keyword: Optional search keyword (used for post-filtering).
            location: Ignored (we filter by location fields in the response).
        """
        all_jobs: list[dict] = []
        max_pages = kwargs.get("max_pages", MAX_PAGES)

        for page in range(1, max_pages + 1):
            try:
                jobs, last_page = await self._fetch_page(page, keyword)
                all_jobs.extend(jobs)

                if page >= last_page:
                    logger.info(
                        "[%s] Reached last page %d/%d",
                        self.name, page, last_page,
                    )
                    break

            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching page %d: %s",
                    self.name, page, str(exc)[:200],
                )
                break

        # Enrich all jobs with classification and sponsorship detection
        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d relevant jobs across %d pages",
            self.name, len(all_jobs), min(page, max_pages),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Not used for API scraper -- implemented to satisfy abstract method."""
        return []

    async def _fetch_page(self, page: int, keyword: str = "") -> tuple[list[dict], int]:
        """Fetch a single page of jobs from the Arbeitnow API."""
        url = f"{self.base_url}?page={page}"
        jobs: list[dict] = []
        last_page = 1

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
                    "[%s] HTTP %d for page %d",
                    self.name, response.status_code, page,
                )
                return jobs, last_page

            data = response.json()
            raw_jobs = data.get("data", [])
            meta = data.get("meta", {})
            last_page = meta.get("last_page", 1)

            for raw in raw_jobs:
                try:
                    parsed = self._parse_job(raw, keyword)
                    if parsed:
                        jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job slug=%s: %s",
                        self.name, raw.get("slug", "?"), str(exc)[:200],
                    )

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching page %d", self.name, page)
        except httpx.RequestError as exc:
            logger.warning(
                "[%s] Request error for page %d: %s",
                self.name, page, str(exc)[:200],
            )
        except Exception as exc:
            logger.warning(
                "[%s] Unexpected error for page %d: %s",
                self.name, page, str(exc)[:200],
            )

        return jobs, last_page

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        """Parse a single Arbeitnow API job object into internal format."""
        location = raw.get("location", "") or ""
        is_remote_flag = bool(raw.get("remote", False))

        # Filter: only UK/Europe/Remote-relevant locations
        if not _is_relevant_location(location, is_remote_flag):
            return None

        # Optional keyword filter (post-fetch)
        title = raw.get("title", "") or ""
        description_html = raw.get("description", "") or ""
        tags = raw.get("tags", []) or []

        if keyword:
            searchable = f"{title} {description_html} {' '.join(tags)}".lower()
            if keyword.lower() not in searchable:
                return None

        description = _strip_html(description_html)
        company = raw.get("company_name", "") or ""
        slug = raw.get("slug", "") or ""

        # Build source URL (Arbeitnow uses relative URLs)
        raw_url = raw.get("url", "") or ""
        if raw_url and not raw_url.startswith("http"):
            source_url = f"https://www.arbeitnow.com{raw_url}"
        elif raw_url:
            source_url = raw_url
        else:
            source_url = f"https://www.arbeitnow.com/view/{slug}" if slug else ""

        is_remote = _detect_remote(title, location, is_remote_flag)

        job: dict = {
            "source": JobSource.ARBEITNOW.value,
            "source_job_id": slug or str(raw.get("id", "")),
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": source_url,
            "posted_date": _parse_unix_timestamp(raw.get("created_at")),
            "contract_type": _detect_contract_type(title),
            "skills_extracted": tags if tags else None,
            "is_remote": is_remote,
            "location_is_remote": is_remote,
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
