"""Civil Service Jobs scraper — UK government roles."""
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class CivilServiceScraper:
    """Scrapes civilservicejobs.service.gov.uk. Government sponsor roles."""

    BASE_URL = "https://www.civilservicejobs.service.gov.uk/csr/index.cgi"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        kw = keyword or "visa sponsorship"

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                self.BASE_URL,
                params={"pageaction": "searchbyquick", "storesearchcontext": "1", "nghr_dept": "0", "query": kw},
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                },
            )
            if r.status_code != 200:
                logger.warning(f"[civilservice] HTTP {r.status_code}")
                return []

        jobs = []
        cards = re.findall(r'<li[^>]*class="[^"]*search-results[^"]*"[^>]*>(.*?)</li>', r.text, re.DOTALL)

        for card in cards[:30]:
            title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', card)
            dept_match = re.search(r'Department.*?>(.*?)</', card, re.DOTALL)
            loc_match = re.search(r'Location.*?>(.*?)</', card, re.DOTALL)
            salary_match = re.search(r'Salary.*?>(.*?)</', card, re.DOTALL)

            if not title_match:
                continue

            title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
            url = title_match.group(1)
            if url and not url.startswith("http"):
                url = f"https://www.civilservicejobs.service.gov.uk{url}"

            jobs.append({
                "source": "civilservice",
                "source_url": url,
                "title": title,
                "title_raw": title,
                "company": re.sub(r'<[^>]+>', '', dept_match.group(1)).strip() if dept_match else "Civil Service",
                "company_name_raw": re.sub(r'<[^>]+>', '', dept_match.group(1)).strip() if dept_match else "Civil Service",
                "location_raw": re.sub(r'<[^>]+>', '', loc_match.group(1)).strip() if loc_match else "United Kingdom",
                "salary_text_raw": re.sub(r'<[^>]+>', '', salary_match.group(1)).strip() if salary_match else None,
            })

        logger.info(f"[civilservice] Scraped {len(jobs)} government jobs for '{kw}'")
        return jobs
