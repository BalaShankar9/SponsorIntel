"""Declan Murphy — Entity Resolution Specialist (Acquisition department)."""

import logging
from rapidfuzz import fuzz
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)


def normalise_company_name(name: str) -> str:
    """Normalise company name for matching."""
    if not name:
        return ""
    n = name.lower().strip()
    for suffix in [" limited", " ltd", " plc", " inc", " llp", " lp",
                   " & co", " corporation", " corp", " group"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)]
    n = "".join(c for c in n if c.isalnum() or c == " ")
    return " ".join(n.split())


class EntityResolver(BaseSubAgent):
    name = "entity_resolver"
    persona = "Declan Murphy"
    title = "Entity Resolution Specialist"
    agent_type = "DET"
    description = "Matches scraped company names to sponsors in the register"

    async def run(self, company_name: str = "", sponsor_cache: dict | None = None, **kwargs) -> dict:
        """
        Match a company name to a sponsor.

        Args:
            company_name: Raw company name from scraper
            sponsor_cache: Dict of {normalised_name: sponsor_id}

        Returns:
            {sponsor_id: str|None, confidence: float, matched_name: str|None}
        """
        if not company_name or not sponsor_cache:
            return {"sponsor_id": None, "confidence": 0, "matched_name": None}

        normalised = normalise_company_name(company_name)
        if not normalised:
            return {"sponsor_id": None, "confidence": 0, "matched_name": None}

        # Exact match first
        if normalised in sponsor_cache:
            return {
                "sponsor_id": sponsor_cache[normalised],
                "confidence": 100,
                "matched_name": normalised,
            }

        # Fuzzy match
        best_score = 0
        best_match = None
        for cached_name, sponsor_id in sponsor_cache.items():
            score = fuzz.ratio(normalised, cached_name)
            if score > best_score:
                best_score = score
                best_match = (cached_name, sponsor_id)

        if best_score >= 85 and best_match:
            return {
                "sponsor_id": best_match[1],
                "confidence": best_score,
                "matched_name": best_match[0],
            }

        return {"sponsor_id": None, "confidence": best_score, "matched_name": None}
