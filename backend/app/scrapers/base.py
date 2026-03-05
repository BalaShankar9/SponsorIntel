"""
Abstract base scraper with retry, rate limiting, and proxy support.

All scrapers inherit from BaseScraper to get consistent error handling,
anti-detection measures, and configurable throttling.
"""

import asyncio
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.scrapers.anti_detection import get_random_headers, get_random_referer, random_delay
from app.scrapers.proxy_manager import ProxyManager
from app.scrapers.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# Shared proxy manager (singleton)
_proxy_manager: Optional[ProxyManager] = None


def get_proxy_manager() -> ProxyManager:
    """Get or create the shared ProxyManager instance."""
    global _proxy_manager
    if _proxy_manager is None:
        _proxy_manager = ProxyManager()
    return _proxy_manager


class BaseScraper(ABC):
    """
    Base class for all scrapers with retry, rate limiting, and proxy support.

    Subclasses must define:
    - name: str identifier (e.g. "reed", "indeed")
    - base_url: str root URL of the target site
    - scrape(**kwargs) -> list[dict]: main scraping entry point
    - parse(html, **kwargs) -> list[dict]: HTML parsing logic
    """

    name: str = ""
    base_url: str = ""
    requests_per_minute: int = 10
    max_retries: int = 3
    use_proxy: bool = False
    use_browser: bool = False
    timeout: int = 30

    def __init__(self) -> None:
        self._rate_limiter = RateLimiter(requests_per_minute=self.requests_per_minute)
        self._proxy_manager = get_proxy_manager()

    def _get_domain(self, url: str) -> str:
        """Extract domain from URL."""
        parsed = urlparse(url)
        return parsed.netloc or parsed.hostname or self.name

    def _get_headers(self, url: str) -> dict:
        """Get randomised headers with a plausible referer."""
        headers = get_random_headers()
        domain = self._get_domain(url)
        referer = get_random_referer(domain)
        if referer:
            headers["Referer"] = referer
        return headers

    async def fetch(self, url: str, headers: dict | None = None) -> str | None:
        """
        Fetch URL with retry, rate limiting, proxy rotation, and anti-detection.

        Returns HTML string or None on failure after all retries.
        """
        await self._rate_limiter.acquire()

        request_headers = self._get_headers(url)
        if headers:
            request_headers.update(headers)

        proxy_url = None
        if self.use_proxy:
            proxy_url = self._proxy_manager.get_proxy(self._get_domain(url))

        for attempt in range(1, self.max_retries + 1):
            try:
                transport = None
                client_kwargs = {
                    "headers": request_headers,
                    "timeout": httpx.Timeout(self.timeout),
                    "follow_redirects": True,
                }
                if proxy_url:
                    client_kwargs["proxy"] = proxy_url

                async with httpx.AsyncClient(**client_kwargs) as client:
                    response = await client.get(url)

                if response.status_code == 200:
                    if proxy_url:
                        self._proxy_manager.mark_success(proxy_url)
                    return response.text

                if response.status_code == 429:
                    # Rate limited - back off longer
                    wait = 2 ** attempt * 5
                    logger.warning(
                        "[%s] Rate limited (429) on %s. Waiting %ds (attempt %d/%d)",
                        self.name, url[:80], wait, attempt, self.max_retries,
                    )
                    await asyncio.sleep(wait)
                    continue

                if response.status_code in (403, 503):
                    logger.warning(
                        "[%s] Blocked (%d) on %s (attempt %d/%d)",
                        self.name, response.status_code, url[:80], attempt, self.max_retries,
                    )
                    if proxy_url:
                        self._proxy_manager.mark_failed(proxy_url)
                        proxy_url = self._proxy_manager.get_proxy(self._get_domain(url))
                    await asyncio.sleep(2 ** attempt)
                    continue

                logger.warning(
                    "[%s] HTTP %d on %s (attempt %d/%d)",
                    self.name, response.status_code, url[:80], attempt, self.max_retries,
                )

            except httpx.TimeoutException:
                logger.warning(
                    "[%s] Timeout on %s (attempt %d/%d)",
                    self.name, url[:80], attempt, self.max_retries,
                )
            except httpx.RequestError as e:
                logger.warning(
                    "[%s] Request error on %s: %s (attempt %d/%d)",
                    self.name, url[:80], str(e)[:100], attempt, self.max_retries,
                )
                if proxy_url:
                    self._proxy_manager.mark_failed(proxy_url)
                    proxy_url = self._proxy_manager.get_proxy(self._get_domain(url))

            # Exponential backoff between retries
            if attempt < self.max_retries:
                await asyncio.sleep(2 ** attempt)

        logger.error("[%s] All %d retries exhausted for %s", self.name, self.max_retries, url[:80])
        return None

    async def fetch_with_browser(self, url: str) -> str | None:
        """
        Fetch using Playwright headless browser for JS-heavy sites.

        Launches Chromium, navigates to the URL, waits for content to load,
        and returns the rendered page HTML.
        """
        await self._rate_limiter.acquire()

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("[%s] Playwright not installed. Install with: pip install playwright", self.name)
            return None

        for attempt in range(1, self.max_retries + 1):
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    context = await browser.new_context(
                        user_agent=get_random_headers()["User-Agent"],
                        viewport={"width": 1920, "height": 1080},
                        locale="en-GB",
                    )
                    page = await context.new_page()

                    # Block unnecessary resources to speed up loading
                    await page.route(
                        "**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}",
                        lambda route: route.abort(),
                    )

                    response = await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout * 1000)

                    if response and response.status == 200:
                        # Wait for dynamic content
                        await page.wait_for_timeout(2000)
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
                await asyncio.sleep(2 ** attempt)

        logger.error("[%s] Browser fetch failed after %d attempts for %s", self.name, self.max_retries, url[:80])
        return None

    @staticmethod
    def md5_hash(content: bytes) -> str:
        """Compute MD5 hash of content bytes."""
        return hashlib.md5(content).hexdigest()

    @abstractmethod
    async def scrape(self, **kwargs) -> list[dict]:
        """Main scraping entry point. Returns list of scraped records."""
        ...

    @abstractmethod
    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse HTML and return list of structured records."""
        ...

    async def scrape_with_delay(self, **kwargs) -> list[dict]:
        """Scrape with a random delay before starting (anti-detection)."""
        await random_delay(1.0, 3.0)
        return await self.scrape(**kwargs)
