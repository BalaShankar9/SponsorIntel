"""
CharityJob XML feed scraper.

Uses the free public CharityJob XML feed (no authentication required) to
fetch UK charity sector job listings. All jobs are UK-based.

Feed endpoint: https://www.charityjob.co.uk/feeds
Returns a large XML document (~9MB) with structured job elements.

Charities and non-profits are significant UK visa sponsors, making this
a valuable source for sponsorship-seeking job hunters.
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

import httpx

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

_HTML_ENTITY_RE = re.compile(r"&amp;(?:amp;)*(?:rsquo|lsquo|ldquo|rdquo|nbsp|pound|mdash|ndash);?")
_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _clean_text(text: str) -> str:
    if not text:
        return ""
    text = _HTML_ENTITY_RE.sub(" ", text)
    text = _HTML_TAG_RE.sub("", text)
    return text.strip()


def _parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%Y %H:%M:%S", "%d %B %Y"):
        try:
            return datetime.strptime(date_str[:10], "%d/%m/%Y")
        except ValueError:
            continue
    return None


def _map_job_type(job_type: str) -> Optional[str]:
    if not job_type:
        return None
    t = job_type.lower()
    if "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "fixed" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp" in t:
        return ContractType.TEMPORARY.value
    if "apprentice" in t or "volunteer" in t:
        return ContractType.APPRENTICESHIP.value
    return None


def _map_job_level(level: str) -> Optional[str]:
    if not level:
        return None
    t = level.lower()
    if any(k in t for k in ("director", "trustee", "chief")):
        return Seniority.DIRECTOR.value
    if any(k in t for k in ("head of", "senior manager")):
        return Seniority.EXECUTIVE.value
    if any(k in t for k in ("manager", "lead")):
        return Seniority.LEAD.value
    if any(k in t for k in ("senior", "experienced")):
        return Seniority.SENIOR.value
    if any(k in t for k in ("officer", "coordinator", "adviser")):
        return Seniority.MID.value
    if any(k in t for k in ("entry", "junior", "assistant", "graduate", "intern", "trainee")):
        return Seniority.ENTRY.value
    return None


def _is_remote(city: str, workplace: str) -> bool:
    combined = f"{city or ''} {workplace or ''}".lower()
    return any(k in combined for k in ("remote", "home based", "home-based", "work from home"))


class CharityJobFeedScraper(BaseScraper):
    """
    Scrapes UK charity sector jobs from the CharityJob XML feed.

    No authentication required. Returns a large XML document with
    structured job elements. All jobs are UK-based.
    """

    name = "charityjob"
    base_url = "https://www.charityjob.co.uk/feeds"
    requests_per_minute = 5  # Large feed, be gentle
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        all_jobs: list[dict] = []

        try:
            xml_text = await self._fetch_feed()
            if not xml_text:
                return all_jobs

            root = ET.fromstring(xml_text)
            items = root.findall(".//job")

            for item in items:
                try:
                    parsed = self._parse_item(item, keyword)
                    if parsed:
                        all_jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing job: %s",
                        self.name, str(exc)[:200],
                    )

        except ET.ParseError as exc:
            logger.warning("[%s] XML parse error: %s", self.name, str(exc)[:200])
        except Exception as exc:
            logger.warning("[%s] Error: %s", self.name, str(exc)[:200])

        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d charity jobs from CharityJob feed",
            self.name, len(all_jobs),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    async def _fetch_feed(self) -> Optional[str]:
        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(60),  # Large feed needs more time
                follow_redirects=True,
            ) as client:
                response = await client.get(self.base_url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "application/xml, text/xml",
                })

            if response.status_code != 200:
                logger.warning("[%s] HTTP %d", self.name, response.status_code)
                return None

            return response.text

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching feed", self.name)
        except httpx.RequestError as exc:
            logger.warning("[%s] Request error: %s", self.name, str(exc)[:200])
        except Exception as exc:
            logger.warning("[%s] Unexpected error: %s", self.name, str(exc)[:200])

        return None

    def _parse_item(self, item: ET.Element, keyword: str = "") -> Optional[dict]:
        title = (item.findtext("title") or "").strip()
        company = (item.findtext("company") or "").strip()
        description = _clean_text(item.findtext("description") or "")
        city = (item.findtext("city") or "").strip()
        salary_text = (item.findtext("salary") or "").strip()
        job_type = (item.findtext("jobtype") or "").strip()
        job_level = (item.findtext("joblevel") or "").strip()
        category = (item.findtext("category") or "").strip()
        ref = (item.findtext("referencenumber") or "").strip()
        url = (item.findtext("url") or "").strip()
        date_str = (item.findtext("date") or "").strip()
        workplace = (item.findtext("workplace") or "").strip()

        if not title:
            return None

        if keyword:
            searchable = f"{title} {company} {description} {category}".lower()
            if keyword.lower() not in searchable:
                return None

        # Parse salary
        salary_min = None
        salary_max = None
        if salary_text:
            import re as _re
            m = _re.search(r"£([\d,]+)", salary_text)
            if m:
                try:
                    val = int(m.group(1).replace(",", ""))
                    salary_min = val
                    # Look for a range
                    m2 = _re.search(r"£[\d,]+\s*[-–to]+\s*£([\d,]+)", salary_text)
                    if m2:
                        salary_max = int(m2.group(1).replace(",", ""))
                    else:
                        salary_max = val
                except ValueError:
                    pass

        location_raw = city or "United Kingdom"
        if workplace and workplace.lower() not in location_raw.lower():
            location_raw = f"{location_raw} ({workplace})"

        skills = [c.strip() for c in category.split(",") if c.strip()] if category else None

        job: dict = {
            "source": JobSource.CHARITYJOB.value,
            "source_job_id": ref or url,
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": location_raw,
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": url.split("?")[0] if url else "",  # Strip UTM params
            "posted_date": _parse_date(date_str),
            "contract_type": _map_job_type(job_type),
            "seniority": _map_job_level(job_level),
            "skills_extracted": skills,
            "location_is_remote": _is_remote(city, workplace),
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "GBP",
            "salary_period": "ANNUAL" if (salary_min or salary_max) else None,
            "salary_text_raw": salary_text if salary_text else None,
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        description = job.get("description_full", "") or ""
        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
