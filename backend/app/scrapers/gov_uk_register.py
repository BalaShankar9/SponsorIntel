"""
GOV.UK Sponsor Register scraper (Tier 1).

Downloads the official CSV of licensed sponsors from the GOV.UK publications page.
Checks for changes via MD5 hash comparison before triggering a full import.
"""

import logging
import re
from typing import Optional

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

GOV_UK_REGISTER_URL = (
    "https://www.gov.uk/government/publications/"
    "register-of-licensed-sponsors-workers"
)


class GovUKRegisterScraper(BaseScraper):
    """
    Scrapes the GOV.UK register of licensed sponsors.

    Fetches the publication page, finds the CSV download link,
    downloads the CSV, and returns the raw bytes with filename.
    """

    name = "gov_uk_register"
    base_url = "https://www.gov.uk"
    requests_per_minute = 10
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape the register page and download the CSV.

        Returns a list with a single dict containing:
        - filename: str
        - csv_bytes: bytes
        - md5: str (hash of the CSV content)
        - download_url: str
        """
        html = await self.fetch(GOV_UK_REGISTER_URL)
        if not html:
            logger.error("[%s] Failed to fetch register page", self.name)
            return []

        csv_info = await self._find_and_download_csv(html)
        if csv_info:
            return [csv_info]
        return []

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse the GOV.UK page to find CSV download links."""
        links = self._extract_csv_links(html)
        return [{"url": link, "type": "csv_download"} for link in links]

    def _extract_csv_links(self, html: str) -> list[str]:
        """
        Extract CSV download links from the GOV.UK publication page.

        Looks for links to .csv files in the attachments section.
        """
        csv_links = []

        # Pattern 1: Direct CSV href links
        pattern = r'href="([^"]*\.csv[^"]*)"'
        matches = re.findall(pattern, html, re.IGNORECASE)
        for match in matches:
            url = match
            if url.startswith("/"):
                url = f"{self.base_url}{url}"
            csv_links.append(url)

        # Pattern 2: attachment links that may not end in .csv
        # GOV.UK sometimes uses redirect URLs
        attachment_pattern = r'href="(https://assets\.publishing\.service\.gov\.uk/[^"]*)"'
        attachment_matches = re.findall(attachment_pattern, html, re.IGNORECASE)
        for match in attachment_matches:
            if match not in csv_links:
                csv_links.append(match)

        return csv_links

    async def _find_and_download_csv(self, html: str) -> Optional[dict]:
        """
        Find the CSV download link and download the file.

        Returns dict with filename, csv_bytes, md5, and download_url,
        or None if no CSV found.
        """
        csv_links = self._extract_csv_links(html)

        if not csv_links:
            logger.error("[%s] No CSV download links found on page", self.name)
            return None

        # Prefer links that mention 'worker' or 'sponsor' in the URL
        preferred = [
            link for link in csv_links
            if "worker" in link.lower() or "sponsor" in link.lower()
        ]
        download_url = preferred[0] if preferred else csv_links[0]

        logger.info("[%s] Downloading CSV from: %s", self.name, download_url[:100])

        import httpx
        from app.scrapers.anti_detection import get_random_headers

        headers = get_random_headers()
        try:
            async with httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(60),
                follow_redirects=True,
            ) as client:
                response = await client.get(download_url)

            if response.status_code != 200:
                logger.error(
                    "[%s] Failed to download CSV: HTTP %d",
                    self.name, response.status_code,
                )
                return None

            csv_bytes = response.content
            md5 = self.md5_hash(csv_bytes)

            # Extract filename from URL or Content-Disposition
            filename = "sponsor_register.csv"
            cd = response.headers.get("Content-Disposition", "")
            if "filename=" in cd:
                fname_match = re.search(r'filename="?([^";\s]+)', cd)
                if fname_match:
                    filename = fname_match.group(1)
            elif "/" in download_url:
                url_filename = download_url.rstrip("/").split("/")[-1]
                if url_filename.endswith(".csv"):
                    filename = url_filename

            logger.info(
                "[%s] Downloaded CSV: %s (%d bytes, MD5: %s)",
                self.name, filename, len(csv_bytes), md5,
            )

            return {
                "filename": filename,
                "csv_bytes": csv_bytes,
                "md5": md5,
                "download_url": download_url,
            }

        except Exception as e:
            logger.error("[%s] Error downloading CSV: %s", self.name, str(e)[:200])
            return None

    def check_csv_changed(self, new_md5: str, last_md5: str | None) -> bool:
        """Check if the CSV has changed by comparing MD5 hashes."""
        if last_md5 is None:
            return True
        return new_md5 != last_md5
