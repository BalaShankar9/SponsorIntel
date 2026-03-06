"""
Sponsorship Detection NLP engine.

Scans job descriptions for visa sponsorship signals and estimates
the likelihood (0-100) that a position offers sponsorship.
"""

import re
from typing import Optional

POSITIVE_SIGNALS: dict[str, float] = {
    "visa sponsorship available": 0.95,
    "we sponsor visas": 0.95,
    "sponsor your visa": 0.90,
    "tier 2 sponsorship": 0.90,
    "skilled worker visa": 0.85,
    "visa sponsorship": 0.85,
    "sponsorship available": 0.80,
    "willing to sponsor": 0.85,
    "offer sponsorship": 0.85,
    "sponsorship provided": 0.85,
    "immigration sponsorship": 0.80,
    "work permit": 0.60,
    "sponsor licence": 0.70,
    "certificate of sponsorship": 0.90,
    "cos application": 0.85,
    "we can sponsor": 0.90,
    "happy to sponsor": 0.90,
    "provide sponsorship": 0.85,
    "sponsorship is available": 0.85,
    "skilled worker sponsorship": 0.90,
    "tier 2 visa": 0.85,
    "sponsor work visa": 0.90,
    "able to sponsor": 0.85,
}

NEGATIVE_SIGNALS: dict[str, float] = {
    "no sponsorship": -0.95,
    "cannot sponsor": -0.95,
    "unable to sponsor": -0.95,
    "not able to sponsor": -0.90,
    "sponsorship is not available": -0.95,
    "must have right to work": -0.70,
    "must be eligible to work": -0.65,
    "right to work in the uk": -0.50,
    "no visa sponsorship": -0.95,
    "uk work permit required": -0.60,
    "unfortunately we cannot provide sponsorship": -0.95,
    "we do not sponsor": -0.95,
    "we are unable to sponsor": -0.95,
    "we cannot offer sponsorship": -0.95,
    "not in a position to sponsor": -0.90,
    "sponsorship will not be provided": -0.95,
    "pre-existing right to work": -0.70,
    "existing right to work": -0.65,
}


def detect_sponsorship(
    description: str,
    is_known_sponsor: bool = False,
    is_shortage_occupation: bool = False,
) -> tuple[int, dict]:
    """
    Detect sponsorship likelihood from a job description.

    Returns:
        (likelihood, signals) where:
        - likelihood: int 0-100 (0 = definitely no sponsorship, 100 = definitely yes)
        - signals: dict mapping matched signal text to its score

    The algorithm:
    1. Scan for positive and negative keyword signals in the text
    2. Compute a weighted score from all matched signals
    3. Apply bonus for known sponsor status and shortage occupation
    4. Clamp result to 0-100
    """
    if not description:
        base = 30 if is_known_sponsor else 10
        signals = {}
        if is_known_sponsor:
            signals["known_sponsor_bonus"] = 0.20
        return base, signals

    description_lower = description.lower()
    matched_signals: dict[str, float] = {}

    # Scan positive signals (check longer phrases first)
    sorted_positive = sorted(POSITIVE_SIGNALS.keys(), key=len, reverse=True)
    for signal_text in sorted_positive:
        if signal_text in description_lower:
            matched_signals[signal_text] = POSITIVE_SIGNALS[signal_text]

    # Scan negative signals (check longer phrases first)
    sorted_negative = sorted(NEGATIVE_SIGNALS.keys(), key=len, reverse=True)
    for signal_text in sorted_negative:
        if signal_text in description_lower:
            matched_signals[signal_text] = NEGATIVE_SIGNALS[signal_text]

    # Compute score
    if not matched_signals:
        # No signals found - use context clues
        base_score = 30 if is_known_sponsor else 15
        if is_shortage_occupation:
            base_score += 15
        signals = {}
        if is_known_sponsor:
            signals["known_sponsor_bonus"] = 0.20
        if is_shortage_occupation:
            signals["shortage_occupation_bonus"] = 0.15
        return base_score, signals

    # Separate positive and negative
    positive_scores = [v for v in matched_signals.values() if v > 0]
    negative_scores = [v for v in matched_signals.values() if v < 0]

    if positive_scores and not negative_scores:
        # Only positive signals
        best_positive = max(positive_scores)
        score = int(best_positive * 100)
    elif negative_scores and not positive_scores:
        # Only negative signals
        best_negative = min(negative_scores)  # Most negative
        score = max(0, int((1.0 + best_negative) * 50))
    else:
        # Mixed signals - weight by strongest signal
        best_positive = max(positive_scores)
        best_negative = min(negative_scores)

        # If negative is stronger, lean negative (but not fully)
        if abs(best_negative) > best_positive:
            score = max(10, int((1.0 + best_negative) * 50))
        else:
            score = int(best_positive * 80)

    # Apply bonuses
    if is_known_sponsor:
        score = min(100, score + 10)
        matched_signals["known_sponsor_bonus"] = 0.10

    if is_shortage_occupation:
        score = min(100, score + 10)
        matched_signals["shortage_occupation_bonus"] = 0.10

    # Clamp
    score = max(0, min(100, score))

    return score, matched_signals


def extract_sponsorship_context(description: str, window: int = 100) -> list[str]:
    """
    Extract text snippets around sponsorship-related keywords.

    Useful for displaying relevant context to users.
    """
    if not description:
        return []

    keywords = [
        "sponsor", "visa", "work permit", "tier 2", "skilled worker",
        "right to work", "immigration", "cos ", "certificate of sponsorship",
    ]

    contexts: list[str] = []
    description_lower = description.lower()

    for keyword in keywords:
        for match in re.finditer(re.escape(keyword), description_lower):
            start = max(0, match.start() - window)
            end = min(len(description), match.end() + window)
            snippet = description[start:end].strip()
            if snippet not in contexts:
                contexts.append(snippet)

    return contexts[:5]  # Limit to 5 context snippets
