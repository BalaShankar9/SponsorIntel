"""Ibrahim Hassan — SOC Code Classifier (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Deterministic fallback: keyword -> (SOC code, SOC title)
# Covers top ~50 common roles to avoid LLM calls for straightforward titles.
# ---------------------------------------------------------------------------
_KEYWORD_SOC_MAP: list[tuple[re.Pattern, str, str]] = [
    # Software & IT
    (re.compile(r"\bsoftware\s+(?:engineer|developer)\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bfull[\s-]?stack\s+(?:engineer|developer)\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bback[\s-]?end\s+(?:engineer|developer)\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bfront[\s-]?end\s+(?:engineer|developer)\b", re.I), "2137", "Web design and development professionals"),
    (re.compile(r"\bweb\s+developer\b", re.I), "2137", "Web design and development professionals"),
    (re.compile(r"\bdevops\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bplatform\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bsite\s+reliability\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bsre\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bdata\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bdata\s+scientist\b", re.I), "2425", "Actuaries, economists and statisticians"),
    (re.compile(r"\bdata\s+analyst\b", re.I), "2135", "IT business analysts, architects and systems designers"),
    (re.compile(r"\bmachine\s+learning\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bml\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bai\s+engineer\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\bbusiness\s+analyst\b", re.I), "2135", "IT business analysts, architects and systems designers"),
    (re.compile(r"\bsolutions?\s+architect\b", re.I), "2135", "IT business analysts, architects and systems designers"),
    (re.compile(r"\btechnical\s+architect\b", re.I), "2135", "IT business analysts, architects and systems designers"),
    (re.compile(r"\bit\s+(?:project\s+)?manager\b", re.I), "2134", "IT project and programme managers"),
    (re.compile(r"\bscrum\s+master\b", re.I), "2134", "IT project and programme managers"),
    (re.compile(r"\bproduct\s+manager\b", re.I), "2134", "IT project and programme managers"),
    (re.compile(r"\bcloud\s+engineer\b", re.I), "2139", "IT and telecommunications professionals nec"),
    (re.compile(r"\bnetwork\s+engineer\b", re.I), "2139", "IT and telecommunications professionals nec"),
    (re.compile(r"\bcybersecurity\s+(?:analyst|engineer|consultant)\b", re.I), "2139", "IT and telecommunications professionals nec"),
    (re.compile(r"\bsecurity\s+(?:analyst|engineer|consultant)\b", re.I), "2139", "IT and telecommunications professionals nec"),
    (re.compile(r"\bdatabase\s+administrator\b", re.I), "2139", "IT and telecommunications professionals nec"),
    (re.compile(r"\bux\s+(?:designer|researcher)\b", re.I), "2137", "Web design and development professionals"),
    (re.compile(r"\bui\s+designer\b", re.I), "2137", "Web design and development professionals"),
    (re.compile(r"\bqa\s+(?:engineer|tester|analyst)\b", re.I), "2136", "Programmers and software development professionals"),
    (re.compile(r"\btest\s+(?:engineer|analyst|automation)\b", re.I), "2136", "Programmers and software development professionals"),

    # Healthcare
    (re.compile(r"\b(?:registered\s+)?nurse\b", re.I), "2231", "Nurses"),
    (re.compile(r"\bmidwife\b", re.I), "2232", "Midwives"),
    (re.compile(r"\bdoctor\b", re.I), "2211", "Medical practitioners"),
    (re.compile(r"\bconsultant\s+(?:physician|surgeon|psychiatrist|anaesthetist)\b", re.I), "2211", "Medical practitioners"),
    (re.compile(r"\bpharmacist\b", re.I), "2213", "Pharmacists"),
    (re.compile(r"\bradiographer\b", re.I), "2217", "Medical radiographers"),
    (re.compile(r"\bphysiotherapist\b", re.I), "2219", "Health professionals nec"),
    (re.compile(r"\boccupational\s+therapist\b", re.I), "2219", "Health professionals nec"),
    (re.compile(r"\bsocial\s+worker\b", re.I), "2442", "Social workers"),
    (re.compile(r"\bcare\s+(?:worker|assistant)\b", re.I), "6145", "Care workers and home carers"),
    (re.compile(r"\bsenior\s+care\s+worker\b", re.I), "6146", "Senior care workers"),

    # Engineering
    (re.compile(r"\bcivil\s+engineer\b", re.I), "2121", "Civil engineers"),
    (re.compile(r"\bmechanical\s+engineer\b", re.I), "2122", "Mechanical engineers"),
    (re.compile(r"\belectrical\s+engineer\b", re.I), "2123", "Electrical engineers"),
    (re.compile(r"\belectronics?\s+engineer\b", re.I), "2124", "Electronics engineers"),

    # Finance
    (re.compile(r"\baccountant\b", re.I), "2421", "Chartered and certified accountants"),
    (re.compile(r"\bfinancial\s+analyst\b", re.I), "2422", "Finance and investment analysts and advisers"),
    (re.compile(r"\bactuary\b", re.I), "2425", "Actuaries, economists and statisticians"),

    # Education
    (re.compile(r"\bteacher\b", re.I), "2314", "Secondary education teaching professionals"),
    (re.compile(r"\blecturer\b", re.I), "2311", "Higher education teaching professionals"),
]


class SOCClassifierAgent(BaseSubAgent):
    """Classifies jobs into SOC 2020 codes using LLM with deterministic fallback."""

    name = "soc_classifier"
    persona = "Ibrahim Hassan"
    title = "SOC Code Classifier"
    agent_type = "LLM"
    description = (
        "Classifies jobs into UK SOC 2020 codes. Uses deterministic keyword "
        "matching for top 50 common roles, falling back to LLM for ambiguous cases."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Classify a job into a SOC code.

        Parameters
        ----------
        title : str
            Job title.
        description : str
            Job description.

        Returns
        -------
        SubAgentResult with data:
            soc_code     : str | None
            soc_title    : str | None
            confidence   : str  - "high" | "medium" | "low"
            method       : str  - "deterministic" | "llm"
        """
        title: str = kwargs.get("title", "") or ""
        description: str = kwargs.get("description", "") or ""

        # --- Deterministic pass ---
        for pattern, soc_code, soc_title in _KEYWORD_SOC_MAP:
            if pattern.search(title):
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "soc_code": soc_code,
                        "soc_title": soc_title,
                        "confidence": "high",
                        "method": "deterministic",
                    },
                )

        # Fallback: try matching against description if title didn't match
        for pattern, soc_code, soc_title in _KEYWORD_SOC_MAP:
            if pattern.search(description):
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "soc_code": soc_code,
                        "soc_title": soc_title,
                        "confidence": "medium",
                        "method": "deterministic",
                    },
                )

        # --- LLM pass ---
        # In production this would call the LLM with a structured prompt.
        # For now, return unknown and flag for LLM enrichment.
        try:
            result = await self._classify_with_llm(title, description)
            if result:
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "soc_code": result.get("soc_code"),
                        "soc_title": result.get("soc_title"),
                        "confidence": "medium",
                        "method": "llm",
                    },
                )
        except Exception:
            pass

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "soc_code": None,
                "soc_title": None,
                "confidence": "low",
                "method": "none",
            },
        )

    async def _classify_with_llm(self, title: str, description: str) -> dict[str, str] | None:
        """
        Call LLM to classify the job into a SOC code.

        Override this method with actual LLM integration. The prompt should
        instruct the model to return a JSON with soc_code and soc_title from
        the UK SOC 2020 classification.
        """
        # Placeholder: import and call your LLM client here.
        # Example:
        #   from app.core.llm import llm_client
        #   response = await llm_client.complete(
        #       system="You are a UK SOC 2020 classification expert...",
        #       prompt=f"Classify this job:\nTitle: {title}\nDescription: {description[:500]}",
        #       response_format={"type": "json_object"},
        #   )
        #   return json.loads(response.text)
        return None
