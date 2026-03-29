"""
Trustpilot scraper (Tier 3).

Scrapes company review data from Trustpilot.
Returns dicts with fields matching CompanyProfile model:
trustpilot_rating, trustpilot_review_count, and recent review snippets.
"""

import logging
import re

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class TrustpilotScraper(BaseScraper):
    """
    Scrapes Trustpilot company review pages.

    Extracts: trustpilot_rating, trustpilot_review_count, and recent reviews.
    Rate limited to 8 req/min.
    """

    name = "trustpilot"
    base_url = "https://www.trustpilot.com"
    requests_per_minute = 8
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
        """Parse Trustpilot review page. Returns dict with CompanyProfile fields."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        data: dict = {"source": "trustpilot"}

        # Overall rating -> trustpilot_rating
        try:
            rating_el = tree.css_first(
                "span[data-rating-typography], "
                "p.typography_heading-m__T_L_X, "
                "span.star-rating"
            )
            if rating_el:
                data["trustpilot_rating"] = float(rating_el.text(strip=True))
        except (ValueError, TypeError) as e:
            logger.warning("[%s] Could not parse rating: %s", self.name, str(e)[:80])
            data["trustpilot_rating"] = None

        # Total reviews -> trustpilot_review_count
        try:
            count_el = tree.css_first(
                "span[data-reviews-count-typography], "
                "p.typography_body-l__aP7_d, "
                "span.headline__review-count"
            )
            if count_el:
                count_match = re.search(r"([\d,]+)", count_el.text(strip=True))
                if count_match:
                    data["trustpilot_review_count"] = int(count_match.group(1).replace(",", ""))
        except (ValueError, TypeError) as e:
            logger.warning("[%s] Could not parse review count: %s", self.name, str(e)[:80])
            data["trustpilot_review_count"] = None

        # TrustScore text
        try:
            score_el = tree.css_first("p[data-trust-score-caption-typography]")
            if score_el:
                data["trust_score_text"] = score_el.text(strip=True)
        except Exception:
            pass

        # Fallback: try JSON-LD structured data
        if "trustpilot_rating" not in data or data.get("trustpilot_rating") is None:
            try:
                rating_match = re.search(r'"ratingValue"\s*:\s*"?(\d+\.?\d*)', html)
                if rating_match:
                    data["trustpilot_rating"] = float(rating_match.group(1))
            except Exception:
                pass

        if "trustpilot_review_count" not in data or data.get("trustpilot_review_count") is None:
            try:
                count_match = re.search(r'"reviewCount"\s*:\s*"?(\d+)', html)
                if count_match:
                    data["trustpilot_review_count"] = int(count_match.group(1))
            except Exception:
                pass

        # Recent reviews (for CompanyReview records)
        reviews = []
        try:
            for review_el in tree.css(
                "article.paper_paper__EsAY_, "
                "div.review-card, "
                "article[data-service-review-card-paper]"
            ):
                review: dict = {}

                try:
                    star_el = review_el.css_first("div[data-service-review-rating]")
                    if star_el:
                        stars = star_el.attributes.get("data-service-review-rating", "")
                        review["rating"] = float(stars)
                except (ValueError, TypeError):
                    review["rating"] = None

                try:
                    title_el = review_el.css_first(
                        "h2[data-service-review-title-typography], "
                        "a[data-review-title-typography]"
                    )
                    if title_el:
                        review["title"] = title_el.text(strip=True)
                except Exception:
                    pass

                try:
                    text_el = review_el.css_first(
                        "p[data-service-review-text-typography], "
                        "p.review-content__text"
                    )
                    if text_el:
                        review["text_snippet"] = text_el.text(strip=True)
                except Exception:
                    pass

                try:
                    date_el = review_el.css_first("time")
                    if date_el:
                        review["review_date"] = date_el.attributes.get(
                            "datetime", date_el.text(strip=True)
                        )
                except Exception:
                    pass

                if review:
                    reviews.append(review)
        except Exception as e:
            logger.warning("[%s] Error parsing reviews: %s", self.name, str(e)[:100])

        data["reviews"] = reviews[:10]  # Limit to 10 most recent
        return [data]

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "trustpilot"}

        try:
            rating_match = re.search(r'"ratingValue"\s*:\s*"?(\d+\.?\d*)', html)
            if rating_match:
                data["trustpilot_rating"] = float(rating_match.group(1))
        except Exception:
            data["trustpilot_rating"] = None

        try:
            count_match = re.search(r'"reviewCount"\s*:\s*"?(\d+)', html)
            if count_match:
                data["trustpilot_review_count"] = int(count_match.group(1))
        except Exception:
            data["trustpilot_review_count"] = None

        return data
