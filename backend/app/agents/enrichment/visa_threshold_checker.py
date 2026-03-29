"""Luke Chambers — Visa Threshold Analyst (Enrichment department)."""

from __future__ import annotations

from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Thresholds (updated April 2024)
# ---------------------------------------------------------------------------
GENERAL_THRESHOLD = 38_700
SHORTAGE_THRESHOLD = 23_200  # Minimum for shortage / new entrant routes
NEW_ENTRANT_THRESHOLD = 30_960  # 80% of general for new entrants

# Occupation-specific going rates (SOC 2020 code -> annual GBP).
# This is a representative subset; the full table has ~200 entries.
_OCCUPATION_THRESHOLDS: dict[str, int] = {
    # Healthcare
    "2211": 38_700,  # Medical practitioners
    "2212": 38_700,  # Psychologists
    "2213": 38_700,  # Pharmacists
    "2214": 38_700,  # Ophthalmic opticians
    "2215": 38_700,  # Dental practitioners
    "2217": 38_700,  # Medical radiographers
    "2231": 29_000,  # Nurses (shortage)
    "2232": 29_000,  # Midwives (shortage)
    "2442": 38_700,  # Social workers

    # Engineering
    "2121": 38_700,  # Civil engineers
    "2122": 38_700,  # Mechanical engineers
    "2123": 38_700,  # Electrical engineers
    "2124": 38_700,  # Electronics engineers
    "2126": 38_700,  # Design engineers
    "2127": 38_700,  # Production engineers
    "2129": 38_700,  # Engineering professionals nec

    # IT & Tech
    "2133": 38_700,  # IT specialist managers
    "2134": 38_700,  # IT project managers
    "2135": 38_700,  # IT business analysts
    "2136": 38_700,  # Programmers / software developers
    "2137": 38_700,  # Web design and development
    "2139": 38_700,  # IT professionals nec

    # Science & Research
    "2111": 38_700,  # Chemical scientists
    "2112": 38_700,  # Biological scientists
    "2113": 38_700,  # Biochemists
    "2114": 38_700,  # Physical scientists
    "2119": 38_700,  # Natural science professionals nec

    # Finance
    "2421": 38_700,  # Chartered accountants
    "2422": 38_700,  # Finance / investment analysts
    "2423": 38_700,  # Tax experts
    "2424": 38_700,  # Actuaries, economists, statisticians

    # Education
    "2311": 38_700,  # Higher education teachers
    "2312": 38_700,  # Further education teachers
    "2314": 30_000,  # Secondary teachers (shortage)
    "2315": 30_000,  # Primary teachers

    # Care
    "6145": 23_200,  # Care workers (shortage)
    "6146": 23_200,  # Senior care workers (shortage)
}


class VisaThresholdCheckerAgent(BaseSubAgent):
    """Checks if a salary meets UK Skilled Worker visa minimum thresholds."""

    name = "visa_threshold_checker"
    persona = "Luke Chambers"
    title = "Visa Threshold Analyst"
    agent_type = "DET"
    description = (
        "Compares annual salary against UK visa thresholds including "
        "general, shortage, new entrant, and occupation-specific rates."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Check salary against visa thresholds.

        Parameters
        ----------
        annual_salary : float | None
            Annual salary in GBP.
        soc_code : str | None
            SOC 2020 code for occupation-specific thresholds.
        is_new_entrant : bool
            Whether the applicant qualifies as new entrant (default False).
        is_shortage : bool
            Whether the role is on the shortage list (default False).

        Returns
        -------
        SubAgentResult with data:
            meets_threshold        : bool
            threshold_used         : float
            threshold_type         : str   - "general" | "shortage" | "new_entrant" | "occupation"
            salary                 : float | None
            margin                 : float | None - how far above/below threshold
            margin_pct             : float | None - percentage above/below
        """
        annual_salary = kwargs.get("annual_salary")
        soc_code = kwargs.get("soc_code")
        is_new_entrant = kwargs.get("is_new_entrant", False)
        is_shortage = kwargs.get("is_shortage", False)

        if annual_salary is None:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "meets_threshold": False,
                    "threshold_used": GENERAL_THRESHOLD,
                    "threshold_type": "general",
                    "salary": None,
                    "margin": None,
                    "margin_pct": None,
                    "reason": "No salary data available",
                },
            )

        salary = float(annual_salary)

        # Determine applicable threshold (lowest eligible)
        threshold = GENERAL_THRESHOLD
        threshold_type = "general"

        # Check occupation-specific going rate
        if soc_code and soc_code in _OCCUPATION_THRESHOLDS:
            occ_threshold = _OCCUPATION_THRESHOLDS[soc_code]
            if occ_threshold < threshold:
                threshold = occ_threshold
                threshold_type = "occupation"

        # Shortage route has lower minimum
        if is_shortage:
            if SHORTAGE_THRESHOLD < threshold:
                threshold = SHORTAGE_THRESHOLD
                threshold_type = "shortage"

        # New entrant discount (80% of general threshold)
        if is_new_entrant:
            ne_threshold = NEW_ENTRANT_THRESHOLD
            if ne_threshold < threshold:
                threshold = ne_threshold
                threshold_type = "new_entrant"

        meets = salary >= threshold
        margin = salary - threshold
        margin_pct = (margin / threshold * 100) if threshold > 0 else 0.0

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "meets_threshold": meets,
                "threshold_used": threshold,
                "threshold_type": threshold_type,
                "salary": salary,
                "margin": round(margin, 2),
                "margin_pct": round(margin_pct, 2),
            },
        )
