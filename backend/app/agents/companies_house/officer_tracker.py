"""Emily Hartley — Officer Tracking Specialist (Companies House department)."""

import logging
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

logger = logging.getLogger(__name__)


class OfficerTrackerAgent(BaseSubAgent):
    name = "officer_tracker"
    persona = "Emily Hartley"
    title = "Officer Tracking Specialist"
    agent_type = "DET"
    description = (
        "Tracks director and officer changes at Companies House, "
        "detecting appointments and resignations since last check."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        ch_api = kwargs["ch_api"]
        company_number: str = kwargs["company_number"]
        last_check_date: str | None = kwargs.get("last_check_date")

        data = await ch_api._get(
            f"/company/{company_number}/officers?items_per_page=10"
        )

        if not data or not data.get("items"):
            return SubAgentResult(
                success=True,
                data={
                    "changes": [],
                    "total_officers": 0,
                    "recent_resignations": 0,
                },
            )

        officers = data["items"]
        total_officers = data.get("total_results", len(officers))
        changes: list[dict] = []
        recent_resignations = 0

        for officer in officers:
            appointed_on = officer.get("appointed_on")
            resigned_on = officer.get("resigned_on")
            name = officer.get("name", "Unknown")
            role = officer.get("officer_role", "unknown")

            # Detect new appointments since last check
            if last_check_date and appointed_on and appointed_on > last_check_date:
                changes.append({
                    "type": "appointment",
                    "name": name,
                    "role": role,
                    "date": appointed_on,
                })

            # Detect resignations since last check
            if resigned_on:
                if not last_check_date or resigned_on > last_check_date:
                    recent_resignations += 1
                    changes.append({
                        "type": "resignation",
                        "name": name,
                        "role": role,
                        "date": resigned_on,
                    })

        return SubAgentResult(
            success=True,
            data={
                "changes": changes,
                "total_officers": total_officers,
                "recent_resignations": recent_resignations,
            },
        )
