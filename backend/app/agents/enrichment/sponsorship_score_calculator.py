"""Owen Griffiths — Sponsorship Score Calculator (Enrichment department)."""

from __future__ import annotations

from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult


class SponsorshipScoreCalculatorAgent(BaseSubAgent):
    """Computes a multi-track sponsorship likelihood score (0-100)."""

    name = "sponsorship_score_calculator"
    persona = "Owen Griffiths"
    title = "Sponsorship Score Calculator"
    agent_type = "DET"
    description = (
        "Calculates a 4-track sponsorship score (company, description, "
        "salary, shortage) producing a 0-100 overall likelihood."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Calculate sponsorship score.

        Parameters
        ----------
        register_data : dict
            Output from SponsorRegisterMatcherAgent.
        keyword_data : dict
            Output from SponsorshipKeywordScannerAgent.
        visa_data : dict
            Output from VisaThresholdCheckerAgent.
        shortage_data : dict
            Output from ShortageListMatcherAgent.

        Returns
        -------
        SubAgentResult with data:
            total             : int  (0-100)
            company_score     : int  (0-40)
            description_score : int  (0-35)
            salary_score      : int  (0-15)
            shortage_score    : int  (0-10)
            breakdown         : dict  - detailed point allocation
            tier              : str   - "very_high" | "high" | "medium" | "low" | "unlikely"
        """
        register_data: dict = kwargs.get("register_data") or {}
        keyword_data: dict = kwargs.get("keyword_data") or {}
        visa_data: dict = kwargs.get("visa_data") or {}
        shortage_data: dict = kwargs.get("shortage_data") or {}

        breakdown: dict[str, Any] = {}

        # ---- Company Track (max 40) ----
        company_score = 0
        company_details: dict[str, int] = {}

        if register_data.get("on_register", False):
            company_score += 25
            company_details["on_register"] = 25

            if register_data.get("is_a_rated", False):
                company_score += 10
                company_details["a_rated"] = 10

            # Active hiring signal (if the company has multiple sponsored roles)
            company_score += 5
            company_details["active_hiring"] = 5

        company_score = min(company_score, 40)
        breakdown["company"] = company_details

        # ---- Description Track (max 35) ----
        description_score = 0
        desc_details: dict[str, int] = {}

        positive_signals = keyword_data.get("positive_signals", [])
        negative_signals = keyword_data.get("negative_signals", [])
        strong_positive = keyword_data.get("strong_positive", False)

        # Strong positive signals worth more
        if strong_positive:
            description_score += 15
            desc_details["strong_positive_signal"] = 15

        # Each additional positive signal adds points
        remaining_positives = [
            s for s in positive_signals
            if s not in {
                "visa_sponsorship", "sponsor_visa", "will_sponsor",
                "can_sponsor", "able_to_sponsor", "happy_to_sponsor",
                "willing_to_sponsor", "sponsorship_available",
                "sponsorship_offered", "sponsorship_provided",
                "offer_sponsorship", "provide_sponsorship",
                "certificate_of_sponsorship", "skilled_worker_visa",
                "licensed_sponsor",
            } or not strong_positive
        ]

        signal_points = min(len(remaining_positives) * 4, 20)
        if signal_points > 0:
            description_score += signal_points
            desc_details["additional_signals"] = signal_points

        # Negative signals reduce score
        if negative_signals:
            penalty = min(len(negative_signals) * 10, 30)
            description_score -= penalty
            desc_details["negative_penalty"] = -penalty

        description_score = max(0, min(description_score, 35))
        breakdown["description"] = desc_details

        # ---- Salary Track (max 15) ----
        salary_score = 0
        salary_details: dict[str, int] = {}

        salary = visa_data.get("salary")
        meets_threshold = visa_data.get("meets_threshold", False)
        margin_pct = visa_data.get("margin_pct")

        if salary is None:
            salary_score = 0
            salary_details["no_salary_data"] = 0
        elif meets_threshold:
            salary_score = 15
            salary_details["above_threshold"] = 15
        elif margin_pct is not None and margin_pct >= -10:
            salary_score = 10
            salary_details["within_10pct"] = 10
        else:
            salary_score = 5
            salary_details["below_threshold"] = 5

        salary_score = min(salary_score, 15)
        breakdown["salary"] = salary_details

        # ---- Shortage Track (max 10) ----
        shortage_score = 0
        shortage_details: dict[str, int] = {}

        if shortage_data.get("on_shortage_list", False):
            shortage_score = 10
            shortage_details["on_shortage_list"] = 10
        elif shortage_data.get("related", False):
            shortage_score = 5
            shortage_details["related_occupation"] = 5

        shortage_score = min(shortage_score, 10)
        breakdown["shortage"] = shortage_details

        # ---- Total ----
        total = company_score + description_score + salary_score + shortage_score
        total = max(0, min(total, 100))

        # Tier classification
        if total >= 80:
            tier = "very_high"
        elif total >= 60:
            tier = "high"
        elif total >= 40:
            tier = "medium"
        elif total >= 20:
            tier = "low"
        else:
            tier = "unlikely"

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "total": total,
                "company_score": company_score,
                "description_score": description_score,
                "salary_score": salary_score,
                "shortage_score": shortage_score,
                "breakdown": breakdown,
                "tier": tier,
            },
        )
