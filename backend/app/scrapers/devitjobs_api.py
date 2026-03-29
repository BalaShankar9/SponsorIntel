"""
DevITjobs.uk API scraper.

Uses the free public DevITjobs API (no authentication required) to fetch
UK developer job listings. This source is especially valuable because it
provides a native ``hasVisaSponsorship`` boolean field, eliminating the
need for NLP-based sponsorship detection.

API endpoint: https://devitjobs.uk/api/jobsLight
Returns a JSON array of job objects. All jobs are UK-based.
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

_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _strip_html(html: str) -> str:
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _map_exp_level(level: str) -> Optional[str]:
    if not level:
        return None
    t = level.lower()
    if t in ("junior", "intern", "trainee"):
        return Seniority.ENTRY.value
    if t in ("regular", "mid", "mid-level"):
        return Seniority.MID.value
    if t in ("senior", "experienced"):
        return Seniority.SENIOR.value
    if t in ("lead", "principal", "staff"):
        return Seniority.LEAD.value
    if t in ("director", "vp"):
        return Seniority.DIRECTOR.value
    if t in ("executive", "c-level"):
        return Seniority.EXECUTIVE.value
    return None


def _map_job_type(job_type: str) -> Optional[str]:
    if not job_type:
        return None
    t = job_type.lower()
    if "full" in t or "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "freelance" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp" in t:
        return ContractType.TEMPORARY.value
    if "internship" in t or "apprentice" in t:
        return ContractType.APPRENTICESHIP.value
    return None


def _parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str[:26], fmt.replace("Z", ""))
        except ValueError:
            continue
    return None


def _is_remote(workplace: str) -> bool:
    if not workplace:
        return False
    return workplace.lower() in ("remote", "fully remote")


class DevITJobsAPIScraper(BaseScraper):
    """
    Scrapes UK developer job listings from the DevITjobs.uk API.

    No authentication required. Returns a JSON array of all active jobs.
    All jobs are UK-based with structured salary, technology, and visa
    sponsorship data.
    """

    name = "devitjobs"
    base_url = "https://devitjobs.uk/api/jobsLight"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        all_jobs: list[dict] = []

        try:
            raw_jobs = await self._fetch_jobs()

            for raw in raw_jobs:
                try:
                    parsed = self._parse_job(raw, keyword)
                    if parsed:
                        all_jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job id=%s: %s",
                        self.name, raw.get("_id", "?"), str(exc)[:200],
                    )

        except Exception as exc:
            logger.warning(
                "[%s] Error fetching jobs: %s",
                self.name, str(exc)[:200],
            )

        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK developer jobs from DevITjobs",
            self.name, len(all_jobs),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    async def _fetch_jobs(self) -> list[dict]:
        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            ) as client:
                response = await client.get(self.base_url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "application/json",
                })

            if response.status_code != 200:
                logger.warning(
                    "[%s] HTTP %d from DevITjobs API",
                    self.name, response.status_code,
                )
                return []

            data = response.json()

            if not isinstance(data, list):
                logger.warning(
                    "[%s] Unexpected response type: %s",
                    self.name, type(data).__name__,
                )
                return []

            return data

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching DevITjobs API", self.name)
        except httpx.RequestError as exc:
            logger.warning("[%s] Request error: %s", self.name, str(exc)[:200])
        except Exception as exc:
            logger.warning("[%s] Unexpected error: %s", self.name, str(exc)[:200])

        return []

    def _parse_job(self, raw: dict, keyword: str = "") -> Optional[dict]:
        title = raw.get("name", "") or ""
        company = raw.get("company", "") or ""
        city = raw.get("cityCategory", "") or ""
        workplace = raw.get("workplace", "") or ""
        description = raw.get("description", "") or ""
        if "<" in description:
            description = _strip_html(description)

        if keyword:
            techs = " ".join(raw.get("technologies", []) or [])
            searchable = f"{title} {company} {description} {techs}".lower()
            if keyword.lower() not in searchable:
                return None

        # Salary
        salary_min = raw.get("annualSalaryFrom")
        salary_max = raw.get("annualSalaryTo")
        if salary_min is not None:
            try:
                salary_min = int(salary_min)
            except (ValueError, TypeError):
                salary_min = None
        if salary_max is not None:
            try:
                salary_max = int(salary_max)
            except (ValueError, TypeError):
                salary_max = None

        # Visa sponsorship — native field from API (returns "Yes"/"No" strings)
        visa_raw = raw.get("hasVisaSponsorship", "No")
        has_visa = visa_raw is True or (isinstance(visa_raw, str) and visa_raw.lower() == "yes")

        # Technologies as skills
        technologies = raw.get("technologies", []) or []

        # Location
        location_parts = [city]
        if workplace:
            location_parts.append(f"({workplace})")
        location_raw = " ".join(location_parts).strip() or "United Kingdom"

        # Build source URL
        job_url = raw.get("jobUrl", "")
        source_url = f"https://devitjobs.uk/jobs/{job_url}" if job_url else ""

        job: dict = {
            "source": JobSource.DEVITJOBS.value,
            "source_job_id": raw.get("_id", ""),
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location_raw,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": source_url,
            "posted_date": None,
            "contract_type": _map_job_type(raw.get("jobType")),
            "seniority": _map_exp_level(raw.get("expLevel")),
            "skills_extracted": technologies if technologies else None,
            "location_is_remote": _is_remote(workplace),
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "GBP",
            "salary_period": "ANNUAL" if (salary_min or salary_max) else None,
            "has_visa_sponsorship": has_visa,
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        description = job.get("description_full", "") or ""

        # If the API says visa sponsorship is available, set high likelihood
        if job.pop("has_visa_sponsorship", False):
            job["sponsorship_likelihood"] = 95
            job["sponsorship_signals"] = {"visa_sponsorship_confirmed_by_employer": 0.95}
        else:
            likelihood, signals = detect_sponsorship(description)
            job["sponsorship_likelihood"] = likelihood
            job["sponsorship_signals"] = signals
