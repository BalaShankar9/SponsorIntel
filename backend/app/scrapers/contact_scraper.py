"""
Contact details scraper.

Extracts contact information (email, phone, address) from company
websites by checking common contact page paths and parsing HTML.

Returns structured contact data for CompanyProfile enrichment.
"""

import logging
import re
from typing import Optional

import httpx

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

CONTACT_PATHS = [
    "/contact", "/contact-us", "/get-in-touch", "/about/contact",
    "/about-us", "/about", "/company/contact",
]

# Email regex — matches common formats, avoids false positives
_EMAIL_RE = re.compile(
    r'\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b'
)

# UK phone patterns
_PHONE_RE = re.compile(
    r'(?:\+44[\s.-]?|0)(?:\d[\s.-]?){9,10}\b'
)

# Skip these email domains (not real contact emails)
_SKIP_EMAIL_DOMAINS = {
    "example.com", "test.com", "sentry.io", "wixpress.com",
    "w3.org", "schema.org", "googleapis.com", "google.com",
    "facebook.com", "twitter.com", "github.com",
}


class ContactScraper(BaseScraper):
    """
    Extracts contact details from company websites.

    Checks /contact, /about pages for email addresses, phone numbers,
    and physical addresses. Rate limited to avoid overloading targets.
    """

    name = "contact_scraper"
    base_url = ""
    requests_per_minute = 15
    max_retries = 2
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Extract contact details from a company website.

        Args:
            url: Company website URL
        """
        url = kwargs.get("url", "")
        if not url:
            return []

        if not url.startswith("http"):
            url = f"https://{url}"

        result = await self._extract_contacts(url)
        return [result] if result else []

    async def parse(self, html: str, **kwargs) -> list[dict]:
        return []

    async def _extract_contacts(self, base_url: str) -> Optional[dict]:
        """Try to extract contact info from a company website."""
        from urllib.parse import urlparse

        parsed = urlparse(base_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        all_emails = set()
        all_phones = set()

        # Fetch homepage first
        html = await self._fetch_page(base_url)
        if html:
            emails, phones = self._parse_contacts(html)
            all_emails.update(emails)
            all_phones.update(phones)

        # Try contact pages
        for path in CONTACT_PATHS[:4]:  # Limit to 4 paths
            page_url = f"{origin}{path}"
            page_html = await self._fetch_page(page_url)
            if page_html:
                emails, phones = self._parse_contacts(page_html)
                all_emails.update(emails)
                all_phones.update(phones)

                if all_emails:
                    break  # Found what we need

        if not all_emails and not all_phones:
            return None

        return {
            "contact_emails": sorted(all_emails)[:5],
            "contact_phones": sorted(all_phones)[:3],
        }

    def _parse_contacts(self, html: str) -> tuple[set, set]:
        """Extract emails and phone numbers from HTML."""
        emails = set()
        phones = set()

        # Extract emails
        for match in _EMAIL_RE.finditer(html):
            email = match.group(1).lower()
            domain = email.split("@")[1]
            if domain not in _SKIP_EMAIL_DOMAINS:
                # Skip image/asset emails
                if not any(ext in email for ext in (".png", ".jpg", ".svg", ".gif", ".css", ".js")):
                    emails.add(email)

        # Extract UK phone numbers
        for match in _PHONE_RE.finditer(html):
            phone = match.group(0).strip()
            # Normalise: remove spaces/dots/dashes
            clean = re.sub(r'[\s.-]', '', phone)
            if len(clean) >= 10:
                phones.add(phone)

        return emails, phones

    async def _fetch_page(self, url: str) -> Optional[str]:
        """Fetch a page, return HTML or None."""
        try:
            await self._rate_limiter.acquire()
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(10),
                follow_redirects=True,
            ) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "SponsorIntel/1.0",
                    "Accept": "text/html",
                })
            if resp.status_code == 200:
                return resp.text
        except Exception:
            pass
        return None
