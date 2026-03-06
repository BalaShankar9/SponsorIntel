"""
Glassdoor Company Reviews scraper (Tier 3).

Scrapes company review pages for ratings, reviews, and sponsorship mentions.
"""

import logging
import re

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

VISA_KEYWORDS = [
    "visa", "sponsorship", "sponsor", "work permit", "tier 2",
    "skilled worker", "immigration", "right to work", "cos",
    "certificate of sponsorship",
]


class GlassdoorCompanyScraper(BaseScraper):
    """
    Scrapes Glassdoor company review pages.

    Extracts: rating, review count, CEO approval %, recommend %,
    and individual reviews with visa/sponsorship mention detection.
    """

    name = "glassdoor_company"
    base_url = "https://www.glassdoor.co.uk"
    requests_per_minute = 2
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Glassdoor company reviews.

        Args:
            company_url: Direct Glassdoor company URL
            company_name: Company name to search for
        """
        company_url = kwargs.get("company_url", "")
        company_name = kwargs.get("company_name", "")

        if not company_url and not company_name:
            return []

        if not company_url and company_name:
            company_url = await self._search_company(company_name)

        if not company_url:
            logger.warning("[%s] Could not find Glassdoor page for company", self.name)
            return []

        html = await self.fetch_with_browser(company_url)
        if not html:
            return []

        result = await self.parse(html)
        return result

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Glassdoor company review page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        company_data: dict = {"source": "glassdoor"}

        # Overall rating
        rating_el = tree.css_first(
            "div[data-test='rating-info'] span, "
            "span.rating-headline-average, "
            "div.v2__EIReviewsRatingsStylesV2__ratingNum"
        )
        if rating_el:
            try:
                company_data["rating"] = float(rating_el.text(strip=True))
            except ValueError:
                pass

        # Review count
        review_count_el = tree.css_first(
            "div[data-test='rating-info'] h3, "
            "span.review-count, "
            "h2[data-test='review-count']"
        )
        if review_count_el:
            text = review_count_el.text(strip=True)
            count_match = re.search(r"([\d,]+)", text)
            if count_match:
                company_data["review_count"] = int(count_match.group(1).replace(",", ""))

        # CEO approval
        ceo_el = tree.css_first(
            "div[data-test='ceoApproval'] span, "
            "span.ceo-approval-percentage"
        )
        if ceo_el:
            pct_match = re.search(r"(\d+)%", ceo_el.text(strip=True))
            if pct_match:
                company_data["ceo_approval_pct"] = float(pct_match.group(1))

        # Recommend percentage
        recommend_el = tree.css_first(
            "div[data-test='recommendToFriend'] span, "
            "span.recommend-percentage"
        )
        if recommend_el:
            pct_match = re.search(r"(\d+)%", recommend_el.text(strip=True))
            if pct_match:
                company_data["recommend_pct"] = float(pct_match.group(1))

        # Individual reviews
        reviews = []
        for review_el in tree.css(
            "div[data-test='review-card'], "
            "li.empReview, "
            "div.review-container"
        ):
            review: dict = {}

            title_el = review_el.css_first("h2 a, a.reviewLink")
            if title_el:
                review["title"] = title_el.text(strip=True)

            rating_span = review_el.css_first(
                "span.ratingNumber, span[data-test='review-rating']"
            )
            if rating_span:
                try:
                    review["rating"] = float(rating_span.text(strip=True))
                except ValueError:
                    pass

            # Pros and cons
            pros_el = review_el.css_first(
                "span[data-test='pros'], div.pros"
            )
            if pros_el:
                review["pros"] = pros_el.text(strip=True)

            cons_el = review_el.css_first(
                "span[data-test='cons'], div.cons"
            )
            if cons_el:
                review["cons"] = cons_el.text(strip=True)

            # Check for visa/sponsorship mentions
            review_text = " ".join([
                review.get("title", ""),
                review.get("pros", ""),
                review.get("cons", ""),
            ]).lower()

            review["mentions_visa"] = any(kw in review_text for kw in VISA_KEYWORDS)
            review["mentions_sponsorship"] = any(
                kw in review_text
                for kw in ["sponsorship", "sponsor", "certificate of sponsorship"]
            )

            if review.get("title") or review.get("pros"):
                reviews.append(review)

        company_data["reviews"] = reviews
        company_data["visa_mention_count"] = sum(
            1 for r in reviews if r.get("mentions_visa")
        )

        return [company_data]

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "glassdoor"}
        rating_match = re.search(r'ratingNum[^>]*>(\d+\.?\d*)', html)
        if rating_match:
            data["rating"] = float(rating_match.group(1))
        return data

    async def _search_company(self, company_name: str) -> str:
        """Search Glassdoor for a company and return its review page URL."""
        from urllib.parse import quote_plus
        search_url = f"{self.base_url}/Search/results.htm?keyword={quote_plus(company_name)}"
        html = await self.fetch_with_browser(search_url)
        if not html:
            return ""

        # Try to find company link in search results
        pattern = r'href="(/Overview/[^"]+)"'
        match = re.search(pattern, html)
        if match:
            return f"{self.base_url}{match.group(1)}"

        return ""
