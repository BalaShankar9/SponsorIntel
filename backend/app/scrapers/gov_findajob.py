"""
Find a Job (DWP) scraper.

Scrapes the UK government's Find a Job service at findajob.dwp.gov.uk.
Government site with clean HTML and lenient rate limiting.
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

# Import shared helpers from reed (they live in the same package)
from app.scrapers.reed import (
    detect_contract_type,
    detect_remote,
    detect_seniority,
    parse_relative_date,
    parse_salary,
)


class FindAJobScraper(BaseScraper):
    """
    Scrapes job listings from the DWP Find a Job service.

    Government site with well-structured HTML. Parses title, company,
    location, salary, and URL from search results and detail pages.
    """

    name = "gov_findajob"
    base_url = "https://findajob.dwp.gov.uk"
    requests_per_minute = 10
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "United Kingdom", **kwargs) -> list[dict]:
        """
        Scrape Find a Job listings.

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

        # Enrichment
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
        """Extract job cards from a Find a Job search results page."""
        jobs: list[dict] = []
        try:
            tree = HTMLParser(html)
        except Exception as exc:
            logger.warning("[%s] HTMLParser error: %s", self.name, exc)
            return jobs

        for card in tree.css(
            "div.search-result, li.search-result, "
            "div.govuk-grid-row div.search-results__item, "
            "div.search-results div.govuk-\\!-margin-bottom-4"
        ):
            try:
                job = self._parse_card(card)
                if job and job.get("title_raw"):
                    jobs.append(job)
            except Exception as exc:
                logger.warning("[%s] Error parsing job card: %s", self.name, exc)

        return jobs

    def _parse_card(self, node) -> dict:
        """Parse a single job card node."""
        job: dict = {"source": JobSource.GOV_FIND_A_JOB.value}

        # Title & URL
        title_el = node.css_first("h2 a, h3 a, a.govuk-link")
        if title_el:
            job["title_raw"] = title_el.text(strip=True)
            href = title_el.attributes.get("href", "")
            if href.startswith("/"):
                href = f"{self.base_url}{href}"
            job["source_url"] = href

            id_match = re.search(r"/details/(\d+)", href)
            if id_match:
                job["source_job_id"] = id_match.group(1)

        # Company
        company_el = node.css_first(
            "span.company, p.company-name, dd.company-name, "
            "span.search-result__company"
        )
        if company_el:
            job["company_name_raw"] = company_el.text(strip=True)

        # Location
        location_el = node.css_first(
            "span.location, p.location, dd.location, "
            "span.search-result__location"
        )
        if location_el:
            job["location_raw"] = location_el.text(strip=True)

        # Salary
        salary_el = node.css_first(
            "span.salary, p.salary, dd.salary, "
            "span.search-result__salary"
        )
        if salary_el:
            sal = parse_salary(salary_el.text(strip=True))
            job.update(sal)

        # Posted date
        date_el = node.css_first("span.date, time, span.search-result__date")
        if date_el:
            job["posted_date"] = parse_relative_date(date_el.text(strip=True))

        # Fallback: parse from card text
        card_text = node.text()
        if not job.get("company_name_raw"):
            m = re.search(r"Company:\s*(.+?)(?:\n|$)", card_text)
            if m:
                job["company_name_raw"] = m.group(1).strip()
        if not job.get("company_name_raw"):
            job["company_name_raw"] = "Unknown"

        if not job.get("location_raw"):
            m = re.search(r"Location:\s*(.+?)(?:\n|$)", card_text)
            if m:
                job["location_raw"] = m.group(1).strip()

        if not job.get("salary_text_raw"):
            m = re.search(r"Salary:\s*(.+?)(?:\n|$)", card_text)
            if m:
                sal = parse_salary(m.group(1).strip())
                job.update(sal)

        # Snippet
        snippet_el = node.css_first("p.search-result__description, div.search-result__snippet")
        if snippet_el:
            job["description_snippet"] = snippet_el.text(strip=True)[:500]

        return job

    # ------------------------------------------------------------------
    # Detail page
    # ------------------------------------------------------------------

    def _parse_detail_page(self, html: str, url: str) -> dict:
        """Extract full job details from a Find a Job detail page."""
        result: dict = {}
        try:
            tree = HTMLParser(html)
        except Exception as exc:
            logger.warning("[%s] HTMLParser error on detail page %s: %s", self.name, url, exc)
            return result

        # Full description
        desc_el = tree.css_first(
            "div.vacancy-description, div.job-description, "
            "div#job-description, div.govuk-body"
        )
        if desc_el:
            result["description_full"] = desc_el.text(strip=True)
            result["description_snippet"] = result["description_full"][:500]

        # Salary
        salary_el = tree.css_first("dd.salary, span.salary, div.salary")
        if salary_el:
            sal = parse_salary(salary_el.text(strip=True))
            result.update(sal)

        # Company from detail
        company_el = tree.css_first("dd.company-name, span.company, h2.employer-name")
        if company_el:
            result["company_name_raw"] = company_el.text(strip=True)

        # Location from detail
        location_el = tree.css_first("dd.location, span.location")
        if location_el:
            result["location_raw"] = location_el.text(strip=True)

        # Contract type
        for dt in tree.css("dt"):
            label = dt.text(strip=True).lower()
            dd = dt.next
            if dd is None:
                continue
            dd_text = dd.text(strip=True) if hasattr(dd, "text") else ""
            if "contract" in label or "type" in label:
                ct = detect_contract_type(dd_text)
                if ct:
                    result["contract_type"] = ct

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

        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals

        if not job.get("description_snippet") and description:
            job["description_snippet"] = description[:500]

    # ------------------------------------------------------------------
    # URL builder
    # ------------------------------------------------------------------

    def _build_search_url(self, keyword: str, location: str, page: int) -> str:
        """Build Find a Job search URL."""
        params = f"q={quote_plus(keyword)}"
        if location:
            params += f"&w={quote_plus(location)}"
        if page > 1:
            params += f"&p={page}"
        return f"{self.base_url}/search?{params}"
