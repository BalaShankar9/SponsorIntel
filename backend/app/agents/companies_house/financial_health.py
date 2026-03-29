"""Rahul Khanna — Financial Health Analyst (Companies House department)."""

import logging
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Points deducted from base score of 100 for each risk factor
_RISK_DEDUCTIONS: dict[str, int] = {
    "has_charges": 10,
    "high_charge_count": 15,       # > 5 outstanding charges
    "has_insolvency_history": 25,
    "accounts_overdue": 20,
    "confirmation_statement_overdue": 15,
    "dissolved_or_liquidation": 30,
}


class FinancialHealthAgent(BaseSubAgent):
    name = "financial_health"
    persona = "Rahul Khanna"
    title = "Financial Health Analyst"
    agent_type = "DET"
    description = (
        "Assesses financial health by checking Companies House for charges, "
        "insolvency history, overdue accounts, and computing a credit risk score."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        ch_api = kwargs["ch_api"]
        company_number: str = kwargs["company_number"]
        stored_charge_count: int | None = kwargs.get("stored_charge_count")
        company_status: str | None = kwargs.get("company_status")

        # Fetch charges data
        charges_data = await ch_api._get(f"/company/{company_number}/charges")

        # Fetch main profile for overdue flags
        profile_data = await ch_api._get(f"/company/{company_number}")

        # Parse charges
        current_charge_count = 0
        has_charges = False
        if charges_data and charges_data.get("items"):
            has_charges = True
            current_charge_count = charges_data.get("total_count", len(charges_data["items"]))

        has_new_charges = bool(
            stored_charge_count is not None
            and current_charge_count > stored_charge_count
        )

        # Parse profile flags
        has_insolvency_history = False
        accounts_overdue = False
        confirmation_statement_overdue = False

        if profile_data:
            has_insolvency_history = profile_data.get("has_insolvency_history", False)
            accounts_overdue = profile_data.get("accounts", {}).get("overdue", False)
            confirmation_statement_overdue = (
                profile_data.get("confirmation_statement", {}).get("overdue", False)
            )

        # Compute credit risk score (starts at 100, deductions for risk factors)
        credit_risk_score = 100
        risk_factors: list[str] = []

        if has_charges:
            credit_risk_score -= _RISK_DEDUCTIONS["has_charges"]
            risk_factors.append(f"has_charges ({current_charge_count})")

        if current_charge_count > 5:
            credit_risk_score -= _RISK_DEDUCTIONS["high_charge_count"]
            risk_factors.append(f"high_charge_count ({current_charge_count})")

        if has_insolvency_history:
            credit_risk_score -= _RISK_DEDUCTIONS["has_insolvency_history"]
            risk_factors.append("has_insolvency_history")

        if accounts_overdue:
            credit_risk_score -= _RISK_DEDUCTIONS["accounts_overdue"]
            risk_factors.append("accounts_overdue")

        if confirmation_statement_overdue:
            credit_risk_score -= _RISK_DEDUCTIONS["confirmation_statement_overdue"]
            risk_factors.append("confirmation_statement_overdue")

        if company_status and company_status.lower() in (
            "dissolved", "liquidation", "insolvency-proceedings", "receivership",
        ):
            credit_risk_score -= _RISK_DEDUCTIONS["dissolved_or_liquidation"]
            risk_factors.append(f"status_{company_status}")

        credit_risk_score = max(credit_risk_score, 0)

        return SubAgentResult(
            success=True,
            data={
                "credit_risk_score": credit_risk_score,
                "risk_factors": risk_factors,
                "has_new_charges": has_new_charges,
                "has_charges": has_charges,
                "charge_count": current_charge_count,
                "has_insolvency_history": has_insolvency_history,
                "accounts_overdue": accounts_overdue,
                "confirmation_statement_overdue": confirmation_statement_overdue,
            },
        )
