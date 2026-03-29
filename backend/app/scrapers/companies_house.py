"""
Companies House scraper with circuit breaker and optional REST API support.

Primary: REST API (if COMPANIES_HOUSE_API_KEY is set) — 600 req/5 min.
Fallback: Web scraping with circuit breaker to stop hammering on 403s.
"""

import logging
import re
import time
from typing import Optional
from urllib.parse import quote_plus

import httpx

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

# Circuit breaker: skip CH requests when we're blocked
_circuit_open = False
_circuit_opened_at = 0.0
_consecutive_403s = 0
_CIRCUIT_THRESHOLD = 5  # open circuit after 5 consecutive 403s
_CIRCUIT_COOLDOWN = 600  # try again after 10 minutes


def _check_circuit() -> bool:
    """Return True if circuit is open (should skip CH requests)."""
    global _circuit_open, _circuit_opened_at
    if not _circuit_open:
        return False
    if time.time() - _circuit_opened_at > _CIRCUIT_COOLDOWN:
        _circuit_open = False
        logger.info("[companies_house] Circuit breaker reset — retrying CH requests")
        return False
    return True


def _record_403():
    """Record a 403 response. Opens circuit after threshold."""
    global _consecutive_403s, _circuit_open, _circuit_opened_at
    _consecutive_403s += 1
    if _consecutive_403s >= _CIRCUIT_THRESHOLD and not _circuit_open:
        _circuit_open = True
        _circuit_opened_at = time.time()
        logger.warning(
            "[companies_house] Circuit breaker OPEN after %d consecutive 403s. "
            "Skipping CH requests for %ds.",
            _consecutive_403s, _CIRCUIT_COOLDOWN,
        )


def _record_success():
    """Record a successful response. Resets 403 counter."""
    global _consecutive_403s
    _consecutive_403s = 0


class CompaniesHouseAPI:
    """
    Companies House REST API client.

    Uses the official API at api.company-information.service.gov.uk.
    Rate limit: 600 requests per 5 minutes.
    Auth: API key as HTTP Basic Auth username.
    """

    BASE = "https://api.company-information.service.gov.uk"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def _get(self, path: str) -> Optional[dict]:
        if _check_circuit():
            return None
        try:
            async with httpx.AsyncClient(
                auth=(self.api_key, ""),
                timeout=httpx.Timeout(15),
            ) as client:
                resp = await client.get(f"{self.BASE}{path}")
            if resp.status_code == 200:
                _record_success()
                return resp.json()
            if resp.status_code in (403, 429):
                _record_403()
                logger.warning("[ch_api] %d on %s", resp.status_code, path[:80])
            return None
        except Exception as e:
            logger.warning("[ch_api] Error: %s", str(e)[:100])
            return None

    async def search_company(self, name: str) -> list[dict]:
        data = await self._get(f"/search/companies?q={quote_plus(name)}&items_per_page=5")
        if not data or not data.get("items"):
            return []
        results = []
        for item in data["items"]:
            results.append({
                "companies_house_number": item.get("company_number"),
                "company_name": item.get("title"),
                "company_status": item.get("company_status"),
                "incorporation_date": item.get("date_of_creation"),
                "registered_address": item.get("address", {}),
            })
        return results

    async def get_company_profile(self, number: str) -> Optional[dict]:
        data = await self._get(f"/company/{number}")
        if not data:
            return None
        profile = {
            "companies_house_number": data.get("company_number"),
            "company_name": data.get("company_name"),
            "company_status": data.get("company_status"),
            "company_type": data.get("type"),
            "incorporation_date": data.get("date_of_creation"),
            "has_charges": data.get("has_charges", False),
            "has_insolvency_history": data.get("has_insolvency_history", False),
            "registered_address": data.get("registered_office_address", {}),
            "accounts_overdue": data.get("accounts", {}).get("overdue", False),
            "last_accounts_date": (
                data.get("accounts", {}).get("last_accounts", {}).get("made_up_to")
            ),
            "confirmation_statement_overdue": (
                data.get("confirmation_statement", {}).get("overdue", False)
            ),
        }
        sic = data.get("sic_codes")
        if sic:
            profile["sic_codes"] = sic
        charges = data.get("charges")
        if isinstance(charges, dict):
            profile["charge_count"] = charges.get("total_count", 0)
        return profile


