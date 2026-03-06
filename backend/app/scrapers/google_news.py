"""
Google News scraper (Tier 3).

Scrapes Google News for company-related articles and performs simple sentiment scoring.
"""

import logging
import re
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

NEGATIVE_KEYWORDS = [
    "layoffs", "layoff", "redundancies", "redundancy", "insolvency",
    "insolvent", "fraud", "fraudulent", "fine", "fined", "penalty",
    "closure", "closing", "liquidation", "liquidated", "tribunal",
    "scandal", "bankrupt", "bankruptcy", "sued", "lawsuit",
    "investigation", "charged", "violation", "misconduct", "breach",
    "downsizing", "restructuring", "cutbacks", "cuts",
]

POSITIVE_KEYWORDS = [
    "hiring", "expansion", "expanding", "growth", "growing",
    "funding", "funded", "award", "awarded", "partnership",
    "investment", "invested", "launch", "launched", "innovation",
    "record revenue", "profit", "profitable", "acquisition",
    "new office", "new jobs", "recruitment drive",
    "carbon neutral", "sustainability",
]


def compute_sentiment(text: str) -> tuple[str, float]:
    """
    Compute simple sentiment score from text.

    Returns (label, score) where:
    - label: "positive", "negative", or "neutral"
    - score: float from -1.0 to 1.0
    """
    text_lower = text.lower()

    positive_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
    negative_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)

    if positive_count == 0 and negative_count == 0:
        return "neutral", 0.0

    total = positive_count + negative_count
    score = (positive_count - negative_count) / total

    if score > 0.2:
        return "positive", min(score, 1.0)
    elif score < -0.2:
        return "negative", max(score, -1.0)
    else:
        return "neutral", score


class GoogleNewsScraper(BaseScraper):
    """
    Scrapes Google News for company-related headlines.

    Extracts: headline, source, URL, published date, and computes
    simple sentiment scoring based on keyword presence.
    """

    name = "google_news"
    base_url = "https://news.google.com"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Google News for a company.

        Args:
            company_name: Company name to search for (required)
        """
        company_name = kwargs.get("company_name", "")
        if not company_name:
            return []

        # Try RSS feed first (lighter, less likely to be blocked)
        articles = await self._scrape_rss(company_name)
        if articles:
            return articles

        # Fallback to HTML scraping
        url = f"{self.base_url}/search?q={quote_plus(company_name)}&hl=en-GB&gl=GB"
        html = await self.fetch(url)
        if not html:
            return []

        return await self.parse(html)

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Google News search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        articles = []

        for card in tree.css("article, div.xrnccd, c-wiz article"):
            article: dict = {"source_type": "google_news"}

            title_el = card.css_first("h3 a, h4 a, a.JtKRv")
            if title_el:
                article["headline"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("./"):
                    href = f"{self.base_url}/{href[2:]}"
                elif href.startswith("/"):
                    href = f"{self.base_url}{href}"
                article["url"] = href

            source_el = card.css_first("div.vr1PYe, a.wEwyrc, span.source")
            if source_el:
                article["news_source"] = source_el.text(strip=True)

            time_el = card.css_first("time, div.WW6dff")
            if time_el:
                article["published_date"] = time_el.attributes.get(
                    "datetime", time_el.text(strip=True)
                )

            # Compute sentiment
            if article.get("headline"):
                label, score = compute_sentiment(article["headline"])
                article["sentiment"] = label
                article["sentiment_score"] = score
                article["is_risk_signal"] = label == "negative"

            if article.get("headline"):
                articles.append(article)

        return articles

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser for Google News."""
        articles = []
        # Match article titles
        pattern = r'<h[34][^>]*><a[^>]*href="([^"]*)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html):
            headline = match.group(2).strip()
            label, score = compute_sentiment(headline)
            articles.append({
                "source_type": "google_news",
                "headline": headline,
                "url": match.group(1),
                "sentiment": label,
                "sentiment_score": score,
                "is_risk_signal": label == "negative",
            })
        return articles

    async def _scrape_rss(self, company_name: str) -> list[dict]:
        """Try to scrape Google News RSS feed."""
        rss_url = (
            f"https://news.google.com/rss/search?"
            f"q={quote_plus(company_name)}&hl=en-GB&gl=GB&ceid=GB:en"
        )

        xml_text = await self.fetch(rss_url)
        if not xml_text:
            return []

        return self._parse_rss(xml_text)

    def _parse_rss(self, xml_text: str) -> list[dict]:
        """Parse Google News RSS XML."""
        articles = []

        # Extract items using regex (avoid XML library dependency)
        items = re.findall(
            r"<item>(.*?)</item>", xml_text, re.DOTALL
        )

        for item in items:
            article: dict = {"source_type": "google_news"}

            title_match = re.search(r"<title>(.*?)</title>", item, re.DOTALL)
            if title_match:
                headline = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", title_match.group(1))
                headline = re.sub(r"<[^>]+>", "", headline).strip()
                article["headline"] = headline

            link_match = re.search(r"<link>(.*?)</link>", item)
            if link_match:
                article["url"] = link_match.group(1).strip()

            source_match = re.search(r"<source[^>]*>(.*?)</source>", item)
            if source_match:
                article["news_source"] = source_match.group(1).strip()

            pub_date_match = re.search(r"<pubDate>(.*?)</pubDate>", item)
            if pub_date_match:
                article["published_date"] = pub_date_match.group(1).strip()

            # Compute sentiment
            if article.get("headline"):
                label, score = compute_sentiment(article["headline"])
                article["sentiment"] = label
                article["sentiment_score"] = score
                article["is_risk_signal"] = label == "negative"

            if article.get("headline"):
                articles.append(article)

        return articles
