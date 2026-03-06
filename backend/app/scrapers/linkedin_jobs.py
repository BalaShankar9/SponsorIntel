"""
LinkedIn Jobs scraper (Tier 2).

Scrapes job listings from LinkedIn's public jobs search.
Uses Playwright browser as LinkedIn is heavily JS-rendered.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class LinkedInJobsScraper(BaseScraper):
    """
    Scrapes job listings from LinkedIn's public job search pages.

    Uses headless browser since LinkedIn requires JS rendering.
    Rate limited to 2/min with proxy to avoid blocks.
    """

    name = "linkedin"
    base_url = "https://www.linkedin.com"
    requests_per_minute = 2
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape LinkedIn job listings.

        Args:
            keyword: Search keyword (required)
            location: Location filter (optional, defaults to "United Kingdom")
            pages: Number of pages (default 2)
        """
        keyword = kwargs.get("keyword", "")
        location = kwargs.get("location", "United Kingdom")
        pages = kwargs.get("pages", 2)

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        all_jobs: list[dict] = []

        for page in range(pages):
            start = page * 25
            url = self._build_search_url(keyword, location, start)
            html = await self.fetch_with_browser(url)
            if not html:
                break

            jobs = await self.parse(html)
            if not jobs:
                break
            all_jobs.extend(jobs)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse LinkedIn jobs search results."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "div.base-card, li.jobs-search-results__list-item, "
            "div.job-search-card"
        ):
            job: dict = {"source": "linkedin"}

            title_el = card.css_first(
                "h3.base-search-card__title, h3.job-search-card__title, "
                "a.base-card__full-link"
            )
            if title_el:
                job["title"] = title_el.text(strip=True)

            link_el = card.css_first("a.base-card__full-link, a[data-tracking-control-name]")
            if link_el:
                href = link_el.attributes.get("href", "")
                job["url"] = href.split("?")[0] if href else ""

                id_match = re.search(r"/view/[^/]+-(\d+)", href)
                if not id_match:
                    id_match = re.search(r"currentJobId=(\d+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)

            company_el = card.css_first(
                "h4.base-search-card__subtitle, a.job-search-card__subtitle-link"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            location_el = card.css_first(
                "span.job-search-card__location, span.base-search-card__metadata"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            date_el = card.css_first("time")
            if date_el:
                job["posted_date_text"] = date_el.attributes.get(
                    "datetime", date_el.text(strip=True)
                )

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'class="base-search-card__title[^"]*"[^>]*>([^<]+)'
        for match in re.finditer(pattern, html):
            jobs.append({
                "source": "linkedin",
                "title": match.group(1).strip(),
            })
        return jobs

    def _build_search_url(self, keyword: str, location: str, start: int) -> str:
        """Build LinkedIn jobs search URL."""
        params = f"keywords={quote_plus(keyword)}"
        if location:
            params += f"&location={quote_plus(location)}"
        if start > 0:
            params += f"&start={start}"
        return f"{self.base_url}/jobs/search/?{params}"
