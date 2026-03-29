"""Connor Walsh — Sponsorship Keyword Analyst (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult


# --------------------------------------------------------------------------
# Pattern definitions: (label, compiled regex)
# Each pattern is a named signal that contributes to sponsorship likelihood.
# --------------------------------------------------------------------------
_PATTERNS: list[tuple[str, re.Pattern]] = [
    # Explicit sponsorship mentions
    ("visa_sponsorship", re.compile(r"\bvisa\s+sponsor(?:ship|ed|ing|s)?\b", re.I)),
    ("sponsor_visa", re.compile(r"\bsponsor(?:s|ed|ing)?\s+(?:a\s+)?visa\b", re.I)),
    ("will_sponsor", re.compile(r"\bwill\s+sponsor\b", re.I)),
    ("can_sponsor", re.compile(r"\bcan\s+sponsor\b", re.I)),
    ("able_to_sponsor", re.compile(r"\bable\s+to\s+sponsor\b", re.I)),
    ("happy_to_sponsor", re.compile(r"\bhappy\s+to\s+sponsor\b", re.I)),
    ("willing_to_sponsor", re.compile(r"\bwilling\s+to\s+sponsor\b", re.I)),
    ("open_to_sponsoring", re.compile(r"\bopen\s+to\s+sponsor(?:ing)?\b", re.I)),
    ("sponsorship_available", re.compile(r"\bsponsorship\s+(?:is\s+)?available\b", re.I)),
    ("sponsorship_offered", re.compile(r"\bsponsorship\s+(?:is\s+)?offered\b", re.I)),
    ("sponsorship_provided", re.compile(r"\bsponsorship\s+(?:is\s+)?provided\b", re.I)),
    ("offer_sponsorship", re.compile(r"\boffer(?:s|ing)?\s+(?:\w+\s+)?sponsorship\b", re.I)),
    ("provide_sponsorship", re.compile(r"\bprovide(?:s|d)?\s+(?:\w+\s+)?sponsorship\b", re.I)),

    # UK-specific visa types
    ("tier_2", re.compile(r"\btier\s*2\b", re.I)),
    ("tier_2_general", re.compile(r"\btier\s*2\s*\(?general\)?\b", re.I)),
    ("skilled_worker_visa", re.compile(r"\bskilled\s+worker\s+visa\b", re.I)),
    ("skilled_worker_route", re.compile(r"\bskilled\s+worker\s+route\b", re.I)),
    ("health_care_worker_visa", re.compile(r"\bhealth\s*(?:and\s*)?care\s+worker\s+visa\b", re.I)),
    ("global_talent_visa", re.compile(r"\bglobal\s+talent\s+visa\b", re.I)),
    ("scale_up_visa", re.compile(r"\bscale[\s-]?up\s+(?:worker\s+)?visa\b", re.I)),
    ("graduate_visa", re.compile(r"\bgraduate\s+visa\b", re.I)),
    ("intra_company_transfer", re.compile(r"\bintra[\s-]?company\s+transfer\b", re.I)),
    ("global_business_mobility", re.compile(r"\bglobal\s+business\s+mobility\b", re.I)),

    # Certificate of Sponsorship
    ("certificate_of_sponsorship", re.compile(r"\bcertificate\s+of\s+sponsorship\b", re.I)),
    ("cos_reference", re.compile(r"\bCoS\b")),

    # Sponsor licence
    ("sponsor_licence", re.compile(r"\bsponsor\s+licen[cs]e\b", re.I)),
    ("licensed_sponsor", re.compile(r"\blicen[cs]ed\s+sponsor\b", re.I)),

    # Right to work (negative signals - may indicate NO sponsorship)
    ("right_to_work_required", re.compile(r"\bright\s+to\s+work\s+(?:in\s+the\s+)?(?:UK|United\s+Kingdom)\b", re.I)),
    ("must_have_right_to_work", re.compile(r"\bmust\s+(?:already\s+)?have\s+(?:the\s+)?right\s+to\s+work\b", re.I)),
    ("no_sponsorship", re.compile(r"\b(?:no|not|cannot|can't|unable\s+to)\s+(?:offer\s+|provide\s+)?sponsor(?:ship)?\b", re.I)),
    ("unable_to_sponsor", re.compile(r"\bunable\s+to\s+(?:offer\s+|provide\s+)?sponsor(?:ship)?\b", re.I)),
    ("does_not_sponsor", re.compile(r"\bdoes\s+not\s+sponsor\b", re.I)),

    # Immigration / work permit terms
    ("work_permit", re.compile(r"\bwork\s+permit\b", re.I)),
    ("immigration_status", re.compile(r"\bimmigration\s+status\b", re.I)),
    ("visa_required", re.compile(r"\bvisa\s+required\b", re.I)),
    ("visa_support", re.compile(r"\bvisa\s+support\b", re.I)),
    ("immigration_support", re.compile(r"\bimmigration\s+support\b", re.I)),
    ("relocation_support", re.compile(r"\brelocation\s+(?:support|assistance|package)\b", re.I)),
    ("relocation_provided", re.compile(r"\brelocation\s+(?:is\s+)?provided\b", re.I)),

    # UKVI / Home Office references
    ("ukvi", re.compile(r"\bUKVI\b")),
    ("home_office", re.compile(r"\bHome\s+Office\b", re.I)),
    ("points_based_system", re.compile(r"\bpoints[\s-]based\s+system\b", re.I)),

    # Shortage occupation
    ("shortage_occupation", re.compile(r"\bshortage\s+occupation\b", re.I)),
    ("immigration_skills_charge", re.compile(r"\bimmigration\s+skills\s+charge\b", re.I)),

    # International applicants welcome
    ("international_applicants", re.compile(r"\binternational\s+(?:applicants?|candidates?)\s+(?:welcome|encouraged|considered)\b", re.I)),
    ("overseas_applicants", re.compile(r"\boverseas\s+(?:applicants?|candidates?)\s+(?:welcome|encouraged|considered)\b", re.I)),
]

# Patterns that indicate the company explicitly does NOT sponsor
_NEGATIVE_LABELS = frozenset({
    "no_sponsorship",
    "unable_to_sponsor",
    "does_not_sponsor",
    "must_have_right_to_work",
})

# Patterns that are strong positive signals
_STRONG_POSITIVE_LABELS = frozenset({
    "visa_sponsorship",
    "sponsor_visa",
    "will_sponsor",
    "can_sponsor",
    "able_to_sponsor",
    "happy_to_sponsor",
    "willing_to_sponsor",
    "sponsorship_available",
    "sponsorship_offered",
    "sponsorship_provided",
    "offer_sponsorship",
    "provide_sponsorship",
    "certificate_of_sponsorship",
    "skilled_worker_visa",
    "licensed_sponsor",
})


class SponsorshipKeywordScannerAgent(BaseSubAgent):
    """Scans job descriptions and titles for sponsorship-related keywords."""

    name = "sponsorship_keyword_scanner"
    persona = "Connor Walsh"
    title = "Sponsorship Keyword Analyst"
    agent_type = "DET"
    description = (
        "Deterministic scanner that matches 40+ regex patterns against job "
        "text to identify sponsorship signals, both positive and negative."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Scan text for sponsorship signals.

        Parameters
        ----------
        description : str
            Job description text.
        title : str, optional
            Job title.

        Returns
        -------
        SubAgentResult with data:
            matched_keywords : list[str]  - labels of matched patterns
            positive_signals : list[str]  - positive sponsorship signals
            negative_signals : list[str]  - anti-sponsorship signals
            strong_positive  : bool       - at least one strong positive match
            has_negative     : bool       - at least one negative signal found
            signal_count     : int        - total number of matched signals
        """
        description: str = kwargs.get("description", "") or ""
        title: str = kwargs.get("title", "") or ""
        text = f"{title}\n{description}"

        matched: list[str] = []
        positive: list[str] = []
        negative: list[str] = []

        for label, pattern in _PATTERNS:
            if pattern.search(text):
                matched.append(label)
                if label in _NEGATIVE_LABELS:
                    negative.append(label)
                else:
                    positive.append(label)

        strong_positive = bool(set(matched) & _STRONG_POSITIVE_LABELS)

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "matched_keywords": matched,
                "positive_signals": positive,
                "negative_signals": negative,
                "strong_positive": strong_positive,
                "has_negative": len(negative) > 0,
                "signal_count": len(matched),
            },
        )
