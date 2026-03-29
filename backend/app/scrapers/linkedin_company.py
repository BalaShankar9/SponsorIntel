"""
LinkedIn Company page scraper (Tier 3).

Scrapes LinkedIn company pages for employee count, industry, and other details.
Uses Playwright browser with stealth measures as LinkedIn has aggressive anti-bot.
Returns dicts with fields matching CompanyProfile model:
employee_count_estimate, linkedin_follower_count, industry, headquarters.
"""

import asyncio
import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class LinkedInCompanyScraper(BaseScraper):
    """
    Scrapes LinkedIn company pages with stealth measures.

    Extracts: employee_count_estimate, linkedin_follower_count, industry,
    headquarters, website.
    Rate limited to 2 req/min with proxy to avoid blocks.
    """

    name = "linkedin_company"
    base_url = "https://www.linkedin.com"
    requests_per_minute = 2
    use_proxy = True
    use_browser = True
    timeout = 45  # Longer timeout for LinkedIn

    async def fetch_with_browser(self, url: str) -> Optional[str]:
        """
        Override to add LinkedIn-specific stealth measures.

        Adds randomised delays, viewport jitter, scroll simulation,
        and webdriver flag masking to evade anti-bot detection.
        """
        await self._rate_limiter.acquire()

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("[%s] Playwright not installed. Install with: pip install playwright", self.name)
            return None

        from app.scrapers.anti_detection import get_random_headers

        for attempt in range(1, self.max_retries + 1):
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=[
                            "--disable-blink-features=AutomationControlled",
                            "--disable-infobars",
                            "--no-sandbox",
                            "--disable-dev-shm-usage",
                        ],
                    )

                    # Randomise viewport slightly to avoid fingerprinting
                    import random
                    width = random.randint(1280, 1920)
                    height = random.randint(800, 1080)

                    context = await browser.new_context(
                        user_agent=get_random_headers()["User-Agent"],
                        viewport={"width": width, "height": height},
                        locale="en-GB",
                        timezone_id="Europe/London",
                        geolocation={"latitude": 51.5074, "longitude": -0.1278},
                        permissions=["geolocation"],
                    )

                    page = await context.new_page()

                    # Mask webdriver flags
                    await page.add_init_script("""
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined,
                        });
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3, 4, 5],
                        });
                        Object.defineProperty(navigator, 'languages', {
                            get: () => ['en-GB', 'en-US', 'en'],
                        });
                        window.chrome = { runtime: {} };
                    """)

                    # Block unnecessary resources to speed up loading
                    await page.route(
                        "**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}",
                        lambda route: route.abort(),
                    )

                    # Add random delay before navigation
                    await asyncio.sleep(random.uniform(1.0, 3.0))

                    response = await page.goto(
                        url, wait_until="domcontentloaded", timeout=self.timeout * 1000
                    )

                    if response and response.status == 200:
                        # Simulate human scrolling behaviour
                        await page.wait_for_timeout(random.randint(2000, 4000))
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
                        await page.wait_for_timeout(random.randint(500, 1500))
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                        await page.wait_for_timeout(random.randint(500, 1000))

                        html = await page.content()
                        await browser.close()
                        return html

                    if response:
                        logger.warning(
                            "[%s] Browser got HTTP %d on %s (attempt %d/%d)",
                            self.name, response.status, url[:80], attempt, self.max_retries,
                        )

                    await browser.close()

            except Exception as e:
                logger.warning(
                    "[%s] Browser error on %s: %s (attempt %d/%d)",
                    self.name, url[:80], str(e)[:100], attempt, self.max_retries,
                )

            if attempt < self.max_retries:
                # Longer backoff for LinkedIn
                await asyncio.sleep(2 ** attempt * 3)

        logger.error("[%s] Browser fetch failed after %d attempts for %s", self.name, self.max_retries, url[:80])
        return None

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape LinkedIn company page.

        Args:
            company_url: Direct LinkedIn company URL
            company_name: Company name to search for
        """
        company_url = kwargs.get("company_url", "")
        company_name = kwargs.get("company_name", "")

        if not company_url and company_name:
            company_url = await self._search_company(company_name)

        if not company_url:
            return []

        # Ensure we're on the about page for the most data
        if "/about" not in company_url:
            about_url = company_url.rstrip("/") + "/about/"
        else:
            about_url = company_url

        html = await self.fetch_with_browser(about_url)
        if not html:
            return []

        return await self.parse(html)

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse LinkedIn company page. Returns dict with CompanyProfile fields."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return [self._parse_regex(html)]

        tree = HTMLParser(html)
        data: dict = {"source": "linkedin"}

        # Company name
        try:
            name_el = tree.css_first(
                "h1.org-top-card-summary__title, "
                "h1.top-card-layout__title, "
                "span.org-top-card-summary-info-list__info-item"
            )
            if name_el:
                data["name"] = name_el.text(strip=True)
        except Exception:
            pass

        # Description / tagline
        try:
            desc_el = tree.css_first(
                "p.org-top-card-summary__tagline, "
                "p.top-card-layout__first-subline"
            )
            if desc_el:
                data["tagline"] = desc_el.text(strip=True)
        except Exception:
            pass

        # Parse definition list items on about page
        try:
            for dl in tree.css("dl.overflow-hidden"):
                dts = dl.css("dt")
                dds = dl.css("dd")
                for dt, dd in zip(dts, dds):
                    try:
                        key = dt.text(strip=True).lower()
                        value = dd.text(strip=True)

                        if "website" in key:
                            data["website_url"] = value
                        elif "industry" in key:
                            data["industry"] = value
                            data["industry_primary"] = value
                        elif "company size" in key or "employees" in key:
                            data["employee_count_text"] = value
                            data["employee_count_source"] = "linkedin"
                            count_match = re.search(r"([\d,]+)\s*[-\u2013]\s*([\d,]+)", value)
                            if count_match:
                                low = int(count_match.group(1).replace(",", ""))
                                high = int(count_match.group(2).replace(",", ""))
                                data["employee_count_estimate"] = (low + high) // 2
                            else:
                                single = re.search(r"([\d,]+)", value)
                                if single:
                                    data["employee_count_estimate"] = int(
                                        single.group(1).replace(",", "")
                                    )
                        elif "headquarter" in key:
                            data["headquarters"] = value
                        elif "founded" in key:
                            data["founded"] = value
                        elif "type" in key:
                            data["company_type"] = value
                        elif "specialties" in key or "specialities" in key:
                            data["specialties"] = [s.strip() for s in value.split(",")]
                    except Exception as e:
                        logger.warning("[%s] Error parsing dl field: %s", self.name, str(e)[:100])
        except Exception:
            pass

        # Follower count -> linkedin_follower_count
        try:
            follower_el = tree.css_first(
                "span.org-top-card-summary-info-list__info-item:last-child, "
                "div.org-top-card-summary-info-list span"
            )
            if follower_el:
                text = follower_el.text(strip=True)
                follower_match = re.search(r"([\d,]+)\s*followers?", text, re.I)
                if follower_match:
                    data["linkedin_follower_count"] = int(follower_match.group(1).replace(",", ""))
        except Exception:
            pass

        # Fallback: also scan full page text for follower counts
        if "linkedin_follower_count" not in data:
            try:
                full_text = tree.body.text() if tree.body else ""
                follower_match = re.search(r"([\d,]+)\s*followers?", full_text, re.I)
                if follower_match:
                    data["linkedin_follower_count"] = int(follower_match.group(1).replace(",", ""))
            except Exception:
                pass

        # Extract LinkedIn URL from page
        try:
            canonical = tree.css_first("link[rel='canonical']")
            if canonical:
                href = canonical.attributes.get("href", "")
                if "linkedin.com/company" in href:
                    data["linkedin_url"] = href
        except Exception:
            pass

        return [data] if data.get("name") or data.get("industry") or data.get("employee_count_estimate") else []

    def _parse_regex(self, html: str) -> dict:
        """Fallback regex parser for LinkedIn company data."""
        data: dict = {"source": "linkedin"}

        try:
            name_match = re.search(r'"name"\s*:\s*"([^"]+)"', html)
            if name_match:
                data["name"] = name_match.group(1)
        except Exception:
            pass

        try:
            employee_match = re.search(r'"numberOfEmployees"\s*:\s*\{[^}]*"value"\s*:\s*(\d+)', html)
            if employee_match:
                data["employee_count_estimate"] = int(employee_match.group(1))
                data["employee_count_source"] = "linkedin"
        except Exception:
            pass

        try:
            follower_match = re.search(r'"followersCount"\s*:\s*(\d+)', html)
            if follower_match:
                data["linkedin_follower_count"] = int(follower_match.group(1))
        except Exception:
            pass

        try:
            industry_match = re.search(r'"industry"\s*:\s*"([^"]+)"', html)
            if industry_match:
                data["industry"] = industry_match.group(1)
                data["industry_primary"] = industry_match.group(1)
        except Exception:
            pass

        try:
            url_match = re.search(r'"url"\s*:\s*"(https?://www\.linkedin\.com/company/[^"]+)"', html)
            if url_match:
                data["linkedin_url"] = url_match.group(1)
        except Exception:
            pass

        return data

    async def _search_company(self, company_name: str) -> str:
        """Search LinkedIn for a company and return its page URL."""
        search_url = (
            f"{self.base_url}/search/results/companies/"
            f"?keywords={quote_plus(company_name)}"
        )

        html = await self.fetch_with_browser(search_url)
        if not html:
            return ""

        # Find company page link
        try:
            pattern = r'href="(/company/[^/"]+/?)"'
            match = re.search(pattern, html)
            if match:
                return f"{self.base_url}{match.group(1)}"
        except Exception:
            pass

        return ""
