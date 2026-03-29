"""
Career page scraper — scans sponsor websites for job listings.

Two-phase approach:
1. ATS Detection: Check if the company uses a known ATS (Greenhouse, Lever,
   Workable, etc.) by probing URL patterns and scanning career page HTML.
2. Job Extraction: If an ATS is found, use its structured API/feed.
   Otherwise, parse the raw career page HTML for job links.

This scraper is designed to run at scale across 124K+ sponsor websites.
Only companies with a detected career page (has_careers_page=True) or
website_url are candidates.
"""

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

from app.models.enums import JobSource
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

# Known ATS platforms and their URL patterns
ATS_PATTERNS = {
    "greenhouse": {
        "board_url": "https://boards.greenhouse.io/{slug}",
        "api_url": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
        "detect_patterns": [
            r'boards\.greenhouse\.io/([a-zA-Z0-9_-]+)',
            r'grnh\.se/',
        ],
    },
    "lever": {
        "board_url": "https://jobs.lever.co/{slug}",
        "api_url": "https://api.lever.co/v0/postings/{slug}?mode=json",
        "detect_patterns": [
            r'jobs\.lever\.co/([a-zA-Z0-9_-]+)',
        ],
    },
    "workable": {
        "board_url": "https://apply.workable.com/{slug}",
        "api_url": "https://apply.workable.com/api/v3/accounts/{slug}/jobs",
        "detect_patterns": [
            r'apply\.workable\.com/([a-zA-Z0-9_-]+)',
        ],
    },
    "bamboohr": {
        "board_url": "https://{slug}.bamboohr.com/careers",
        "detect_patterns": [
            r'([a-zA-Z0-9_-]+)\.bamboohr\.com/(?:careers|jobs)',
        ],
    },
    "smartrecruiters": {
        "board_url": "https://careers.smartrecruiters.com/{slug}",
        "api_url": "https://api.smartrecruiters.com/v1/companies/{slug}/postings",
        "detect_patterns": [
            r'careers\.smartrecruiters\.com/([a-zA-Z0-9_-]+)',
        ],
    },
    "ashby": {
        "board_url": "https://jobs.ashbyhq.com/{slug}",
        "api_url": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
        "detect_patterns": [
            r'jobs\.ashbyhq\.com/([a-zA-Z0-9_-]+)',
        ],
    },
}

# Patterns in career page HTML that indicate an embedded ATS
ATS_IFRAME_PATTERNS = [
    (r'src="https://boards\.greenhouse\.io/([^/"]+)', "greenhouse"),
    (r'src="https://jobs\.lever\.co/([^/"]+)', "lever"),
    (r'src="https://apply\.workable\.com/([^/"]+)', "workable"),
    (r'src="https://([^.]+)\.bamboohr\.com', "bamboohr"),
    (r'src="https://careers\.smartrecruiters\.com/([^/"]+)', "smartrecruiters"),
    (r'src="https://jobs\.ashbyhq\.com/([^/"]+)', "ashby"),
]


def detect_ats_from_html(html: str) -> Optional[tuple[str, str]]:
    """Detect ATS platform from career page HTML. Returns (platform, slug) or None."""
    for pattern, platform in ATS_IFRAME_PATTERNS:
        match = re.search(pattern, html, re.I)
        if match:
            return platform, match.group(1)

    # Also check href links
    for platform, config in ATS_PATTERNS.items():
        for pattern in config["detect_patterns"]:
            match = re.search(pattern, html, re.I)
            if match:
                return platform, match.group(1)

    return None


def detect_ats_from_url(url: str) -> Optional[tuple[str, str]]:
    """Detect ATS platform from a URL. Returns (platform, slug) or None."""
    for platform, config in ATS_PATTERNS.items():
        for pattern in config["detect_patterns"]:
            match = re.search(pattern, url, re.I)
            if match:
                return platform, match.group(1)
    return None


