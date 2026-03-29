"""Jobs.ac.uk RSS scraper — UK academic/research jobs with sponsorship."""
import logging
from datetime import datetime, timezone
import httpx
import re

logger = logging.getLogger(__name__)


class JobsAcUKScraper:
    """Scrapes Jobs.ac.uk via their free RSS feed. High-value academic sponsor roles."""

    BASE_RSS = "https://www.jobs.ac.uk/search/rss"

    KEYWORDS = [
        "visa sponsorship", "skilled worker visa", "sponsor",
        "international candidates", "overseas applicants",
    ]

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        kw = keyword or "visa sponsorship"
        url = f"{self.BASE_RSS}?keywords={kw.replace(' ', '+')}"

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers={"User-Agent": "SponsorIntel/1.0"})
            if r.status_code != 200:
                logger.warning(f"[jobs.ac.uk] HTTP {r.status_code}")
                return []

        jobs = []
        # Parse RSS XML
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

            if not title or not link:
                continue

            # Extract company from title (format: "Job Title - Company Name")
            title_text = title.group(1).strip()
            company = ""
            if " - " in title_text:
                parts = title_text.rsplit(" - ", 1)
                title_text = parts[0]
                company = parts[1] if len(parts) > 1 else ""

            jobs.append({
                "source": "jobs_ac_uk",
                "source_job_id": link.group(1).split("/")[-1] if link else None,
                "source_url": link.group(1) if link else None,
                "title": title_text,
                "title_raw": title_text,
                "company": company,
                "company_name_raw": company,
                "description": desc.group(1)[:2000] if desc else None,
                "description_full": desc.group(1) if desc else None,
                "posted_date": pub_date.group(1) if pub_date else None,
                "location_raw": "United Kingdom",
            })

        logger.info(f"[jobs.ac.uk] Scraped {len(jobs)} jobs for '{kw}'")
        return jobs
