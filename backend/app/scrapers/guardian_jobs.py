"""
Guardian Jobs scraper (Tier 2).

Scrapes job listings from The Guardian's jobs section.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class GuardianJobsScraper(BaseScraper):
    """
    Scrapes job listings from Guardian Jobs.

    Parses: title, company, location, salary, URL.
    """

    name = "guardian"
    base_url = "https://jobs.theguardian.com"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Guardian Jobs listings.

        Args:
            keyword: Search keyword (required)
            pages: Number of pages (default 3)
        """
        keyword = kwargs.get("keyword", "")
        pages = kwargs.get("pages", 3)

        if not keyword:
            return []

        all_jobs: list[dict] = []

        for page in range(1, pages + 1):
            url = self._build_search_url(keyword, page)
            html = await self.fetch(url)
            if not html:
                break

            jobs = await self.parse(html)
            if not jobs:
                break
            all_jobs.extend(jobs)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Guardian Jobs search results."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "div.lister__item, li.lister__item, "
            "article.job-card"
        ):
            job: dict = {"source": "guardian"}

            title_el = card.css_first("h2 a, h3 a, a.lister__link")
            if title_el:
                job["title"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["url"] = href

                id_match = re.search(r"/job/(\d+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)

            company_el = card.css_first(
                "span.lister__meta-item--recruiter, "
                "span.company-name, a.recruiter"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            location_el = card.css_first(
                "span.lister__meta-item--location, "
                "span.location"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            salary_el = card.css_first(
                "span.lister__meta-item--salary, "
                "span.salary"
            )
            if salary_el:
                job["salary_text"] = salary_el.text(strip=True)

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'<a[^>]*href="(/job/\d+[^"]*)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html, re.I):
            jobs.append({
                "source": "guardian",
                "title": match.group(2).strip(),
                "url": f"{self.base_url}{match.group(1)}",
            })
        return jobs

    def _build_search_url(self, keyword: str, page: int) -> str:
        """Build Guardian Jobs search URL."""
        keyword_slug = keyword.lower().replace(" ", "-")
        url = f"{self.base_url}/jobs/{keyword_slug}/"
        if page > 1:
            url += f"?page={page}"
        return url
