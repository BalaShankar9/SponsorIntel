"""
Entity Resolution Engine ("Nexus").

Resolves raw company names to Sponsor records using a multi-stage pipeline:
1. Exact normalised name match
2. Alias lookup
3. Fuzzy matching (rapidfuzz)
4. Address + name combo
"""

import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from rapidfuzz import fuzz
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import CompanyAlias
from app.models.sponsor import Sponsor
from app.utils.name_normaliser import normalise_company_name


def normalise_for_matching(name: str) -> str:
    """
    Stricter normalisation for matching:
    removes ALL non-alphanumeric characters, lowercases, collapses whitespace.
    """
    if not name:
        return ""
    result = normalise_company_name(name)
    # Remove all non-alphanumeric (keep spaces)
    result = re.sub(r"[^a-z0-9\s]", "", result)
    result = re.sub(r"\s+", " ", result).strip()
    return result


async def resolve_entity(
    db: AsyncSession,
    raw_name: str,
    source: str,
    additional_info: Optional[dict] = None,
) -> Tuple[Optional[uuid.UUID], float]:
    """
    Resolve a raw company name to a Sponsor.

    Returns (sponsor_id, confidence) or (None, 0.0) if no match found.

    Pipeline stages:
    1. Exact match on normalised name (confidence 1.0)
    2. Alias lookup (confidence from alias record)
    3. Fuzzy match with rapidfuzz (threshold 85, confidence = ratio/100)
    4. Address + name combo (threshold 75 + matching city, confidence 0.85)
    """
    normalised = normalise_for_matching(raw_name)
    if not normalised:
        return None, 0.0

    # Stage 1: Exact match
    result = await db.execute(
        select(Sponsor).where(
            Sponsor.organisation_name_normalised == normalise_company_name(raw_name)
        )
    )
    sponsor = result.scalar_one_or_none()
    if sponsor:
        return sponsor.id, 1.0

    # Stage 2: Alias lookup
    alias_result = await db.execute(
        select(CompanyAlias).where(CompanyAlias.alias_name == raw_name)
    )
    alias = alias_result.scalar_one_or_none()
    if alias:
        return alias.sponsor_id, alias.confidence or 0.9

    # Fetch all sponsors for fuzzy matching
    all_sponsors_result = await db.execute(
        select(Sponsor.id, Sponsor.organisation_name_normalised, Sponsor.town_city)
    )
    all_sponsors = all_sponsors_result.all()

    # Stage 3: Fuzzy match
    best_match_id: Optional[uuid.UUID] = None
    best_ratio: float = 0.0

    for s_id, s_name_norm, s_city in all_sponsors:
        s_match_name = re.sub(r"[^a-z0-9\s]", "", s_name_norm or "")
        s_match_name = re.sub(r"\s+", " ", s_match_name).strip()

        ratio = fuzz.token_sort_ratio(normalised, s_match_name)
        if ratio > best_ratio:
            best_ratio = ratio
            best_match_id = s_id

    if best_ratio >= 85:
        return best_match_id, best_ratio / 100.0

    # Stage 4: Address + name combo
    if additional_info and (additional_info.get("city") or additional_info.get("postcode")):
        target_city = (additional_info.get("city") or "").lower().strip()

        for s_id, s_name_norm, s_city in all_sponsors:
            s_match_name = re.sub(r"[^a-z0-9\s]", "", s_name_norm or "")
            s_match_name = re.sub(r"\s+", " ", s_match_name).strip()

            ratio = fuzz.token_sort_ratio(normalised, s_match_name)
            sponsor_city = (s_city or "").lower().strip()

            if ratio >= 75 and target_city and sponsor_city == target_city:
                return s_id, 0.85

    return None, 0.0


async def create_alias(
    db: AsyncSession,
    sponsor_id: uuid.UUID,
    alias_name: str,
    source: str,
    confidence: float,
) -> CompanyAlias:
    """Create a CompanyAlias record for future lookups."""
    alias = CompanyAlias(
        id=uuid.uuid4(),
        sponsor_id=sponsor_id,
        alias_name=alias_name,
        alias_source=source,
        confidence=confidence,
        created_at=datetime.utcnow(),
    )
    db.add(alias)
    await db.flush()
    return alias


async def get_match_candidates(
    db: AsyncSession,
    name: str,
    limit: int = 10,
) -> List[Dict]:
    """
    Use PostgreSQL trigram similarity to find candidate matches.

    Requires the pg_trgm extension to be enabled.
    Returns list of {sponsor_id, name, similarity}.
    """
    normalised = normalise_company_name(name)
    if not normalised:
        return []

    stmt = text(
        """
        SELECT id, organisation_name, organisation_name_normalised,
               similarity(organisation_name_normalised, :name) AS sim
        FROM sponsors
        WHERE organisation_name_normalised % :name
        ORDER BY sim DESC
        LIMIT :limit
        """
    )

    result = await db.execute(stmt, {"name": normalised, "limit": limit})
    rows = result.all()

    return [
        {
            "sponsor_id": row[0],
            "name": row[1],
            "similarity": float(row[3]),
        }
        for row in rows
    ]
