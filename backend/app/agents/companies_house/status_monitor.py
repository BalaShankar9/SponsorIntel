"""Ade Ogundimu — Company Status Monitor (Companies House department)."""

import logging
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)

# Risk levels by company status
_STATUS_RISK: dict[str, str] = {
    "active": "low",
    "dissolved": "critical",
    "liquidation": "critical",
    "administration": "high",
    "voluntary-arrangement": "high",
    "insolvency-proceedings": "critical",
    "receivership": "critical",
    "open": "low",
    "closed": "medium",
    "converted-closed": "medium",
    "dormant": "medium",
}


class StatusMonitorAgent(BaseSubAgent):
    name = "status_monitor"
    persona = "Ade Ogundimu"
    title = "Company Status Monitor"
    agent_type = "DET"
    description = (
        "Monitors Companies House for company status changes "
        "(active, dissolved, liquidation, administration, etc.) and "
        "assigns a risk level to the current status."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        ch_api = kwargs["ch_api"]
        company_number: str = kwargs["company_number"]
        stored_status: str | None = kwargs.get("stored_status")

        data = await ch_api._get(f"/company/{company_number}")

        if not data:
            return SubAgentResult(
                success=True,
                data={
                    "status": None,
                    "changed": False,
                    "previous_status": stored_status,
                    "risk_level": "low",
                },
            )

        current_status = data.get("company_status", "").lower()
        changed = bool(
            stored_status
            and current_status
            and current_status != stored_status.lower()
        )
        risk_level = _STATUS_RISK.get(current_status, "medium")

        return SubAgentResult(
            success=True,
            data={
                "status": current_status,
                "changed": changed,
                "previous_status": stored_status,
                "risk_level": risk_level,
                "company_name": data.get("company_name"),
                "has_charges": data.get("has_charges", False),
                "has_insolvency_history": data.get("has_insolvency_history", False),
                "accounts_overdue": data.get("accounts", {}).get("overdue", False),
                "confirmation_statement_overdue": (
                    data.get("confirmation_statement", {}).get("overdue", False)
                ),
                "last_accounts_date": (
                    data.get("accounts", {})
                    .get("last_accounts", {})
                    .get("made_up_to")
                ),
            },
        )
