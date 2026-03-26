"""Crawl4AI adapter for LLM-powered web scraping.

Uses Crawl4AI's LLM extraction mode when available.
Falls back to BeautifulSoup if crawl4ai is not installed.
Designed to survive site redesigns — schema-driven extraction
instead of brittle CSS selectors.
"""

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_crawl4ai():
    """Lazy import crawl4ai."""
    try:
        import crawl4ai
        return crawl4ai
    except ImportError:
        return None


async def extract_with_schema(
    url: str,
    schema: dict[str, str],
    provider: str = "groq/llama-3.3-70b-versatile",
    instruction: str = "",
) -> dict | None:
    """Extract structured data from a URL using LLM-powered extraction.

    Parameters
    ----------
    url : str
        Target URL to scrape.
    schema : dict[str, str]
        Expected output schema, e.g. {"company_name": "string", "employee_count": "integer"}
    provider : str
        LLM provider for extraction (Crawl4AI format).
    instruction : str
        Additional extraction instruction.

    Returns
    -------
    dict with extracted data, or None if extraction fails.
    """
    crawl4ai = _get_crawl4ai()

    if crawl4ai:
        try:
            from crawl4ai import AsyncWebCrawler, LLMExtractionStrategy

            strategy = LLMExtractionStrategy(
                provider=provider,
                schema=schema,
                instruction=instruction or f"Extract the following fields from this page: {', '.join(schema.keys())}",
            )

            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=url, extraction_strategy=strategy)
                if result.success and result.extracted_content:
                    data = json.loads(result.extracted_content)
                    if isinstance(data, list) and data:
                        return data[0]
                    elif isinstance(data, dict):
                        return data
        except Exception as e:
            logger.warning(f"Crawl4AI extraction failed for {url}: {e}")

    # Fallback: basic HTTP fetch + return raw text
    return await _fallback_extract(url, schema)


async def _fallback_extract(url: str, schema: dict) -> dict | None:
    """Basic fallback when Crawl4AI is not available."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None

            from selectolax.parser import HTMLParser
            tree = HTMLParser(resp.text)

            # Extract basic info from meta tags and page content
            result = {}
            title = tree.css_first("title")
            if title:
                result["page_title"] = title.text(strip=True)

            meta_desc = tree.css_first('meta[name="description"]')
            if meta_desc:
                result["description"] = meta_desc.attributes.get("content", "")

            # Return what we found (partial extraction)
            return result if result else None

    except Exception as e:
        logger.warning(f"Fallback extraction failed for {url}: {e}")
        return None


# Pre-defined schemas for common extraction tasks
COMPANY_PROFILE_SCHEMA = {
    "company_name": "string",
    "description": "string",
    "employee_count": "integer",
    "industry": "string",
    "headquarters": "string",
    "website": "string",
    "founded_year": "integer",
}

CAREER_PAGE_SCHEMA = {
    "job_title": "string",
    "location": "string",
    "salary_range": "string",
    "department": "string",
    "job_type": "string",
    "description_snippet": "string",
    "apply_url": "string",
}

CONTACT_INFO_SCHEMA = {
    "email": "string",
    "phone": "string",
    "address": "string",
    "linkedin_url": "string",
    "twitter_url": "string",
}
