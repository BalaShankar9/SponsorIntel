"""
UK Teaching Vacancies API scraper.

Uses the free public Teaching Vacancies API (no authentication required)
from the UK Department for Education. Returns structured JSON-LD job
postings across England's state-funded schools.

Teaching is a shortage occupation in the UK, making these jobs highly
relevant for sponsorship seekers.

API endpoint: https://teaching-vacancies.service.gov.uk/api/v1/jobs.json
"""

import logging
import re
from datetime import datetime
from typing import Optional

import httpx

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

MAX_PAGES = 10

_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _strip_html(html: str) -> str:
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d")
        except ValueError:
            continue
    return None


def _map_employment_type(types: list[str]) -> Optional[str]:
    if not types:
        return None
    for t in types:
        t_lower = t.lower()
        if "full" in t_lower:
            return ContractType.PERMANENT.value
        if "part" in t_lower:
            return ContractType.TEMPORARY.value
        if "fixed" in t_lower or "contract" in t_lower:
            return ContractType.CONTRACT.value
    return ContractType.PERMANENT.value


def _detect_seniority(title: str) -> Optional[str]:
    if not title:
        return None
    t = title.lower()
    if any(k in t for k in ("headteacher", "head teacher", "principal", "director")):
        return Seniority.DIRECTOR.value
    if any(k in t for k in ("head of", "assistant head", "deputy head", "vice principal")):
        return Seniority.LEAD.value
    if any(k in t for k in ("senior", "lead ", "lead,", "experienced")):
        return Seniority.SENIOR.value
    if any(k in t for k in ("teacher", "lecturer")):
        return Seniority.MID.value
    if any(k in t for k in ("nqt", "ect", "trainee", "teaching assistant", "ta ", "intern")):
        return Seniority.ENTRY.value
    return None


def _build_location(job_location: dict) -> str:
    if not job_location:
        return ""
    address = job_location.get("address", {})
    parts = []
    if address.get("addressLocality"):
        parts.append(address["addressLocality"])
    if address.get("addressRegion"):
        parts.append(address["addressRegion"])
    return ", ".join(parts) if parts else ""


class TeachingVacanciesAPIScraper(BaseScraper):
    """
    Scrapes teaching job listings from the UK Teaching Vacancies API.

    No authentication required. Returns paginated JSON-LD job postings
    (100 per page). All jobs are UK-based (England state-funded schools).
    """

    name = "teaching_vacancies"
    base_url = "https://teaching-vacancies.service.gov.uk/api/v1/jobs.json"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        all_jobs: list[dict] = []
        max_pages = kwargs.get("max_pages", MAX_PAGES)

        for page in range(1, max_pages + 1):
            try:
                jobs, total_pages = await self._fetch_page(page, keyword)
                all_jobs.extend(jobs)

                if page >= total_pages:
                    logger.info(
                        "[%s] Reached last page %d/%d",
                        self.name, page, total_pages,
                    )
                    break

            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching page %d: %s",
                    self.name, page, str(exc)[:200],
                )
                break

        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d teaching jobs across %d pages",
            self.name, len(all_jobs), min(page, max_pages),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    async def _fetch_page(self, page: int, keyword: str = "") -> tuple[list[dict], int]:
        url = f"{self.base_url}?page={page}"
        jobs: list[dict] = []
        total_pages = 1

        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            ) as client:
                response = await client.get(url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "application/json",
                })

            if response.status_code != 200:
                logger.warning(
                    "[%s] HTTP %d for page %d",
                    self.name, response.status_code, page,
                )
                return jobs, total_pages

            data = response.json()
            meta = data.get("meta", {})
            total_pages = meta.get("totalPages", 1)
            raw_jobs = data.get("data", [])

            for raw in raw_jobs:
                try:
                    parsed = self._parse_job(raw, keyword)
                    if parsed:
                        jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job: %s",
                        self.name, str(exc)[:200],
                    )

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching page %d", self.name, page)
        except httpx.RequestError as exc:
            logger.warning("[%s] Request error page %d: %s", self.name, page, str(exc)[:200])
        except Exception as exc:
            logger.warning("[%s] Unexpected error page %d: %s", self.name, page, str(exc)[:200])

        return jobs, total_pages

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        title = raw.get("title", "") or ""
        description_html = raw.get("description", "") or ""
        description = _strip_html(description_html)

        if keyword:
            searchable = f"{title} {description}".lower()
            if keyword.lower() not in searchable:
                return None

        hiring_org = raw.get("hiringOrganization", {}) or {}
        company = hiring_org.get("name", "") or ""
        source_url = raw.get("url", "") or ""

        location = _build_location(raw.get("jobLocation", {}))

        employment_types = raw.get("employmentType", []) or []
        if isinstance(employment_types, str):
            employment_types = [employment_types]

        # Extract salary from jobBenefits or description
        salary_text = raw.get("jobBenefits", "") or ""

        job: dict = {
            "source": JobSource.TEACHING_VACANCIES.value,
            "source_job_id": source_url or title,
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location or "England, United Kingdom",
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": source_url,
            "posted_date": _parse_date(raw.get("datePosted")),
            "contract_type": _map_employment_type(employment_types),
            "seniority": _detect_seniority(title),
            "skills_extracted": [raw.get("occupationalCategory")] if raw.get("occupationalCategory") else None,
            "location_is_remote": False,
            "salary_text_raw": salary_text if salary_text else None,
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        title = job.get("title_raw", "")
        description = job.get("description_full", "") or ""

        if not job.get("seniority"):
            job["seniority"] = _detect_seniority(title)

        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
