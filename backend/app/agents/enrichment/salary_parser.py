"""George Palmer — Salary Parser (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Currency detection
# ---------------------------------------------------------------------------
_CURRENCY_MAP: dict[str, str] = {
    "gbp": "GBP", "pound": "GBP", "pounds": "GBP", "sterling": "GBP",
    "usd": "USD", "dollar": "USD", "dollars": "USD", "us$": "USD",
    "eur": "EUR", "euro": "EUR", "euros": "EUR",
}

_CURRENCY_SYMBOLS: dict[str, str] = {
    "\u00a3": "GBP",
    "$": "USD",
    "\u20ac": "EUR",
}

# ---------------------------------------------------------------------------
# Period detection
# ---------------------------------------------------------------------------
_PERIOD_MAP: dict[str, str] = {
    "annum": "annual", "annual": "annual", "annually": "annual",
    "year": "annual", "yearly": "annual", "pa": "annual", "p.a.": "annual",
    "p/a": "annual", "per annum": "annual",
    "month": "monthly", "monthly": "monthly", "pm": "monthly",
    "p.m.": "monthly", "pcm": "monthly", "per month": "monthly",
    "week": "weekly", "weekly": "weekly", "pw": "weekly",
    "p.w.": "weekly", "per week": "weekly",
    "day": "daily", "daily": "daily", "pd": "daily",
    "p.d.": "daily", "per day": "daily", "per diem": "daily",
    "hour": "hourly", "hourly": "hourly", "ph": "hourly",
    "p.h.": "hourly", "per hour": "hourly", "hr": "hourly",
}

# ---------------------------------------------------------------------------
# Number extraction
# ---------------------------------------------------------------------------
_NUMBER_PATTERN = re.compile(
    r"(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*[kK]?",
)


def _parse_number(s: str) -> float | None:
    """Extract a numeric value, handling commas and 'k' suffix."""
    s = s.strip().replace(",", "")
    multiplier = 1
    if s.lower().endswith("k"):
        s = s[:-1]
        multiplier = 1000
    try:
        return float(s) * multiplier
    except (ValueError, TypeError):
        return None


class SalaryParserAgent(BaseSubAgent):
    """Parses free-text salary strings into structured data."""

    name = "salary_parser"
    persona = "George Palmer"
    title = "Salary Parser"
    agent_type = "DET"
    description = (
        "Deterministic parser that extracts min/max salary, currency, and "
        "pay period from free-text salary strings."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Parse a salary string.

        Parameters
        ----------
        salary_string : str
            Raw salary text from job listing.

        Returns
        -------
        SubAgentResult with data:
            min         : float | None
            max         : float | None
            currency    : str          - "GBP" | "USD" | "EUR"
            period      : str          - "annual" | "monthly" | "daily" | "hourly" | "weekly"
            is_range    : bool
            raw         : str
            confidence  : str          - "high" | "medium" | "low" | "none"
        """
        salary_string: str = kwargs.get("salary_string", "") or ""
        raw = salary_string.strip()

        if not raw:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "min": None, "max": None, "currency": "GBP",
                    "period": "annual", "is_range": False, "raw": raw,
                    "confidence": "none",
                },
            )

        text = raw.lower()

        # Detect "competitive" / "negotiable" / "DOE"
        if re.search(r"\b(competitive|negotiable|doe|d\.o\.e|market rate|attractive)\b", text, re.I):
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "min": None, "max": None, "currency": "GBP",
                    "period": "annual", "is_range": False, "raw": raw,
                    "confidence": "none",
                },
            )

        # --- Detect currency ---
        currency = "GBP"  # default for UK job board
        for symbol, curr in _CURRENCY_SYMBOLS.items():
            if symbol in raw:
                currency = curr
                break
        else:
            for word, curr in _CURRENCY_MAP.items():
                if word in text:
                    currency = curr
                    break

        # --- Detect period ---
        period = "annual"  # default assumption
        for word, per in _PERIOD_MAP.items():
            if word in text:
                period = per
                break

        # --- Extract numbers ---
        # Normalise 'k' suffix inline: "45k" -> "45000"
        normalised = re.sub(
            r"(\d+(?:\.\d+)?)\s*[kK]\b",
            lambda m: str(int(float(m.group(1)) * 1000)),
            raw,
        )

        numbers = _NUMBER_PATTERN.findall(normalised)
        parsed_numbers = [_parse_number(n) for n in numbers]
        parsed_numbers = [n for n in parsed_numbers if n is not None and n > 0]

        if not parsed_numbers:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "min": None, "max": None, "currency": currency,
                    "period": period, "is_range": False, "raw": raw,
                    "confidence": "low",
                },
            )

        # Deduplicate and sort
        parsed_numbers = sorted(set(parsed_numbers))

        if len(parsed_numbers) == 1:
            # Check for "up to" or "from"
            is_max = bool(re.search(r"\b(up\s+to|max|maximum|to)\b", text))
            is_min = bool(re.search(r"\b(from|min|minimum|starting)\b", text))

            val = parsed_numbers[0]
            if is_max:
                salary_min, salary_max = None, val
            elif is_min:
                salary_min, salary_max = val, None
            else:
                salary_min, salary_max = val, val

            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "min": salary_min, "max": salary_max, "currency": currency,
                    "period": period, "is_range": False, "raw": raw,
                    "confidence": "high",
                },
            )

        # Range: take first and last
        salary_min = parsed_numbers[0]
        salary_max = parsed_numbers[-1]

        # Sanity check: if max < min, swap
        if salary_max < salary_min:
            salary_min, salary_max = salary_max, salary_min

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "min": salary_min, "max": salary_max, "currency": currency,
                "period": period, "is_range": True, "raw": raw,
                "confidence": "high",
            },
        )
