"""Nikhil Verma — Seniority Detection Analyst (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Deterministic seniority patterns (ordered by specificity / priority)
# ---------------------------------------------------------------------------
_SENIORITY_PATTERNS: list[tuple[str, re.Pattern]] = [
    # C-level
    ("c_level", re.compile(r"\b(?:CEO|CTO|CFO|COO|CIO|CISO|CMO|CPO|CDO|Chief\s+\w+\s+Officer)\b", re.I)),

    # VP
    ("vp", re.compile(r"\b(?:VP|Vice\s+President)\b", re.I)),
    ("vp", re.compile(r"\bSVP\b")),
    ("vp", re.compile(r"\bEVP\b")),

    # Director
    ("director", re.compile(r"\bDirector\b", re.I)),
    ("director", re.compile(r"\bManaging\s+Director\b", re.I)),
    ("director", re.compile(r"\bAssociate\s+Director\b", re.I)),
    ("director", re.compile(r"\bGroup\s+Director\b", re.I)),

    # Head of
    ("director", re.compile(r"\bHead\s+of\b", re.I)),

    # Principal / Staff / Distinguished
    ("principal", re.compile(r"\bPrincipal\b", re.I)),
    ("staff", re.compile(r"\bStaff\s+(?:Engineer|Developer|Scientist|Designer)\b", re.I)),
    ("principal", re.compile(r"\bDistinguished\s+Engineer\b", re.I)),
    ("principal", re.compile(r"\bFellow\b", re.I)),

    # Lead / Manager
    ("lead", re.compile(r"\bLead\s+(?!Genera)\w+\b", re.I)),
    ("lead", re.compile(r"\bTeam\s+Lead\b", re.I)),
    ("lead", re.compile(r"\bTech\s+Lead\b", re.I)),
    ("lead", re.compile(r"\bEngineering\s+(?:Manager|Lead)\b", re.I)),
    ("lead", re.compile(r"\bManager\b", re.I)),

    # Senior
    ("senior", re.compile(r"\bSenior\b", re.I)),
    ("senior", re.compile(r"\bSr\.?\b", re.I)),
    ("senior", re.compile(r"\bSenior[\s-]Level\b", re.I)),

    # Mid-level (explicit)
    ("mid", re.compile(r"\bMid[\s-]?Level\b", re.I)),
    ("mid", re.compile(r"\bIntermediate\b", re.I)),

    # Junior
    ("junior", re.compile(r"\bJunior\b", re.I)),
    ("junior", re.compile(r"\bJr\.?\b", re.I)),
    ("junior", re.compile(r"\bAssociate\s+(?!Director)\w+\b", re.I)),
    ("junior", re.compile(r"\bEntry[\s-]?Level\b", re.I)),

    # Intern / Graduate / Trainee / Apprentice
    ("intern", re.compile(r"\bIntern(?:ship)?\b", re.I)),
    ("intern", re.compile(r"\bGraduate\s+(?:Scheme|Programme|Program|Role|Position|Trainee)\b", re.I)),
    ("intern", re.compile(r"\bGraduate\b", re.I)),
    ("intern", re.compile(r"\bTrainee\b", re.I)),
    ("intern", re.compile(r"\bApprenti(?:ce|ceship)\b", re.I)),
    ("intern", re.compile(r"\bPlacement\s+(?:Student|Year)\b", re.I)),
]

# Experience years -> seniority (used for description-based inference)
_EXPERIENCE_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("senior", re.compile(r"\b(?:8|9|10|1[0-9]|20)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)\b", re.I)),
    ("senior", re.compile(r"\b(?:5|6|7)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)\b", re.I)),
    ("mid", re.compile(r"\b(?:3|4)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)\b", re.I)),
    ("junior", re.compile(r"\b(?:1|2)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)\b", re.I)),
    ("intern", re.compile(r"\b(?:0|no)\s+(?:years?|yrs?)?\s*(?:of\s+)?(?:experience|exp)\b", re.I)),
]


class SeniorityDetectorAgent(BaseSubAgent):
    """Detects seniority level from job title and description."""

    name = "seniority_detector"
    persona = "Nikhil Verma"
    title = "Seniority Detection Analyst"
    agent_type = "HYB"
    description = (
        "Hybrid seniority detector: deterministic keyword matching on title "
        "first, experience-year matching on description, then LLM fallback."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Detect seniority level.

        Parameters
        ----------
        title : str
            Job title.
        description : str
            Job description.

        Returns
        -------
        SubAgentResult with data:
            seniority    : str  - "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | "staff" | "director" | "vp" | "c_level"
            confidence   : str  - "high" | "medium" | "low"
            method       : str  - "title_keyword" | "description_keyword" | "experience_years" | "llm" | "default"
        """
        title: str = kwargs.get("title", "") or ""
        description: str = kwargs.get("description", "") or ""

        # --- Pass 1: Title keyword matching (highest confidence) ---
        for seniority, pattern in _SENIORITY_PATTERNS:
            if pattern.search(title):
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "seniority": seniority,
                        "confidence": "high",
                        "method": "title_keyword",
                    },
                )

        # --- Pass 2: Experience years in description ---
        for seniority, pattern in _EXPERIENCE_PATTERNS:
            if pattern.search(description):
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "seniority": seniority,
                        "confidence": "medium",
                        "method": "experience_years",
                    },
                )

        # --- Pass 3: Description keyword matching (lower confidence) ---
        for seniority, pattern in _SENIORITY_PATTERNS:
            if pattern.search(description):
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "seniority": seniority,
                        "confidence": "medium",
                        "method": "description_keyword",
                    },
                )

        # --- Pass 4: LLM fallback for ambiguous cases ---
        try:
            result = await self._detect_with_llm(title, description)
            if result:
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "seniority": result,
                        "confidence": "medium",
                        "method": "llm",
                    },
                )
        except Exception:
            pass

        # --- Default: assume mid-level ---
        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "seniority": "mid",
                "confidence": "low",
                "method": "default",
            },
        )

    async def _detect_with_llm(self, title: str, description: str) -> str | None:
        """
        Call LLM to detect seniority for ambiguous cases.
        Override with actual LLM integration.
        """
        # Placeholder for LLM call
        # from app.core.llm import llm_client
        # response = await llm_client.complete(
        #     system="Classify the seniority level...",
        #     prompt=f"Title: {title}\nDescription: {description[:300]}",
        # )
        # return response.text.strip().lower()
        return None
