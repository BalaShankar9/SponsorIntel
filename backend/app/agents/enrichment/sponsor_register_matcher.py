"""Zainab Okonkwo — Sponsor Register Matcher (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Name normalisation helpers
# ---------------------------------------------------------------------------
_STRIP_SUFFIXES = re.compile(
    r"\b(?:limited|ltd|plc|llp|inc|incorporated|corp|corporation|group|"
    r"holdings|uk|international|services|solutions|consulting|consultancy|"
    r"&\s*co)\b\.?",
    re.I,
)
_NON_ALPHA = re.compile(r"[^a-z0-9\s]")
_MULTI_SPACE = re.compile(r"\s+")


def normalise_company_name(name: str) -> str:
    """Reduce a company name to a canonical form for fuzzy matching."""
    name = name.lower().strip()
    name = _STRIP_SUFFIXES.sub("", name)
    name = _NON_ALPHA.sub(" ", name)
    name = _MULTI_SPACE.sub(" ", name).strip()
    return name


class SponsorRegisterMatcherAgent(BaseSubAgent):
    """
    Checks a company against the UK sponsor register.

    The register data is expected to be pre-loaded into a module-level cache
    or fetched from Supabase on first use.  For now the agent accepts an
    optional ``register`` kwarg (set of normalised names) or falls back to an
    in-memory cache populated via ``load_register()``.
    """

    name = "sponsor_register_matcher"
    persona = "Zainab Okonkwo"
    title = "Sponsor Register Matcher"
    agent_type = "DET"
    description = (
        "Matches a company name against the UK Home Office register of "
        "licensed sponsors using normalised name comparison."
    )

    # Class-level cache: normalised_name -> register entry dict
    _register_cache: dict[str, dict[str, Any]] = {}

    @classmethod
    def load_register(cls, entries: list[dict[str, Any]]) -> None:
        """
        Pre-load the sponsor register into memory.

        Parameters
        ----------
        entries : list[dict]
            Each dict should have at minimum:
            - ``organisation_name`` (str)
            - ``route`` (str)  e.g. "Worker", "Temporary Worker"
            - ``rating`` (str) e.g. "A-rated"
            - ``sub_type`` (str, optional)
        """
        cls._register_cache.clear()
        for entry in entries:
            norm = normalise_company_name(entry.get("organisation_name", ""))
            if norm:
                cls._register_cache[norm] = {
                    "organisation_name": entry.get("organisation_name", ""),
                    "route": entry.get("route", ""),
                    "rating": entry.get("rating", ""),
                    "sub_type": entry.get("sub_type", ""),
                }

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Check if a company is on the sponsor register.

        Parameters
        ----------
        company_name : str
            The company name to look up.
        register : dict[str, dict], optional
            Override register cache for testing.

        Returns
        -------
        SubAgentResult with data:
            on_register       : bool
            organisation_name : str | None   - canonical name from register
            route             : str | None   - e.g. "Worker"
            rating            : str | None   - e.g. "A-rated"
            is_a_rated        : bool
            match_type        : str          - "exact" | "normalised" | "none"
        """
        company_name: str = kwargs.get("company_name", "") or ""
        register = kwargs.get("register", self._register_cache)

        if not company_name.strip():
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "on_register": False,
                    "organisation_name": None,
                    "route": None,
                    "rating": None,
                    "is_a_rated": False,
                    "match_type": "none",
                },
            )

        normalised = normalise_company_name(company_name)

        # Exact normalised match
        if normalised in register:
            entry = register[normalised]
            rating = entry.get("rating", "")
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "on_register": True,
                    "organisation_name": entry.get("organisation_name"),
                    "route": entry.get("route"),
                    "rating": rating,
                    "is_a_rated": "a-rated" in rating.lower() if rating else False,
                    "match_type": "normalised",
                },
            )

        # Substring / contains matching for common cases where register has
        # longer legal name e.g. "Acme Holdings Limited" vs input "Acme"
        for reg_name, entry in register.items():
            if len(normalised) >= 4 and (
                normalised in reg_name or reg_name in normalised
            ):
                rating = entry.get("rating", "")
                return SubAgentResult(
                    agent_name=self.name,
                    success=True,
                    data={
                        "on_register": True,
                        "organisation_name": entry.get("organisation_name"),
                        "route": entry.get("route"),
                        "rating": rating,
                        "is_a_rated": "a-rated" in rating.lower() if rating else False,
                        "match_type": "fuzzy",
                    },
                )

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "on_register": False,
                "organisation_name": None,
                "route": None,
                "rating": None,
                "is_a_rated": False,
                "match_type": "none",
            },
        )
