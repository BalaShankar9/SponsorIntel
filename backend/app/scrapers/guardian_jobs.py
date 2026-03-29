"""
Guardian Jobs scraper.

Scrapes job listings from The Guardian's jobs section at jobs.theguardian.com.
Professional roles across various sectors.
"""

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus

from selectolax.parser import HTMLParser

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

from app.scrapers.reed import (
    detect_contract_type,
    detect_remote,
    detect_seniority,
    parse_relative_date,
    parse_salary,
)

logger = logging.getLogger(__name__)


class GuardianJobsScraper(BaseScraper):
    """
    Scrapes job listings from Guardian Jobs.

    Parses title, company, location, salary, and URL from search results.
    Follows detail pages for full descriptions.
    """

    name = "guardian"
    base_url = "https://jobs.theguardian.com"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "United Kingdom", **kwargs) -> list[dict]:
        """
        Scrape Guardian Jobs listings.

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
                source_url = (job.get("source_url") or "").strip()
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
        """Extract job cards from a Guardian Jobs search results page."""
        jobs: list[dict] = []
        try:
            tree = HTMLParser(html)
        except Exception as exc:
            logger.warning("[%s] HTMLParser error: %s", self.name, exc)
            return jobs

        for card in tree.css(
            "div.lister__item, li.lister__item, "
            "article.job-card, div.search-result, "
            "li.search-results__item"
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
        job: dict = {"source": JobSource.GUARDIAN.value}

        # Title & URL
        title_el = node.css_first(
            "h2 a, h3 a, a.lister__link, a.job-card__title, "
            "a[data-testid='job-title']"
        )
        if title_el:
            job["title_raw"] = title_el.text(strip=True)
            href = (title_el.attributes.get("href", "") or "").strip()
            if href.startswith("/"):
                href = f"{self.base_url}{href}"
            job["source_url"] = href

            id_match = re.search(r"/job/(\d+)", href)
            if not id_match:
                id_match = re.search(r"/(\d+)/?", href)
            if id_match:
                job["source_job_id"] = id_match.group(1)

        # Company
        company_el = node.css_first(
            "span.lister__meta-item--recruiter, span.company-name, "
            "a.recruiter, span.job-card__company, "
            "div.lister__meta-item--recruiter a"
        )
        if company_el:
            job["company_name_raw"] = company_el.text(strip=True)
        else:
            job["company_name_raw"] = "Unknown"

        # Location
        location_el = node.css_first(
            "span.lister__meta-item--location, span.location, "
            "span.job-card__location, div.lister__meta-item--location"
        )
        if location_el:
            job["location_raw"] = location_el.text(strip=True)

        # Salary
        salary_el = node.css_first(
            "span.lister__meta-item--salary, span.salary, "
            "span.job-card__salary, div.lister__meta-item--salary"
        )
        if salary_el:
            sal = parse_salary(salary_el.text(strip=True))
            job.update(sal)

        # Posted date
        date_el = node.css_first(
            "span.lister__meta-item--date, time, "
            "span.job-card__date, div.lister__meta-item--date"
        )
        if date_el:
            job["posted_date"] = parse_relative_date(date_el.text(strip=True))

        # Snippet
        snippet_el = node.css_first(
            "p.lister__description, div.lister__description, "
            "p.job-card__description"
        )
        if snippet_el:
            job["description_snippet"] = snippet_el.text(strip=True)[:500]

        return job

    # ------------------------------------------------------------------
    # Detail page
    # ------------------------------------------------------------------

    def _parse_detail_page(self, html: str, url: str) -> dict:
        """Extract full job details from a Guardian Jobs detail page."""
        result: dict = {}
        try:
            tree = HTMLParser(html)
        except Exception as exc:
            logger.warning("[%s] HTMLParser error on detail page %s: %s", self.name, url, exc)
            return result

        # Full description
        desc_el = tree.css_first(
            "div.job-detail__description, div.job-description, "
            "div.vacancy-description, div[class*='description'], "
            "section.job-detail__body"
        )
        if desc_el:
            result["description_full"] = desc_el.text(strip=True)
            result["description_snippet"] = result["description_full"][:500]

        # Salary from detail
        salary_el = tree.css_first(
            "li.job-detail__meta-item--salary, span.salary, "
            "div.job-detail__salary"
        )
        if salary_el:
            sal = parse_salary(salary_el.text(strip=True))
            result.update(sal)

        # Contract type
        contract_el = tree.css_first(
            "li.job-detail__meta-item--type, span.contract-type, "
            "div.job-detail__type"
        )
        if contract_el:
            ct = detect_contract_type(contract_el.text(strip=True))
            if ct:
                result["contract_type"] = ct

        # Location from detail
        location_el = tree.css_first(
            "li.job-detail__meta-item--location, span.location, "
            "div.job-detail__location"
        )
        if location_el:
            result["location_raw"] = location_el.text(strip=True)

        # Company from detail
        company_el = tree.css_first(
            "a.job-detail__recruiter, span.company-name, "
            "div.job-detail__company, h2.job-detail__recruiter"
        )
        if company_el:
            result["company_name_raw"] = company_el.text(strip=True)

        # Closing / expiry date
        closing_el = tree.css_first(
            "span.job-detail__closing-date, li.job-detail__meta-item--closing"
        )
        if closing_el:
            result["expiry_date"] = parse_relative_date(closing_el.text(strip=True))

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
        """Build Guardian Jobs search URL."""
        keyword_slug = keyword.lower().replace(" ", "-")
        url = f"{self.base_url}/jobs/{keyword_slug}/"
        if page > 1:
            url += f"?page={page}"
        return url
