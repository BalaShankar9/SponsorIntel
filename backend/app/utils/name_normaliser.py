"""
Company name normalisation utility for matching sponsor names
across different data sources.
"""

import re

# Legal suffixes to strip (order matters — longer first)
_LEGAL_SUFFIXES = [
    r"\btrading\s+as\b",
    r"\bt/a\b",
    r"\bholdings\b",
    r"\blimited\b",
    r"\bltd\b",
    r"\bplc\b",
    r"\bllp\b",
    r"\binc\b",
    r"\bcorp\b",
    r"\bcorporation\b",
    r"\bgroup\b",
    r"\bco\b",
    r"\buk\b",
]

_SUFFIX_PATTERN = re.compile(
    r"(?:" + "|".join(_LEGAL_SUFFIXES) + r")\.?",
    re.IGNORECASE,
)


def normalise_company_name(name: str) -> str:
    """
    Normalise a company name for matching purposes.

    - Lowercase
    - Strip legal suffixes (Ltd, Limited, PLC, LLP, Inc, Co, Corp, Group, Holdings, UK, T/A, Trading As)
    - Remove punctuation (except & and apostrophes initially, then remove those too)
    - Collapse whitespace
    - Strip surrounding quotes
    """
    if not name or not name.strip():
        return ""

    result = name.strip()

    # Remove surrounding quotes (single and double)
    result = result.strip("\"'")

    # Lowercase
    result = result.lower()

    # Strip legal suffixes
    result = _SUFFIX_PATTERN.sub(" ", result)

    # Remove punctuation but keep alphanumeric, spaces, & and apostrophes
    result = re.sub(r"[^\w\s&']", " ", result)

    # Now remove & and apostrophes too (they served as word-boundary holders)
    result = result.replace("&", " and ")
    result = result.replace("'", "")

    # Collapse whitespace
    result = re.sub(r"\s+", " ", result).strip()

    return result
