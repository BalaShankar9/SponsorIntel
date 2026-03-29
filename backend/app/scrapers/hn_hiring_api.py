"""
Hacker News "Who is Hiring" scraper.

Uses the free HN Firebase API (no authentication) to fetch job postings
from the monthly "Ask HN: Who is Hiring?" threads. Each top-level comment
in these threads is a job posting from a company.

API: https://hacker-news.firebaseio.com/v0/
Monthly thread posted by 'whoishiring' on the 1st of each month.

Posts typically follow the format:
    Company | Role | Location | Remote | Visa | ...
"""

import asyncio
import logging
import re
from datetime import datetime
from typing import Optional

import httpx

from app.models.enums import ContractType, JobSource, Seniority
from app.scrapers.base import BaseScraper
from app.services.sponsorship_detector import detect_sponsorship

logger = logging.getLogger(__name__)

HN_API = "https://hacker-news.firebaseio.com/v0"
SEARCH_API = "https://hn.algolia.com/api/v1/search"

# Max comments to fetch per thread
MAX_COMMENTS = 500

_HTML_TAG_RE = re.compile(r"<[^<]+?>")
_PIPE_SPLIT_RE = re.compile(r"\s*\|\s*")

UK_LOCATION_KEYWORDS = [
    "uk", "united kingdom", "london", "manchester", "birmingham",
    "edinburgh", "glasgow", "bristol", "leeds", "liverpool",
    "cambridge", "oxford", "cardiff", "belfast", "newcastle",
    "worldwide", "anywhere", "europe", "emea", "global",
]


def _strip_html(html: str) -> str:
    if not html:
        return ""
    text = html.replace("<p>", "\n").replace("</p>", "\n")
    text = _HTML_TAG_RE.sub("", text)
    return text.strip()


