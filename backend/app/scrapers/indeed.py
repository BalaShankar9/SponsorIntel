"""
Indeed UK job board scraper (Tier 2).

Scrapes job listings from uk.indeed.com using Playwright browser
as Indeed is heavily JS-rendered with infinite-scroll pagination.
"""

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.models.enums import JobSource
from app.scrapers.anti_detection import random_delay
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class IndeedScraper(BaseScraper):
    """
    Scrapes job listings from uk.indeed.com.

    Uses Playwright headless browser since Indeed renders content via JavaScript.
    Implements stealth measures and handles click-into-card for full descriptions.
    """

    name = "indeed"
    base_url = "https://uk.indeed.com"
    requests_per_minute = 3
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Indeed job listings using Playwright with stealth.

        Args:
            keyword: Search keyword (required)
            location: Location filter (default "United Kingdom")
            pages: Number of pages to scrape (default 2)
        """
        keyword = kwargs.get("keyword", "")
        location = kwargs.get("location", "United Kingdom")
        pages = kwargs.get("pages", 2)

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        all_jobs: list[dict] = []

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("[%s] Playwright not installed", self.name)
            return []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent=self._get_headers(self.base_url)["User-Agent"],
                    viewport={"width": 1920, "height": 1080},
                    locale="en-GB",
                )
                page = await context.new_page()

                # Stealth: hide webdriver flag and add plugin arrays
                await self._apply_stealth(page)

                # Block heavy resources
                await page.route(
                    "**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}",
                    lambda route: route.abort(),
                )

                for page_num in range(pages):
                    start = page_num * 10
                    url = self._build_search_url(keyword, location, start)

                    try:
                        await self._rate_limiter.acquire()
                        response = await page.goto(
                            url, wait_until="domcontentloaded", timeout=self.timeout * 1000
                        )

                        if not response or response.status != 200:
                            logger.warning(
                                "[%s] HTTP %s on page %d",
                                self.name,
                                response.status if response else "None",
                                page_num + 1,
                            )
                            break

                        # Wait for job cards to render
                        try:
                            await page.wait_for_selector(
                                "div.job_seen_beacon, div[data-jk], div[data-testid='job-card']",
                                timeout=10000,
                            )
                        except Exception:
                            logger.warning("[%s] No job cards found on page %d", self.name, page_num + 1)
                            break

                        html = await page.content()
                        jobs = await self.parse(html)

                        # Try clicking into each card for full description
                        jobs = await self._enrich_with_descriptions(page, jobs)

                        if not jobs:
                            break
                        all_jobs.extend(jobs)

                    except Exception as e:
                        logger.warning("[%s] Error on page %d: %s", self.name, page_num + 1, str(e)[:200])
                        break

                    # Gaussian delay between pages
                    if page_num < pages - 1:
                        await random_delay(2.0, 5.0)

                await browser.close()

        except Exception as e:
            logger.error("[%s] Browser session error: %s", self.name, str(e)[:200])

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def _enrich_with_descriptions(self, page, jobs: list[dict]) -> list[dict]:
        """Click into job cards to extract full descriptions from the right panel."""
        for i, job in enumerate(jobs):
            try:
                source_id = job.get("source_job_id")
                if not source_id:
                    continue

                # Click the card by data-jk attribute
                card_selector = f'div[data-jk="{source_id}"], a[data-jk="{source_id}"]'
                card = await page.query_selector(card_selector)
                if not card:
                    continue

                await card.click()
                await random_delay(1.0, 2.0)

                # Wait for description panel
                try:
                    await page.wait_for_selector(
                        "div#jobDescriptionText, div.jobsearch-JobComponent-description",
                        timeout=5000,
                    )
                except Exception:
                    continue

                desc_el = await page.query_selector(
                    "div#jobDescriptionText, div.jobsearch-JobComponent-description"
                )
                if desc_el:
                    desc_text = await desc_el.inner_text()
                    if desc_text:
                        job["description_full"] = desc_text.strip()
                        job["description_snippet"] = desc_text.strip()[:500]

            except Exception as e:
                logger.debug("[%s] Could not get description for job %d: %s", self.name, i, str(e)[:100])
                continue

        return jobs

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Indeed search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        # Indeed uses various card selectors
        selectors = [
            "div.job_seen_beacon",
            "div.jobsearch-ResultsList div.result",
            "li.css-1ac2h1w",
            "div[data-testid='job-card']",
        ]

        cards = []
        for sel in selectors:
            cards = tree.css(sel)
            if cards:
                break

        for card in cards:
            try:
                job = self._parse_card(card)
                if job and job.get("title_raw"):
                    jobs.append(job)
            except Exception as e:
                logger.warning("[%s] Failed to parse card: %s", self.name, str(e)[:100])
                continue

        return jobs

    def _parse_card(self, card) -> Optional[dict]:
        """Parse a single Indeed job card into a Job-compatible dict."""
        job: dict = {
            "source": JobSource.INDEED,
            "salary_currency": "GBP",
        }

        # Title and URL
        try:
            title_el = card.css_first("h2 a, h2 span, a[data-jk]")
            if title_el:
                job["title_raw"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href:
                    if href.startswith("/"):
                        href = f"{self.base_url}{href}"
                    job["source_url"] = href

                    jk_match = re.search(r"jk=([a-f0-9]+)", href)
                    if jk_match:
                        job["source_job_id"] = jk_match.group(1)
            else:
                return None
        except Exception:
            return None

        # Also try data-jk attribute on parent
        if not job.get("source_job_id"):
            try:
                jk = card.attributes.get("data-jk", "")
                if jk:
                    job["source_job_id"] = jk
            except Exception:
                pass

        # Company name
        try:
            company_el = card.css_first(
                "span[data-testid='company-name'], span.companyName, "
                "a[data-tn-element='companyName']"
            )
            if company_el:
                job["company_name_raw"] = company_el.text(strip=True)
            else:
                job["company_name_raw"] = "Unknown"
        except Exception:
            job["company_name_raw"] = "Unknown"

        # Location
        try:
            location_el = card.css_first(
                "div[data-testid='text-location'], div.companyLocation, "
                "span.companyLocation"
            )
            if location_el:
                loc_text = location_el.text(strip=True)
                job["location_raw"] = loc_text
                job["is_remote"] = bool(re.search(r"\bremote\b", loc_text, re.I))
        except Exception:
            job["location_raw"] = None
            job["is_remote"] = False

        # Salary
        try:
            salary_el = card.css_first(
                "div[data-testid='attribute_snippet_testid'], "
                "div.salary-snippet-container, span.salary-snippet"
            )
            if salary_el:
                salary_text = salary_el.text(strip=True)
                job["salary_text_raw"] = salary_text
                self._parse_salary(job, salary_text)
        except Exception:
            pass

        # Snippet
        try:
            snippet_el = card.css_first(
                "div.job-snippet, div[data-testid='job-snippet']"
            )
            if snippet_el:
                snippet = snippet_el.text(strip=True)
                job["description_snippet"] = snippet[:500]
        except Exception:
            pass

        # Contract type detection
        try:
            metadata_el = card.css_first(
                "div.metadata, div[data-testid='attribute_snippet_testid']"
            )
            if metadata_el:
                meta_text = metadata_el.text(strip=True).lower()
                job["contract_type"] = self._detect_contract_type(meta_text)
        except Exception:
            pass

        # Posted date
        try:
            date_el = card.css_first("span.date, span[data-testid='myJobsStateDate']")
            if date_el:
                job["posted_date"] = None  # Would need date parsing
        except Exception:
            pass

        return job

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'data-jk="([^"]+)".*?<h2[^>]*>.*?<span[^>]*>([^<]+)</span>'
        for match in re.finditer(pattern, html, re.DOTALL):
            jobs.append({
                "source": JobSource.INDEED,
                "source_job_id": match.group(1),
                "title_raw": match.group(2).strip(),
                "company_name_raw": "Unknown",
                "salary_currency": "GBP",
            })
        return jobs

    def _build_search_url(self, keyword: str, location: str, start: int) -> str:
        """Build Indeed search URL."""
        params = f"q={quote_plus(keyword)}"
        if location:
            params += f"&l={quote_plus(location)}"
        if start > 0:
            params += f"&start={start}"
        return f"{self.base_url}/jobs?{params}"

    @staticmethod
    def _parse_salary(job: dict, salary_text: str) -> None:
        """Extract salary min/max from salary text."""
        if not salary_text:
            return

        # Detect period
        text_lower = salary_text.lower()
        if "year" in text_lower or "annum" in text_lower or "p.a" in text_lower:
            job["salary_period"] = "year"
        elif "month" in text_lower:
            job["salary_period"] = "month"
        elif "week" in text_lower:
            job["salary_period"] = "week"
        elif "day" in text_lower:
            job["salary_period"] = "day"
        elif "hour" in text_lower:
            job["salary_period"] = "hour"

        # Match patterns like "25,000 - 35,000" or "£25000-£35000"
        range_match = re.search(
            r"[\u00a3$]?\s*(\d[\d,]*(?:\.\d+)?)\s*[-\u2013to]+\s*[\u00a3$]?\s*(\d[\d,]*(?:\.\d+)?)",
            salary_text,
        )
        if range_match:
            job["salary_min"] = float(range_match.group(1).replace(",", ""))
            job["salary_max"] = float(range_match.group(2).replace(",", ""))
            return

        # Single value
        single_match = re.search(r"[\u00a3$]\s*(\d[\d,]*(?:\.\d+)?)", salary_text)
        if single_match:
            val = float(single_match.group(1).replace(",", ""))
            job["salary_min"] = val
            job["salary_max"] = val

    @staticmethod
    def _detect_contract_type(text: str) -> Optional[str]:
        """Detect contract type from metadata text."""
        if "permanent" in text:
            return "permanent"
        elif "contract" in text:
            return "contract"
        elif "temporary" in text or "temp" in text:
            return "temporary"
        elif "apprentice" in text:
            return "apprenticeship"
        return None

    @staticmethod
    async def _apply_stealth(page) -> None:
        """Apply stealth measures to avoid bot detection."""
        await page.add_init_script("""
            // Hide webdriver flag
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Add plugin array
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' },
                ],
            });

            // Add language
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-GB', 'en-US', 'en'],
            });

            // Hide chrome automation indicators
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {},
            };

            // Override permissions query
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);
        """)
