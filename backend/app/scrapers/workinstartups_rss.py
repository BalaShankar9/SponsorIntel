"""WorkInStartups RSS scraper — UK startup jobs."""
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class WorkInStartupsScraper:
    """Scrapes WorkInStartups.com via RSS feed."""

    RSS_URL = "https://workinstartups.com/job-board/feed/"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(self.RSS_URL, headers={"User-Agent": "SponsorIntel/1.0"})
            if r.status_code != 200:
                logger.warning(f"[workinstartups] HTTP {r.status_code}")
                return []

        jobs = []
        items = re.findall(r'<item>(.*?)</item>', r.text, re.DOTALL)
        kw_lower = (keyword or "").lower()

        for item in items:
            title = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item)
            if not title:
                title = re.search(r'<title>(.*?)</title>', item)
            link = re.search(r'<link>(.*?)</link>', item)
            desc = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>', item, re.DOTALL)
            if not desc:
                desc = re.search(r'<description>(.*?)</description>', item, re.DOTALL)
            pub_date = re.search(r'<pubDate>(.*?)</pubDate>', item)

            if not title:
                continue

            title_text = title.group(1).strip()
            desc_text = desc.group(1) if desc else ""

            # Filter by keyword if provided
            if kw_lower and kw_lower not in title_text.lower() and kw_lower not in desc_text.lower():
                continue

            # UK filter
            combined = f"{title_text} {desc_text}".lower()
            uk_indicators = ["uk", "london", "manchester", "birmingham", "edinburgh",
                           "united kingdom", "remote", "hybrid"]
            if not any(ind in combined for ind in uk_indicators):
                continue

            company = ""
            if " at " in title_text:
                parts = title_text.split(" at ", 1)
                title_text = parts[0]
                company = parts[1]

            jobs.append({
                "source": "workinstartups",
                "source_url": link.group(1) if link else None,
                "title": title_text,
                "title_raw": title_text,
                "company": company,
                "company_name_raw": company,
                "description_snippet": desc_text[:500],
                "posted_date": pub_date.group(1) if pub_date else None,
                "location_raw": "United Kingdom",
            })

        logger.info(f"[workinstartups] Scraped {len(jobs)} UK jobs")
        return jobs
