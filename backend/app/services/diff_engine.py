"""
Diff engine: compares the latest CSV import against the previous one
and generates SponsorChange + Event records.
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    ChangeType,
    EventType,
    Severity,
)
from app.models.event import Event
from app.models.sponsor import CsvImport, SponsorChange, SponsorSnapshot


# Maps ChangeType to (significance_score, EventType, Severity)
_CHANGE_META: Dict[ChangeType, Tuple[int, EventType, Severity]] = {
    ChangeType.ADDED: (7, EventType.SPONSOR_ADDED, Severity.INFO),
    ChangeType.REMOVED: (9, EventType.SPONSOR_REMOVED, Severity.CRITICAL),
    ChangeType.RATING_UPGRADE: (8, EventType.RATING_CHANGE, Severity.INFO),
    ChangeType.RATING_DOWNGRADE: (10, EventType.RATING_CHANGE, Severity.CRITICAL),
    ChangeType.LOCATION_CHANGE: (3, EventType.RATING_CHANGE, Severity.INFO),
    ChangeType.ROUTE_ADDED: (5, EventType.RATING_CHANGE, Severity.INFO),
    ChangeType.ROUTE_REMOVED: (6, EventType.RATING_CHANGE, Severity.WARNING),
}


async def compute_diff(
    db: AsyncSession,
    csv_import_id: uuid.UUID,
) -> List[SponsorChange]:
    """
    Compare the given CSV import against its predecessor.
    Returns a list of SponsorChange records created.
    """
    # Fetch the current import
    current_import = await db.get(CsvImport, csv_import_id)
    if not current_import:
        raise ValueError(f"CsvImport {csv_import_id} not found")

    # Find the previous import (most recent before this one)
    prev_result = await db.execute(
        select(CsvImport)
        .where(CsvImport.imported_at < current_import.imported_at)
        .order_by(CsvImport.imported_at.desc())
        .limit(1)
    )
    prev_import: Optional[CsvImport] = prev_result.scalar_one_or_none()

    if not prev_import:
        # First import — every sponsor is an addition. We skip diff for the first import.
        return []

    # Load snapshots for both imports, keyed by sponsor_id
    curr_snaps_result = await db.execute(
        select(SponsorSnapshot).where(
            SponsorSnapshot.csv_import_id == csv_import_id
        )
    )
    curr_snaps = {s.sponsor_id: s for s in curr_snaps_result.scalars().all()}

    prev_snaps_result = await db.execute(
        select(SponsorSnapshot).where(
            SponsorSnapshot.csv_import_id == prev_import.id
        )
    )
    prev_snaps = {s.sponsor_id: s for s in prev_snaps_result.scalars().all()}

    now = datetime.utcnow()
    changes: List[SponsorChange] = []

    # Detect additions: in current but not in previous
    for sponsor_id in curr_snaps:
        if sponsor_id not in prev_snaps:
            change = _create_change(
                sponsor_id=sponsor_id,
                csv_import_id=csv_import_id,
                change_type=ChangeType.ADDED,
                new_value=curr_snaps[sponsor_id].organisation_name,
                detected_at=now,
            )
            changes.append(change)

    # Detect removals: in previous but not in current
    for sponsor_id in prev_snaps:
        if sponsor_id not in curr_snaps:
            change = _create_change(
                sponsor_id=sponsor_id,
                csv_import_id=csv_import_id,
                change_type=ChangeType.REMOVED,
                old_value=prev_snaps[sponsor_id].organisation_name,
                detected_at=now,
            )
            changes.append(change)

    # Detect changes for sponsors present in both
    common_ids = set(curr_snaps.keys()) & set(prev_snaps.keys())
    for sponsor_id in common_ids:
        curr = curr_snaps[sponsor_id]
        prev = prev_snaps[sponsor_id]

        # Rating changes
        curr_rating = _extract_rating(curr.type_and_rating)
        prev_rating = _extract_rating(prev.type_and_rating)

        if curr_rating != prev_rating and curr_rating and prev_rating:
            if prev_rating == "B" and curr_rating == "A":
                ct = ChangeType.RATING_UPGRADE
            elif prev_rating == "A" and curr_rating == "B":
                ct = ChangeType.RATING_DOWNGRADE
            else:
                ct = ChangeType.RATING_UPGRADE  # generic

            change = _create_change(
                sponsor_id=sponsor_id,
                csv_import_id=csv_import_id,
                change_type=ct,
                field_changed="rating",
                old_value=prev_rating,
                new_value=curr_rating,
                detected_at=now,
            )
            changes.append(change)

        # Location changes
        if (curr.town_city or "") != (prev.town_city or ""):
            change = _create_change(
                sponsor_id=sponsor_id,
                csv_import_id=csv_import_id,
                change_type=ChangeType.LOCATION_CHANGE,
                field_changed="town_city",
                old_value=prev.town_city,
                new_value=curr.town_city,
                detected_at=now,
            )
            changes.append(change)

        # Route changes
        curr_routes = set(curr.route or [])
        prev_routes = set(prev.route or [])
        added_routes = curr_routes - prev_routes
        removed_routes = prev_routes - curr_routes

        for route in added_routes:
            change = _create_change(
                sponsor_id=sponsor_id,
                csv_import_id=csv_import_id,
                change_type=ChangeType.ROUTE_ADDED,
                field_changed="route",
                new_value=route,
                detected_at=now,
            )
            changes.append(change)

        for route in removed_routes:
            change = _create_change(
                sponsor_id=sponsor_id,
                csv_import_id=csv_import_id,
                change_type=ChangeType.ROUTE_REMOVED,
                field_changed="route",
                old_value=route,
                detected_at=now,
            )
            changes.append(change)

    # Persist all changes and emit events
    for change in changes:
        db.add(change)
        event = _create_event_for_change(change)
        db.add(event)

    await db.flush()
    return changes


def _extract_rating(type_and_rating: Optional[str]) -> Optional[str]:
    if not type_and_rating:
        return None
    val = type_and_rating.upper()
    if "(A RATING)" in val:
        return "A"
    if "(B RATING)" in val:
        return "B"
    return None


def _create_change(
    sponsor_id: uuid.UUID,
    csv_import_id: uuid.UUID,
    change_type: ChangeType,
    field_changed: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    detected_at: Optional[datetime] = None,
) -> SponsorChange:
    meta = _CHANGE_META.get(change_type, (5, EventType.RATING_CHANGE, Severity.INFO))
    return SponsorChange(
        id=uuid.uuid4(),
        sponsor_id=sponsor_id,
        csv_import_id=csv_import_id,
        change_type=change_type,
        field_changed=field_changed,
        old_value=old_value,
        new_value=new_value,
        detected_at=detected_at or datetime.utcnow(),
        significance_score=meta[0],
    )


def _create_event_for_change(change: SponsorChange) -> Event:
    meta = _CHANGE_META.get(
        change.change_type, (5, EventType.RATING_CHANGE, Severity.INFO)
    )
    return Event(
        id=uuid.uuid4(),
        event_type=meta[1],
        entity_type="sponsor",
        entity_id=change.sponsor_id,
        payload={
            "change_type": change.change_type.value,
            "field_changed": change.field_changed,
            "old_value": change.old_value,
            "new_value": change.new_value,
            "significance_score": change.significance_score,
        },
        severity=meta[2],
    )
