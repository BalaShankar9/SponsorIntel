"""BMJ Careers scraper — UK medical/clinical jobs (high sponsorship)."""
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class BMJCareersScraper:
    """Scrapes BMJ Careers. Medical roles — very high sponsorship rate for doctors."""

    BASE_URL = "https://jobs.bmj.com/jobs"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        kw = keyword or "visa sponsorship"

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                self.BASE_URL,
                params={"Keywords": kw, "CountryCode": "GB"},
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html",
                },
            )
            if r.status_code != 200:
                logger.warning(f"[bmj] HTTP {r.status_code}")
                return []

        jobs = []
        cards = re.findall(r'<div[^>]*class="[^"]*lister__item[^"]*"[^>]*>(.*?)</div>\s*</div>', r.text, re.DOTALL)
        if not cards:
            cards = re.findall(r'<article[^>]*>(.*?)</article>', r.text, re.DOTALL)

        for card in cards[:30]:
            title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)</a>', card, re.DOTALL)
            if not title_match:
                title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', card)
            company_match = re.search(r'employer[^"]*"[^>]*>(.*?)</', card)
            loc_match = re.search(r'location[^"]*"[^>]*>(.*?)</', card)
            salary_match = re.search(r'salary[^"]*"[^>]*>(.*?)</', card)

            if not title_match:
                continue

            title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
            url = title_match.group(1)
            if url and not url.startswith("http"):
                url = f"https://jobs.bmj.com{url}"

            jobs.append({
                "source": "bmj_careers",
                "source_url": url,
                "title": title,
                "title_raw": title,
                "company": re.sub(r'<[^>]+>', '', company_match.group(1)).strip() if company_match else "",
                "company_name_raw": re.sub(r'<[^>]+>', '', company_match.group(1)).strip() if company_match else "",
                "location_raw": re.sub(r'<[^>]+>', '', loc_match.group(1)).strip() if loc_match else "United Kingdom",
                "salary_text_raw": re.sub(r'<[^>]+>', '', salary_match.group(1)).strip() if salary_match else None,
            })

        logger.info(f"[bmj] Scraped {len(jobs)} medical jobs for '{kw}'")
        return jobs