class CareerPageScraper(BaseScraper):
    """
    Scans sponsor career pages for job listings.

    Detects ATS platforms (Greenhouse, Lever, Workable, etc.) and
    extracts jobs via their APIs. Falls back to HTML parsing for
    non-ATS career pages.
    """

    name = "career_page"
    base_url = ""
    requests_per_minute = 20
    max_retries = 2
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape jobs from a company's career page.

        Args:
            careers_url: Direct careers page URL
            website_url: Company website (will try to find careers page)
            company_name: Company name for metadata
            sponsor_id: UUID of the sponsor record
        """
        careers_url = kwargs.get("careers_url") or kwargs.get("website_url", "")
        company_name = kwargs.get("company_name", "")
        sponsor_id = kwargs.get("sponsor_id")

        if not careers_url:
            return []

        jobs: list[dict] = []

        try:
            # Phase 1: Try to detect ATS from URL
            ats_result = detect_ats_from_url(careers_url)

            if not ats_result:
                # Fetch career page HTML and detect ATS from content
                html = await self._fetch_page(careers_url)
                if html:
                    ats_result = detect_ats_from_html(html)

                    if not ats_result:
                        # No ATS found — parse raw HTML for job links
                        jobs = self._parse_html_jobs(html, careers_url, company_name)

            # Phase 2: If ATS detected, use its API
            if ats_result:
                platform, slug = ats_result
                logger.info(
                    "[%s] Detected %s ATS (slug=%s) for %s",
                    self.name, platform, slug, company_name or careers_url,
                )

                if platform == "greenhouse":
                    jobs = await self._scrape_greenhouse(slug, company_name)
                elif platform == "lever":
                    jobs = await self._scrape_lever(slug, company_name)
                elif platform == "workable":
                    jobs = await self._scrape_workable(slug, company_name)
                elif platform == "smartrecruiters":
                    jobs = await self._scrape_smartrecruiters(slug, company_name)
                elif platform == "ashby":
                    jobs = await self._scrape_ashby(slug, company_name)

        except Exception as exc:
            logger.warning(
                "[%s] Error scraping %s: %s",
                self.name, careers_url[:80], str(exc)[:200],
            )

        # Enrich with sponsorship detection and sponsor linkage
        for job in jobs:
            job["sponsor_id"] = sponsor_id
            description = job.get("description_full", "") or ""
            if description:
                likelihood, signals = detect_sponsorship(description)
                job["sponsorship_likelihood"] = likelihood
                job["sponsorship_signals"] = signals

        logger.info(
            "[%s] Found %d jobs for %s",
            self.name, len(jobs), company_name or careers_url[:60],
        )
        return jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    # ------------------------------------------------------------------
    # ATS-specific scrapers (use free public APIs)
    # ------------------------------------------------------------------

    async def _scrape_greenhouse(self, slug: str, company_name: str) -> list[dict]:
        """Greenhouse public API — no auth required."""
        url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
        data = await self._fetch_json(url)
        if not data or "jobs" not in data:
            return []

        jobs = []
        for j in data["jobs"]:
            location = ""
            if j.get("location", {}).get("name"):
                location = j["location"]["name"]

            description = j.get("content", "")
            if "<" in description:
                description = re.sub(r"<[^>]+>", " ", description).strip()

            jobs.append({
                "source": JobSource.CAREER_PAGE.value,
                "source_job_id": f"gh_{slug}_{j.get('id', '')}",
                "title_raw": j.get("title", ""),
                "company_name_raw": company_name or slug,
                "location_raw": location,
                "description_full": description,
                "description_snippet": description[:500] if description else None,
                "source_url": j.get("absolute_url", ""),
                "posted_date": _parse_iso_date(j.get("updated_at")),
                "ats_platform": "greenhouse",
            })

        return jobs

    async def _scrape_lever(self, slug: str, company_name: str) -> list[dict]:
        """Lever public API — no auth required."""
        url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
        data = await self._fetch_json(url)
        if not data or not isinstance(data, list):
            return []

        jobs = []
        for j in data:
            location = j.get("categories", {}).get("location", "")
            team = j.get("categories", {}).get("team", "")
            description = j.get("descriptionPlain", "") or j.get("description", "")
            if "<" in description:
                description = re.sub(r"<[^>]+>", " ", description).strip()

            jobs.append({
                "source": JobSource.CAREER_PAGE.value,
                "source_job_id": f"lever_{slug}_{j.get('id', '')}",
                "title_raw": j.get("text", ""),
                "company_name_raw": company_name or slug,
                "location_raw": location,
                "description_full": description,
                "description_snippet": description[:500] if description else None,
                "source_url": j.get("hostedUrl", ""),
                "posted_date": _parse_epoch_ms(j.get("createdAt")),
                "ats_platform": "lever",
                "department": team,
            })

        return jobs

    async def _scrape_workable(self, slug: str, company_name: str) -> list[dict]:
        """Workable public API."""
        url = f"https://apply.workable.com/api/v3/accounts/{slug}/jobs"
        data = await self._fetch_json(url, method="POST", json_body={"query": "", "location": [], "department": [], "worktype": []})
        if not data or "results" not in data:
            return []

        jobs = []
        for j in data["results"]:
            location_parts = []
            if j.get("city"):
                location_parts.append(j["city"])
            if j.get("country"):
                location_parts.append(j["country"])
            location = ", ".join(location_parts) if location_parts else ""

            jobs.append({
                "source": JobSource.CAREER_PAGE.value,
                "source_job_id": f"workable_{slug}_{j.get('shortcode', '')}",
                "title_raw": j.get("title", ""),
                "company_name_raw": company_name or slug,
                "location_raw": location,
                "description_full": "",
                "description_snippet": j.get("description", "")[:500] if j.get("description") else None,
                "source_url": j.get("url", f"https://apply.workable.com/{slug}/j/{j.get('shortcode', '')}/"),
                "posted_date": _parse_iso_date(j.get("published_on")),
                "ats_platform": "workable",
            })

        return jobs

    async def _scrape_smartrecruiters(self, slug: str, company_name: str) -> list[dict]:
        """SmartRecruiters public API."""
        url = f"https://api.smartrecruiters.com/v1/companies/{slug}/postings"
        data = await self._fetch_json(url)
        if not data or "content" not in data:
            return []

        jobs = []
        for j in data["content"]:
            location = j.get("location", {})
            loc_parts = [location.get("city", ""), location.get("country", "")]
            location_str = ", ".join(p for p in loc_parts if p)

            jobs.append({
                "source": JobSource.CAREER_PAGE.value,
                "source_job_id": f"sr_{slug}_{j.get('id', '')}",
                "title_raw": j.get("name", ""),
                "company_name_raw": company_name or j.get("company", {}).get("name", slug),
                "location_raw": location_str,
                "description_full": "",
                "source_url": j.get("ref", ""),
                "posted_date": _parse_iso_date(j.get("releasedDate")),
                "ats_platform": "smartrecruiters",
            })

        return jobs

    async def _scrape_ashby(self, slug: str, company_name: str) -> list[dict]:
        """Ashby public API."""
        url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
        data = await self._fetch_json(url)
        if not data or "jobs" not in data:
            return []

        jobs = []
        for j in data["jobs"]:
            jobs.append({
                "source": JobSource.CAREER_PAGE.value,
                "source_job_id": f"ashby_{slug}_{j.get('id', '')}",
                "title_raw": j.get("title", ""),
                "company_name_raw": company_name or slug,
                "location_raw": j.get("location", ""),
                "description_full": re.sub(r"<[^>]+>", " ", j.get("descriptionHtml", "")).strip(),
                "description_snippet": j.get("descriptionPlain", "")[:500] if j.get("descriptionPlain") else None,
                "source_url": j.get("jobUrl", ""),
                "posted_date": _parse_iso_date(j.get("publishedAt")),
                "ats_platform": "ashby",
            })

        return jobs

    # ------------------------------------------------------------------
    # HTML job extraction (fallback for non-ATS career pages)
    # ------------------------------------------------------------------

    def _parse_html_jobs(self, html: str, base_url: str, company_name: str) -> list[dict]:
        """Extract job-like links from raw career page HTML."""
        jobs = []
        seen_urls = set()

        # Look for links that look like job postings
        job_link_pattern = re.compile(
            r'<a[^>]*href="([^"]*)"[^>]*>([^<]{5,100})</a>',
            re.I,
        )

        for match in job_link_pattern.finditer(html):
            href = match.group(1).strip()
            link_text = match.group(2).strip()

            # Skip navigation/footer links
            if any(skip in link_text.lower() for skip in (
                "privacy", "cookie", "terms", "contact", "about", "home",
                "login", "sign", "register", "blog", "news",
            )):
                continue

            # Resolve relative URLs
            if href.startswith("/"):
                href = urljoin(base_url, href)
            elif not href.startswith("http"):
                continue

            # Deduplicate
            if href in seen_urls:
                continue
            seen_urls.add(href)

            # Heuristic: job links often contain "job", "position", "role", "vacancy"
            combined = f"{href} {link_text}".lower()
            is_job_like = any(kw in combined for kw in (
                "job", "position", "role", "vacanc", "opening", "apply",
                "engineer", "manager", "analyst", "developer", "designer",
                "coordinator", "specialist", "director", "officer",
            ))

            if is_job_like:
                jobs.append({
                    "source": JobSource.CAREER_PAGE.value,
                    "source_job_id": f"career_{hash(href) & 0xFFFFFFFF:08x}",
                    "title_raw": link_text,
                    "company_name_raw": company_name,
                    "location_raw": "",
                    "description_full": "",
                    "source_url": href.split("?")[0],
                    "ats_platform": "direct",
                })

        return jobs

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    async def _fetch_page(self, url: str) -> Optional[str]:
        """Fetch a page and return HTML text."""
        try:
            await self._rate_limiter.acquire()
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(15),
                follow_redirects=True,
            ) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "text/html",
                })
            if resp.status_code == 200:
                return resp.text
        except Exception as exc:
            logger.warning("[%s] Fetch failed %s: %s", self.name, url[:80], str(exc)[:100])
        return None

    async def _fetch_json(self, url: str, method: str = "GET", json_body: dict = None) -> Optional[dict | list]:
        """Fetch JSON from a URL."""
        try:
            await self._rate_limiter.acquire()
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(15),
                follow_redirects=True,
            ) as client:
                if method == "POST":
                    resp = await client.post(url, json=json_body, headers={
                        "User-Agent": "SponsorIntel/1.0",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    })
                else:
                    resp = await client.get(url, headers={
                        "User-Agent": "SponsorIntel/1.0",
                        "Accept": "application/json",
                    })
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            logger.warning("[%s] JSON fetch failed %s: %s", self.name, url[:80], str(exc)[:100])
        return None


def _parse_iso_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(date_str[:26].rstrip("Z"), fmt.rstrip("Z"))
        except ValueError:
            continue
    return None


def _parse_epoch_ms(epoch_ms: Optional[int]) -> Optional[datetime]:
    if not epoch_ms:
        return None
    try:
        return datetime.utcfromtimestamp(epoch_ms / 1000)
    except (ValueError, TypeError, OSError):
        return None
