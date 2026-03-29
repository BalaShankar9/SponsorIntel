"""CV-Library scraper — one of the largest UK job boards (200k+ jobs)."""
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class CVLibraryScraper:
    """Scrapes CV-Library.co.uk search results. Massive UK-specific board."""

    BASE_URL = "https://www.cv-library.co.uk/search-jobs"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        kw = keyword or "visa sponsorship"

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                self.BASE_URL,
                params={"q": kw, "geo": location or "United Kingdom"},
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html",
                },
            )
            if r.status_code != 200:
                logger.warning(f"[cv-library] HTTP {r.status_code}")
                return []

        jobs = []
        # Extract job cards from HTML
        cards = re.findall(
            r'<article[^>]*class="[^"]*job[^"]*"[^>]*>(.*?)</article>',
            r.text, re.DOTALL
        )

        for card in cards[:50]:
            title_match = re.search(r'<a[^>]*class="[^"]*job__title[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', card, re.DOTALL)
            company_match = re.search(r'<a[^>]*class="[^"]*job__company[^"]*"[^>]*>(.*?)</a>', card, re.DOTALL)
            location_match = re.search(r'<span[^>]*class="[^"]*job__location[^"]*"[^>]*>(.*?)</span>', card, re.DOTALL)
            salary_match = re.search(r'<span[^>]*class="[^"]*job__salary[^"]*"[^>]*>(.*?)</span>', card, re.DOTALL)

            if not title_match:
                continue

            title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
            url = title_match.group(1)
            if not url.startswith("http"):
                url = f"https://www.cv-library.co.uk{url}"

            company = re.sub(r'<[^>]+>', '', company_match.group(1)).strip() if company_match else ""
            loc = re.sub(r'<[^>]+>', '', location_match.group(1)).strip() if location_match else ""
            salary = re.sub(r'<[^>]+>', '', salary_match.group(1)).strip() if salary_match else ""

            jobs.append({
                "source": "cvlibrary",
                "source_url": url,
                "source_job_id": url.split("/")[-1] if url else None,
                "title": title,
                "title_raw": title,
                "company": company,
                "company_name_raw": company,
                "location_raw": loc,
                "salary_text_raw": salary,
            })

        logger.info(f"[cv-library] Scraped {len(jobs)} jobs for '{kw}'")
        return jobs
