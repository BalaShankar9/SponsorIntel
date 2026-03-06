"""
Glassdoor Jobs scraper (Tier 2).

Scrapes job listings from Glassdoor UK using Playwright browser.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class GlassdoorJobsScraper(BaseScraper):
    """
    Scrapes job listings from Glassdoor UK.

    Uses headless browser as Glassdoor requires JS rendering.
    Parses: title, company, location, salary estimate, company rating.
    """

    name = "glassdoor"
    base_url = "https://www.glassdoor.co.uk"
    requests_per_minute = 3
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Glassdoor job listings.

        Args:
            keyword: Search keyword (required)
            pages: Number of pages (default 2)
        """
        keyword = kwargs.get("keyword", "")
        pages = kwargs.get("pages", 2)

        if not keyword:
            return []

        all_jobs: list[dict] = []

        for page in range(1, pages + 1):
            url = self._build_search_url(keyword, page)
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
        """Parse Glassdoor jobs search results."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "li.JobsList_jobListItem__wjTHv, "
            "li[data-test='jobListing'], "
            "div.job-listing"
        ):
            job: dict = {"source": "glassdoor"}

            title_el = card.css_first(
                "a.JobCard_jobTitle__GLyJ1, "
                "a[data-test='job-link'], "
                "a.jobLink"
            )
            if title_el:
                job["title"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["url"] = href

                id_match = re.search(r"jobListingId=(\d+)", href)
                if not id_match:
                    id_match = re.search(r"JV_IC\d+_KO\d+_KE\d+_IP\d+_(\d+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)

            company_el = card.css_first(
                "span.EmployerProfile_compactEmployerName__9MGcV, "
                "a[data-test='employer-short-name'], "
                "div.jobHeader span.employerName"
            )
            if company_el:
                job["company_name"] = company_el.text(strip=True)

            location_el = card.css_first(
                "div.JobCard_location__Ds1fM, "
                "span[data-test='emp-location'], "
                "span.loc"
            )
            if location_el:
                job["location"] = location_el.text(strip=True)

            salary_el = card.css_first(
                "div.JobCard_salaryEstimate__QpbTW, "
                "span[data-test='detailSalary'], "
                "span.salary-estimate"
            )
            if salary_el:
                job["salary_text"] = salary_el.text(strip=True)

            rating_el = card.css_first(
                "span.JobCard_ratingText__jf3Ks, "
                "span[data-test='rating'], "
                "span.compactStarRating"
            )
            if rating_el:
                try:
                    job["company_rating"] = float(rating_el.text(strip=True))
                except ValueError:
                    pass

            if job.get("title"):
                jobs.append(job)

        return jobs

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'class="[^"]*jobTitle[^"]*"[^>]*>([^<]+)'
        for match in re.finditer(pattern, html, re.I):
            jobs.append({
                "source": "glassdoor",
                "title": match.group(1).strip(),
            })
        return jobs

    def _build_search_url(self, keyword: str, page: int) -> str:
        """Build Glassdoor jobs search URL."""
        encoded = quote_plus(keyword)
        url = f"{self.base_url}/Job/jobs.htm?sc.keyword={encoded}"
        if page > 1:
            url += f"&p={page}"
        return url
