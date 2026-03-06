"""
Find a Job (DWP) scraper (Tier 2).

Scrapes the UK government's Find a Job service at findajob.dwp.gov.uk.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class FindAJobScraper(BaseScraper):
    """
    Scrapes job listings from the DWP Find a Job service.

    Government site with lenient rate limiting. Parses title, company,
    location, and URL from search results.
    """

    name = "gov_findajob"
    base_url = "https://findajob.dwp.gov.uk"
    requests_per_minute = 10
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Find a Job listings.

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
        """Parse Find a Job search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "div.search-result, li.search-result, "
            "div.govuk-grid-row div.search-results__item"
        ):
            job: dict = {"source": "gov_findajob"}

            title_el = card.css_first("h2 a, h3 a, a.govuk-link")
            if title_el:
                job["title"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["url"] = href

                id_match = re.search(r"/details/(\d+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)

            company_el = card.css_first(
                "span.company, p.company-name, dd.company-name"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            location_el = card.css_first(
                "span.location, p.location, dd.location"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            # Fallback: parse details from text
            text = card.text()
            if not job.get("company_name"):
                company_match = re.search(r"Company:\s*(.+?)(?:\n|$)", text)
                if company_match:
                    job["company_name"] = company_match.group(1).strip()

            if not job.get("location"):
                loc_match = re.search(r"Location:\s*(.+?)(?:\n|$)", text)
                if loc_match:
                    job["location"] = loc_match.group(1).strip()

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'<h[23][^>]*><a[^>]*href="(/details/\d+)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html, re.I):
            jobs.append({
                "source": "gov_findajob",
                "title": match.group(2).strip(),
                "url": f"{self.base_url}{match.group(1)}",
                "source_job_id": re.search(r"/details/(\d+)", match.group(1)).group(1),
            })
        return jobs

    def _build_search_url(self, keyword: str, location: str, page: int) -> str:
        """Build Find a Job search URL."""
        params = f"q={quote_plus(keyword)}"
        if location:
            params += f"&w={quote_plus(location)}"
        if page > 1:
            params += f"&page={page}"
        return f"{self.base_url}/search?{params}"
