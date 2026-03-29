"""
Website analyser (Tier 3).

Analyses company websites for legitimacy signals:
responsiveness, careers page, social media links, SSL validity,
tech stack detection, and domain age estimation.

Returns dicts with fields matching CompanyProfile model:
website_url, has_careers_page, social_links, tech_stack_detected,
website_domain_age_days.
"""

import logging
import re
import socket
import ssl
from datetime import datetime, timezone
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

# Tech stack detection patterns: (name, patterns_in_html)
TECH_STACK_SIGNATURES = [
    ("React", [r'react\.production\.min\.js', r'react-dom', r'__NEXT_DATA__', r'_next/static']),
    ("Next.js", [r'__NEXT_DATA__', r'_next/static', r'next/dist']),
    ("Angular", [r'ng-version', r'angular\.min\.js', r'ng-app', r'angular\.io']),
    ("Vue.js", [r'vue\.min\.js', r'vue\.runtime', r'__vue__', r'v-bind:', r'v-if=']),
    ("Nuxt.js", [r'__NUXT__', r'nuxt\.js', r'/_nuxt/']),
    ("WordPress", [r'wp-content/', r'wp-includes/', r'wordpress', r'wp-json']),
    ("Shopify", [r'cdn\.shopify\.com', r'shopify\.com', r'Shopify\.theme']),
    ("Squarespace", [r'squarespace\.com', r'squarespace-cdn']),
    ("Wix", [r'wix\.com', r'wixsite\.com', r'parastorage\.com']),
    ("Webflow", [r'webflow\.com', r'assets\.website-files\.com']),
    ("Django", [r'csrfmiddlewaretoken', r'django']),
    ("Ruby on Rails", [r'csrf-token', r'turbolinks', r'rails']),
    ("jQuery", [r'jquery\.min\.js', r'jquery-\d']),
    ("Bootstrap", [r'bootstrap\.min\.css', r'bootstrap\.min\.js', r'bootstrap\.bundle']),
    ("Tailwind CSS", [r'tailwindcss', r'tailwind\.min\.css']),
    ("Google Analytics", [r'google-analytics\.com', r'gtag\(', r'ga\.js', r'analytics\.js', r'G-[A-Z0-9]+']),
    ("Google Tag Manager", [r'googletagmanager\.com', r'gtm\.js']),
    ("HubSpot", [r'hubspot\.com', r'hs-scripts\.com', r'hbspt\.forms']),
    ("Cloudflare", [r'cloudflare', r'cf-ray', r'__cf_bm']),
    ("Intercom", [r'intercom\.io', r'intercomcdn\.com']),
    ("Zendesk", [r'zendesk\.com', r'zdassets\.com']),
    ("Hotjar", [r'hotjar\.com', r'static\.hotjar\.com']),
    ("PHP", [r'\.php[\s"\'>?]', r'PHPSESSID']),
    ("ASP.NET", [r'__VIEWSTATE', r'__EVENTVALIDATION', r'aspnet']),
    ("Gatsby", [r'gatsby', r'/static/[a-f0-9]+/']),
    ("Svelte", [r'svelte', r'__svelte']),
    ("Drupal", [r'drupal\.js', r'sites/default/files', r'Drupal\.settings']),
    ("Joomla", [r'joomla', r'/media/system/js']),
    ("Magento", [r'mage/', r'magento', r'Mage\.Cookies']),
    ("Laravel", [r'laravel_session', r'XSRF-TOKEN.*laravel']),
]


