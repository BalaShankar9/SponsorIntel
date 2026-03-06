"""
Website analyser (Tier 3).

Analyses company websites for basic legitimacy signals:
responsiveness, careers page, social media links, SSL validity.
"""

import logging
import re
import ssl
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

from app.scrapers.anti_detection import get_random_headers
from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

CAREERS_PATHS = [
    "/careers", "/jobs", "/vacancies", "/join-us", "/work-with-us",
    "/opportunities", "/hiring", "/recruitment", "/career",
    "/join-our-team", "/work-for-us",
]

SOCIAL_PATTERNS = {
    "linkedin": r'https?://(?:www\.)?linkedin\.com/company/[^"\'>\s]+',
    "twitter": r'https?://(?:www\.)?(?:twitter|x)\.com/[^"\'>\s]+',
    "facebook": r'https?://(?:www\.)?facebook\.com/[^"\'>\s]+',
    "instagram": r'https?://(?:www\.)?instagram\.com/[^"\'>\s]+',
    "youtube": r'https?://(?:www\.)?youtube\.com/[^"\'>\s]+',
    "github": r'https?://(?:www\.)?github\.com/[^"\'>\s]+',
}


class WebsiteAnalyser(BaseScraper):
    """
    Analyses a company website for legitimacy signals.

    Checks: responsiveness, careers page presence, social media links,
    SSL certificate validity.
    """

    name = "website_analyser"
    base_url = ""
    requests_per_minute = 10
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Analyse a company website.

        Args:
            url: Website URL to analyse (required)
        """
        url = kwargs.get("url", "")
        if not url:
            return []

        result = await self.analyse_website(url)
        return [result]

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse website HTML for signals."""
        url = kwargs.get("url", "")
        return [self._extract_signals(html, url)]

    async def analyse_website(self, url: str) -> dict:
        """
        Full website analysis.

        Returns dict with:
        - is_reachable: bool
        - status_code: int
        - has_careers_page: bool
        - careers_url: str or None
        - social_links: dict of platform -> URL
        - has_ssl: bool
        - ssl_valid: bool
        - redirect_url: final URL after redirects
        """
        # Normalise URL
        if not url.startswith("http"):
            url = f"https://{url}"

        result: dict = {
            "url": url,
            "is_reachable": False,
            "status_code": 0,
            "has_careers_page": False,
            "careers_url": None,
            "social_links": {},
            "has_ssl": False,
            "ssl_valid": False,
            "redirect_url": None,
        }

        # Check SSL
        result["has_ssl"], result["ssl_valid"] = await self._check_ssl(url)

        # Fetch homepage
        headers = get_random_headers()
        try:
            async with httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(15),
                follow_redirects=True,
            ) as client:
                response = await client.get(url)

            result["status_code"] = response.status_code
            result["is_reachable"] = response.status_code == 200
            result["redirect_url"] = str(response.url)

            if response.status_code == 200:
                html = response.text
                signals = self._extract_signals(html, str(response.url))
                result.update(signals)

                # Check for careers page by looking for links
                if not result["has_careers_page"]:
                    result["has_careers_page"], result["careers_url"] = (
                        await self._check_careers_page(str(response.url), html)
                    )

        except httpx.TimeoutException:
            logger.warning("[%s] Timeout analysing %s", self.name, url[:80])
        except Exception as e:
            logger.warning("[%s] Error analysing %s: %s", self.name, url[:80], str(e)[:100])

        return result

    def _extract_signals(self, html: str, base_url: str) -> dict:
        """Extract social links and careers indicators from HTML."""
        signals: dict = {
            "social_links": {},
            "has_careers_page": False,
        }

        # Social media links
        for platform, pattern in SOCIAL_PATTERNS.items():
            match = re.search(pattern, html, re.I)
            if match:
                signals["social_links"][platform] = match.group(0)

        # Check for careers links in HTML
        careers_pattern = (
            r'<a[^>]*href="([^"]*(?:career|jobs?|vacancies|join|hiring|recruitment)[^"]*)"'
        )
        careers_match = re.search(careers_pattern, html, re.I)
        if careers_match:
            signals["has_careers_page"] = True
            href = careers_match.group(1)
            if href.startswith("/"):
                href = urljoin(base_url, href)
            signals["careers_url"] = href

        return signals

    async def _check_careers_page(self, base_url: str, html: str) -> tuple[bool, Optional[str]]:
        """Check if common careers paths exist on the website."""
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        # First check if links exist in the HTML
        for path in CAREERS_PATHS:
            if path in html.lower():
                careers_url = f"{base}{path}"
                return True, careers_url

        # Try HEAD requests on common paths
        headers = get_random_headers()
        try:
            async with httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(10),
                follow_redirects=True,
            ) as client:
                for path in CAREERS_PATHS[:5]:  # Only try first 5 to limit requests
                    try:
                        check_url = f"{base}{path}"
                        resp = await client.head(check_url)
                        if resp.status_code == 200:
                            return True, check_url
                    except Exception:
                        continue
        except Exception:
            pass

        return False, None

    async def _check_ssl(self, url: str) -> tuple[bool, bool]:
        """Check if the URL has a valid SSL certificate."""
        parsed = urlparse(url)
        if parsed.scheme != "https":
            return False, False

        hostname = parsed.hostname
        if not hostname:
            return False, False

        try:
            context = ssl.create_default_context()
            conn = context.wrap_socket(
                __import__("socket").socket(),
                server_hostname=hostname,
            )
            conn.settimeout(5)
            conn.connect((hostname, 443))
            conn.close()
            return True, True
        except ssl.SSLCertVerificationError:
            return True, False
        except Exception:
            return False, False
