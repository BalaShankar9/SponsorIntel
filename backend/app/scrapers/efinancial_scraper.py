"""eFinancialCareers scraper — UK finance/banking jobs with sponsorship."""
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class EFinancialScraper:
    """Scrapes eFinancialCareers.co.uk. Finance sector, high sponsorship rate."""

    BASE_URL = "https://www.efinancialcareers.co.uk/search"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        kw = keyword or "visa sponsorship"

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                self.BASE_URL,
                params={"q": kw, "location": "United Kingdom"},
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html",
                },
            )
            if r.status_code != 200:
                logger.warning(f"[efinancial] HTTP {r.status_code}")
                return []

        jobs = []
        # Extract job listings
        cards = re.findall(r'<div[^>]*class="[^"]*jobCard[^"]*"[^>]*>(.*?)</div>\s*</div>', r.text, re.DOTALL)
        if not cards:
            cards = re.findall(r'<article[^>]*>(.*?)</article>', r.text, re.DOTALL)

        for card in cards[:30]:
            title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', card)
            company_match = re.search(r'company[^"]*"[^>]*>(.*?)</', card)
            loc_match = re.search(r'location[^"]*"[^>]*>(.*?)</', card)

            if not title_match:
                continue

            title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
            url = title_match.group(1)
            if url and not url.startswith("http"):
                url = f"https://www.efinancialcareers.co.uk{url}"

            company = re.sub(r'<[^>]+>', '', company_match.group(1)).strip() if company_match else ""
            loc = re.sub(r'<[^>]+>', '', loc_match.group(1)).strip() if loc_match else ""

            jobs.append({
                "source": "efinancial",
                "source_url": url,
                "title": title,
                "title_raw": title,
                "company": company,
                "company_name_raw": company,
                "location_raw": loc or "United Kingdom",
            })

        logger.info(f"[efinancial] Scraped {len(jobs)} finance jobs for '{kw}'")
        return jobs