class CompaniesHouseScraper(BaseScraper):
    """
    Companies House enrichment — uses REST API if key is available,
    falls back to web scraping with circuit breaker protection.
    """

    name = "companies_house"
    base_url = "https://find-and-update.company-information.service.gov.uk"
    requests_per_minute = 120  # ~2/sec; concurrency controlled by caller's semaphore
    max_retries = 1  # Reduced from 3 to avoid wasting time on 403s
    use_proxy = False
    use_browser = False

    def __init__(self):
        super().__init__()
        self._api: Optional[CompaniesHouseAPI] = None
        try:
            from app.core.config import get_settings
            key = get_settings().companies_house_api_key
            if key:
                self._api = CompaniesHouseAPI(key)
                logger.info("[companies_house] Using REST API")
        except Exception:
            pass

    async def scrape(self, **kwargs) -> list[dict]:
        """
        Scrape company data based on kwargs.

        Supports:
        - search_name: str -> search for companies by name
        - company_number: str -> get full profile with officers
        """
        search_name = kwargs.get("search_name")
        company_number = kwargs.get("company_number")

        if search_name:
            return await self.search_company(search_name)
        elif company_number:
            profile = await self.get_full_profile(company_number)
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
        # Prefer REST API
        if self._api:
            return await self._api.search_company(name)

        # Circuit breaker: skip if blocked
        if _check_circuit():
            return []

        encoded_name = quote_plus(name)
        url = f"{self.base_url}/search/companies?q={encoded_name}"
        html = await self.fetch(url)
        if not html:
            return []
        _record_success()
        return self._parse_search_results(html)

    async def get_full_profile(self, company_number: str) -> Optional[dict]:
        """
        Get a comprehensive company profile.

        Uses REST API (single call) or web scraping (profile page only —
        officers/filings/insolvency skipped for speed).
        """
        # Prefer REST API — single call gets everything
        if self._api:
            return await self._api.get_company_profile(company_number)

        # Web scraping fallback: just the profile page (skip officers/filings)
        profile = await self.get_company_profile(company_number)
        return profile

    async def get_company_profile(self, company_number: str) -> Optional[dict]:
        """
        Get detailed company profile by company number.

        Returns dict with fields matching CompanyProfile model.
        """
        if _check_circuit():
            return None
        url = f"{self.base_url}/company/{company_number}"
        html = await self.fetch(url)
        if not html:
            return None
        _record_success()
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
                    result["companies_house_number"] = number_match.group(1)

            # Company details paragraph
            details = item.css_first("p.meta")
            if details:
                detail_text = details.text(strip=True)
                result["details_text"] = detail_text

                # Status
                status_match = re.search(r"(Active|Dissolved|Liquidation|Administration|Dormant)", detail_text, re.I)
                if status_match:
                    result["company_status"] = status_match.group(1)

                # Incorporation date
                date_match = re.search(r"Incorporated on\s+(\d{1,2}\s+\w+\s+\d{4})", detail_text, re.I)
                if date_match:
                    result["incorporation_date"] = date_match.group(1)

            # Address
            address_el = item.css_first("p:not(.meta)")
            if address_el:
                result["registered_address"] = {"full_address": address_el.text(strip=True)}

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
                "companies_house_number": match.group(1),
                "company_name": match.group(2).strip(),
            })
        return results

    def _parse_profile_page(self, html: str) -> dict:
        """Parse company profile page. Returns dict matching CompanyProfile model fields."""
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
                profile["companies_house_number"] = number_match.group(1)

        # Check for charges indicator in page
        try:
            charges_link = tree.css_first("a[href*='/charges'], a[href*='/mortgage']")
            if charges_link:
                profile["has_charges"] = True
                charges_text = charges_link.text(strip=True)
                count_match = re.search(r"(\d+)", charges_text)
                if count_match:
                    profile["charge_count"] = int(count_match.group(1))
            else:
                profile["has_charges"] = False
                profile["charge_count"] = 0
        except Exception:
            profile["has_charges"] = None
            profile["charge_count"] = None

        # Check for insolvency indicator
        try:
            insolvency_link = tree.css_first("a[href*='/insolvency']")
            if insolvency_link:
                profile["has_insolvency_history"] = True
            else:
                # Also check text content for insolvency markers
                page_text = tree.body.text() if tree.body else ""
                profile["has_insolvency_history"] = "insolvency" in page_text.lower()
        except Exception:
            profile["has_insolvency_history"] = None

        # Extract data from definition lists
        for dl in tree.css("dl"):
            dts = dl.css("dt")
            dds = dl.css("dd")
            for dt, dd in zip(dts, dds):
                try:
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
                        profile["registered_address"] = {"full_address": value}
                    elif "last accounts" in key:
                        profile["last_accounts_date"] = value
                    elif "next accounts" in key:
                        profile["next_accounts_due"] = value
                        # Check if accounts are overdue
                        if "overdue" in value.lower():
                            profile["accounts_overdue"] = True
                    elif "confirmation statement" in key:
                        if "overdue" in value.lower():
                            profile["confirmation_statement_overdue"] = True
                        else:
                            profile["confirmation_statement_overdue"] = False
                except Exception as e:
                    logger.warning("[%s] Error parsing dl field: %s", self.name, str(e)[:100])

        # SIC codes from specific section (spans with id="sic0", "sic1", etc.)
        try:
            sic_spans = tree.css("span[id^='sic']")
            if sic_spans:
                sic_codes = [el.text(strip=True) for el in sic_spans if el.text(strip=True)]
                if sic_codes:
                    profile["sic_codes"] = sic_codes
        except Exception:
            pass

        return profile

    def _parse_profile_page_regex(self, html: str) -> dict:
        """Fallback regex-based profile parser."""
        profile: dict = {}

        try:
            name_match = re.search(r"<h1[^>]*>([^<]+)</h1>", html)
            if name_match:
                profile["company_name"] = name_match.group(1).strip()
        except Exception:
            pass

        try:
            number_match = re.search(r"Company number\s*(\w{6,8})", html, re.I)
            if number_match:
                profile["companies_house_number"] = number_match.group(1)
        except Exception:
            pass

        try:
            status_match = re.search(r"Company status\s*</dt>\s*<dd[^>]*>\s*(\w+)", html, re.I)
            if status_match:
                profile["company_status"] = status_match.group(1).strip()
        except Exception:
            pass

        # Check for charges/insolvency in raw HTML
        try:
            profile["has_charges"] = bool(re.search(r'href="[^"]*charges"', html, re.I))
            profile["has_insolvency_history"] = bool(re.search(r'href="[^"]*insolvency"', html, re.I))
        except Exception:
            pass

        return profile

    def _parse_officers_page(self, html: str) -> list[dict]:
        """Parse officers page. Returns list of dicts matching CompanyOfficer fields."""
        try:
            from selectolax.parser import HTMLParser
        except ImportError:
            return self._parse_officers_page_regex(html)

        tree = HTMLParser(html)
        officers = []

        for item in tree.css("div.appointment-1, div.officer-appointment"):
            officer: dict = {}

            try:
                name_el = item.css_first("a, h2, span.heading-medium")
                if name_el:
                    officer["name"] = name_el.text(strip=True)
            except Exception:
                pass

            # Parse details from definition lists within officer section
            try:
                for dl in item.css("dl"):
                    dts = dl.css("dt")
                    dds = dl.css("dd")
                    for dt, dd in zip(dts, dds):
                        key = dt.text(strip=True).lower()
                        value = dd.text(strip=True)

                        if "role" in key:
                            officer["role"] = value
                        elif "appointed" in key:
                            officer["appointed_on"] = value
                        elif "resigned" in key:
                            officer["resigned_on"] = value
                            officer["is_active"] = False
                        elif "nationality" in key:
                            officer["nationality"] = value
            except Exception:
                pass

            # Fallback: parse from text content
            try:
                item_text = item.text()
                if not officer.get("role"):
                    role_match = re.search(r"(Director|Secretary|Member|LLP Member)", item_text, re.I)
                    if role_match:
                        officer["role"] = role_match.group(1)

                if not officer.get("appointed_on"):
                    appointed_match = re.search(r"Appointed on\s+(\d{1,2}\s+\w+\s+\d{4})", item_text, re.I)
                    if appointed_match:
                        officer["appointed_on"] = appointed_match.group(1)

                if not officer.get("resigned_on"):
                    resigned_match = re.search(r"Resigned on\s+(\d{1,2}\s+\w+\s+\d{4})", item_text, re.I)
                    if resigned_match:
                        officer["resigned_on"] = resigned_match.group(1)
                        officer["is_active"] = False

                if not officer.get("nationality"):
                    nationality_match = re.search(r"Nationality\s*:\s*(\w+)", item_text, re.I)
                    if nationality_match:
                        officer["nationality"] = nationality_match.group(1)
            except Exception:
                pass

            # Set is_active default
            if "is_active" not in officer:
                officer["is_active"] = True

            if officer.get("name"):
                officers.append(officer)

        return officers

    def _parse_officers_page_regex(self, html: str) -> list[dict]:
        """Fallback regex-based officers parser."""
        officers = []
        pattern = r'class="[^"]*officer[^"]*"[^>]*>([^<]+)'
        for match in re.finditer(pattern, html, re.I):
            officers.append({"name": match.group(1).strip(), "is_active": True})
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
            try:
                cells = row.css("td")

                if len(cells) >= 2:
                    filing["date"] = cells[0].text(strip=True)
                    filing["description"] = cells[1].text(strip=True)

                    if len(cells) >= 3:
                        filing["filing_type"] = cells[2].text(strip=True)
            except Exception:
                pass

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
            try:
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
            except Exception:
                pass

            if case:
                insolvency["cases"].append(case)

        return insolvency if insolvency["cases"] else None

    def _parse_insolvency_regex(self, html: str) -> Optional[dict]:
        """Fallback regex insolvency parser."""
        if "insolvency" in html.lower() and "case" in html.lower():
            return {"has_insolvency": True, "cases": []}
        return None
