"""
We Work Remotely RSS scraper.

Fetches remote job listings from We Work Remotely RSS feeds (no
authentication required). Iterates multiple category feeds, filters
for UK-relevant positions, and maps fields to the internal Job model.

Feed base: https://weworkremotely.com/categories/{category}.rss
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# RSS categories available on We Work Remotely
WWR_CATEGORIES = [
    "remote-programming-jobs",
    "remote-design-jobs",
    "remote-devops-sysadmin-jobs",
    "remote-product-jobs",
    "remote-customer-support-jobs",
]

UK_LOCATION_KEYWORDS = [
    "uk", "united kingdom", "london", "manchester", "birmingham",
    "edinburgh", "glasgow", "bristol", "leeds", "liverpool",
    "worldwide", "anywhere", "europe", "emea", "global",
]

_HTML_TAG_RE = re.compile(r"<[^<]+?>")


def _strip_html(html: str) -> str:
    if not html:
        return ""
    return _HTML_TAG_RE.sub("", html).strip()


def _is_uk_relevant(region: str, description: str) -> bool:
    if not region:
        return True  # No region = open to all
    combined = f"{region} {description}".lower()
    return any(kw in combined for kw in UK_LOCATION_KEYWORDS)


def _parse_pub_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return parsedate_to_datetime(date_str).replace(tzinfo=None)
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str[:19], fmt)
        except ValueError:
            continue
    return None


def _extract_company(title: str) -> tuple[str, str]:
    """Split 'Company: Job Title' into (company, title)."""
    if ": " in title:
        parts = title.split(": ", 1)
        return parts[0].strip(), parts[1].strip()
    return "", title.strip()


def _detect_contract_type(text: str) -> Optional[str]:
    if not text:
        return None
    t = text.lower()
    if "permanent" in t:
        return ContractType.PERMANENT.value
    if "contract" in t or "freelance" in t:
        return ContractType.CONTRACT.value
    if "temporary" in t or "temp " in t:
        return ContractType.TEMPORARY.value
    if "apprentice" in t or "internship" in t:
        return ContractType.APPRENTICESHIP.value
    if "full-time" in t or "full time" in t:
        return ContractType.PERMANENT.value
    return None


def _detect_seniority(title: str) -> Optional[str]:
    if not title:
        return None
    t = title.lower()
    if any(k in t for k in ("director", "vp ", "vice president")):
        return Seniority.DIRECTOR.value
    if any(k in t for k in ("head of", "chief", "cto", "cfo", "ceo", "c-suite")):
        return Seniority.EXECUTIVE.value
    if any(k in t for k in ("lead ", "lead,", "principal", "staff ")):
        return Seniority.LEAD.value
    if any(k in t for k in ("senior", "sr ", "sr.", "experienced")):
        return Seniority.SENIOR.value
    if any(k in t for k in ("mid ", "mid-level", "intermediate")):
        return Seniority.MID.value
    if any(k in t for k in ("junior", "jr ", "jr.", "entry", "graduate", "intern", "trainee")):
        return Seniority.ENTRY.value
    return None


class WWRRSSScraper(BaseScraper):
    """
    Scrapes remote job listings from We Work Remotely RSS feeds.

    No authentication required. Iterates multiple category feeds and
    filters for UK-relevant positions.
    """

    name = "wwr"
    base_url = "https://weworkremotely.com/categories"
    requests_per_minute = 10
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        all_jobs: list[dict] = []
        seen_guids: set[str] = set()
        categories = kwargs.get("categories", WWR_CATEGORIES)

        for category in categories:
            try:
                jobs = await self._fetch_category(category, keyword, seen_guids)
                all_jobs.extend(jobs)
            except Exception as exc:
                logger.warning(
                    "[%s] Error fetching category '%s': %s",
                    self.name, category, str(exc)[:200],
                )

        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK-relevant jobs across %d categories",
            self.name, len(all_jobs), len(categories),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    async def _fetch_category(
        self, category: str, keyword: str, seen_guids: set[str]
    ) -> list[dict]:
        url = f"{self.base_url}/{category}.rss"
        jobs: list[dict] = []

        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                follow_redirects=True,
            ) as client:
                response = await client.get(url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "application/rss+xml, application/xml, text/xml",
                })

            if response.status_code != 200:
                logger.warning(
                    "[%s] HTTP %d for category '%s'",
                    self.name, response.status_code, category,
                )
                return jobs

            root = ET.fromstring(response.text)
            items = root.findall(".//item")

            for item in items:
                try:
                    parsed = self._parse_item(item, category, keyword, seen_guids)
                    if parsed:
                        jobs.append(parsed)
                except Exception as exc:
                    logger.warning(
                        "[%s] Error parsing item in '%s': %s",
                        self.name, category, str(exc)[:200],
                    )

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout fetching category '%s'", self.name, category)
        except httpx.RequestError as exc:
            logger.warning(
                "[%s] Request error for '%s': %s",
                self.name, category, str(exc)[:200],
            )
        except ET.ParseError as exc:
            logger.warning(
                "[%s] XML parse error for '%s': %s",
                self.name, category, str(exc)[:200],
            )
        except Exception as exc:
            logger.warning(
                "[%s] Unexpected error for '%s': %s",
                self.name, category, str(exc)[:200],
            )

        return jobs

    def _parse_item(
        self, item: ET.Element, category: str, keyword: str, seen_guids: set[str]
    ) -> Optional[dict]:
        guid_el = item.find("guid")
        guid = guid_el.text if guid_el is not None else ""
        if guid in seen_guids:
            return None
        seen_guids.add(guid)

        title_el = item.find("title")
        full_title = title_el.text if title_el is not None else ""
        company, title = _extract_company(full_title)

        region_el = item.find("region")
        region = region_el.text if region_el is not None else ""

        desc_el = item.find("description")
        description_html = desc_el.text if desc_el is not None else ""
        description = _strip_html(description_html)

        # UK relevance filter
        if not _is_uk_relevant(region, description):
            return None

        # Keyword filter
        if keyword:
            searchable = f"{title} {company} {description}".lower()
            if keyword.lower() not in searchable:
                return None

        link_el = item.find("link")
        source_url = link_el.text if link_el is not None else ""

        pub_date_el = item.find("pubDate")
        posted_date = _parse_pub_date(
            pub_date_el.text if pub_date_el is not None else ""
        )

        cat_el = item.find("category")
        cat_name = cat_el.text if cat_el is not None else category
        skills = [cat_name.replace("-", " ")] if cat_name else None

        job: dict = {
            "source": JobSource.WWR.value,
            "source_job_id": guid or source_url,
            "title_raw": title,
            "company_name_raw": company,
            "location_raw": region or "Remote",
            "description_full": description,
            "description_snippet": description[:500] if description else None,
            "source_url": source_url,
            "posted_date": posted_date,
            "contract_type": _detect_contract_type(f"{title} {description}"),
            "seniority": _detect_seniority(title),
            "skills_extracted": skills,
            "location_is_remote": True,
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        title = job.get("title_raw", "")
        description = job.get("description_full", "") or ""
        combined = f"{title} {description}"

        if not job.get("contract_type"):
            job["contract_type"] = _detect_contract_type(combined)
        if not job.get("seniority"):
            job["seniority"] = _detect_seniority(title)

        likelihood, signals = detect_sponsorship(description)
        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
