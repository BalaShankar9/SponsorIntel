"""
Indeed UK job board scraper (Tier 2).

Scrapes job listings from uk.indeed.com using Playwright browser
as Indeed is heavily JS-rendered.
"""

import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class IndeedScraper(BaseScraper):
    """
    Scrapes job listings from uk.indeed.com.

    Uses Playwright headless browser since Indeed renders content via JavaScript.
    Parses: title, company, location, salary, snippet, URL.
    """

    name = "indeed"
    base_url = "https://uk.indeed.com"
    requests_per_minute = 3
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Indeed job listings.

        Args:
            keyword: Search keyword (required)
            location: Location filter (optional)
            pages: Number of pages to scrape (default 2)
        """
        keyword = kwargs.get("keyword", "")
        location = kwargs.get("location", "")
        pages = kwargs.get("pages", 2)

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        all_jobs: list[dict] = []

        for page in range(pages):
            start = page * 10
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
        """Parse Indeed search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        # Indeed uses various card selectors
        selectors = [
            "div.job_seen_beacon",
            "div.jobsearch-ResultsList div.result",
            "li.css-1ac2h1w",
            "div[data-testid='job-card']",
        ]

        cards = []
        for sel in selectors:
            cards = tree.css(sel)
            if cards:
                break

        for card in cards:
            job: dict = {"source": "indeed"}

            # Title
            title_el = card.css_first("h2 a, h2 span, a[data-jk]")
            if title_el:
                job["title"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href:
                    if href.startswith("/"):
                        href = f"{self.base_url}{href}"
                    job["url"] = href

                    jk_match = re.search(r"jk=([a-f0-9]+)", href)
                    if jk_match:
                        job["source_job_id"] = jk_match.group(1)

            # Company name
            company_el = card.css_first(
                "span[data-testid='company-name'], span.companyName, "
                "a[data-tn-element='companyName']"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            # Location
            location_el = card.css_first(
                "div[data-testid='text-location'], div.companyLocation, "
                "span.companyLocation"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            # Salary
            salary_el = card.css_first(
                "div[data-testid='attribute_snippet_testid'], "
                "div.salary-snippet-container, span.salary-snippet"
            )
            if salary_el:
                job["salary_text"] = salary_el.text(strip=True)

            # Snippet
            snippet_el = card.css_first(
                "div.job-snippet, div[data-testid='job-snippet']"
            )
            if snippet_el:
                job["description_snippet"] = snippet_el.text(strip=True)

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'data-jk="([^"]+)".*?<h2[^>]*>.*?<span[^>]*>([^<]+)</span>'
        for match in re.finditer(pattern, html, re.DOTALL):
            jobs.append({
                "source": "indeed",
                "source_job_id": match.group(1),
                "title": match.group(2).strip(),
            })
        return jobs

    def _build_search_url(self, keyword: str, location: str, start: int) -> str:
        """Build Indeed search URL."""
        params = f"q={quote_plus(keyword)}"
        if location:
            params += f"&l={quote_plus(location)}"
        if start > 0:
            params += f"&start={start}"
        return f"{self.base_url}/jobs?{params}"
