"""
Companies House scraper (Tier 1 - pure scraping, no API).

Scrapes company information directly from the Companies House web interface
at find-and-update.company-information.service.gov.uk.
"""

import logging
import re
from typing import Optional
from urllib.parse import quote_plus

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class CompaniesHouseScraper(BaseScraper):
    """
    Scrapes Companies House web interface for company data.

    Extracts company profiles, officers, filing history, and insolvency
    information directly from HTML pages. Rate limited to 5 req/min
    to be respectful to the government site.
    """

    name = "companies_house"
    base_url = "https://find-and-update.company-information.service.gov.uk"
    requests_per_minute = 5
    use_proxy = False
    use_browser = False

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape company data based on kwargs.

        Supports:
        - search_name: str -> search for companies by name
        - company_number: str -> get full profile
        """
        search_name = kwargs.get("search_name")
        company_number = kwargs.get("company_number")

        if search_name:
            return await self.search_company(search_name)
        elif company_number:
            profile = await self.get_company_profile(company_number)
            return [profile] if profile else []
        return []

    async def parse(self, html: str, **kwargs) -> list[dict]:
        """Parse HTML based on the page type specified in kwargs."""
        page_type = kwargs.get("page_type", "search")
        if page_type == "search":
            return self._parse_search_results(html)
        elif page_type == "profile":
            return [self._parse_profile_page(html)]
        elif page_type == "officers":
            return self._parse_officers_page(html)
        elif page_type == "filing_history":
            return self._parse_filing_history_page(html)
        return []

    async def search_company(self, name: str) -> list[dict]:
        """
        Search for companies by name.

        Returns list of dicts with: company_name, company_number, status,
        address, incorporation_date.
        """
        encoded_name = quote_plus(name)
        url = f"{self.base_url}/search/companies?q={encoded_name}"
        html = await self.fetch(url)
        if not html:
            return []
        return self._parse_search_results(html)

    async def get_company_profile(self, company_number: str) -> Optional[dict]:
        """
        Get detailed company profile by company number.

        Returns dict with: company_name, company_number, status, company_type,
        registered_address, sic_codes, incorporation_date, accounts_info.
        """
        url = f"{self.base_url}/company/{company_number}"
        html = await self.fetch(url)
        if not html:
            return None
        return self._parse_profile_page(html)

    async def get_officers(self, company_number: str) -> list[dict]:
        """
        Get company officers.

        Returns list of dicts with: name, role, appointed_date, resigned_date, nationality.
        """
        url = f"{self.base_url}/company/{company_number}/officers"
        html = await self.fetch(url)
        if not html:
            return []
        return self._parse_officers_page(html)

    async def get_filing_history(self, company_number: str) -> list[dict]:
        """
        Get company filing history.

        Returns list of dicts with: filing_type, date, description.
        """
        url = f"{self.base_url}/company/{company_number}/filing-history"
        html = await self.fetch(url)
        if not html:
            return []
        return self._parse_filing_history_page(html)

    async def get_insolvency(self, company_number: str) -> Optional[dict]:
        """
        Get company insolvency information.

        Returns dict with insolvency cases and dates, or None if no insolvency data.
        """
        url = f"{self.base_url}/company/{company_number}/insolvency"
        html = await self.fetch(url)
        if not html:
            return None
        return self._parse_insolvency_page(html)

    # ------------------------------------------------------------------
    # Parsing methods using selectolax for fast HTML parsing
    # ------------------------------------------------------------------

    def _parse_search_results(self, html: str) -> list[dict]:
        """Parse company search results page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_search_results_regex(html)

        results = []
        tree = HTMLParser(html)

        for item in tree.css("li.type-company"):
            result = {}

            # Company name and link
            link = item.css_first("a")
            if link:
                result["company_name"] = link.text(strip=True)
                href = link.attributes.get("href", "")
                # Extract company number from URL like /company/12345678
                number_match = re.search(r"/company/(\w+)", href)
                if number_match:
                    result["company_number"] = number_match.group(1)

            # Company details paragraph
            details = item.css_first("p.meta")
            if details:
                detail_text = details.text(strip=True)
                result["details_text"] = detail_text

                # Status
                status_match = re.search(r"(Active|Dissolved|Liquidation|Administration|Dormant)", detail_text, re.I)
                if status_match:
                    result["status"] = status_match.group(1)

                # Incorporation date
                date_match = re.search(r"Incorporated on\s+(\d{1,2}\s+\w+\s+\d{4})", detail_text, re.I)
                if date_match:
                    result["incorporation_date"] = date_match.group(1)

            # Address
            address_el = item.css_first("p:not(.meta)")
            if address_el:
                result["address"] = address_el.text(strip=True)

            if result.get("company_name"):
                results.append(result)

        return results

    def _parse_search_results_regex(self, html: str) -> list[dict]:
        """Fallback regex-based search results parser."""
        results = []
        # Match company links
        pattern = r'<a[^>]*href="/company/(\w+)"[^>]*>([^<]+)</a>'
        for match in re.finditer(pattern, html):
            results.append({
                "company_number": match.group(1),
                "company_name": match.group(2).strip(),
            })
        return results

    def _parse_profile_page(self, html: str) -> dict:
        """Parse company profile page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_profile_page_regex(html)

        tree = HTMLParser(html)
        profile: dict = {}

        # Company name
        h1 = tree.css_first("h1.heading-xlarge, h1")
        if h1:
            profile["company_name"] = h1.text(strip=True)

        # Company number
        number_el = tree.css_first("#company-number, p.heading-secondary")
        if number_el:
            number_text = number_el.text(strip=True)
            number_match = re.search(r"(\d{6,8}|[A-Z]{2}\d+)", number_text)
            if number_match:
                profile["company_number"] = number_match.group(1)

        # Extract data from definition lists
        for dl in tree.css("dl"):
            dts = dl.css("dt")
            dds = dl.css("dd")
            for dt, dd in zip(dts, dds):
                key = dt.text(strip=True).lower()
                value = dd.text(strip=True)

                if "company status" in key:
                    profile["company_status"] = value
                elif "company type" in key:
                    profile["company_type"] = value
                elif "incorporated" in key:
                    profile["incorporation_date"] = value
                elif "nature of business" in key or "sic" in key:
                    profile["sic_codes"] = [s.strip() for s in value.split("\n") if s.strip()]
                elif "registered office" in key or "address" in key:
                    profile["registered_address"] = value
                elif "last accounts" in key:
                    profile["last_accounts_date"] = value
                elif "next accounts" in key:
                    profile["next_accounts_due"] = value
                elif "confirmation statement" in key:
                    if "overdue" in value.lower():
                        profile["confirmation_statement_overdue"] = True
                    profile["confirmation_statement_info"] = value

        # SIC codes from specific section
        sic_section = tree.css("span.sic-code, li.sic-code")
        if sic_section:
            sic_codes = []
            for el in sic_section:
                sic_codes.append(el.text(strip=True))
            if sic_codes:
                profile["sic_codes"] = sic_codes

        return profile

    def _parse_profile_page_regex(self, html: str) -> dict:
        """Fallback regex-based profile parser."""
        profile: dict = {}
        name_match = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
        if name_match:
            profile["company_name"] = name_match.group(1).strip()
        return profile

    def _parse_officers_page(self, html: str) -> list[dict]:
        """Parse officers page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_officers_page_regex(html)

        tree = HTMLParser(html)
        officers = []

        for item in tree.css("div.appointment-1, div.officer-appointment"):
            officer: dict = {}

            name_el = item.css_first("a, h2, span.heading-medium")
            if name_el:
                officer["name"] = name_el.text(strip=True)

            # Parse details from definition lists within officer section
            for dl in item.css("dl"):
                dts = dl.css("dt")
                dds = dl.css("dd")
                for dt, dd in zip(dts, dds):
                    key = dt.text(strip=True).lower()
                    value = dd.text(strip=True)

                    if "role" in key:
                        officer["role"] = value
                    elif "appointed" in key:
                        officer["appointed_date"] = value
                    elif "resigned" in key:
                        officer["resigned_date"] = value
                    elif "nationality" in key:
                        officer["nationality"] = value

            # Fallback: parse from text content
            item_text = item.text()
            if not officer.get("role"):
                role_match = re.search(r"(Director|Secretary|Member|LLP Member)", item_text, re.I)
                if role_match:
                    officer["role"] = role_match.group(1)

            if not officer.get("appointed_date"):
                appointed_match = re.search(r"Appointed on\s+(\d{1,2}\s+\w+\s+\d{4})", item_text, re.I)
                if appointed_match:
                    officer["appointed_date"] = appointed_match.group(1)

            if not officer.get("resigned_date"):
                resigned_match = re.search(r"Resigned on\s+(\d{1,2}\s+\w+\s+\d{4})", item_text, re.I)
                if resigned_match:
                    officer["resigned_date"] = resigned_match.group(1)

            if not officer.get("nationality"):
                nationality_match = re.search(r"Nationality\s*:\s*(\w+)", item_text, re.I)
                if nationality_match:
                    officer["nationality"] = nationality_match.group(1)

            if officer.get("name"):
                officers.append(officer)

        return officers

    def _parse_officers_page_regex(self, html: str) -> list[dict]:
        """Fallback regex-based officers parser."""
        officers = []
        # Simple pattern to find officer names
        pattern = r'class="[^"]*officer[^"]*"[^>]*>([^<]+)'
        for match in re.finditer(pattern, html, re.I):
            officers.append({"name": match.group(1).strip()})
        return officers

    def _parse_filing_history_page(self, html: str) -> list[dict]:
        """Parse filing history page."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_filing_history_regex(html)

        tree = HTMLParser(html)
        filings = []

        for row in tree.css("table.full-width-table tbody tr, tr.filing-history"):
            filing: dict = {}
            cells = row.css("td")

            if len(cells) >= 2:
                filing["date"] = cells[0].text(strip=True)
                filing["description"] = cells[1].text(strip=True)

                if len(cells) >= 3:
                    filing["filing_type"] = cells[2].text(strip=True)

            if filing.get("date") or filing.get("description"):
                filings.append(filing)

        return filings

    def _parse_filing_history_regex(self, html: str) -> list[dict]:
        """Fallback regex parser for filing history."""
        return []

    def _parse_insolvency_page(self, html: str) -> Optional[dict]:
        """Parse insolvency page."""
        # Check if page indicates no insolvency
        if "no insolvency" in html.lower() or "not found" in html.lower():
            return None

        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_insolvency_regex(html)

        tree = HTMLParser(html)
        insolvency: dict = {"has_insolvency": True, "cases": []}

        for item in tree.css("div.insolvency-case, div.case"):
            case: dict = {}
            for dl in item.css("dl"):
                dts = dl.css("dt")
                dds = dl.css("dd")
                for dt, dd in zip(dts, dds):
                    key = dt.text(strip=True).lower()
                    value = dd.text(strip=True)
                    case[key] = value

            text = item.text()
            type_match = re.search(
                r"(Compulsory Liquidation|Creditors Voluntary|Administration|"
                r"Administrative Receiver|Voluntary Arrangement)",
                text, re.I,
            )
            if type_match:
                case["type"] = type_match.group(1)

            if case:
                insolvency["cases"].append(case)

        return insolvency if insolvency["cases"] else None

    def _parse_insolvency_regex(self, html: str) -> Optional[dict]:
        """Fallback regex insolvency parser."""
        if "insolvency" in html.lower() and "case" in html.lower():
            return {"has_insolvency": True, "cases": []}
        return None
