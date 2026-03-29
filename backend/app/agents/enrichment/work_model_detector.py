"""Rosie Watts — Work Model Detector (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Work model patterns, ordered by specificity.
# Each entry: (model, weight, pattern)
# Higher weight = stronger signal.
# ---------------------------------------------------------------------------
_WORK_MODEL_PATTERNS: list[tuple[str, int, re.Pattern]] = [
    # --- Fully Remote ---
    ("remote", 10, re.compile(r"\bfully\s+remote\b", re.I)),
    ("remote", 10, re.compile(r"\b100%\s+remote\b", re.I)),
    ("remote", 10, re.compile(r"\bremote[\s-]?first\b", re.I)),
    ("remote", 10, re.compile(r"\bwork\s+from\s+(?:home|anywhere)\b", re.I)),
    ("remote", 8, re.compile(r"\bremote\s+(?:position|role|job|opportunity|working)\b", re.I)),
    ("remote", 8, re.compile(r"\bremote\b", re.I)),
    ("remote", 7, re.compile(r"\bwfh\b", re.I)),
    ("remote", 6, re.compile(r"\bwork\s+from\s+home\b", re.I)),
    ("remote", 5, re.compile(r"\btelecommut(?:e|ing)\b", re.I)),
    ("remote", 5, re.compile(r"\bdistributed\s+team\b", re.I)),
    ("remote", 4, re.compile(r"\blocation[\s-]?independent\b", re.I)),
    ("remote", 4, re.compile(r"\banywhere\s+in\s+the\s+(?:UK|world)\b", re.I)),

    # --- Hybrid ---
    ("hybrid", 10, re.compile(r"\bhybrid\s+(?:working|model|role|position|arrangement)\b", re.I)),
    ("hybrid", 10, re.compile(r"\bhybrid\b", re.I)),
    ("hybrid", 9, re.compile(r"\b(?:2|3|two|three)\s+days?\s+(?:in\s+(?:the\s+)?)?office\b", re.I)),
    ("hybrid", 9, re.compile(r"\b(?:2|3|two|three)\s+days?\s+(?:at\s+)?home\b", re.I)),
    ("hybrid", 8, re.compile(r"\bsplit\s+(?:between\s+)?(?:home|office|remote)\b", re.I)),
    ("hybrid", 8, re.compile(r"\bmix\s+of\s+(?:home|office|remote)\b", re.I)),
    ("hybrid", 7, re.compile(r"\bflexible\s+(?:hybrid|working\s+(?:from|between))\b", re.I)),
    ("hybrid", 6, re.compile(r"\boffice\s+and\s+(?:home|remote)\b", re.I)),
    ("hybrid", 6, re.compile(r"\bremote\s+and\s+(?:office|on[\s-]?site)\b", re.I)),
    ("hybrid", 5, re.compile(r"\bpart[\s-]?remote\b", re.I)),
    ("hybrid", 5, re.compile(r"\bsome\s+(?:remote|home)\s+working\b", re.I)),

    # --- Office / On-site ---
    ("office", 10, re.compile(r"\boffice[\s-]?based\b", re.I)),
    ("office", 10, re.compile(r"\bon[\s-]?site\b", re.I)),
    ("office", 9, re.compile(r"\bin[\s-]?office\b", re.I)),
    ("office", 8, re.compile(r"\bbased\s+(?:at|in)\s+(?:our|the)\s+(?:\w+\s+)?office\b", re.I)),
    ("office", 7, re.compile(r"\b5\s+days?\s+(?:in\s+(?:the\s+)?)?office\b", re.I)),
    ("office", 7, re.compile(r"\bfull[\s-]?time\s+(?:in\s+(?:the\s+)?)?office\b", re.I)),
    ("office", 6, re.compile(r"\boffice\s+(?:location|attendance|presence)\b", re.I)),
    ("office", 5, re.compile(r"\bnot\s+(?:a\s+)?remote\b", re.I)),
    ("office", 5, re.compile(r"\bno\s+remote\b", re.I)),

    # --- Flexible ---
    ("flexible", 8, re.compile(r"\bflexible\s+(?:working|location|arrangement)\b", re.I)),
    ("flexible", 7, re.compile(r"\bflexible\s+hours\b", re.I)),
    ("flexible", 6, re.compile(r"\bagile\s+working\b", re.I)),
    ("flexible", 5, re.compile(r"\bwork\s+(?:where|when)\s+you\s+(?:want|choose|prefer)\b", re.I)),
    ("flexible", 5, re.compile(r"\bchoose\s+(?:where|how)\s+you\s+work\b", re.I)),
    ("flexible", 4, re.compile(r"\bflexible\b", re.I)),

    # --- Field / Travel ---
    ("field", 8, re.compile(r"\bfield[\s-]?based\b", re.I)),
    ("field", 7, re.compile(r"\btravel(?:ling|ing)?\s+(?:role|position|required)\b", re.I)),
    ("field", 6, re.compile(r"\bmobile\s+(?:worker|working|role)\b", re.I)),
    ("field", 5, re.compile(r"\bcustomer[\s-]?site\b", re.I)),
    ("field", 5, re.compile(r"\bclient[\s-]?site\b", re.I)),
]

# Negative overrides: if these appear, they negate a remote classification
_ANTI_REMOTE = [
    re.compile(r"\bnot\s+(?:a\s+)?remote\b", re.I),
    re.compile(r"\bno\s+remote\s+(?:work|option)\b", re.I),
    re.compile(r"\bremote\s+(?:is\s+)?not\s+(?:available|an?\s+option)\b", re.I),
    re.compile(r"\bthis\s+is\s+not\s+(?:a\s+)?remote\b", re.I),
]


class WorkModelDetectorAgent(BaseSubAgent):
    """Detects work model from job descriptions."""

    name = "work_model_detector"
    persona = "Rosie Watts"
    title = "Work Model Detector"
    agent_type = "DET"
    description = (
        "Deterministic detector for work arrangement: remote, hybrid, "
        "office, flexible, or field-based."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Detect work model.

        Parameters
        ----------
        description : str
            Job description.
        title : str, optional
            Job title (higher weight for signals found here).

        Returns
        -------
        SubAgentResult with data:
            work_model       : str  - "remote" | "hybrid" | "office" | "flexible" | "field" | "unknown"
            confidence       : str  - "high" | "medium" | "low"
            signals          : list[str] - matched pattern descriptions
            all_detected     : dict[str, int] - model -> total weight
        """
        description: str = kwargs.get("description", "") or ""
        title: str = kwargs.get("title", "") or ""
        text = f"{title}\n{description}"

        if not text.strip():
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "work_model": "unknown",
                    "confidence": "low",
                    "signals": [],
                    "all_detected": {},
                },
            )

        # Check for anti-remote signals
        has_anti_remote = any(p.search(text) for p in _ANTI_REMOTE)

        # Score each model
        model_scores: dict[str, int] = {}
        signals: list[str] = []

        for model, weight, pattern in _WORK_MODEL_PATTERNS:
            match = pattern.search(text)
            if match:
                # Boost weight if found in title
                actual_weight = weight + 3 if pattern.search(title) else weight
                model_scores[model] = model_scores.get(model, 0) + actual_weight
                signals.append(f"{model}: {match.group()} (w={actual_weight})")

        # Apply anti-remote override
        if has_anti_remote and "remote" in model_scores:
            model_scores["remote"] = max(0, model_scores["remote"] - 20)

        if not model_scores:
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "work_model": "unknown",
                    "confidence": "low",
                    "signals": [],
                    "all_detected": {},
                },
            )

        # Pick highest scoring model
        best_model = max(model_scores, key=model_scores.get)  # type: ignore[arg-type]
        best_score = model_scores[best_model]

        # Determine confidence
        if best_score >= 15:
            confidence = "high"
        elif best_score >= 8:
            confidence = "medium"
        else:
            confidence = "low"

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "work_model": best_model,
                "confidence": confidence,
                "signals": signals,
                "all_detected": model_scores,
            },
        )
