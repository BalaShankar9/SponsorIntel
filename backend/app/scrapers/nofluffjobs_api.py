"""NoFluffJobs API scraper — EU/UK tech jobs with visa sponsorship filter."""
import logging
import httpx

logger = logging.getLogger(__name__)


class NoFluffJobsAPIScraper:
    """Scrapes NoFluffJobs.com public REST API. Has explicit visa sponsorship filter."""

    BASE_URL = "https://nofluffjobs.com/api/posting"

    async def scrape(self, keyword: str = None, location: str = None) -> list[dict]:
        params = {}
        if keyword:
            params["criteria"] = f"requirement=visa-sponsorship keyword={keyword}"
        else:
            params["criteria"] = "requirement=visa-sponsorship country=united-kingdom"

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                self.BASE_URL,
                params=params,
                headers={"User-Agent": "SponsorIntel/1.0", "Accept": "application/json"},
            )
            if r.status_code != 200:
                logger.warning(f"[nofluffjobs] HTTP {r.status_code}")
                return []

            try:
                data = r.json()
            except Exception:
                return []

        jobs = []
        postings = data if isinstance(data, list) else data.get("postings", [])

        for post in postings:
            title = post.get("title", "")
            company = post.get("name", "") or post.get("company", {}).get("name", "")
            slug = post.get("url", "") or post.get("id", "")

            location_data = post.get("location", {})
            loc_text = ""
            if isinstance(location_data, dict):
                places = location_data.get("places", [])
                if places:
                    loc_text = ", ".join(
                        p.get("city", "") for p in places if isinstance(p, dict)
                    )
            elif isinstance(location_data, str):
                loc_text = location_data

            # UK filter — strict (exclude generic "remote" without UK mention)
            combined = f"{title} {company} {loc_text}".lower()
            uk_terms = ["uk", "london", "manchester", "birmingham", "edinburgh",
                       "united kingdom", "england", "scotland", "wales", "belfast",
                       "glasgow", "cardiff", "leeds", "bristol", "cambridge", "oxford"]
            if not any(t in combined for t in uk_terms):
                continue

            salary = post.get("salary", {})
            salary_min = None
            salary_max = None
            if isinstance(salary, dict):
                salary_min = salary.get("from")
                salary_max = salary.get("to")

            jobs.append({
                "source": "nofluffjobs",
                "source_job_id": str(slug),
                "source_url": f"https://nofluffjobs.com/job/{slug}" if slug else None,
                "title": title,
                "title_raw": title,
                "company": company,
                "company_name_raw": company,
                "location_raw": loc_text or "Remote",
                "salary_min": salary_min,
                "salary_max": salary_max,
                "salary_currency": salary.get("currency", "GBP") if isinstance(salary, dict) else "GBP",
                "location_is_remote": "remote" in combined,
            })

        logger.info(f"[nofluffjobs] Scraped {len(jobs)} UK visa-sponsorship jobs")
        return jobs
