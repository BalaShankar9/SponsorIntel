"""
Google Maps scraper (Tier 3).

Scrapes Google Maps search results for company information.
Uses Playwright browser as Google Maps is heavily JS-rendered.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class GoogleMapsScraper(BaseScraper):
    """
    Scrapes Google Maps for company information.

    Extracts: rating, review count, address, phone, website, opening hours.
    """

    name = "google_maps"
    base_url = "https://www.google.com/maps"
    requests_per_minute = 3
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Google Maps for a company.

        Args:
            company_name: Company name (required)
            location: Location for search context (optional)
        """
        company_name = kwargs.get("company_name", "")
        location = kwargs.get("location", "")

        if not company_name:
            return []

        query = company_name
        if location:
            query += f" {location}"

        url = f"{self.base_url}/search/{quote_plus(query)}"
        html = await self.fetch_with_browser(url)
        if not html:
            return []

        return await self.parse(html)

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Google Maps search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        results = []

        # Try to find business card / listing
        for card in tree.css(
            "div[role='article'], div.Nv2PK, div[jsaction*='placeCard']"
        ):
            data: dict = {"source": "google_maps"}

            name_el = card.css_first("div.qBF1Pd, span.OSrXXb, a.hfpxzc")
            if name_el:
                data["name"] = name_el.text(strip=True)

            rating_el = card.css_first("span.MW4etd, span.ZkP5Je")
            if rating_el:
                try:
                    data["rating"] = float(rating_el.text(strip=True))
                except ValueError:
                    pass

            review_count_el = card.css_first("span.UY7F9, span.HypWnf")
            if review_count_el:
                text = review_count_el.text(strip=True)
                count_match = re.search(r"([\d,]+)", text)
                if count_match:
                    data["review_count"] = int(count_match.group(1).replace(",", ""))

            address_el = card.css_first("div.W4Efsd span:nth-child(2), span.rllt__details")
            if address_el:
                data["address"] = address_el.text(strip=True)

            if data.get("name"):
                results.append(data)

        # If no cards found, try to parse a single business page
        if not results:
            data = self._parse_single_business(tree, html)
            if data:
                results.append(data)

        return results

    def _parse_single_business(self, tree, html: str) -> dict:
        """Parse a single Google Maps business page."""
        data: dict = {"source": "google_maps"}

        # Name
        name_el = tree.css_first("h1.DUwDvf, h1[data-attrid]")
        if name_el:
            data["name"] = name_el.text(strip=True)

        # Rating
        rating_el = tree.css_first("div.F7nice span[aria-hidden]")
        if rating_el:
            try:
                data["rating"] = float(rating_el.text(strip=True))
            except ValueError:
                pass

        # Review count
        review_el = tree.css_first("div.F7nice span:nth-child(2)")
        if review_el:
            text = review_el.text(strip=True)
            count_match = re.search(r"([\d,]+)", text)
            if count_match:
                data["review_count"] = int(count_match.group(1).replace(",", ""))

        # Address
        address_els = tree.css("button[data-item-id='address'] div, div[data-attrid='kc:/location/location:address']")
        if address_els:
            data["address"] = address_els[0].text(strip=True)

        # Phone
        phone_els = tree.css("button[data-item-id*='phone'] div, span[data-phone-number]")
        if phone_els:
            data["phone"] = phone_els[0].text(strip=True)

        # Website
        website_els = tree.css("a[data-item-id='authority'], a[data-tooltip='Open website']")
        if website_els:
            data["website"] = website_els[0].attributes.get("href", "")

        return data if data.get("name") else {}

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "google_maps"}
        rating_match = re.search(r'"([0-9]\.[0-9])" aria-label="[0-9.]+ stars"', html)
        if rating_match:
            data["rating"] = float(rating_match.group(1))
        return data
