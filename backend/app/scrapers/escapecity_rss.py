"""Escape the City RSS scraper — purpose-driven UK jobs."""
import logging
import re
import httpx

logger = logging.getLogger(__name__)


class EscapeCityScraper:
    """Scrapes Escape the City RSS feed. Purpose-driven, many sponsor roles."""

    RSS_URL = "https://jobs.escapethecity.org/feed/"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(self.RSS_URL, headers={"User-Agent": "SponsorIntel/1.0"})
            if r.status_code != 200:
                logger.warning(f"[escapecity] HTTP {r.status_code}")
                return []

        jobs = []
        items = re.findall(r'<item>(.*?)</item>', r.text, re.DOTALL)

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

            # UK filter
            combined = f"{title_text} {desc_text}".lower()
            uk_terms = ["uk", "london", "united kingdom", "england", "remote"]
            if not any(t in combined for t in uk_terms):
                continue

            company = ""
            if " at " in title_text:
                parts = title_text.split(" at ", 1)
                title_text = parts[0].strip()
                company = parts[1].strip()
            elif " - " in title_text:
                parts = title_text.rsplit(" - ", 1)
                title_text = parts[0].strip()
                company = parts[1].strip()

            jobs.append({
                "source": "escapecity",
                "source_url": link.group(1) if link else None,
                "title": title_text,
                "title_raw": title_text,
                "company": company,
                "company_name_raw": company,
                "description_snippet": re.sub(r'<[^>]+>', '', desc_text)[:500],
                "posted_date": pub_date.group(1) if pub_date else None,
                "location_raw": "United Kingdom",
            })

        logger.info(f"[escapecity] Scraped {len(jobs)} UK jobs")
        return jobs
