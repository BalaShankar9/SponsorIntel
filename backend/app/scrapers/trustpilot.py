"""
Trustpilot scraper (Tier 3).

Scrapes company review data from Trustpilot.
"""

import logging
import re

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class TrustpilotScraper(BaseScraper):
    """
    Scrapes Trustpilot company review pages.

    Extracts: overall rating, review count, and recent reviews.
    """

    name = "trustpilot"
    base_url = "https://www.trustpilot.com"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Trustpilot company reviews.

        Args:
            domain: Company domain (e.g. "example.com")
        """
        domain = kwargs.get("domain", "")
        if not domain:
            return []

        # Clean domain
        domain = domain.replace("https://", "").replace("http://", "")
        domain = domain.replace("www.", "").rstrip("/")

        url = f"{self.base_url}/review/{domain}"
        html = await self.fetch(url)
        if not html:
            return []

        return await self.parse(html)

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Trustpilot review page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        data: dict = {"source": "trustpilot"}

        # Overall rating
        rating_el = tree.css_first(
            "span[data-rating-typography], "
            "p.typography_heading-m__T_L_X, "
            "span.star-rating"
        )
        if rating_el:
            try:
                data["rating"] = float(rating_el.text(strip=True))
            except ValueError:
                pass

        # Total reviews
        count_el = tree.css_first(
            "span[data-reviews-count-typography], "
            "p.typography_body-l__aP7_d, "
            "span.headline__review-count"
        )
        if count_el:
            count_match = re.search(r"([\d,]+)", count_el.text(strip=True))
            if count_match:
                data["review_count"] = int(count_match.group(1).replace(",", ""))

        # TrustScore text
        score_el = tree.css_first("p[data-trust-score-caption-typography]")
        if score_el:
            data["trust_score_text"] = score_el.text(strip=True)

        # Recent reviews
        reviews = []
        for review_el in tree.css(
            "article.paper_paper__EsAY_, "
            "div.review-card, "
            "article[data-service-review-card-paper]"
        ):
            review: dict = {}

            star_el = review_el.css_first("div[data-service-review-rating]")
            if star_el:
                stars = star_el.attributes.get("data-service-review-rating", "")
                try:
                    review["rating"] = float(stars)
                except ValueError:
                    pass

            title_el = review_el.css_first(
                "h2[data-service-review-title-typography], "
                "a[data-review-title-typography]"
            )
            if title_el:
                review["title"] = title_el.text(strip=True)

            text_el = review_el.css_first(
                "p[data-service-review-text-typography], "
                "p.review-content__text"
            )
            if text_el:
                review["text"] = text_el.text(strip=True)

            date_el = review_el.css_first("time")
            if date_el:
                review["date"] = date_el.attributes.get(
                    "datetime", date_el.text(strip=True)
                )

            if review:
                reviews.append(review)

        data["reviews"] = reviews[:10]  # Limit to 10 most recent
        return [data]

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "trustpilot"}
        rating_match = re.search(r'"ratingValue"\s*:\s*"?(\d+\.?\d*)', html)
        if rating_match:
            data["rating"] = float(rating_match.group(1))
        count_match = re.search(r'"reviewCount"\s*:\s*"?(\d+)', html)
        if count_match:
            data["review_count"] = int(count_match.group(1))
        return data
