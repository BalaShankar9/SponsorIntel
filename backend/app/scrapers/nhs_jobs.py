"""
NHS Jobs scraper (Tier 2).

Scrapes job listings from the NHS Jobs website.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class NHSJobsScraper(BaseScraper):
    """
    Scrapes job listings from NHS Jobs.

    Parses: title, employer, location, salary band, closing date.
    """

    name = "nhs_jobs"
    base_url = "https://www.jobs.nhs.uk"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape NHS Jobs listings.

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
        """Parse NHS Jobs search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "li.vacancy, div.vacancy-card, "
            "ul.search-results li, div.search-result"
        ):
            job: dict = {"source": "nhs_jobs"}

            title_el = card.css_first("h2 a, h3 a, a.vacancy-title")
            if title_el:
                job["title"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["url"] = href

                id_match = re.search(r"/jobadvert/(\w+[-]?\w*)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)

            employer_el = card.css_first(
                "span.employer, p.employer-name, "
                "span.vacancy-employer, dd.employer"
            )
            if employer_el:
                job["company_name"] = employer_el.text(strip=True)

            location_el = card.css_first(
                "span.location, p.location, dd.location"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            salary_el = card.css_first(
                "span.salary, p.salary, dd.salary, span.pay-scheme"
            )
            if salary_el:
                job["salary_text"] = salary_el.text(strip=True)

            closing_el = card.css_first(
                "span.closing-date, p.closing-date, dd.closing-date"
            )
            if closing_el:
                job["closing_date_text"] = closing_el.text(strip=True)

            # Fallback text parsing
            text = card.text()
            if not job.get("company_name"):
                emp_match = re.search(r"(?:Employer|Organisation):\s*(.+?)(?:\n|$)", text, re.I)
                if emp_match:
                    job["company_name"] = emp_match.group(1).strip()

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'<a[^>]*href="(/candidate/jobadvert/[^"]*)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html, re.I):
            jobs.append({
                "source": "nhs_jobs",
                "title": match.group(2).strip(),
                "url": f"{self.base_url}{match.group(1)}",
            })
        return jobs

    def _build_search_url(self, keyword: str, page: int) -> str:
        """Build NHS Jobs search URL."""
        params = f"keyword={quote_plus(keyword)}"
        if page > 1:
            params += f"&page={page}"
        return f"{self.base_url}/candidate/search/results?{params}"
