"""Fatima Al-Rashid — Search Priority Analyst (Acquisition department)."""

import logging
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)

# ---- TIER 0: Sponsorship-specific queries (highest priority) ----
# These directly find jobs that mention visa sponsorship.
SPONSORSHIP_KEYWORDS = [
    "visa sponsorship",
    "sponsor visa",
    "skilled worker visa",
    "tier 2 visa",
    "certificate of sponsorship",
    "sponsorship available",
    "will sponsor",
    "visa sponsorship UK",
    "sponsor licence",
    "international candidates welcome",
]

# ---- TIER 1: UK shortage occupation keywords ----
SHORTAGE_KEYWORDS = [
    "software engineer", "data engineer", "devops engineer",
    "registered nurse", "care worker", "social worker",
    "civil engineer", "structural engineer", "quantity surveyor",
    "teacher", "secondary school teacher", "maths teacher",
    "pharmacist", "radiographer", "occupational therapist",
    "accountant", "financial analyst", "auditor",
    "chef", "veterinarian", "physiotherapist",
    "speech therapist", "dental practitioner", "medical practitioner",
    "architect", "town planner",
    "electrical engineer", "mechanical engineer", "chemical engineer",
    "biomedical scientist", "clinical psychologist",
]

# ---- TIER 2: High-demand tech & professional roles ----
TECH_KEYWORDS = [
    "backend developer", "frontend developer", "full stack developer",
    "machine learning engineer", "data scientist", "cloud architect",
    "cybersecurity analyst", "product manager", "scrum master",
    "ui/ux designer", "mobile developer", "qa engineer",
    "site reliability engineer", "platform engineer", "data analyst",
    "solutions architect", "technical lead", "engineering manager",
    "python developer", "java developer", "react developer",
    "business analyst", "project manager", "programme manager",
    "marketing manager", "hr manager", "operations manager",
    "supply chain manager", "logistics coordinator",
    "research scientist", "bioinformatics", "AI engineer",
]

# ---- TIER 3: Healthcare & public sector (high sponsorship volume) ----
HEALTHCARE_KEYWORDS = [
    "NHS nurse", "healthcare assistant", "support worker",
    "mental health nurse", "midwife", "paramedic",
    "medical officer", "consultant doctor", "junior doctor",
    "clinical nurse specialist", "ward sister",
    "sonographer", "diagnostic radiographer",
    "pharmacy technician", "clinical scientist",
]


class SearchPrioritiser(BaseSubAgent):
    name = "search_prioritiser"
    persona = "Fatima Al-Rashid"
    title = "Search Priority Analyst"
    agent_type = "DET"
    description = "Ranks and prioritises search keywords based on demand"

    async def run(self, max_keywords: int = 30, **kwargs) -> list[str]:
        """Return prioritised list of search keywords.

        Priority order: sponsorship-specific > shortage > tech > healthcare.
        Sponsorship keywords are always included first as they directly
        surface jobs that offer visa sponsorship.
        """
        combined = []
        seen = set()
        for kw in (
            SPONSORSHIP_KEYWORDS
            + SHORTAGE_KEYWORDS
            + TECH_KEYWORDS
            + HEALTHCARE_KEYWORDS
        ):
            normalised = kw.lower().strip()
            if normalised not in seen:
                seen.add(normalised)
                combined.append(kw)

        return combined[:max_keywords]
