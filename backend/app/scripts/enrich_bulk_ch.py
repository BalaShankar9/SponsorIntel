"""
Bulk Companies House enrichment using downloaded CSV data.

Downloads the full CH company dataset (~491MB ZIP), loads it into memory,
and matches sponsor names against company names using fuzzy matching.

Zero HTTP requests needed — all matching done locally.

Usage:
    python -m app.scripts.enrich_bulk_ch [--csv-path data/ch_bulk.csv] [--limit 0]
"""

import argparse
import asyncio
import csv
import io
import logging
import os
import time
import zipfile
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("enrich_bulk_ch")


def normalize(name: str) -> str:
    """Normalize company name for matching."""
    import re
    name = name.upper().strip()
    # Strip anything after T/A or TRADING AS (trading name)
    name = re.split(r'\s+T/A\s+|\s+TRADING AS\s+|\.T/A[- ]', name)[0]
    # Strip appended company numbers like "-14416548"
    name = re.sub(r'-\d{6,}$', '', name)
    # Remove common suffixes
    for suffix in [" LIMITED", " LTD", " LTD.", " PLC", " LLP", " LP", " INC",
                   " CORPORATION", " CORP", " CO.", " CO",
                   " CIC", " C.I.C", " C.I.C."]:
        name = name.replace(suffix, "")
    # Remove punctuation
    name = re.sub(r"[^A-Z0-9 ]", "", name)
    # Collapse whitespace
    name = re.sub(r"\s+", " ", name).strip()
    return name


def load_ch_data(csv_path: str, wanted_names: set[str] | None = None) -> dict:
    """
    Stream CH CSV and extract only matching rows.

    If wanted_names is provided, only keep rows whose normalized name
    is in the set. This reduces memory from ~4GB to ~50MB.

    Returns: {normalized_name: {company_number, status, sic_codes, ...}}
    """
    logger.info("Loading CH bulk data from %s...", csv_path)
    if wanted_names:
        logger.info("  Filtering for %d wanted names (memory-efficient mode)", len(wanted_names))
    start = time.time()

    ch_index = {}
    row_count = 0

    with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        # CH CSV has leading spaces in some column names — strip them
        reader.fieldnames = [n.strip() for n in reader.fieldnames]
        for row in reader:
            row_count += 1
            # Strip all values
            row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
            name = row.get("CompanyName", "")
            number = row.get("CompanyNumber", "")
            if not name or not number:
                continue

            norm = normalize(name)
            if not norm:
                continue

            # Skip if not in wanted set (memory-efficient mode)
            if wanted_names and norm not in wanted_names:
                continue

            # Collect SIC codes
            sic_codes = []
            for i in range(1, 5):
                sic = row.get(f"SICCode.SicText_{i}", "").strip()
                if sic:
                    sic_codes.append(sic)

            # Parse address
            address_parts = []
            for field in ["RegAddress.AddressLine1", "RegAddress.AddressLine2",
                         "RegAddress.PostTown", "RegAddress.County",
                         "RegAddress.Country", "RegAddress.PostCode"]:
                val = row.get(field, "").strip()
                if val:
                    address_parts.append(val)

            ch_index[norm] = {
                "company_number": number,
                "company_name": name,
                "company_status": row.get("CompanyStatus", "").strip(),
                "company_type": row.get("CompanyCategory", "").strip(),
                "incorporation_date": row.get("IncorporationDate", "").strip(),
                "sic_codes": sic_codes,
                "registered_address": {"full_address": ", ".join(address_parts)} if address_parts else None,
                "accounts_overdue": row.get("Accounts.AccountRefDay", "") == "",
                "has_charges": row.get("Mortgages.NumMortCharges", "0") != "0",
                "charge_count": int(row.get("Mortgages.NumMortCharges", "0") or 0),
            }

            if row_count % 1000000 == 0:
                logger.info("  scanned %d rows, matched %d...", row_count, len(ch_index))

    elapsed = time.time() - start
    logger.info("Scanned %d companies, matched %d in %.1fs",
                row_count, len(ch_index), elapsed)
    return ch_index


