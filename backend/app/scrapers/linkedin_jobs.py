"""
LinkedIn Jobs scraper (Tier 2).

Scrapes job listings from LinkedIn's public jobs search.
Uses curl_cffi for TLS fingerprinting first, falls back to Playwright.
Most aggressive anti-bot detection of all scrapers.
"""

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.models.enums import JobSource
from app.scrapers.anti_detection import get_random_headers, random_delay
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class LinkedInJobsScraper(BaseScraper):
    """
    Scrapes job listings from LinkedIn's public job search pages.

    Strategy: Try curl_cffi with TLS fingerprinting first (faster, less
    detectable). Fall back to Playwright with full stealth if curl_cffi
    fails or is not installed. Implements graceful degradation — returns
    partial results if blocked mid-scrape.
    """

    name = "linkedin"
    base_url = "https://www.linkedin.com"
    requests_per_minute = 2
    use_proxy = True
    use_browser = True
    max_retries = 2  # LinkedIn blocks quickly; fewer retries

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape LinkedIn job listings.

        Args:
            keyword: Search keyword (required)
            location: Location filter (default "United Kingdom")
            pages: Number of pages (default 2)
        """
        keyword = kwargs.get("keyword", "")
        location = kwargs.get("location", "United Kingdom")
        pages = kwargs.get("pages", 2)

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        all_jobs: list[dict] = []

        for page_num in range(pages):
            start = page_num * 25
            url = self._build_search_url(keyword, location, start)

            # Strategy 1: Try curl_cffi with TLS fingerprinting
            html = await self._fetch_with_curl_cffi(url)

            # Strategy 2: Fall back to Playwright
            if not html:
                logger.info("[%s] curl_cffi failed, trying Playwright for page %d", self.name, page_num + 1)
                html = await self._fetch_with_playwright(url)

            if not html:
                logger.warning("[%s] All fetch methods failed on page %d — returning partial results", self.name, page_num + 1)
                break

            jobs = await self.parse(html)
            if not jobs:
                logger.info("[%s] No jobs parsed from page %d", self.name, page_num + 1)
                break

            all_jobs.extend(jobs)

            # Gaussian delay between pages
            if page_num < pages - 1:
                await random_delay(3.0, 7.0)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def _fetch_with_curl_cffi(self, url: str) -> Optional[str]:
        """Fetch using curl_cffi with Chrome TLS fingerprinting."""
        try:
            from curl_cffi.requests import AsyncSession
        except ImportError:
            logger.debug("[%s] curl_cffi not installed, skipping", self.name)
            return None

        await self._rate_limiter.acquire()
        headers = get_random_headers()

        for attempt in range(1, self.max_retries + 1):
            try:
                async with AsyncSession() as session:
                    response = await session.get(
                        url,
                        headers=headers,
                        impersonate="chrome120",
                        timeout=self.timeout,
                        allow_redirects=True,
                    )

                    if response.status_code == 200:
                        return response.text

                    if response.status_code in (429, 999):
                        # LinkedIn uses 999 for bot detection
                        logger.warning(
                            "[%s] curl_cffi blocked (%d) on attempt %d/%d",
                            self.name, response.status_code, attempt, self.max_retries,
                        )
                        await asyncio.sleep(2 ** attempt * 3)
                        continue

                    logger.warning(
                        "[%s] curl_cffi HTTP %d on attempt %d/%d",
                        self.name, response.status_code, attempt, self.max_retries,
                    )

            except Exception as e:
                logger.warning(
                    "[%s] curl_cffi error: %s (attempt %d/%d)",
                    self.name, str(e)[:100], attempt, self.max_retries,
                )

            if attempt < self.max_retries:
                await asyncio.sleep(2 ** attempt)

        return None

    async def _fetch_with_playwright(self, url: str) -> Optional[str]:
        """Fetch using Playwright with full stealth measures."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("[%s] Playwright not installed", self.name)
            return None

        await self._rate_limiter.acquire()

        for attempt in range(1, self.max_retries + 1):
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    context = await browser.new_context(
                        user_agent=get_random_headers()["User-Agent"],
                        viewport={"width": 1920, "height": 1080},
                        locale="en-GB",
                        java_script_enabled=True,
                    )
                    page = await context.new_page()

                    # Apply stealth
                    await self._apply_stealth(page)

                    # Block heavy resources
                    await page.route(
                        "**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}",
                        lambda route: route.abort(),
                    )

                    response = await page.goto(
                        url, wait_until="domcontentloaded", timeout=self.timeout * 1000
                    )

                    if not response or response.status not in (200, 302):
                        logger.warning(
                            "[%s] Playwright HTTP %s (attempt %d/%d)",
                            self.name,
                            response.status if response else "None",
                            attempt,
                            self.max_retries,
                        )
                        await browser.close()
                        if attempt < self.max_retries:
                            await asyncio.sleep(2 ** attempt * 2)
                        continue

                    # Wait for job cards
                    try:
                        await page.wait_for_selector(
                            "div.base-card, li.jobs-search-results__list-item, "
                            "div.job-search-card",
                            timeout=10000,
                        )
                    except Exception:
                        logger.warning("[%s] Job card selector timeout", self.name)

                    # Scroll down to trigger lazy loading
                    for _ in range(3):
                        await page.evaluate("window.scrollBy(0, 800)")
                        await random_delay(0.5, 1.5)

                    html = await page.content()
                    await browser.close()
                    return html

            except Exception as e:
                logger.warning(
                    "[%s] Playwright error: %s (attempt %d/%d)",
                    self.name, str(e)[:100], attempt, self.max_retries,
                )

            if attempt < self.max_retries:
                await asyncio.sleep(2 ** attempt)

        return None

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse LinkedIn jobs search results."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "div.base-card, li.jobs-search-results__list-item, "
            "div.job-search-card"
        ):
            try:
                job = self._parse_card(card)
                if job and job.get("title_raw"):
                    jobs.append(job)
            except Exception as e:
                logger.warning("[%s] Failed to parse card: %s", self.name, str(e)[:100])
                continue

        return jobs

    def _parse_card(self, card) -> Optional[dict]:
        """Parse a single LinkedIn job card into a Job-compatible dict."""
        job: dict = {
            "source": JobSource.LINKEDIN,
            "salary_currency": "GBP",
        }

        # Title
        try:
            title_el = card.css_first(
                "h3.base-search-card__title, h3.job-search-card__title, "
                "a.base-card__full-link"
            )
            if title_el:
                job["title_raw"] = title_el.text(strip=True)
            else:
                return None
        except Exception:
            return None

        # URL and source_job_id
        try:
            link_el = card.css_first("a.base-card__full-link, a[data-tracking-control-name]")
            if link_el:
                href = link_el.attributes.get("href", "")
                job["source_url"] = href.split("?")[0] if href else ""

                id_match = re.search(r"/view/[^/]+-(\d+)", href)
                if not id_match:
                    id_match = re.search(r"currentJobId=(\d+)", href)
                if not id_match:
                    id_match = re.search(r"-(\d+)\?", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)
        except Exception:
            job["source_url"] = None

        # Company
        try:
            company_el = card.css_first(
                "h4.base-search-card__subtitle, a.job-search-card__subtitle-link, "
                "a.hidden-nested-link"
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
                "span.job-search-card__location, span.base-search-card__metadata"
            )
            if location_el:
                loc_text = location_el.text(strip=True)
                job["location_raw"] = loc_text
                job["is_remote"] = bool(re.search(r"\bremote\b", loc_text, re.I))
            else:
                job["location_raw"] = None
                job["is_remote"] = False
        except Exception:
            job["location_raw"] = None
            job["is_remote"] = False

        # Posted date
        try:
            date_el = card.css_first("time")
            if date_el:
                datetime_val = date_el.attributes.get("datetime", "")
                if datetime_val:
                    from datetime import datetime
                    try:
                        job["posted_date"] = datetime.fromisoformat(datetime_val.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        job["posted_date"] = None
        except Exception:
            job["posted_date"] = None

        # LinkedIn public search rarely shows salary, but try
        try:
            salary_el = card.css_first("span.job-search-card__salary-info")
            if salary_el:
                salary_text = salary_el.text(strip=True)
                job["salary_text_raw"] = salary_text
                self._parse_salary(job, salary_text)
        except Exception:
            pass

        # Seniority from title
        try:
            job["seniority"] = self._detect_seniority(job.get("title_raw", ""))
        except Exception:
            pass

        # Contract type from badges
        try:
            badge_el = card.css_first("span.result-benefits__text")
            if badge_el:
                badge_text = badge_el.text(strip=True).lower()
                job["contract_type"] = self._detect_contract_type(badge_text)
        except Exception:
            pass

        return job

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'class="base-search-card__title[^"]*"[^>]*>([^<]+)'
        for match in re.finditer(pattern, html):
            jobs.append({
                "source": JobSource.LINKEDIN,
                "title_raw": match.group(1).strip(),
                "company_name_raw": "Unknown",
                "salary_currency": "GBP",
            })
        return jobs

    def _build_search_url(self, keyword: str, location: str, start: int) -> str:
        """Build LinkedIn jobs search URL."""
        params = f"keywords={quote_plus(keyword)}"
        if location:
            params += f"&location={quote_plus(location)}"
        if start > 0:
            params += f"&start={start}"
        return f"{self.base_url}/jobs/search/?{params}"

    @staticmethod
    def _parse_salary(job: dict, salary_text: str) -> None:
        """Extract salary min/max from salary text."""
        if not salary_text:
            return

        text_lower = salary_text.lower()
        if "year" in text_lower or "annum" in text_lower or "p.a" in text_lower:
            job["salary_period"] = "year"
        elif "month" in text_lower:
            job["salary_period"] = "month"
        elif "hour" in text_lower:
            job["salary_period"] = "hour"

        range_match = re.search(
            r"[\u00a3$\u20ac]?\s*(\d[\d,]*(?:\.\d+)?)\s*[-\u2013to]+\s*[\u00a3$\u20ac]?\s*(\d[\d,]*(?:\.\d+)?)",
            salary_text,
        )
        if range_match:
            job["salary_min"] = float(range_match.group(1).replace(",", ""))
            job["salary_max"] = float(range_match.group(2).replace(",", ""))
            return

        single_match = re.search(r"[\u00a3$\u20ac]\s*(\d[\d,]*(?:\.\d+)?)", salary_text)
        if single_match:
            val = float(single_match.group(1).replace(",", ""))
            job["salary_min"] = val
            job["salary_max"] = val

    @staticmethod
    def _detect_seniority(title: str) -> Optional[str]:
        """Detect seniority level from job title."""
        title_lower = title.lower()
        if any(w in title_lower for w in ("director", "vp", "vice president")):
            return "director"
        elif any(w in title_lower for w in ("head of", "principal", "lead")):
            return "lead"
        elif any(w in title_lower for w in ("senior", "sr.", "sr ")):
            return "senior"
        elif any(w in title_lower for w in ("junior", "jr.", "jr ", "graduate", "entry")):
            return "entry"
        elif any(w in title_lower for w in ("mid", "intermediate")):
            return "mid"
        return None

    @staticmethod
    def _detect_contract_type(text: str) -> Optional[str]:
        """Detect contract type from text."""
        if "permanent" in text:
            return "permanent"
        elif "contract" in text:
            return "contract"
        elif "temporary" in text or "temp " in text:
            return "temporary"
        elif "apprentice" in text:
            return "apprenticeship"
        return None

    @staticmethod
    async def _apply_stealth(page) -> None:
        """Apply aggressive stealth measures for LinkedIn."""
        await page.add_init_script("""
            // Hide webdriver flag
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Add realistic plugin array
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' },
                ],
            });

            // Set languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-GB', 'en-US', 'en'],
            });

            // Chrome runtime object
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: { isInstalled: false },
            };

            // Override permissions query
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);

            // Mask headless indicators
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8,
            });
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8,
            });

            // Fake WebGL vendor/renderer
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter.call(this, parameter);
            };
        """)
