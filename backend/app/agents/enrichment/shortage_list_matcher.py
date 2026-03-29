"""Meera Nair — Shortage List Specialist (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# UK Immigration Salary List / Shortage Occupation List (representative)
# SOC 2020 code -> (title, keywords for fuzzy matching)
# ---------------------------------------------------------------------------
_SHORTAGE_OCCUPATIONS: dict[str, dict[str, Any]] = {
    # Healthcare
    "2211": {"title": "Medical practitioners", "keywords": ["doctor", "physician", "gp", "general practitioner", "consultant", "registrar", "medical officer"]},
    "2231": {"title": "Nurses", "keywords": ["nurse", "nursing", "registered nurse", "staff nurse", "ward nurse", "clinical nurse"]},
    "2232": {"title": "Midwives", "keywords": ["midwife", "midwifery"]},
    "2217": {"title": "Medical radiographers", "keywords": ["radiographer", "radiography", "diagnostic radiographer", "therapeutic radiographer"]},
    "2219": {"title": "Health professionals nec", "keywords": ["paramedic", "orthoptist", "podiatrist", "speech therapist", "occupational therapist"]},
    "2442": {"title": "Social workers", "keywords": ["social worker", "children's social worker", "adult social worker"]},

    # Engineering
    "2121": {"title": "Civil engineers", "keywords": ["civil engineer", "structural engineer", "geotechnical engineer"]},
    "2122": {"title": "Mechanical engineers", "keywords": ["mechanical engineer"]},
    "2123": {"title": "Electrical engineers", "keywords": ["electrical engineer", "power systems engineer"]},
    "2124": {"title": "Electronics engineers", "keywords": ["electronics engineer", "embedded engineer"]},
    "2126": {"title": "Design and development engineers", "keywords": ["design engineer", "development engineer", "r&d engineer"]},
    "2127": {"title": "Production and process engineers", "keywords": ["production engineer", "process engineer", "manufacturing engineer"]},

    # IT & Digital
    "2133": {"title": "IT specialist managers", "keywords": ["it manager", "it director", "head of it", "cto", "chief technology officer"]},
    "2134": {"title": "IT project and programme managers", "keywords": ["it project manager", "programme manager", "scrum master", "delivery manager"]},
    "2135": {"title": "IT business analysts, architects and systems designers", "keywords": ["business analyst", "solutions architect", "systems architect", "enterprise architect", "technical architect"]},
    "2136": {"title": "Programmers and software development professionals", "keywords": ["software engineer", "software developer", "programmer", "full stack", "backend developer", "frontend developer", "devops engineer", "sre", "platform engineer", "data engineer"]},
    "2137": {"title": "Web design and development professionals", "keywords": ["web developer", "web designer", "ui developer", "ux developer"]},
    "2139": {"title": "IT and telecommunications professionals nec", "keywords": ["cybersecurity", "security analyst", "network engineer", "cloud engineer", "infrastructure engineer", "database administrator"]},

    # Science
    "2111": {"title": "Chemical scientists", "keywords": ["chemist", "chemical scientist", "analytical chemist"]},
    "2112": {"title": "Biological scientists and biochemists", "keywords": ["biologist", "biochemist", "microbiologist", "biomedical scientist"]},
    "2113": {"title": "Physical scientists", "keywords": ["physicist", "geophysicist", "meteorologist"]},

    # Education
    "2314": {"title": "Secondary education teaching professionals", "keywords": ["secondary teacher", "secondary school teacher", "maths teacher", "physics teacher", "chemistry teacher", "science teacher", "computer science teacher"]},

    # Care
    "6145": {"title": "Care workers and home carers", "keywords": ["care worker", "home carer", "care assistant", "support worker", "domiciliary care"]},
    "6146": {"title": "Senior care workers", "keywords": ["senior care worker", "senior carer", "team leader care", "care supervisor"]},

    # Construction
    "5215": {"title": "Welding trades", "keywords": ["welder", "welding", "pipe welder", "coded welder"]},
    "5241": {"title": "Electricians and electrical fitters", "keywords": ["electrician", "electrical fitter", "electrical installer"]},
    "5312": {"title": "Bricklayers and masons", "keywords": ["bricklayer", "mason", "stonemason"]},
    "5313": {"title": "Roofers, roof tilers and slaters", "keywords": ["roofer", "roof tiler", "slater"]},
    "5316": {"title": "Glaziers, window fabricators and fitters", "keywords": ["glazier", "window fitter", "window fabricator"]},

    # Veterinary
    "2216": {"title": "Veterinarians", "keywords": ["vet", "veterinarian", "veterinary surgeon", "veterinary practitioner"]},

    # Arts (specific)
    "3411": {"title": "Artists", "keywords": ["animator", "vfx artist", "3d artist", "concept artist"]},
    "3414": {"title": "Dancers and choreographers", "keywords": ["ballet dancer", "choreographer", "classical ballet"]},
    "3415": {"title": "Musicians", "keywords": ["orchestral musician", "classical musician"]},
}


def _build_keyword_index() -> dict[str, list[str]]:
    """Build a keyword -> list of SOC codes index for fast lookup."""
    index: dict[str, list[str]] = {}
    for soc_code, entry in _SHORTAGE_OCCUPATIONS.items():
        for kw in entry["keywords"]:
            index.setdefault(kw.lower(), []).append(soc_code)
    return index


_KEYWORD_INDEX = _build_keyword_index()


class ShortageListMatcherAgent(BaseSubAgent):
    """Matches jobs against the UK Shortage Occupation List."""

    name = "shortage_list_matcher"
    persona = "Meera Nair"
    title = "Shortage List Specialist"
    agent_type = "DET"
    description = (
        "Deterministic matcher that checks jobs against the UK Immigration "
        "Salary List (Shortage Occupation List) by SOC code or keyword."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Check if a job matches the shortage occupation list.

        Parameters
        ----------
        title : str
            Job title.
        soc_code : str | None
            SOC 2020 code if already classified.
        description : str, optional
            Job description for keyword matching.

        Returns
        -------
        SubAgentResult with data:
            on_shortage_list  : bool
            match_type        : str   - "soc_code" | "keyword" | "none"
            matched_soc_code  : str | None
            soc_title         : str | None
            matched_keywords  : list[str]
            related           : bool  - close but not exact match
        """
        title: str = (kwargs.get("title", "") or "").lower()
        soc_code: str | None = kwargs.get("soc_code")
        description: str = (kwargs.get("description", "") or "").lower()
        combined_text = f"{title} {description}"

        # Direct SOC code match
        if soc_code and soc_code in _SHORTAGE_OCCUPATIONS:
            entry = _SHORTAGE_OCCUPATIONS[soc_code]
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "on_shortage_list": True,
                    "match_type": "soc_code",
                    "matched_soc_code": soc_code,
                    "soc_title": entry["title"],
                    "matched_keywords": [],
                    "related": False,
                },
            )

        # Keyword matching against title (high confidence)
        matched_keywords: list[str] = []
        matched_soc_codes: set[str] = set()

        for kw, soc_codes in _KEYWORD_INDEX.items():
            pattern = re.compile(r"\b" + re.escape(kw) + r"\b", re.I)
            if pattern.search(title):
                matched_keywords.append(kw)
                matched_soc_codes.update(soc_codes)

        if matched_soc_codes:
            best_soc = sorted(matched_soc_codes)[0]
            entry = _SHORTAGE_OCCUPATIONS[best_soc]
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "on_shortage_list": True,
                    "match_type": "keyword",
                    "matched_soc_code": best_soc,
                    "soc_title": entry["title"],
                    "matched_keywords": matched_keywords,
                    "related": False,
                },
            )

        # Keyword matching against description (lower confidence -> related)
        desc_keywords: list[str] = []
        desc_soc_codes: set[str] = set()

        for kw, soc_codes in _KEYWORD_INDEX.items():
            pattern = re.compile(r"\b" + re.escape(kw) + r"\b", re.I)
            if pattern.search(combined_text):
                desc_keywords.append(kw)
                desc_soc_codes.update(soc_codes)

        if desc_soc_codes:
            best_soc = sorted(desc_soc_codes)[0]
            entry = _SHORTAGE_OCCUPATIONS[best_soc]
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "on_shortage_list": False,
                    "match_type": "keyword",
                    "matched_soc_code": best_soc,
                    "soc_title": entry["title"],
                    "matched_keywords": desc_keywords,
                    "related": True,
                },
            )

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "on_shortage_list": False,
                "match_type": "none",
                "matched_soc_code": None,
                "soc_title": None,
                "matched_keywords": [],
                "related": False,
            },
        )
