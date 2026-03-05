"""
CSV import service for UK Home Office sponsor licence register.

Parses the published CSV, creates/updates Sponsor records,
generates SponsorSnapshot rows, and marks removed sponsors inactive.
"""

import csv
import hashlib
import io
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SponsorRating, SponsorType
from app.models.sponsor import CsvImport, Sponsor, SponsorSnapshot
from app.utils.name_normaliser import normalise_company_name


def parse_rating(type_and_rating: str) -> Optional[SponsorRating]:
    """Extract A or B rating from strings like 'Worker (A rating)'."""
    if not type_and_rating:
        return None
    val = type_and_rating.upper()
    if "(A RATING)" in val or "A RATING" in val:
        return SponsorRating.A
    if "(B RATING)" in val or "B RATING" in val:
        return SponsorRating.B
    return None


def parse_sponsor_type(type_and_rating: str) -> Optional[SponsorType]:
    """Extract sponsor type from strings like 'Worker (A rating)'."""
    if not type_and_rating:
        return None
    val = type_and_rating.strip()
    if val.lower().startswith("temporary"):
        return SponsorType.TEMPORARY_WORKER
    if val.lower().startswith("worker"):
        return SponsorType.WORKER
    return None


def parse_routes(route_str: str) -> List[str]:
    """Split comma-separated routes, stripping whitespace."""
    if not route_str:
        return []
    return [r.strip() for r in route_str.split(",") if r.strip()]


async def import_csv(
    db: AsyncSession,
    file_content: bytes,
    filename: str,
    source_url: Optional[str] = None,
    is_auto: bool = False,
) -> CsvImport:
    """
    Import a UK Home Office sponsor register CSV.

    Steps:
    1. Compute MD5 checksum, reject duplicates
    2. Parse CSV rows
    3. Match against existing sponsors by normalised name
    4. Create new / update existing Sponsor records
    5. Create SponsorSnapshot for every row
    6. Mark sponsors not in new CSV as inactive
    7. Track counts and return CsvImport record
    """
    # 1. Checksum & duplicate check
    checksum = hashlib.md5(file_content).hexdigest()

    existing = await db.execute(
        select(CsvImport).where(CsvImport.checksum_md5 == checksum)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"CSV with checksum {checksum} has already been imported")

    # Create CsvImport record
    csv_import = CsvImport(
        id=uuid.uuid4(),
        filename=filename,
        source_url=source_url,
        checksum_md5=checksum,
        is_auto=is_auto,
        imported_at=datetime.utcnow(),
    )
    db.add(csv_import)

    # 2. Parse CSV
    text = file_content.decode("utf-8-sig")  # Handle BOM
    reader = csv.DictReader(io.StringIO(text))

    # Build lookup of existing sponsors by normalised name
    result = await db.execute(select(Sponsor))
    existing_sponsors: Dict[str, Sponsor] = {}
    for sponsor in result.scalars().all():
        existing_sponsors[sponsor.organisation_name_normalised] = sponsor

    seen_normalised_names: Set[str] = set()
    added_count = 0
    updated_count = 0
    record_count = 0

    now = datetime.utcnow()

    for row in reader:
        record_count += 1

        org_name = row.get("Organisation Name", "").strip()
        if not org_name:
            continue

        normalised = normalise_company_name(org_name)
        town_city = row.get("Town/City", "").strip() or None
        county = row.get("County", "").strip() or None
        type_and_rating = row.get("Type & Rating", "").strip() or None
        route_str = row.get("Route", "").strip() or ""

        rating = parse_rating(type_and_rating) if type_and_rating else None
        sponsor_type = parse_sponsor_type(type_and_rating) if type_and_rating else None
        routes = parse_routes(route_str)

        seen_normalised_names.add(normalised)

        if normalised in existing_sponsors:
            # Update existing sponsor
            sponsor = existing_sponsors[normalised]
            changed = False

            if sponsor.rating != rating and rating is not None:
                if sponsor.rating is not None:
                    sponsor.times_rating_changed += 1
                sponsor.rating = rating
                changed = True

            if sponsor.town_city != town_city and town_city is not None:
                sponsor.town_city = town_city
                changed = True

            if routes and sponsor.route != routes:
                sponsor.route = routes
                changed = True

            if sponsor.type_and_rating != type_and_rating and type_and_rating is not None:
                sponsor.type_and_rating = type_and_rating
                changed = True

            if sponsor.sponsor_type != sponsor_type and sponsor_type is not None:
                sponsor.sponsor_type = sponsor_type
                changed = True

            # Reactivate if previously marked inactive
            if not sponsor.is_active:
                sponsor.is_active = True
                changed = True

            sponsor.last_seen_date = now

            if changed:
                sponsor.updated_at = now
                updated_count += 1
        else:
            # Create new sponsor
            sponsor = Sponsor(
                id=uuid.uuid4(),
                organisation_name=org_name,
                organisation_name_normalised=normalised,
                town_city=town_city,
                county=county,
                type_and_rating=type_and_rating,
                rating=rating,
                sponsor_type=sponsor_type,
                route=routes if routes else None,
                is_active=True,
                first_seen_date=now,
                last_seen_date=now,
                consecutive_a_rating_days=0,
                times_rating_changed=0,
                created_at=now,
                updated_at=now,
            )
            db.add(sponsor)
            existing_sponsors[normalised] = sponsor
            added_count += 1

        # Create snapshot for every row
        snapshot = SponsorSnapshot(
            id=uuid.uuid4(),
            sponsor_id=sponsor.id,
            csv_import_id=csv_import.id,
            snapshot_date=now,
            organisation_name=org_name,
            town_city=town_city,
            county=county,
            type_and_rating=type_and_rating,
            route=routes if routes else None,
        )
        db.add(snapshot)

    # 6. Mark sponsors not in new CSV as inactive
    removed_count = 0
    for norm_name, sponsor in existing_sponsors.items():
        if norm_name not in seen_normalised_names and sponsor.is_active:
            sponsor.is_active = False
            sponsor.updated_at = now
            removed_count += 1

    # 7. Update counts
    csv_import.record_count = record_count
    csv_import.added_count = added_count
    csv_import.removed_count = removed_count
    csv_import.changed_count = updated_count

    await db.flush()

    return csv_import
