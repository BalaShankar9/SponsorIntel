"""
Reed.co.uk job board scraper.

Scrapes job listings from Reed's search results pages, follows detail pages
for full descriptions, and runs sponsorship detection on each listing.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote_plus

from selectolax.parser import HTMLParser

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared helpers (salary, date, classification)
# ---------------------------------------------------------------------------

_SALARY_RANGE_RE = re.compile(
    r"[\u00a3\$]?\s*([\d,]+(?:\.\d+)?)\s*[-\u2013]+\s*[\u00a3\$]?\s*([\d,]+(?:\.\d+)?)",
)
_SALARY_SINGLE_RE = re.compile(r"[\u00a3\$]\s*([\d,]+(?:\.\d+)?)")
_SALARY_PERIOD_RE = re.compile(
    r"(per\s+annum|per\s+year|p\.?a\.?|annual|yearly|per\s+month|per\s+day|per\s+hour|per\s+week)",
    re.I,
)

_RELATIVE_DATE_RE = re.compile(
    r"(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago", re.I
)


def parse_salary(text: str) -> dict:
    """Parse a salary string into min, max, currency, period, and raw text."""
    result: dict = {
        "salary_min": None,
        "salary_max": None,
        "salary_currency": "GBP",
        "salary_period": None,
        "salary_text_raw": text.strip() if text else None,
    }
    if not text:
        return result

    # Detect currency
    if "$" in text:
        result["salary_currency"] = "USD"

    # Range
    m = _SALARY_RANGE_RE.search(text)
    if m:
        result["salary_min"] = float(m.group(1).replace(",", ""))
        result["salary_max"] = float(m.group(2).replace(",", ""))
    else:
        m = _SALARY_SINGLE_RE.search(text)
        if m:
            val = float(m.group(1).replace(",", ""))
            result["salary_min"] = val
            result["salary_max"] = val

    # Period
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
        # Heuristic: if min >= 1000, assume annual
        if result["salary_min"] and result["salary_min"] >= 1000:
            result["salary_period"] = "ANNUAL"

    return result


def parse_relative_date(text: str) -> Optional[datetime]:
    """Convert relative date strings like '2 days ago' to datetime."""
    if not text:
        return None
    text_lower = text.lower().strip()

    if "just" in text_lower or "today" in text_lower or "now" in text_lower:
        return datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    if "yesterday" in text_lower:
        return (datetime.utcnow() - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

    m = _RELATIVE_DATE_RE.search(text_lower)
    if m:
        amount = int(m.group(1))
        unit = m.group(2).lower()
        delta_map = {
            "second": timedelta(seconds=amount),
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
            "month": timedelta(days=amount * 30),
        }
        delta = delta_map.get(unit)
        if delta:
            return (datetime.utcnow() - delta).replace(hour=0, minute=0, second=0, microsecond=0)

    # Try absolute date formats
    for fmt in ("%d/%m/%Y", "%d %B %Y", "%d %b %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.strip(), fmt)
        except ValueError:
            continue

    return None


def detect_contract_type(text: str) -> Optional[str]:
    """Detect contract type from title or description text."""
    if not text:
        return None
    t = text.lower()
    if "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "fixed term" in t or "fixed-term" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp " in t:
        return ContractType.TEMPORARY.value
    if "apprentice" in t:
        return ContractType.APPRENTICESHIP.value
    return None


def detect_seniority(text: str) -> Optional[str]:
    """Detect seniority level from title or description."""
    if not text:
        return None
    t = text.lower()
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


def detect_remote(title: str, location: str) -> bool:
    """Detect if a job is remote from title/location text."""
    combined = f"{title or ''} {location or ''}".lower()
    return any(k in combined for k in ("remote", "work from home", "wfh", "home based", "home-based"))


# ---------------------------------------------------------------------------
# Reed Scraper
# ---------------------------------------------------------------------------


class ReedScraper(BaseScraper):
    """
    Scrapes job listings from Reed.co.uk.

    Parses search result pages for job title, company, location, salary,
    posted date, and URL. Follows detail pages for full descriptions.
    """

    name = "reed"
    base_url = "https://www.reed.co.uk"
    requests_per_minute = 5
    use_proxy = True
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "United Kingdom", **kwargs) -> list[dict]:
        """
        Scrape Reed job listings.

        Args:
            keyword: Search keyword (required).
            location: Location filter (default: United Kingdom).
        """
        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        pages = kwargs.get("pages", 5)
        fetch_details = kwargs.get("fetch_details", True)
        all_jobs: list[dict] = []

        for page in range(1, pages + 1):
            url = self._build_search_url(keyword, location, page)
            html = await self.fetch(url)
            if not html:
                logger.warning("[%s] No HTML returned for page %d", self.name, page)
                break

            jobs = self._parse_listing_page(html)
            if not jobs:
                logger.info("[%s] No jobs found on page %d, stopping pagination", self.name, page)
                break

            all_jobs.extend(jobs)

        # Fetch detail pages
        if fetch_details:
            for job in all_jobs:
                source_url = job.get("source_url")
                if source_url:
                    try:
                        detail_html = await self.fetch(source_url)
                        if detail_html:
                            detail = self._parse_detail_page(detail_html, source_url)
                            job.update({k: v for k, v in detail.items() if v is not None and job.get(k) is None})
                    except Exception as exc:
                        logger.warning("[%s] Failed to fetch detail page %s: %s", self.name, source_url, exc)

        # Run sponsorship detection & classification on each job
        for job in all_jobs:
            self._enrich_job(job)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse HTML — delegates to _parse_listing_page."""
        return self._parse_listing_page(html)

    # ------------------------------------------------------------------
    # Listing page
    # ------------------------------------------------------------------

    def _parse_listing_page(self, html: str) -> list[dict]:
        """Extract job cards from a Reed search results page."""
        jobs: list[dict] = []
        try:
            tree = HTMLParser(html)
        except Exception as exc:
            logger.warning("[%s] HTMLParser error: %s", self.name, exc)
            return jobs

        for article in tree.css("article[data-qa='job-card'], article.job-result, div.job-result-card"):
            try:
                job = self._parse_card(article)
                if job and job.get("title_raw"):
                    jobs.append(job)
            except Exception as exc:
                logger.warning("[%s] Error parsing job card: %s", self.name, exc)

        return jobs

    def _parse_card(self, node) -> dict:
        """Parse a single job card node into a dict."""
        job: dict = {"source": JobSource.REED.value}

        # Title & URL
        title_el = node.css_first("h2 a, h3 a, a[data-qa='job-card-title']")
        if title_el:
            job["title_raw"] = title_el.text(strip=True)
            href = title_el.attributes.get("href", "")
            if href.startswith("/"):
                href = f"{self.base_url}{href}"
            job["source_url"] = href

            id_match = re.search(r"/jobs?/.*?/(\d+)", href)
            if id_match:
                job["source_job_id"] = id_match.group(1)
            else:
                id_match2 = re.search(r"/(\d+)\??", href)
                if id_match2:
                    job["source_job_id"] = id_match2.group(1)

        # Company
        company_el = node.css_first(
            "a[data-qa='job-card-company'], span.job-result-heading__posted-by, "
            "div.job-result-heading__posted-by a"
        )
        if company_el:
            raw = company_el.text(strip=True)
            # Remove "by " prefix
            job["company_name_raw"] = re.sub(r"^by\s+", "", raw, flags=re.I).strip()
        else:
            job["company_name_raw"] = "Unknown"

        # Location
        location_el = node.css_first(
            "span[data-qa='job-card-location'], li.job-metadata__item--location, "
            "span.job-card-location"
        )
        if location_el:
            job["location_raw"] = location_el.text(strip=True)

        # Salary
        salary_el = node.css_first(
            "span[data-qa='job-card-salary'], li.job-metadata__item--salary, "
            "span.job-card-salary"
        )
        if salary_el:
            sal = parse_salary(salary_el.text(strip=True))
            job.update(sal)

        # Posted date
        date_el = node.css_first(
            "span[data-qa='job-card-posted-date'], time, span.job-result-heading__posted-date"
        )
        if date_el:
            date_text = date_el.text(strip=True)
            job["posted_date"] = parse_relative_date(date_text)

        # Snippet from card
        snippet_el = node.css_first("p.job-result-description__details, div.job-snippet")
        if snippet_el:
            job["description_snippet"] = snippet_el.text(strip=True)[:500]

        return job

    # ------------------------------------------------------------------
    # Detail page
    # ------------------------------------------------------------------

    def _parse_detail_page(self, html: str, url: str) -> dict:
        """Extract full job details from a Reed detail page."""
        result: dict = {}
        try:
            tree = HTMLParser(html)
        except Exception as exc:
            logger.warning("[%s] HTMLParser error on detail page %s: %s", self.name, url, exc)
            return result

        # Full description
        desc_el = tree.css_first(
            "div[data-qa='job-description'], div.job-description, "
            "div.description, span[itemprop='description']"
        )
        if desc_el:
            result["description_full"] = desc_el.text(strip=True)
            if not result.get("description_snippet"):
                result["description_snippet"] = result["description_full"][:500]

        # Salary from detail page
        salary_el = tree.css_first("span[data-qa='salaryLbl'], div.job-header__salary")
        if salary_el:
            sal = parse_salary(salary_el.text(strip=True))
            result.update(sal)

        # Contract type from metadata
        for meta in tree.css("li.job-metadata__item, span.job-metadata__detail"):
            text = meta.text(strip=True).lower()
            if "permanent" in text or "contract" in text or "temporary" in text:
                ct = detect_contract_type(text)
                if ct:
                    result["contract_type"] = ct
                break

        return result

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

        if not job.get("contract_type"):
            job["contract_type"] = detect_contract_type(combined)
        if not job.get("seniority"):
            job["seniority"] = detect_seniority(title)

        job["is_remote"] = detect_remote(title, location)

        # Sponsorship detection
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals

        # Ensure snippet
        if not job.get("description_snippet") and description:
            job["description_snippet"] = description[:500]

    # ------------------------------------------------------------------
    # URL builder
    # ------------------------------------------------------------------

    def _build_search_url(self, keyword: str, location: str, page: int) -> str:
        """Build Reed search URL."""
        keyword_slug = keyword.lower().replace(" ", "-")
        if location:
            location_slug = location.lower().replace(" ", "-")
            url = f"{self.base_url}/jobs/{keyword_slug}-jobs-in-{location_slug}"
        else:
            url = f"{self.base_url}/jobs/{keyword_slug}-jobs"

        if page > 1:
            url += f"?pageno={page}"
        return url
