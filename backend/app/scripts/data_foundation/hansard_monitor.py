"""Parliamentary Hansard immigration debate monitor."""
import logging
from datetime import datetime, timedelta, timezone
import httpx
logger = logging.getLogger(__name__)

HANSARD_SEARCH_URL = "https://hansard.parliament.uk/search/Contributions"
IMMIGRATION_KEYWORDS = [
    "visa", "immigration", "sponsor licence", "skilled worker",
    "shortage occupation", "salary threshold", "points-based",
    "home office", "uk visas", "immigration rules",
]

async def search_hansard(days_back: int = 1, keywords: list[str] | None = None) -> list[dict]:
    kw_list = keywords or IMMIGRATION_KEYWORDS
    since = datetime.now(timezone.utc) - timedelta(days=days_back)
    results = []

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for keyword in kw_list[:5]:
            try:
                params = {
                    "searchTerm": keyword,
                    "startDate": since.strftime("%Y-%m-%d"),
                    "endDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                }
                resp = await client.get(HANSARD_SEARCH_URL, params=params)
                if resp.status_code != 200:
                    logger.warning(f"Hansard search failed for '{keyword}': {resp.status_code}")
                    continue

                from selectolax.parser import HTMLParser
                tree = HTMLParser(resp.text)
                for item in tree.css(".search-result"):
                    title_el = item.css_first("a.search-result-title")
                    date_el = item.css_first(".search-result-date")
                    snippet_el = item.css_first(".search-result-description")
                    if title_el:
                        title = title_el.text(strip=True)
                        url = title_el.attributes.get("href", "")
                        if url and not url.startswith("http"):
                            url = f"https://hansard.parliament.uk{url}"
                        results.append({
                            "title": title,
                            "source_name": "Hansard",
                            "source_url": url,
                            "source_category": "government",
                            "content_snippet": snippet_el.text(strip=True) if snippet_el else "",
                            "published_at": date_el.text(strip=True) if date_el else None,
                            "scanner_agent": "hansard_monitor",
                        })
            except Exception as e:
                logger.error(f"Hansard search error for '{keyword}': {e}")

    seen_urls = set()
    unique = []
    for r in results:
        if r["source_url"] not in seen_urls:
            seen_urls.add(r["source_url"])
            unique.append(r)
    return unique
