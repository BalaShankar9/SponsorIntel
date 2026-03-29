"""
Glassdoor Jobs scraper (Tier 2).

Scrapes job listings from Glassdoor UK using Playwright browser.
Handles cookie consent modals and dynamic JS-rendered content.
"""

import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.models.enums import JobSource
from app.scrapers.anti_detection import get_random_headers, random_delay
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class GlassdoorJobsScraper(BaseScraper):
    """
    Scrapes job listings from Glassdoor UK.

    Uses Playwright headless browser — Glassdoor requires JS rendering and
    frequently shows cookie consent banners that must be dismissed.
    """

    name = "glassdoor"
    base_url = "https://www.glassdoor.co.uk"
    requests_per_minute = 3
    use_proxy = True
    use_browser = True

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape Glassdoor job listings using Playwright with stealth.

        Args:
            keyword: Search keyword (required)
            pages: Number of pages (default 2)
        """
        keyword = kwargs.get("keyword", "")
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

                for page_num in range(1, pages + 1):
                    url = self._build_search_url(keyword, page_num)

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
                                page_num,
                            )
                            break

                        # Handle cookie consent banner
                        await self._dismiss_cookie_consent(page)

                        # Wait for job listings to render
                        try:
                            await page.wait_for_selector(
                                "li.JobsList_jobListItem__wjTHv, "
                                "li[data-test='jobListing'], "
                                "li.react-job-listing, "
                                "div.job-listing",
                                timeout=10000,
                            )
                        except Exception:
                            logger.warning("[%s] No job cards found on page %d", self.name, page_num)
                            break

                        # Scroll to load all cards
                        for _ in range(3):
                            await page.evaluate("window.scrollBy(0, 600)")
                            await random_delay(0.5, 1.0)

                        html = await page.content()
                        jobs = await self.parse(html)

                        if not jobs:
                            break
                        all_jobs.extend(jobs)

                    except Exception as e:
                        logger.warning(
                            "[%s] Error on page %d: %s", self.name, page_num, str(e)[:200]
                        )
                        break

                    # Gaussian delay between pages
                    if page_num < pages:
                        await random_delay(2.0, 5.0)

                    # Try click-to-next pagination if URL pagination fails
                    if page_num < pages:
                        try:
                            next_btn = await page.query_selector(
                                "button[data-test='pagination-next'], "
                                "a.nextButton, "
                                "button.nextButton"
                            )
                            if next_btn and await next_btn.is_visible():
                                await next_btn.click()
                                await random_delay(2.0, 4.0)
                        except Exception:
                            pass

                await browser.close()

        except Exception as e:
            logger.error("[%s] Browser session error: %s", self.name, str(e)[:200])

        logger.info("[%s] Scraped %d jobs for '%s'", self.name, len(all_jobs), keyword)
        return all_jobs

    async def _dismiss_cookie_consent(self, page) -> None:
        """Dismiss Glassdoor cookie consent banner if present."""
        cookie_selectors = [
            "button#onetrust-accept-btn-handler",
            "button[data-test='cookie-accept']",
            "button.cookie-accept",
            "button[id*='accept']",
            "button[class*='accept']",
        ]
        for selector in cookie_selectors:
            try:
                btn = await page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    await random_delay(0.5, 1.0)
                    logger.debug("[%s] Dismissed cookie consent", self.name)
                    return
            except Exception:
                continue

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse Glassdoor jobs search results."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_regex(html)

        tree = HTMLParser(html)
        jobs = []

        for card in tree.css(
            "li.JobsList_jobListItem__wjTHv, "
            "li[data-test='jobListing'], "
            "li.react-job-listing, "
            "div.job-listing"
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
        """Parse a single Glassdoor job card into a Job-compatible dict."""
        job: dict = {
            "source": JobSource.GLASSDOOR,
            "salary_currency": "GBP",
        }

        # Title and URL
        try:
            title_el = card.css_first(
                "a.JobCard_jobTitle__GLyJ1, "
                "a[data-test='job-link'], "
                "a.jobLink, "
                "a.job-search-key-1hob5d"
            )
            if title_el:
                job["title_raw"] = title_el.text(strip=True)
                href = title_el.attributes.get("href", "")
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                job["source_url"] = href

                # Extract job ID
                id_match = re.search(r"jobListingId=(\d+)", href)
                if not id_match:
                    id_match = re.search(r"JV_IC\d+_KO\d+_KE\d+_IP\d+_(\d+)", href)
                if not id_match:
                    id_match = re.search(r"-jl(\d+)", href)
                if id_match:
                    job["source_job_id"] = id_match.group(1)
            else:
                return None
        except Exception:
            return None

        # Company name
        try:
            company_el = card.css_first(
                "span.EmployerProfile_compactEmployerName__9MGcV, "
                "a[data-test='employer-short-name'], "
                "div.jobHeader span.employerName, "
                "div.EmployerProfile_employerName__Xemli"
            )
            if company_el:
                # Remove rating number sometimes appended to company name
                company_text = company_el.text(strip=True)
                company_text = re.sub(r"\d+\.\d+$", "", company_text).strip()
                job["company_name_raw"] = company_text
            else:
                job["company_name_raw"] = "Unknown"
        except Exception:
            job["company_name_raw"] = "Unknown"

        # Location
        try:
            location_el = card.css_first(
                "div.JobCard_location__Ds1fM, "
                "span[data-test='emp-location'], "
                "span.loc, "
                "div.d-flex.align-items-center span"
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

        # Salary estimate
        try:
            salary_el = card.css_first(
                "div.JobCard_salaryEstimate__QpbTW, "
                "span[data-test='detailSalary'], "
                "span.salary-estimate, "
                "div.SalaryEstimate"
            )
            if salary_el:
                salary_text = salary_el.text(strip=True)
                job["salary_text_raw"] = salary_text
                self._parse_salary(job, salary_text)
        except Exception:
            pass

        # Company rating
        try:
            rating_el = card.css_first(
                "span.JobCard_ratingText__jf3Ks, "
                "span[data-test='rating'], "
                "span.compactStarRating"
            )
            if rating_el:
                try:
                    float(rating_el.text(strip=True))
                except ValueError:
                    pass
        except Exception:
            pass

        # Description snippet (sometimes available on cards)
        try:
            snippet_el = card.css_first(
                "div.JobCard_jobDescriptionSnippet__l0hkm, "
                "div[data-test='descSnippet']"
            )
            if snippet_el:
                snippet = snippet_el.text(strip=True)
                job["description_snippet"] = snippet[:500]
        except Exception:
            pass

        # Contract type
        try:
            type_el = card.css_first(
                "div.JobCard_jobType__nudLY, "
                "span[data-test='job-type']"
            )
            if type_el:
                type_text = type_el.text(strip=True).lower()
                job["contract_type"] = self._detect_contract_type(type_text)
        except Exception:
            pass

        # Seniority from title
        try:
            job["seniority"] = self._detect_seniority(job.get("title_raw", ""))
        except Exception:
            pass

        return job

    def _parse_regex(self, html: str) -> list[dict]:
        """Fallback regex parser."""
        jobs = []
        pattern = r'class="[^"]*jobTitle[^"]*"[^>]*>([^<]+)'
        for match in re.finditer(pattern, html, re.I):
            jobs.append({
                "source": JobSource.GLASSDOOR,
                "title_raw": match.group(1).strip(),
                "company_name_raw": "Unknown",
                "salary_currency": "GBP",
            })
        return jobs

    def _build_search_url(self, keyword: str, page: int) -> str:
        """
        Build Glassdoor jobs search URL.

        Format: /Job/united-kingdom-{keyword}-jobs-SRCH_IL.0,14_IN2_KO15,{len}.htm
        Falls back to query-param format for reliability.
        """
        keyword_slug = keyword.lower().replace(" ", "-")
        keyword_len = 15 + len(keyword)

        # Try the SEO-friendly URL format
        url = (
            f"{self.base_url}/Job/united-kingdom-{keyword_slug}-jobs-"
            f"SRCH_IL.0,14_IN2_KO15,{keyword_len}.htm"
        )
        if page > 1:
            url = url.replace(".htm", f"_IP{page}.htm")
        return url

    @staticmethod
    def _parse_salary(job: dict, salary_text: str) -> None:
        """Extract salary min/max from Glassdoor salary estimate text."""
        if not salary_text:
            return

        text_lower = salary_text.lower()
        if "year" in text_lower or "annum" in text_lower or "p.a" in text_lower or "/yr" in text_lower:
            job["salary_period"] = "year"
        elif "month" in text_lower or "/mo" in text_lower:
            job["salary_period"] = "month"
        elif "hour" in text_lower or "/hr" in text_lower:
            job["salary_period"] = "hour"

        # Glassdoor often shows "£30K - £40K" or "£30,000 - £40,000"
        # Handle K suffix
        k_range = re.search(
            r"[\u00a3$\u20ac]?\s*(\d+(?:\.\d+)?)\s*[Kk]\s*[-\u2013to]+\s*[\u00a3$\u20ac]?\s*(\d+(?:\.\d+)?)\s*[Kk]",
            salary_text,
        )
        if k_range:
            job["salary_min"] = float(k_range.group(1)) * 1000
            job["salary_max"] = float(k_range.group(2)) * 1000
            return

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
    def _detect_contract_type(text: str) -> Optional[str]:
        """Detect contract type from text."""
        if "permanent" in text or "full-time" in text:
            return "permanent"
        elif "contract" in text:
            return "contract"
        elif "temporary" in text or "temp" in text:
            return "temporary"
        elif "apprentice" in text or "intern" in text:
            return "apprenticeship"
        return None

    @staticmethod
    def _detect_seniority(title: str) -> Optional[str]:
        """Detect seniority level from job title."""
        title_lower = title.lower()
        if any(w in title_lower for w in ("director", "vp", "vice president", "cto", "cfo", "ceo")):
            return "director"
        elif any(w in title_lower for w in ("head of", "principal", "lead")):
            return "lead"
        elif any(w in title_lower for w in ("senior", "sr.", "sr ")):
            return "senior"
        elif any(w in title_lower for w in ("junior", "jr.", "jr ", "graduate", "entry", "trainee")):
            return "entry"
        elif any(w in title_lower for w in ("mid", "intermediate")):
            return "mid"
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

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);
        """)