def _is_uk_relevant(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(kw in t for kw in UK_LOCATION_KEYWORDS)


def _has_visa_mention(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(kw in t for kw in (
        "visa", "sponsorship", "sponsor", "work permit",
        "skilled worker", "tier 2",
    ))


def _parse_pipe_header(text: str) -> dict:
    """Parse 'Company | Role | Location | Remote | Visa' header."""
    first_line = text.split("\n")[0]
    parts = _PIPE_SPLIT_RE.split(first_line)

    result = {
        "company": "",
        "title": "",
        "location": "",
        "is_remote": False,
        "visa_mentioned": False,
    }

    if len(parts) >= 1:
        result["company"] = parts[0].strip()
    if len(parts) >= 2:
        result["title"] = parts[1].strip()
    if len(parts) >= 3:
        result["location"] = parts[2].strip()

    for part in parts[3:]:
        p = part.lower().strip()
        if p in ("remote", "remote ok", "remote friendly", "fully remote"):
            result["is_remote"] = True
        if "visa" in p or "sponsor" in p:
            result["visa_mentioned"] = True

    return result


def _detect_seniority(title: str) -> Optional[str]:
    if not title:
        return None
    t = title.lower()
    if any(k in t for k in ("director", "vp ", "vice president")):
        return Seniority.DIRECTOR.value
    if any(k in t for k in ("head of", "chief", "cto", "cfo", "ceo")):
        return Seniority.EXECUTIVE.value
    if any(k in t for k in ("lead ", "lead,", "principal", "staff ")):
        return Seniority.LEAD.value
    if any(k in t for k in ("senior", "sr ", "sr.")):
        return Seniority.SENIOR.value
    if any(k in t for k in ("mid ", "mid-level")):
        return Seniority.MID.value
    if any(k in t for k in ("junior", "jr ", "entry", "intern", "graduate")):
        return Seniority.ENTRY.value
    return None


class HNHiringAPIScraper(BaseScraper):
    """
    Scrapes job postings from Hacker News "Who is Hiring?" threads.

    No authentication required. Uses the HN Algolia search API to find
    the latest thread, then fetches individual comments via the Firebase
    API. Filters for UK-relevant postings.
    """

    name = "hn_hiring"
    base_url = HN_API
    requests_per_minute = 30  # Firebase API is generous
    max_retries = 3
    use_proxy = False
    use_browser = False

    async def scrape(self, keyword: str = "", location: str = "", **kwargs) -> list[dict]:
        all_jobs: list[dict] = []

        try:
            thread_id = await self._find_latest_thread()
            if not thread_id:
                logger.warning("[%s] Could not find latest hiring thread", self.name)
                return all_jobs

            comment_ids = await self._get_thread_comments(thread_id)
            logger.info(
                "[%s] Found %d comments in thread %d",
                self.name, len(comment_ids), thread_id,
            )

            # Fetch comments in batches of 20
            batch_size = 20
            for i in range(0, min(len(comment_ids), MAX_COMMENTS), batch_size):
                batch = comment_ids[i:i + batch_size]
                comments = await self._fetch_comments_batch(batch)

                for comment in comments:
                    try:
                        parsed = self._parse_comment(comment, thread_id, keyword)
                        if parsed:
                            all_jobs.append(parsed)
                    except Exception as exc:
                        logger.warning(
                            "[%s] Error parsing comment %s: %s",
                            self.name, comment.get("id", "?"), str(exc)[:200],
                        )

        except Exception as exc:
            logger.warning("[%s] Error: %s", self.name, str(exc)[:200])

        for job in all_jobs:
            self._enrich_job(job)

        logger.info(
            "[%s] Scraped %d UK-relevant jobs from HN Who is Hiring",
            self.name, len(all_jobs),
        )
        return all_jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    async def _find_latest_thread(self) -> Optional[int]:
        """Find the latest 'Who is Hiring?' thread using Algolia search."""
        url = f"{SEARCH_API}?query=who+is+hiring&tags=story,author_whoishiring&hitsPerPage=1"

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
                logger.warning("[%s] Algolia search HTTP %d", self.name, response.status_code)
                return None

            data = response.json()
            hits = data.get("hits", [])
            if not hits:
                return None

            return int(hits[0]["objectID"])

        except Exception as exc:
            logger.warning("[%s] Error finding thread: %s", self.name, str(exc)[:200])
            return None

    async def _get_thread_comments(self, thread_id: int) -> list[int]:
        """Get list of top-level comment IDs from the thread."""
        url = f"{HN_API}/item/{thread_id}.json"

        try:
            await self._rate_limiter.acquire()

            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
            ) as client:
                response = await client.get(url)

            if response.status_code != 200:
                return []

            data = response.json()
            return data.get("kids", [])

        except Exception as exc:
            logger.warning("[%s] Error getting comments: %s", self.name, str(exc)[:200])
            return []

    async def _fetch_comments_batch(self, comment_ids: list[int]) -> list[dict]:
        """Fetch a batch of comments concurrently."""
        comments = []

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout),
        ) as client:
            tasks = []
            for cid in comment_ids:
                tasks.append(self._fetch_single_comment(client, cid))
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, dict):
                    comments.append(result)

        return comments

    async def _fetch_single_comment(self, client: httpx.AsyncClient, comment_id: int) -> Optional[dict]:
        """Fetch a single comment from the HN API."""
        url = f"{HN_API}/item/{comment_id}.json"
        try:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data and not data.get("deleted") and not data.get("dead"):
                    return data
        except Exception:
            pass
        return None

    def _parse_comment(self, comment: dict, thread_id: int, keyword: str = "") -> Optional[dict]:
        """Parse a single HN comment into a job dict."""
        text_html = comment.get("text", "") or ""
        text = _strip_html(text_html)

        if not text or len(text) < 50:
            return None

        # UK relevance filter
        if not _is_uk_relevant(text):
            return None

        # Parse pipe-delimited header
        header = _parse_pipe_header(text)
        company = header["company"]
        title = header["title"]
        location = header["location"]
        is_remote = header["is_remote"]
        visa_mentioned = header["visa_mentioned"]

        if not company:
            return None

        # Keyword filter
        if keyword:
            if keyword.lower() not in text.lower():
                return None

        comment_id = comment.get("id", "")
        posted_epoch = comment.get("time")
        posted_date = None
        if posted_epoch:
            try:
                posted_date = datetime.utcfromtimestamp(int(posted_epoch))
            except (ValueError, TypeError, OSError):
                pass

        job: dict = {
            "source": JobSource.HN_HIRING.value,
            "source_job_id": str(comment_id),
            "title_raw": title or "See description",
            "company_name_raw": company,
            "location_raw": location or "See description",
            "description_full": text,
            "description_snippet": text[:500] if text else None,
            "source_url": f"https://news.ycombinator.com/item?id={comment_id}",
            "posted_date": posted_date,
            "contract_type": None,
            "seniority": _detect_seniority(title),
            "skills_extracted": None,
            "location_is_remote": is_remote or "remote" in text.lower(),
            "visa_mentioned_in_header": visa_mentioned,
        }

        return job

    @staticmethod
    def _enrich_job(job: dict) -> None:
        description = job.get("description_full", "") or ""
        visa_in_header = job.pop("visa_mentioned_in_header", False)

        likelihood, signals = detect_sponsorship(description)

        if visa_in_header and likelihood < 70:
            likelihood = 70
            if isinstance(signals, dict):
                signals["visa_mentioned_in_job_header"] = 0.7
            else:
                signals = {"visa_mentioned_in_job_header": 0.7}

        job["sponsorship_likelihood"] = likelihood
        job["sponsorship_signals"] = signals
