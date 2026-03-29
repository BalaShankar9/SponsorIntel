"""Aisha Begum — Salary Normalisation Specialist (Enrichment department)."""

from __future__ import annotations

from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Conversion constants
# ---------------------------------------------------------------------------
HOURS_PER_WEEK = 37.5
WEEKS_PER_YEAR = 52
WORKING_DAYS_PER_YEAR = 252
MONTHS_PER_YEAR = 12

# Approximate exchange rates (updated periodically)
_EXCHANGE_RATES: dict[str, float] = {
    "GBP": 1.0,
    "USD": 0.79,   # 1 USD = 0.79 GBP
    "EUR": 0.86,   # 1 EUR = 0.86 GBP
}

# Period -> annual multiplier
_PERIOD_MULTIPLIERS: dict[str, float] = {
    "annual": 1.0,
    "monthly": MONTHS_PER_YEAR,
    "weekly": WEEKS_PER_YEAR,
    "daily": WORKING_DAYS_PER_YEAR,
    "hourly": HOURS_PER_WEEK * WEEKS_PER_YEAR,
}


class SalaryNormaliserAgent(BaseSubAgent):
    """Normalises parsed salary to annual GBP."""

    name = "salary_normaliser"
    persona = "Aisha Begum"
    title = "Salary Normalisation Specialist"
    agent_type = "DET"
    description = (
        "Converts parsed salary (any currency, any period) to annual GBP "
        "for consistent comparison against visa thresholds."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Normalise salary to annual GBP.

        Parameters
        ----------
        parsed_salary : dict
            Output from SalaryParserAgent (min, max, currency, period).
        exchange_rates : dict, optional
            Override exchange rates for testing.

        Returns
        -------
        SubAgentResult with data:
            annual_gbp_min   : float | None
            annual_gbp_max   : float | None
            annual_gbp_mid   : float | None
            currency_original: str
            period_original  : str
            multiplier       : float
            exchange_rate    : float
        """
        parsed: dict = kwargs.get("parsed_salary") or {}
        exchange_rates = kwargs.get("exchange_rates", _EXCHANGE_RATES)

        salary_min = parsed.get("min")
        salary_max = parsed.get("max")
        currency = parsed.get("currency", "GBP")
        period = parsed.get("period", "annual")

        if salary_min is None and salary_max is None:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "annual_gbp_min": None,
                    "annual_gbp_max": None,
                    "annual_gbp_mid": None,
                    "currency_original": currency,
                    "period_original": period,
                    "multiplier": 1.0,
                    "exchange_rate": 1.0,
                },
            )

        multiplier = _PERIOD_MULTIPLIERS.get(period, 1.0)
        fx_rate = exchange_rates.get(currency, 1.0)

        def normalise(val: float | None) -> float | None:
            if val is None:
                return None
            return round(val * multiplier * fx_rate, 2)

        annual_min = normalise(salary_min)
        annual_max = normalise(salary_max)

        # Calculate midpoint
        if annual_min is not None and annual_max is not None:
            annual_mid = round((annual_min + annual_max) / 2, 2)
        elif annual_min is not None:
            annual_mid = annual_min
        elif annual_max is not None:
            annual_mid = annual_max
        else:
            annual_mid = None

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "annual_gbp_min": annual_min,
                "annual_gbp_max": annual_max,
                "annual_gbp_mid": annual_mid,
                "currency_original": currency,
                "period_original": period,
                "multiplier": multiplier,
                "exchange_rate": fx_rate,
            },
        )
