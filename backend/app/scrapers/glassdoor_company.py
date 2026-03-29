"""
Glassdoor Company Reviews scraper (Tier 3).

Scrapes company review pages for ratings, reviews, and sponsorship mentions.
Returns dicts with fields matching CompanyProfile model:
glassdoor_rating, glassdoor_review_count, glassdoor_ceo_approval,
glassdoor_recommend_pct.
"""

import logging
import re
from urllib.parse import quote_plus

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

    Extracts: glassdoor_rating, glassdoor_review_count, glassdoor_ceo_approval,
    glassdoor_recommend_pct, and individual reviews with visa/sponsorship
    mention detection.
    Rate limited to 3 req/min.
    """

    name = "glassdoor_company"
    base_url = "https://www.glassdoor.co.uk"
    requests_per_minute = 3
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

        # Ensure we hit the Reviews page
        if "/Reviews/" not in company_url and "/Overview/" in company_url:
            company_url = company_url.replace("/Overview/", "/Reviews/").replace("-Overview", "-Reviews")

        html = await self.fetch_with_browser(company_url)
        if not html:
            return []

        result = await self.parse(html)
        return result

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Glassdoor company review page. Returns dict with CompanyProfile fields."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        company_data: dict = {"source": "glassdoor"}

        # Overall rating -> glassdoor_rating
        try:
            rating_el = tree.css_first(
                "div[data-test='rating-info'] span, "
                "span.rating-headline-average, "
                "div.v2__EIReviewsRatingsStylesV2__ratingNum"
            )
            if rating_el:
                company_data["glassdoor_rating"] = float(rating_el.text(strip=True))
        except (ValueError, TypeError) as e:
            logger.warning("[%s] Could not parse rating: %s", self.name, str(e)[:80])
            company_data["glassdoor_rating"] = None

        # Fallback: JSON-LD rating
        if company_data.get("glassdoor_rating") is None:
            try:
                rating_match = re.search(r'"ratingValue"\s*:\s*"?(\d+\.?\d*)', html)
                if rating_match:
                    company_data["glassdoor_rating"] = float(rating_match.group(1))
            except Exception:
                pass

        # Review count -> glassdoor_review_count
        try:
            review_count_el = tree.css_first(
                "div[data-test='rating-info'] h3, "
                "span.review-count, "
                "h2[data-test='review-count']"
            )
            if review_count_el:
                text = review_count_el.text(strip=True)
                count_match = re.search(r"([\d,]+)", text)
                if count_match:
                    company_data["glassdoor_review_count"] = int(count_match.group(1).replace(",", ""))
        except (ValueError, TypeError) as e:
            logger.warning("[%s] Could not parse review count: %s", self.name, str(e)[:80])
            company_data["glassdoor_review_count"] = None

        # Fallback: JSON-LD review count
        if company_data.get("glassdoor_review_count") is None:
            try:
                count_match = re.search(r'"reviewCount"\s*:\s*"?(\d+)', html)
                if count_match:
                    company_data["glassdoor_review_count"] = int(count_match.group(1))
            except Exception:
                pass

        # CEO approval -> glassdoor_ceo_approval
        try:
            ceo_el = tree.css_first(
                "div[data-test='ceoApproval'] span, "
                "span.ceo-approval-percentage, "
                "div.ceoApproval span"
            )
            if ceo_el:
                pct_match = re.search(r"(\d+)%", ceo_el.text(strip=True))
                if pct_match:
                    company_data["glassdoor_ceo_approval"] = float(pct_match.group(1))
        except (ValueError, TypeError) as e:
            logger.warning("[%s] Could not parse CEO approval: %s", self.name, str(e)[:80])
            company_data["glassdoor_ceo_approval"] = None

        # Fallback: scan full page for CEO approval
        if company_data.get("glassdoor_ceo_approval") is None:
            try:
                ceo_match = re.search(r'(?:CEO|chief executive)\s*(?:approval|rating)[^0-9]*(\d+)\s*%', html, re.I)
                if ceo_match:
                    company_data["glassdoor_ceo_approval"] = float(ceo_match.group(1))
            except Exception:
                pass

        # Recommend percentage -> glassdoor_recommend_pct
        try:
            recommend_el = tree.css_first(
                "div[data-test='recommendToFriend'] span, "
                "span.recommend-percentage, "
                "div.recommendToFriend span"
            )
            if recommend_el:
                pct_match = re.search(r"(\d+)%", recommend_el.text(strip=True))
                if pct_match:
                    company_data["glassdoor_recommend_pct"] = float(pct_match.group(1))
        except (ValueError, TypeError) as e:
            logger.warning("[%s] Could not parse recommend pct: %s", self.name, str(e)[:80])
            company_data["glassdoor_recommend_pct"] = None

        # Fallback: scan full page for recommend percentage
        if company_data.get("glassdoor_recommend_pct") is None:
            try:
                rec_match = re.search(r'(\d+)\s*%\s*(?:recommend|would recommend)', html, re.I)
                if rec_match:
                    company_data["glassdoor_recommend_pct"] = float(rec_match.group(1))
            except Exception:
                pass

        # Individual reviews (for CompanyReview records)
        reviews = []
        try:
            for review_el in tree.css(
                "div[data-test='review-card'], "
                "li.empReview, "
                "div.review-container"
            ):
                review: dict = {}

                try:
                    title_el = review_el.css_first("h2 a, a.reviewLink")
                    if title_el:
                        review["title"] = title_el.text(strip=True)
                except Exception:
                    pass

                try:
                    rating_span = review_el.css_first(
                        "span.ratingNumber, span[data-test='review-rating']"
                    )
                    if rating_span:
                        review["rating"] = float(rating_span.text(strip=True))
                except (ValueError, TypeError):
                    review["rating"] = None

                # Pros and cons
                try:
                    pros_el = review_el.css_first(
                        "span[data-test='pros'], div.pros"
                    )
                    if pros_el:
                        review["pros"] = pros_el.text(strip=True)
                except Exception:
                    pass

                try:
                    cons_el = review_el.css_first(
                        "span[data-test='cons'], div.cons"
                    )
                    if cons_el:
                        review["cons"] = cons_el.text(strip=True)
                except Exception:
                    pass

                # Review date
                try:
                    date_el = review_el.css_first(
                        "time, span.reviewDate, span[data-test='review-date']"
                    )
                    if date_el:
                        review["review_date"] = date_el.attributes.get(
                            "datetime", date_el.text(strip=True)
                        )
                except Exception:
                    pass

                # Build combined text for keyword detection
                try:
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
                except Exception:
                    review["mentions_visa"] = False
                    review["mentions_sponsorship"] = False

                # Build text_snippet for CompanyReview model
                try:
                    snippet_parts = []
                    if review.get("pros"):
                        snippet_parts.append(f"Pros: {review['pros']}")
                    if review.get("cons"):
                        snippet_parts.append(f"Cons: {review['cons']}")
                    if snippet_parts:
                        review["text_snippet"] = " | ".join(snippet_parts)[:500]
                except Exception:
                    pass

                if review.get("title") or review.get("pros"):
                    reviews.append(review)
        except Exception as e:
            logger.warning("[%s] Error parsing reviews: %s", self.name, str(e)[:100])

        company_data["reviews"] = reviews
        company_data["visa_mention_count"] = sum(
            1 for r in reviews if r.get("mentions_visa")
        )
        company_data["sponsorship_mention_count"] = sum(
            1 for r in reviews if r.get("mentions_sponsorship")
        )

        return [company_data]

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser."""
        data: dict = {"source": "glassdoor"}

        try:
            rating_match = re.search(r'ratingNum[^>]*>(\d+\.?\d*)', html)
            if rating_match:
                data["glassdoor_rating"] = float(rating_match.group(1))
        except Exception:
            data["glassdoor_rating"] = None

        try:
            count_match = re.search(r'"reviewCount"\s*:\s*"?(\d+)', html)
            if count_match:
                data["glassdoor_review_count"] = int(count_match.group(1))
        except Exception:
            data["glassdoor_review_count"] = None

        try:
            ceo_match = re.search(r'(\d+)\s*%.*(?:CEO|approve)', html, re.I)
            if ceo_match:
                data["glassdoor_ceo_approval"] = float(ceo_match.group(1))
        except Exception:
            data["glassdoor_ceo_approval"] = None

        try:
            rec_match = re.search(r'(\d+)\s*%.*recommend', html, re.I)
            if rec_match:
                data["glassdoor_recommend_pct"] = float(rec_match.group(1))
        except Exception:
            data["glassdoor_recommend_pct"] = None

        return data

    async def _search_company(self, company_name: str) -> str:
        """Search Glassdoor for a company and return its review page URL."""
        search_url = f"{self.base_url}/Search/results.htm?keyword={quote_plus(company_name)}"

        html = await self.fetch_with_browser(search_url)
        if not html:
            return ""

        # Try to find company review link in search results
        try:
            # Prefer Reviews link directly
            pattern = r'href="(/Reviews/[^"]+)"'
            match = re.search(pattern, html)
            if match:
                return f"{self.base_url}{match.group(1)}"

            # Fall back to Overview link
            pattern = r'href="(/Overview/[^"]+)"'
            match = re.search(pattern, html)
            if match:
                overview_url = f"{self.base_url}{match.group(1)}"
                # Convert to Reviews URL
                return overview_url.replace("/Overview/", "/Reviews/").replace("-Overview", "-Reviews")
        except Exception as e:
            logger.warning("[%s] Error parsing search results: %s", self.name, str(e)[:100])

        return ""
