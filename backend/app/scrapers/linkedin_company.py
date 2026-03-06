"""
LinkedIn Company page scraper (Tier 3).

Scrapes LinkedIn company pages for employee count, industry, and other details.
Uses Playwright browser as LinkedIn requires JS rendering.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class LinkedInCompanyScraper(BaseScraper):
    """
    Scrapes LinkedIn company pages.

    Extracts: employee count, follower count, industry, headquarters, website.
    Very conservative rate limiting (1/min) with proxy to avoid blocks.
    """

    name = "linkedin_company"
    base_url = "https://www.linkedin.com"
    requests_per_minute = 1
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape LinkedIn company page.

        Args:
            company_url: Direct LinkedIn company URL
            company_name: Company name to search for
        """
        company_url = kwargs.get("company_url", "")
        company_name = kwargs.get("company_name", "")

        if not company_url and company_name:
            company_url = await self._search_company(company_name)

        if not company_url:
            return []

        # Ensure we're on the about page for the most data
        if "/about" not in company_url:
            about_url = company_url.rstrip("/") + "/about/"
        else:
            about_url = company_url

        html = await self.fetch_with_browser(about_url)
        if not html:
            return []

        return await self.parse(html)

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse LinkedIn company page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        data: dict = {"source": "linkedin"}

        # Company name
        name_el = tree.css_first(
            "h1.org-top-card-summary__title, "
            "h1.top-card-layout__title, "
            "span.org-top-card-summary-info-list__info-item"
        )
        if name_el:
            data["name"] = name_el.text(strip=True)

        # Description / tagline
        desc_el = tree.css_first(
            "p.org-top-card-summary__tagline, "
            "p.top-card-layout__first-subline"
        )
        if desc_el:
            data["tagline"] = desc_el.text(strip=True)

        # Parse definition list items on about page
        for dl in tree.css("dl.overflow-hidden"):
            dts = dl.css("dt")
            dds = dl.css("dd")
            for dt, dd in zip(dts, dds):
                key = dt.text(strip=True).lower()
                value = dd.text(strip=True)

                if "website" in key:
                    data["website"] = value
                elif "industry" in key:
                    data["industry"] = value
                elif "company size" in key or "employees" in key:
                    data["employee_count_text"] = value
                    count_match = re.search(r"([\d,]+)\s*[-\u2013]\s*([\d,]+)", value)
                    if count_match:
                        low = int(count_match.group(1).replace(",", ""))
                        high = int(count_match.group(2).replace(",", ""))
                        data["employee_count_estimate"] = (low + high) // 2
                    else:
                        single = re.search(r"([\d,]+)", value)
                        if single:
                            data["employee_count_estimate"] = int(
                                single.group(1).replace(",", "")
                            )
                elif "headquarter" in key:
                    data["headquarters"] = value
                elif "founded" in key:
                    data["founded"] = value
                elif "type" in key:
                    data["company_type"] = value
                elif "specialties" in key or "specialities" in key:
                    data["specialties"] = [s.strip() for s in value.split(",")]

        # Follower count
        follower_el = tree.css_first(
            "span.org-top-card-summary-info-list__info-item:last-child, "
            "div.org-top-card-summary-info-list span"
        )
        if follower_el:
            text = follower_el.text(strip=True)
            follower_match = re.search(r"([\d,]+)\s*followers?", text, re.I)
            if follower_match:
                data["follower_count"] = int(follower_match.group(1).replace(",", ""))

        return [data] if data.get("name") or data.get("industry") else []

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "linkedin"}
        name_match = re.search(r'"name"\s*:\s*"([^"]+)"', html)
        if name_match:
            data["name"] = name_match.group(1)
        employee_match = re.search(r'"numberOfEmployees"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
        if employee_match:
            data["employee_count_estimate"] = int(employee_match.group(1))
        return data

    async def _search_company(self, company_name: str) -> str:
        """Search LinkedIn for a company and return its page URL."""
        search_url = (
            f"{self.base_url}/search/results/companies/"
            f"?keywords={quote_plus(company_name)}"
        )
        html = await self.fetch_with_browser(search_url)
        if not html:
            return ""

        # Find company page link
        pattern = r'href="(/company/[^/"]+/?)"'
        match = re.search(pattern, html)
        if match:
            return f"{self.base_url}{match.group(1)}"

        return ""
