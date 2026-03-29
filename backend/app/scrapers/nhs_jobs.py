"""
NHS Jobs scraper (Tier 2).

Scrapes job listings from the NHS Jobs website.
Tries HTTP first for speed, falls back to Playwright if content is missing.
NHS pages are well-structured with band/grade salary information.
"""

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import quote_plus

from app.models.enums import JobSource
from app.scrapers.anti_detection import get_random_headers, random_delay
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

# NHS Agenda for Change pay bands (2024/25 approximate ranges)
NHS_PAY_BANDS = {
    "1": (22_383, 22_383),
    "2": (22_383, 24_336),
    "3": (24_336, 25_764),
    "4": (26_530, 29_114),
    "5": (29_970, 36_483),
    "6": (37_338, 44_962),
    "7": (46_148, 52_809),
    "8a": (53_755, 60_504),
    "8b": (62_215, 72_293),
    "8c": (73_664, 86_074),
    "8d": (87_545, 101_053),
    "9": (105_385, 121_271),
}


class NHSJobsScraper(BaseScraper):
    """
    Scrapes job listings from NHS Jobs.

    Parses: title, employer (NHS Trust), location, salary band/grade,
    closing date. Tries plain HTTP first, falls back to Playwright
    if critical content selectors are missing.
    """

    name = "nhs_jobs"
    base_url = "https://www.jobs.nhs.uk"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False  # HTTP first, browser fallback

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape NHS Jobs listings.

        Args:
            keyword: Search keyword (required)
            pages: Number of pages (default 3)
        """
        keyword = kwargs.get("keyword", "")
        pages = kwargs.get("pages", 3)

        if not keyword:
            logger.warning("[%s] No keyword provided", self.name)
            return []

        all_jobs: list[dict] = []

        for page_num in range(1, pages + 1):
            url = self._build_search_url(keyword, page_num)

            # Strategy 1: Try HTTP first (faster)
            html = await self.fetch(url)

            # Check if the content is actually rendered
            if html and not self._has_job_content(html):
                logger.info(
                    "[%s] HTTP response missing job content on page %d, trying Playwright",
                    self.name, page_num,
                )
                html = None

            # Strategy 2: Fall back to Playwright
            if not html:
                html = await self._fetch_with_playwright_stealth(url)

            if not html:
                logger.warning("[%s] Failed to fetch page %d", self.name, page_num)
                break

            jobs = await self.parse(html)
            if not jobs:
                break
            all_jobs.extend(jobs)

            # Gaussian delay between pages
            if page_num < pages:
                await random_delay(1.5, 3.5)

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    def _has_job_content(self, html: str) -> bool:
        """Check if the HTML actually contains rendered job listings."""
        # Look for common NHS Jobs content markers
        markers = [
            "search-result",
            "vacancy",
            "jobadvert",
            "search-results",
            "nhsuk-card",
            "results-list",
        ]
        html_lower = html.lower()
        return any(marker in html_lower for marker in markers)

    async def _fetch_with_playwright_stealth(self, url: str) -> Optional[str]:
        """Fetch using Playwright with stealth for when HTTP fails."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("[%s] Playwright not installed for fallback", self.name)
            return None

        await self._rate_limiter.acquire()

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent=get_random_headers()["User-Agent"],
                    viewport={"width": 1920, "height": 1080},
                    locale="en-GB",
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

                if not response or response.status != 200:
                    logger.warning(
                        "[%s] Playwright HTTP %s",
                        self.name, response.status if response else "None",
                    )
                    await browser.close()
                    return None

                # Wait for job results
                try:
                    await page.wait_for_selector(
                        "li.vacancy, div.vacancy-card, ul.search-results li, "
                        "div.search-result, div.nhsuk-card, "
                        "ul.results-list li",
                        timeout=10000,
                    )
                except Exception:
                    logger.warning("[%s] Playwright: no job results selector found", self.name)

                # Accept cookies if prompted
                try:
                    cookie_btn = await page.query_selector(
                        "button#CookieAcceptAll, button[data-test='cookie-accept'], "
                        "button.nhsuk-cookie-banner__link--accept"
                    )
                    if cookie_btn and await cookie_btn.is_visible():
                        await cookie_btn.click()
                        await random_delay(0.3, 0.8)
                except Exception:
                    pass

                html = await page.content()
                await browser.close()
                return html

        except Exception as e:
            logger.error("[%s] Playwright fallback error: %s", self.name, str(e)[:200])
            return None

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse NHS Jobs search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        # NHS Jobs uses various card/list formats
        card_selectors = [
            "li.vacancy",
            "div.vacancy-card",
            "ul.search-results li",
            "div.search-result",
            "div.nhsuk-card",
            "ul.results-list li",
        ]

        cards = []
        for sel in card_selectors:
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
        """Parse a single NHS Jobs card into a Job-compatible dict."""
        job: dict = {
            "source": JobSource.NHS_JOBS,
            "salary_currency": "GBP",
        }

        # Title and URL
        try:
            title_el = card.css_first(
                "h2 a, h3 a, a.vacancy-title, "
                "a.nhsuk-card__link, a[data-test='job-title']"
            )
            if title_el:
                job["title_raw"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["source_url"] = href

                # Extract job ID
                id_match = re.search(r"/jobadvert/([A-Za-z0-9\-]+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)
            else:
                return None
        except Exception:
            return None

        # Employer (NHS Trust)
        try:
            employer_el = card.css_first(
                "span.employer, p.employer-name, "
                "span.vacancy-employer, dd.employer, "
                "p.nhsuk-card__description, "
                "span[data-test='employer-name']"
            )
            if employer_el:
                job["company_name_raw"] = employer_el.text(strip=True)
            else:
                # Fallback: try text parsing
                card_text = card.text()
                emp_match = re.search(
                    r"(?:Employer|Organisation|Trust):\s*(.+?)(?:\n|$)", card_text, re.I
                )
                if emp_match:
                    job["company_name_raw"] = emp_match.group(1).strip()
                else:
                    job["company_name_raw"] = "NHS"
        except Exception:
            job["company_name_raw"] = "NHS"

        # Location
        try:
            location_el = card.css_first(
                "span.location, p.location, dd.location, "
                "span[data-test='location']"
            )
            if location_el:
                loc_text = location_el.text(strip=True)
                job["location_raw"] = loc_text
                job["is_remote"] = bool(re.search(r"\bremote\b", loc_text, re.I))
            else:
                # Fallback text parsing
                card_text = card.text()
                loc_match = re.search(r"Location:\s*(.+?)(?:\n|$)", card_text, re.I)
                if loc_match:
                    job["location_raw"] = loc_match.group(1).strip()
                else:
                    job["location_raw"] = None
                job["is_remote"] = False
        except Exception:
            job["location_raw"] = None
            job["is_remote"] = False

        # Salary / Pay band
        try:
            salary_el = card.css_first(
                "span.salary, p.salary, dd.salary, span.pay-scheme, "
                "span[data-test='salary']"
            )
            if salary_el:
                salary_text = salary_el.text(strip=True)
                job["salary_text_raw"] = salary_text
                self._parse_nhs_salary(job, salary_text)
            else:
                # Fallback text parsing for band info
                card_text = card.text()
                band_match = re.search(
                    r"(?:Band|Grade|AFC)\s*:?\s*(\d+[a-d]?)", card_text, re.I
                )
                if band_match:
                    band = band_match.group(1).lower()
                    job["salary_text_raw"] = f"Band {band}"
                    self._parse_nhs_salary(job, job["salary_text_raw"])

                sal_match = re.search(
                    r"(?:Salary|Pay):\s*(.+?)(?:\n|$)", card_text, re.I
                )
                if sal_match and not job.get("salary_text_raw"):
                    salary_text = sal_match.group(1).strip()
                    job["salary_text_raw"] = salary_text
                    self._parse_nhs_salary(job, salary_text)
        except Exception:
            pass

        # Closing date
        try:
            closing_el = card.css_first(
                "span.closing-date, p.closing-date, dd.closing-date, "
                "span[data-test='closing-date']"
            )
            if closing_el:
                closing_text = closing_el.text(strip=True)
                # Try to parse date
                for fmt in ("%d/%m/%Y", "%d %B %Y", "%d %b %Y", "%Y-%m-%d"):
                    try:
                        # Extract just the date part
                        date_match = re.search(
                            r"(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})",
                            closing_text,
                        )
                        if date_match:
                            job["posted_date"] = datetime.strptime(
                                date_match.group(1), fmt
                            )
                            break
                    except ValueError:
                        continue
        except Exception:
            pass

        # Contract type
        try:
            contract_el = card.css_first(
                "span.contract-type, dd.contract-type, "
                "span[data-test='contract-type']"
            )
            if contract_el:
                contract_text = contract_el.text(strip=True).lower()
                job["contract_type"] = self._detect_contract_type(contract_text)
            else:
                card_text = card.text().lower()
                if "permanent" in card_text:
                    job["contract_type"] = "permanent"
                elif "fixed term" in card_text or "fixed-term" in card_text:
                    job["contract_type"] = "contract"
                elif "temporary" in card_text:
                    job["contract_type"] = "temporary"
        except Exception:
            pass

        # Seniority from title and band
        try:
            job["seniority"] = self._detect_seniority(
                job.get("title_raw", ""),
                job.get("salary_text_raw", ""),
            )
        except Exception:
            pass

        return job

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'<a[^>]*href="(/candidate/jobadvert/[^"]*)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html, re.I):
            jobs.append({
                "source": JobSource.NHS_JOBS,
                "title_raw": match.group(2).strip(),
                "source_url": f"{self.base_url}{match.group(1)}",
                "company_name_raw": "NHS",
                "salary_currency": "GBP",
            })
        return jobs

    def _build_search_url(self, keyword: str, page: int) -> str:
        """Build NHS Jobs search URL."""
        params = f"keyword={quote_plus(keyword)}"
        if page > 1:
            params += f"&page={page}"
        return f"{self.base_url}/candidate/search/results?{params}"

    @staticmethod
    def _parse_nhs_salary(job: dict, salary_text: str) -> None:
        """
        Parse NHS salary text, handling band/grade references.

        NHS salaries are typically expressed as AfC (Agenda for Change) bands
        like "Band 5" or explicit ranges like "£29,970 - £36,483 a year".
        """
        if not salary_text:
            return

        job["salary_period"] = "year"  # NHS salaries are almost always annual

        # Try to match band reference
        band_match = re.search(r"(?:Band|AFC)\s*(\d+[a-d]?)", salary_text, re.I)
        if band_match:
            band = band_match.group(1).lower()
            if band in NHS_PAY_BANDS:
                job["salary_min"] = float(NHS_PAY_BANDS[band][0])
                job["salary_max"] = float(NHS_PAY_BANDS[band][1])
                return

        # Try explicit salary range
        range_match = re.search(
            r"[\u00a3]?\s*(\d[\d,]*(?:\.\d+)?)\s*[-\u2013to]+\s*[\u00a3]?\s*(\d[\d,]*(?:\.\d+)?)",
            salary_text,
        )
        if range_match:
            job["salary_min"] = float(range_match.group(1).replace(",", ""))
            job["salary_max"] = float(range_match.group(2).replace(",", ""))
            return

        # Single value
        single_match = re.search(r"[\u00a3]\s*(\d[\d,]*(?:\.\d+)?)", salary_text)
        if single_match:
            val = float(single_match.group(1).replace(",", ""))
            job["salary_min"] = val
            job["salary_max"] = val

    @staticmethod
    def _detect_contract_type(text: str) -> Optional[str]:
        """Detect contract type from text."""
        if "permanent" in text:
            return "permanent"
        elif "fixed term" in text or "fixed-term" in text or "contract" in text:
            return "contract"
        elif "temporary" in text or "bank" in text:
            return "temporary"
        elif "apprentice" in text or "trainee" in text:
            return "apprenticeship"
        return None

    @staticmethod
    def _detect_seniority(title: str, salary_text: str = "") -> Optional[str]:
        """Detect seniority from job title and NHS band."""
        title_lower = title.lower()
        salary_lower = salary_text.lower()

        # Band-based seniority
        band_match = re.search(r"band\s*(\d+)", salary_lower)
        if band_match:
            band_num = int(band_match.group(1))
            if band_num <= 3:
                return "entry"
            elif band_num <= 5:
                return "mid"
            elif band_num <= 7:
                return "senior"
            elif band_num <= 8:
                return "lead"
            else:
                return "director"

        # Title-based
        if any(w in title_lower for w in ("consultant", "director", "chief")):
            return "director"
        elif any(w in title_lower for w in ("lead", "principal", "head of", "manager")):
            return "lead"
        elif any(w in title_lower for w in ("senior", "specialist", "advanced")):
            return "senior"
        elif any(w in title_lower for w in ("junior", "trainee", "apprentice", "assistant")):
            return "entry"
        return "mid"

    @staticmethod
    async def _apply_stealth(page) -> None:
        """Apply stealth measures for Playwright fallback."""
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

            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-GB', 'en-US', 'en'],
            });

            // Chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {},
            };
        """)