class WebsiteAnalyser(BaseScraper):
    """
    Analyses a company website for legitimacy signals and tech stack.

    Checks: responsiveness, careers page presence, social media links,
    SSL certificate validity, tech stack detection, domain age.
    Rate limited to 15 req/min.
    """

    name = "website_analyser"
    base_url = ""
    requests_per_minute = 15
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

        Returns dict with CompanyProfile fields:
        - website_url: str
        - has_careers_page: bool
        - social_links: dict of platform -> URL
        - tech_stack_detected: list of detected technologies
        - website_domain_age_days: int or None
        Plus additional signals:
        - is_reachable: bool
        - status_code: int
        - has_ssl: bool
        - ssl_valid: bool
        - redirect_url: final URL after redirects
        """
        # Normalise URL
        if not url.startswith("http"):
            url = f"https://{url}"

        result: dict = {
            "website_url": url,
            "is_reachable": False,
            "status_code": 0,
            "has_careers_page": False,
            "careers_url": None,
            "social_links": {},
            "tech_stack_detected": [],
            "website_domain_age_days": None,
            "has_ssl": False,
            "ssl_valid": False,
            "redirect_url": None,
        }

        # Check SSL
        try:
            result["has_ssl"], result["ssl_valid"] = await self._check_ssl(url)
        except Exception as e:
            logger.warning("[%s] SSL check failed for %s: %s", self.name, url[:80], str(e)[:100])

        # Estimate domain age
        try:
            domain_age = await self._estimate_domain_age(url)
            if domain_age is not None:
                result["website_domain_age_days"] = domain_age
        except Exception as e:
            logger.warning("[%s] Domain age check failed for %s: %s", self.name, url[:80], str(e)[:100])

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
            result["website_url"] = str(response.url)

            if response.status_code == 200:
                html = response.text

                # Extract signals (social links, careers indicators)
                signals = self._extract_signals(html, str(response.url))
                result.update(signals)

                # Detect tech stack
                try:
                    tech_stack = self._detect_tech_stack(html, dict(response.headers))
                    result["tech_stack_detected"] = tech_stack
                except Exception as e:
                    logger.warning("[%s] Tech stack detection failed: %s", self.name, str(e)[:100])

                # Check for careers page by looking for links
                if not result["has_careers_page"]:
                    try:
                        result["has_careers_page"], result["careers_url"] = (
                            await self._check_careers_page(str(response.url), html)
                        )
                    except Exception as e:
                        logger.warning("[%s] Careers check failed: %s", self.name, str(e)[:100])

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
            try:
                match = re.search(pattern, html, re.I)
                if match:
                    signals["social_links"][platform] = match.group(0)
            except Exception:
                pass

        # Check for careers links in HTML
        try:
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
        except Exception:
            pass

        return signals

    def _detect_tech_stack(self, html: str, headers: dict) -> list[str]:
        """
        Detect technologies used on the website.

        Checks HTML source for framework signatures, meta tags, and script sources.
        Also inspects HTTP response headers for server-side clues.
        """
        detected = []

        # Check HTML content against known signatures
        html_lower = html.lower()
        for tech_name, patterns in TECH_STACK_SIGNATURES:
            try:
                for pattern in patterns:
                    if re.search(pattern, html_lower, re.I):
                        if tech_name not in detected:
                            detected.append(tech_name)
                        break
            except Exception:
                pass

        # Check meta generator tag
        try:
            generator_match = re.search(
                r'<meta[^>]*name=["\']generator["\'][^>]*content=["\']([^"\']+)',
                html, re.I,
            )
            if generator_match:
                generator = generator_match.group(1).strip()
                if generator and generator not in detected:
                    detected.append(generator)
        except Exception:
            pass

        # Check X-Powered-By header
        try:
            powered_by = headers.get("x-powered-by", "") or headers.get("X-Powered-By", "")
            if powered_by and powered_by not in detected:
                detected.append(powered_by)
        except Exception:
            pass

        # Check Server header
        try:
            server = headers.get("server", "") or headers.get("Server", "")
            if server:
                server_lower = server.lower()
                if "nginx" in server_lower and "Nginx" not in detected:
                    detected.append("Nginx")
                elif "apache" in server_lower and "Apache" not in detected:
                    detected.append("Apache")
                elif "iis" in server_lower and "IIS" not in detected:
                    detected.append("IIS")
                elif "cloudflare" in server_lower and "Cloudflare" not in detected:
                    detected.append("Cloudflare")
        except Exception:
            pass

        return detected

    async def _estimate_domain_age(self, url: str) -> Optional[int]:
        """
        Estimate domain age in days.

        Tries WHOIS lookup first (via python-whois if available),
        then falls back to checking SSL certificate 'not before' date,
        then HTTP 'Last-Modified' or 'Date' headers as rough proxy.
        """
        parsed = urlparse(url)
        domain = parsed.hostname
        if not domain:
            return None

        # Method 1: Try python-whois library
        try:
            import whois
            w = whois.whois(domain)
            if w and w.creation_date:
                creation = w.creation_date
                if isinstance(creation, list):
                    creation = creation[0]
                if isinstance(creation, datetime):
                    if creation.tzinfo is None:
                        creation = creation.replace(tzinfo=timezone.utc)
                    now = datetime.now(timezone.utc)
                    return (now - creation).days
        except ImportError:
            logger.debug("[%s] python-whois not installed, trying alternative methods", self.name)
        except Exception as e:
            logger.debug("[%s] WHOIS lookup failed for %s: %s", self.name, domain, str(e)[:100])

        # Method 2: SSL certificate 'not before' date
        try:
            if parsed.scheme == "https":
                context = ssl.create_default_context()
                with socket.create_connection((domain, 443), timeout=5) as sock:
                    with context.wrap_socket(sock, server_hostname=domain) as ssock:
                        cert = ssock.getpeercert()
                        if cert and "notBefore" in cert:
                            # Parse SSL date format: 'May 10 00:00:00 2020 GMT'
                            not_before_str = cert["notBefore"]
                            not_before = datetime.strptime(not_before_str, "%b %d %H:%M:%S %Y %Z")
                            not_before = not_before.replace(tzinfo=timezone.utc)
                            now = datetime.now(timezone.utc)
                            age_days = (now - not_before).days
                            # SSL certs are max 2 years, so this is a lower bound
                            return age_days
        except Exception as e:
            logger.debug("[%s] SSL cert age check failed for %s: %s", self.name, domain, str(e)[:100])

        # Method 3: HTTP Date/Last-Modified headers (very rough)
        try:
            headers = get_random_headers()
            async with httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(10),
                follow_redirects=True,
            ) as client:
                resp = await client.head(url)
                last_modified = resp.headers.get("last-modified")
                if last_modified:
                    from email.utils import parsedate_to_datetime
                    lm_date = parsedate_to_datetime(last_modified)
                    if lm_date.tzinfo is None:
                        lm_date = lm_date.replace(tzinfo=timezone.utc)
                    now = datetime.now(timezone.utc)
                    return (now - lm_date).days
        except Exception as e:
            logger.debug("[%s] HTTP date check failed for %s: %s", self.name, domain, str(e)[:100])

        return None

    async def _check_careers_page(self, base_url: str, html: str) -> tuple[bool, Optional[str]]:
        """Check if common careers paths exist on the website."""
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        # First check if links exist in the HTML
        html_lower = html.lower()
        for path in CAREERS_PATHS:
            try:
                if path in html_lower:
                    careers_url = f"{base}{path}"
                    return True, careers_url
            except Exception:
                pass

        # Also check /work-with-us specifically as per requirements
        for extra_path in ["/work-with-us"]:
            try:
                if extra_path not in CAREERS_PATHS and extra_path in html_lower:
                    return True, f"{base}{extra_path}"
            except Exception:
                pass

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
                socket.socket(),
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
