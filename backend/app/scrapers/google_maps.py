"""
Google Maps scraper (Tier 3).

Scrapes Google Maps search results for company information.
Uses Playwright browser as Google Maps is heavily JS-rendered.
Returns dicts with fields matching CompanyProfile model:
google_rating, google_review_count, plus address and phone.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class GoogleMapsScraper(BaseScraper):
    """
    Scrapes Google Maps for company information.

    Extracts: google_rating, google_review_count, address, phone.
    Rate limited to 3 req/min.
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
            location: Location for search context (default: "UK")
        """
        company_name = kwargs.get("company_name", "")
        location = kwargs.get("location", "UK")

        if not company_name:
            return []

        query = f"{company_name} {location}"
        url = f"{self.base_url}/search/{quote_plus(query)}"
        html = await self.fetch_with_browser(url)
        if not html:
            return []

        return await self.parse(html)

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Google Maps search results page. Returns dicts with CompanyProfile fields."""
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

            try:
                name_el = card.css_first("div.qBF1Pd, span.OSrXXb, a.hfpxzc")
                if name_el:
                    data["name"] = name_el.text(strip=True)
            except Exception:
                pass

            try:
                rating_el = card.css_first("span.MW4etd, span.ZkP5Je")
                if rating_el:
                    data["google_rating"] = float(rating_el.text(strip=True))
            except (ValueError, TypeError) as e:
                logger.warning("[%s] Could not parse rating: %s", self.name, str(e)[:80])
                data["google_rating"] = None

            try:
                review_count_el = card.css_first("span.UY7F9, span.HypWnf")
                if review_count_el:
                    text = review_count_el.text(strip=True)
                    count_match = re.search(r"([\d,]+)", text)
                    if count_match:
                        data["google_review_count"] = int(count_match.group(1).replace(",", ""))
            except (ValueError, TypeError) as e:
                logger.warning("[%s] Could not parse review count: %s", self.name, str(e)[:80])
                data["google_review_count"] = None

            try:
                address_el = card.css_first("div.W4Efsd span:nth-child(2), span.rllt__details")
                if address_el:
                    data["address"] = address_el.text(strip=True)
            except Exception:
                pass

            if data.get("name"):
                results.append(data)

        # If no cards found, try to parse a single business page
        if not results:
            try:
                data = self._parse_single_business(tree, html)
                if data:
                    results.append(data)
            except Exception as e:
                logger.warning("[%s] Error parsing single business page: %s", self.name, str(e)[:100])

        return results

    def _parse_single_business(self, tree, html: str) -> dict:
        """Parse a single Google Maps business page. Returns dict with CompanyProfile fields."""
        data: dict = {"source": "google_maps"}

        # Name
        try:
            name_el = tree.css_first("h1.DUwDvf, h1[data-attrid]")
            if name_el:
                data["name"] = name_el.text(strip=True)
        except Exception:
            pass

        # Rating -> google_rating
        try:
            rating_el = tree.css_first("div.F7nice span[aria-hidden]")
            if rating_el:
                data["google_rating"] = float(rating_el.text(strip=True))
        except (ValueError, TypeError):
            data["google_rating"] = None

        # Review count -> google_review_count
        try:
            review_el = tree.css_first("div.F7nice span:nth-child(2)")
            if review_el:
                text = review_el.text(strip=True)
                count_match = re.search(r"([\d,]+)", text)
                if count_match:
                    data["google_review_count"] = int(count_match.group(1).replace(",", ""))
        except (ValueError, TypeError):
            data["google_review_count"] = None

        # Address
        try:
            address_els = tree.css("button[data-item-id='address'] div, div[data-attrid='kc:/location/location:address']")
            if address_els:
                data["address"] = address_els[0].text(strip=True)
        except Exception:
            pass

        # Phone
        try:
            phone_els = tree.css("button[data-item-id*='phone'] div, span[data-phone-number]")
            if phone_els:
                data["phone"] = phone_els[0].text(strip=True)
        except Exception:
            pass

        # Website
        try:
            website_els = tree.css("a[data-item-id='authority'], a[data-tooltip='Open website']")
            if website_els:
                data["website_url"] = website_els[0].attributes.get("href", "")
        except Exception:
            pass

        return data if data.get("name") else {}

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "google_maps"}

        try:
            rating_match = re.search(r'"([0-9]\.[0-9])" aria-label="[0-9.]+ stars"', html)
            if rating_match:
                data["google_rating"] = float(rating_match.group(1))
        except Exception:
            data["google_rating"] = None

        try:
            count_match = re.search(r'"(\d[\d,]*)\s*reviews?"', html, re.I)
            if count_match:
                data["google_review_count"] = int(count_match.group(1).replace(",", ""))
        except Exception:
            data["google_review_count"] = None

        return data
