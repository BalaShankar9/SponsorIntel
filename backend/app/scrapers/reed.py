"""
Reed.co.uk job board scraper (Tier 2).

Scrapes job listings from Reed's search results pages.
"""

import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class ReedScraper(BaseScraper):
    """
    Scrapes job listings from Reed.co.uk.

    Parses search result pages for job title, company, location, salary,
    posted date, and URL. Can optionally follow detail pages for full descriptions.
    """

    name = "reed"
    base_url = "https://www.reed.co.uk"
    requests_per_minute = 5
    use_proxy = True
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Reed job listings.

        Args:
            keyword: Search keyword (required)
            location: Location filter (optional)
            pages: Number of pages to scrape (default 3)
            fetch_details: Whether to fetch full job descriptions (default False)
        """
        keyword = kwargs.get("keyword", "")
        location = kwargs.get("location", "")
        pages = kwargs.get("pages", 3)
        fetch_details = kwargs.get("fetch_details", False)

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        all_jobs: list[dict] = []

        for page in range(1, pages + 1):
            url = self._build_search_url(keyword, location, page)
            html = await self.fetch(url)
            if not html:
                break

            jobs = await self.parse(html)
            if not jobs:
                break

            all_jobs.extend(jobs)

        if fetch_details:
            for job in all_jobs:
                if job.get("url"):
                    detail_html = await self.fetch(job["url"])
                    if detail_html:
                        description = self._parse_detail_page(detail_html)
                        if description:
                            job["description_full"] = description

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Reed search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for article in tree.css("article[data-qa='job-card'], article.job-result"):
            job: dict = {"source": "reed"}

            # Title
            title_el = article.css_first("h2 a, h3 a, a[data-qa='job-card-title']")
            if title_el:
                job["title"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["url"] = href

                # Extract source_job_id from URL
                id_match = re.search(r"/jobs?/.*?/(\d+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)

            # Company
            company_el = article.css_first(
                "a[data-qa='job-card-company'], span.job-result-heading__posted-by"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            # Location
            location_el = article.css_first(
                "span[data-qa='job-card-location'], li.job-metadata__item--location"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            # Salary
            salary_el = article.css_first(
                "span[data-qa='job-card-salary'], li.job-metadata__item--salary"
            )
            if salary_el:
                job["salary_text"] = salary_el.text(strip=True)
                self._parse_salary(job)

            # Posted date
            date_el = article.css_first(
                "span[data-qa='job-card-posted-date'], time"
            )
            if date_el:
                job["posted_date_text"] = date_el.text(strip=True)

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser for Reed search results."""
        jobs = []
        pattern = r'<article[^>]*>.*?<h[23][^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html, re.DOTALL):
            url = match.group(1)
            if url.startswith("/"):
                url = f"{self.base_url}{url}"
            jobs.append({
                "source": "reed",
                "title": match.group(2).strip(),
                "url": url,
            })
        return jobs

    def _parse_detail_page(self, html: str) -> Optional[str]:
        """Parse a Reed job detail page for the full description."""
        try:
            from selectolax.parser import HTMLParser
            tree = HTMLParser(html)
            desc_el = tree.css_first(
                "div[data-qa='job-description'], div.job-description, "
                "div.description, span[itemprop='description']"
            )
            if desc_el:
                return desc_el.text(strip=True)
        except ImportError:
            pass

        # Regex fallback
        match = re.search(
            r'<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)</div>',
            html, re.DOTALL | re.I,
        )
        if match:
            text = re.sub(r"<[^>]+>", " ", match.group(1))
            return re.sub(r"\s+", " ", text).strip()
        return None

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

    @staticmethod
    def _parse_salary(job: dict) -> None:
        """Extract salary min/max from salary text."""
        salary_text = job.get("salary_text", "")
        if not salary_text:
            return

        # Match patterns like "25,000 - 35,000" or "25000-35000"
        range_match = re.search(
            r"[\u00a3$]?\s*(\d[\d,]*)\s*[-\u2013to]+\s*[\u00a3$]?\s*(\d[\d,]*)",
            salary_text,
        )
        if range_match:
            job["salary_min"] = float(range_match.group(1).replace(",", ""))
            job["salary_max"] = float(range_match.group(2).replace(",", ""))
            return

        # Single value
        single_match = re.search(r"[\u00a3$]\s*(\d[\d,]*)", salary_text)
        if single_match:
            val = float(single_match.group(1).replace(",", ""))
            job["salary_min"] = val
            job["salary_max"] = val
