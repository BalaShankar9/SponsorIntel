"""Sienna Carr — Filing Compliance Checker (Companies House department)."""

import logging
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)


class FilingCheckerAgent(BaseSubAgent):
    name = "filing_checker"
    persona = "Sienna Carr"
    title = "Filing Compliance Checker"
    agent_type = "DET"
    description = (
        "Checks Companies House filing history for new filings "
        "(accounts, annual returns, resolutions) since last check."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        ch_api = kwargs["ch_api"]
        company_number: str = kwargs["company_number"]
        stored_last_accounts_date: str | None = kwargs.get("stored_last_accounts_date")

        data = await ch_api._get(
            f"/company/{company_number}/filing-history?items_per_page=5"
        )

        if not data or not data.get("items"):
            return SubAgentResult(
                success=True,
                data={"new_filings": [], "filing_count": 0},
            )

        filings = data["items"]
        new_filings = []

        for filing in filings:
            filing_date = filing.get("date")
            # If we have a stored date, only include filings newer than it
            if stored_last_accounts_date and filing_date:
                if filing_date <= stored_last_accounts_date:
                    continue

            new_filings.append({
                "date": filing_date,
                "category": filing.get("category"),
                "type": filing.get("type"),
                "description": filing.get("description"),
                "description_values": filing.get("description_values", {}),
            })

        return SubAgentResult(
            success=True,
            data={
                "new_filings": new_filings,
                "filing_count": len(new_filings),
            },
        )