async def enrich_from_bulk(ch_index: dict, limit: int):
    """Match sponsor names against CH bulk data and update profiles."""
    from sqlalchemy import select, func
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.orm import selectinload
    from app.core.config import get_settings
    from app.models.company import CompanyProfile

    settings = get_settings()
    engine = create_async_engine(
        settings.database_url, pool_size=10, max_overflow=5, echo=False,
    )
    SessionFactory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Count profiles needing CH data
    async with SessionFactory() as db:
        total = (await db.execute(
            select(func.count()).select_from(CompanyProfile).where(
                CompanyProfile.companies_house_number.is_(None),
            )
        )).scalar()

    target = min(total, limit) if limit > 0 else total
    logger.info("Matching %d profiles against %d CH companies...", target, len(ch_index))

    stats = {"matched": 0, "updated": 0, "no_match": 0}
    processed = 0
    batch_size = 1000
    start = time.time()

    while processed < target:
        async with SessionFactory() as db:
            result = await db.execute(
                select(CompanyProfile)
                .options(selectinload(CompanyProfile.sponsor))
                .where(CompanyProfile.companies_house_number.is_(None))
                .limit(batch_size)
            )
            profiles = list(result.scalars().all())

            if not profiles:
                break

            for profile in profiles:
                sponsor = profile.sponsor
                if not sponsor:
                    continue

                org_name = sponsor.organisation_name or ""
                norm = normalize(org_name)
                match = ch_index.get(norm)

                if match:
                    profile.companies_house_number = match["company_number"]
                    profile.company_status = match["company_status"]
                    profile.company_type = match["company_type"]
                    if match["sic_codes"]:
                        profile.sic_codes = match["sic_codes"]
                    if match["registered_address"]:
                        profile.registered_address = match["registered_address"]
                    if match["has_charges"]:
                        profile.has_charges = match["has_charges"]
                        profile.charge_count = match["charge_count"]
                    if match.get("incorporation_date"):
                        try:
                            from dateutil.parser import parse as parse_date
                            profile.incorporation_date = parse_date(match["incorporation_date"]).date()
                        except Exception:
                            pass
                    profile.enrichment_level = "LEVEL_1"
                    profile.enriched_at = datetime.utcnow()
                    stats["matched"] += 1
                else:
                    stats["no_match"] += 1
                    # Still mark as enriched (attempted)
                    if not profile.enriched_at:
                        profile.enriched_at = datetime.utcnow()
                        profile.enrichment_level = "LEVEL_1"

            await db.commit()

        processed += len(profiles)
        elapsed = time.time() - start
        rate = processed / elapsed if elapsed > 0 else 0

        if processed % 5000 == 0 or processed >= target:
            logger.info(
                "%d/%d (%.1f%%) | %.0f/sec | matched=%d (%.1f%%) | no_match=%d",
                processed, target, processed / target * 100,
                rate, stats["matched"], stats["matched"] / max(processed, 1) * 100,
                stats["no_match"],
            )

    elapsed = time.time() - start
    logger.info(
        "DONE: %d processed | %d matched (%.1f%%) | %d no match | %.1f min",
        processed, stats["matched"], stats["matched"] / max(processed, 1) * 100,
        stats["no_match"], elapsed / 60,
    )
    await engine.dispose()


def extract_csv(zip_path: str) -> str:
    """Extract CSV from ZIP, return CSV path."""
    data_dir = os.path.dirname(zip_path)
    csv_path = os.path.join(data_dir, "ch_bulk.csv")

    if os.path.exists(csv_path) and os.path.getsize(csv_path) > 100_000_000:
        logger.info("CSV already extracted: %s", csv_path)
        return csv_path

    logger.info("Extracting %s...", zip_path)
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        csv_name = [n for n in names if n.endswith(".csv")][0]
        logger.info("Extracting %s...", csv_name)
        zf.extract(csv_name, data_dir)
        extracted = os.path.join(data_dir, csv_name)
        if extracted != csv_path:
            os.rename(extracted, csv_path)

    logger.info("Extracted to %s (%.0f MB)", csv_path, os.path.getsize(csv_path) / 1e6)
    return csv_path


async def fetch_sponsor_names() -> set[str]:
    """Fetch all sponsor org names from DB and return normalized set."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from app.core.config import get_settings
    from app.models.sponsor import Sponsor

    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    SessionFactory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionFactory() as db:
        result = await db.execute(select(Sponsor.organisation_name))
        names = {normalize(row[0]) for row in result.all() if row[0]}

    await engine.dispose()
    logger.info("Fetched %d unique normalized sponsor names from DB", len(names))
    return names


def main():
    parser = argparse.ArgumentParser(description="Bulk CH enrichment")
    parser.add_argument("--zip-path", default="data/ch_bulk.zip")
    parser.add_argument("--csv-path", default="")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    csv_path = args.csv_path
    if not csv_path:
        csv_path = extract_csv(args.zip_path)

    # Phase 1: Get sponsor names for memory-efficient filtering
    wanted_names = asyncio.run(fetch_sponsor_names())

    # Phase 2: Stream CSV, only keeping matches
    ch_index = load_ch_data(csv_path, wanted_names=wanted_names)

    # Phase 3: Update database
    asyncio.run(enrich_from_bulk(ch_index, args.limit))


if __name__ == "__main__":
    main()
