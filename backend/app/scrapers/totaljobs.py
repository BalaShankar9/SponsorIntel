"""
TotalJobs scraper (Tier 2).

Scrapes job listings from totaljobs.com search results.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class TotalJobsScraper(BaseScraper):
    """
    Scrapes job listings from TotalJobs.

    Parses search results for title, company, location, salary, and URL.
    """

    name = "totaljobs"
    base_url = "https://www.totaljobs.com"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape TotalJobs listings.

        Args:
            keyword: Search keyword (required)
            location: Location filter (optional)
            pages: Number of pages (default 3)
        """
        keyword = kwargs.get("keyword", "")
        location = kwargs.get("location", "")
        pages = kwargs.get("pages", 3)

        if not keyword:
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

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse TotalJobs search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "article[data-testid='job-card'], div.job-card, "
            "article.ResultsJobCard"
        ):
            job: dict = {"source": "totaljobs"}

            title_el = card.css_first("h2 a, a[data-testid='job-title']")
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
                "span[data-testid='company-name'], a.company-link, "
                "span.job-card__company"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            location_el = card.css_first(
                "span[data-testid='job-location'], span.job-card__location"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            salary_el = card.css_first(
                "span[data-testid='job-salary'], span.job-card__salary"
            )
            if salary_el:
                job["salary_text"] = salary_el.text(strip=True)

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'<h2[^>]*><a[^>]*href="(/jobs?/[^"]*)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html, re.I):
            url = match.group(1)
            if url.startswith("/"):
                url = f"{self.base_url}{url}"
            jobs.append({
                "source": "totaljobs",
                "title": match.group(2).strip(),
                "url": url,
            })
        return jobs

    def _build_search_url(self, keyword: str, location: str, page: int) -> str:
        """Build TotalJobs search URL."""
        keyword_slug = keyword.lower().replace(" ", "-")
        if location:
            location_slug = location.lower().replace(" ", "-")
            url = f"{self.base_url}/jobs/{keyword_slug}/in-{location_slug}"
        else:
            url = f"{self.base_url}/jobs/{keyword_slug}"

        if page > 1:
            url += f"?page={page}"
        return url
