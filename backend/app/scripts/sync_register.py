"""
Daily Home Office Sponsor Register Sync.

Downloads the latest UK sponsor register CSV from gov.uk, diffs it against
our database, and applies changes:
- NEW sponsors → Insert with full details
- REMOVED sponsors → Mark as is_active=false, record removal signal
- RATING CHANGES → Update rating, record change signal
- ROUTE CHANGES → Update routes, record change signal

The Home Office publishes the register as a CSV at:
https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers

Usage:
    python -m app.scripts.sync_register [--dry-run]
"""

import argparse
import asyncio
import csv
import io
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sync_register")

# The Home Office publishes the register at this page
REGISTER_PAGE_URL = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"

# Direct CSV download URL (this is the Workers register)
# The URL may change — we'll try to discover it from the page first
DIRECT_CSV_URLS = [
    "https://assets.publishing.service.gov.uk/media/sponsor-register.csv",
]


def normalize_name(name: str) -> str:
    """Normalize org name for matching."""
    n = name.upper().strip()
    n = re.sub(r"[^A-Z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def parse_routes(route_str: str) -> list[str]:
    """Parse route field from CSV — comma-separated list of routes."""
    if not route_str or not route_str.strip():
        return []
    routes = [r.strip() for r in route_str.split(",") if r.strip()]
    # Also handle semicolons
    expanded = []
    for r in routes:
        expanded.extend([x.strip() for x in r.split(";") if x.strip()])
    return expanded


def extract_rating(type_and_rating: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract sponsor_type and rating from the 'Type & Rating' CSV column.

    Handles multiple formats:
    - "Worker (A-rated)" / "Temporary Worker (B-rated)"
    - "Worker (A rating)" / "Temporary Worker (B rating)"
    - "Worker (UK Expansion Worker: Provisional )" — treated as no standard rating
    """
    if not type_and_rating:
        return None, None

    # Match both "(A-rated)" and "(A rating)" formats
    rating_match = re.search(r'\(([AB])[\s-]rat(?:ed|ing)\)', type_and_rating, re.I)
    rating = rating_match.group(1).upper() if rating_match else None

    # Extract type by removing the rating part
    sponsor_type = re.sub(r'\s*\([AB][\s-]rat(?:ed|ing)\)', '', type_and_rating, flags=re.I).strip()
    # Also clean up provisional/other parenthetical suffixes
    sponsor_type = re.sub(r'\s*\([^)]*\)\s*$', '', sponsor_type).strip()
    if not sponsor_type:
        sponsor_type = None

    return sponsor_type, rating


async def discover_csv_url() -> Optional[str]:
    """Try to discover the latest CSV URL from the gov.uk page."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.get(REGISTER_PAGE_URL)
            if resp.status_code != 200:
                logger.warning("Could not fetch register page: %d", resp.status_code)
                return None

            # Look for CSV download links in the page
            csv_links = re.findall(
                r'href="(https://assets\.publishing\.service\.gov\.uk/[^"]+\.csv)"',
                resp.text,
            )
            if csv_links:
                logger.info("Discovered CSV URL: %s", csv_links[0])
                return csv_links[0]

            # Look for any CSV attachment
            csv_links = re.findall(r'href="([^"]+\.csv)"', resp.text)
            if csv_links:
                url = csv_links[0]
                if not url.startswith("http"):
                    url = f"https://www.gov.uk{url}"
                logger.info("Discovered CSV URL: %s", url)
                return url

    except Exception as e:
        logger.warning("Error discovering CSV URL: %s", str(e)[:100])

    return None


async def download_register() -> list[dict]:
    """Download and parse the Home Office sponsor register CSV."""
    # Try to discover the URL first
    url = await discover_csv_url()

    if not url:
        # Try known direct URLs
        for direct_url in DIRECT_CSV_URLS:
            try:
                async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
                    resp = await client.get(direct_url)
                    if resp.status_code == 200:
                        url = direct_url
                        break
            except Exception:
                continue

    if not url:
        logger.error("Could not find or download the register CSV")
        return []

    logger.info("Downloading register from: %s", url)
    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.error("Download failed: %d", resp.status_code)
            return []

    content = resp.text
    logger.info("Downloaded %d bytes", len(content))

    # Parse CSV
    reader = csv.DictReader(io.StringIO(content))
    records = []

    for row in reader:
        # Strip all keys and values
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        org_name = row.get("Organisation Name", "") or row.get("Name", "")
        if not org_name:
            continue

        town_city = row.get("Town/City", "") or row.get("Town", "")
        county = row.get("County", "")
        type_rating = row.get("Type & Rating", "") or row.get("Rating", "")
        route_str = row.get("Route", "") or row.get("Routes", "")

        sponsor_type, rating = extract_rating(type_rating)
        routes = parse_routes(route_str)

        records.append({
            "organisation_name": org_name,
            "organisation_name_normalised": normalize_name(org_name),
            "town_city": town_city or None,
            "county": county or None,
            "type_and_rating": type_rating or None,
            "rating": rating,
            "sponsor_type": sponsor_type,
            "route": routes if routes else None,
            "is_active": True,
        })

    logger.info("Parsed %d sponsors from register", len(records))
    return records


async def get_supabase():
    """Get Supabase client."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


async def load_existing_sponsors(sb) -> dict[str, dict]:
    """Load all existing sponsors from DB, indexed by normalized name."""
    logger.info("Loading existing sponsors from database...")
    existing = {}
    page = 0
    batch_size = 1000

    while True:
        resp = sb.table("sponsors").select(
            "id, organisation_name, organisation_name_normalised, town_city, county, "
            "type_and_rating, rating, sponsor_type, route, is_active"
        ).range(page * batch_size, (page + 1) * batch_size - 1).execute()

        if not resp.data:
            break

        for row in resp.data:
            norm = row.get("organisation_name_normalised") or normalize_name(row["organisation_name"])
            # Key by norm + city for dedup (some sponsors have same name, different cities)
            key = f"{norm}|{(row.get('town_city') or '').upper()}"
            existing[key] = row

        if len(resp.data) < batch_size:
            break
        page += 1

    logger.info("Loaded %d existing sponsors", len(existing))
    return existing


async def sync(sb, register_records: list[dict], dry_run: bool = False):
    """Diff register against DB and apply changes."""
    existing = await load_existing_sponsors(sb)
    now = datetime.now(timezone.utc).isoformat()

    stats = {
        "new_sponsors": 0,
        "removed_sponsors": 0,
        "reactivated": 0,
        "rating_changes": 0,
        "route_changes": 0,
        "unchanged": 0,
        "errors": 0,
    }

    # Build set of all sponsors in the new register
    register_keys = set()
    changes = []

    for record in register_records:
        norm = record["organisation_name_normalised"]
        city = (record.get("town_city") or "").upper()
        key = f"{norm}|{city}"
        register_keys.add(key)

        if key in existing:
            # Sponsor exists — check for changes
            db_row = existing[key]
            sponsor_id = db_row["id"]

            # Check rating change
            if record["rating"] and db_row.get("rating") and record["rating"] != db_row["rating"]:
                stats["rating_changes"] += 1
                changes.append({
                    "type": "rating_change",
                    "sponsor_id": sponsor_id,
                    "old_value": db_row["rating"],
                    "new_value": record["rating"],
                    "org_name": record["organisation_name"],
                })
                if not dry_run:
                    sb.table("sponsors").update({
                        "rating": record["rating"],
                        "type_and_rating": record["type_and_rating"],
                        "updated_at": now,
                    }).eq("id", sponsor_id).execute()

            # Check route changes
            old_routes = sorted(db_row.get("route") or [])
            new_routes = sorted(record.get("route") or [])
            if old_routes != new_routes and new_routes:
                stats["route_changes"] += 1
                changes.append({
                    "type": "route_change",
                    "sponsor_id": sponsor_id,
                    "old_value": ",".join(old_routes),
                    "new_value": ",".join(new_routes),
                    "org_name": record["organisation_name"],
                })
                if not dry_run:
                    sb.table("sponsors").update({
                        "route": record["route"],
                        "updated_at": now,
                    }).eq("id", sponsor_id).execute()

            # Reactivate if was inactive
            if not db_row.get("is_active"):
                stats["reactivated"] += 1
                changes.append({
                    "type": "reactivated",
                    "sponsor_id": sponsor_id,
                    "org_name": record["organisation_name"],
                })
                if not dry_run:
                    sb.table("sponsors").update({
                        "is_active": True,
                        "last_seen_date": now[:10],
                        "updated_at": now,
                    }).eq("id", sponsor_id).execute()
            else:
                stats["unchanged"] += 1

            # Always update last_seen_date
            if not dry_run:
                sb.table("sponsors").update({
                    "last_seen_date": now[:10],
                }).eq("id", sponsor_id).execute()

        else:
            # New sponsor!
            stats["new_sponsors"] += 1
            changes.append({
                "type": "new_sponsor",
                "org_name": record["organisation_name"],
                "rating": record["rating"],
                "town_city": record.get("town_city"),
            })
            if not dry_run:
                new_id = str(uuid.uuid4())
                try:
                    sb.table("sponsors").insert({
                        "id": new_id,
                        "organisation_name": record["organisation_name"],
                        "organisation_name_normalised": record["organisation_name_normalised"],
                        "town_city": record.get("town_city"),
                        "county": record.get("county"),
                        "type_and_rating": record.get("type_and_rating"),
                        "rating": record["rating"],
                        "sponsor_type": record.get("sponsor_type"),
                        "route": record.get("route"),
                        "is_active": True,
                        "first_seen_date": now[:10],
                        "last_seen_date": now[:10],
                        "created_at": now,
                        "updated_at": now,
                    }).execute()

                    # Create empty company profile for enrichment
                    sb.table("company_profiles").insert({
                        "id": str(uuid.uuid4()),
                        "sponsor_id": new_id,
                        "enrichment_level": 0,
                        "created_at": now,
                        "updated_at": now,
                    }).execute()
                except Exception as e:
                    stats["errors"] += 1
                    logger.warning("Insert error for %s: %s", record["organisation_name"][:40], str(e)[:80])

    # Check for REMOVED sponsors (in DB but not in register)
    for key, db_row in existing.items():
        if key not in register_keys and db_row.get("is_active"):
            stats["removed_sponsors"] += 1
            changes.append({
                "type": "removed",
                "sponsor_id": db_row["id"],
                "org_name": db_row["organisation_name"],
                "rating": db_row.get("rating"),
            })
            if not dry_run:
                sb.table("sponsors").update({
                    "is_active": False,
                    "updated_at": now,
                }).eq("id", db_row["id"]).execute()

    # Record changes as signals
    if not dry_run and changes:
        significant_changes = [c for c in changes if c["type"] in ("new_sponsor", "removed", "rating_change")]
        for change in significant_changes[:100]:  # Limit to avoid flooding
            try:
                sb.table("sponsor_changes").insert({
                    "id": str(uuid.uuid4()),
                    "sponsor_id": change.get("sponsor_id"),
                    "change_type": change["type"],
                    "field_changed": "rating" if change["type"] == "rating_change" else change["type"],
                    "old_value": change.get("old_value"),
                    "new_value": change.get("new_value"),
                    "detected_at": now,
                    "significance_score": 90 if change["type"] == "rating_change" else 70,
                }).execute()
            except Exception:
                pass

    return stats, changes


async def main():
    parser = argparse.ArgumentParser(description="Sync Home Office sponsor register")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    args = parser.parse_args()

    logger.info("=== HOME OFFICE REGISTER SYNC ===")
    if args.dry_run:
        logger.info("DRY RUN — no changes will be applied")

    # Download and parse register
    records = await download_register()
    if not records:
        logger.error("No records downloaded — aborting")
        return

    # Connect to database
    sb = await get_supabase()

    # Sync
    start = time.time()
    stats, changes = await sync(sb, records, dry_run=args.dry_run)
    elapsed = time.time() - start

    # Report
    logger.info("\n=== SYNC COMPLETE (%.1fs) ===", elapsed)
    logger.info("Register size: %d", len(records))
    logger.info("New sponsors: %d", stats["new_sponsors"])
    logger.info("Removed sponsors: %d", stats["removed_sponsors"])
    logger.info("Reactivated: %d", stats["reactivated"])
    logger.info("Rating changes: %d", stats["rating_changes"])
    logger.info("Route changes: %d", stats["route_changes"])
    logger.info("Unchanged: %d", stats["unchanged"])
    logger.info("Errors: %d", stats["errors"])

    # Show notable changes
    notable = [c for c in changes if c["type"] in ("new_sponsor", "removed", "rating_change")]
    if notable:
        logger.info("\n--- NOTABLE CHANGES ---")
        for c in notable[:20]:
            if c["type"] == "new_sponsor":
                logger.info("  + NEW: %s (%s, %s)", c["org_name"], c.get("rating", "?"), c.get("town_city", "?"))
            elif c["type"] == "removed":
                logger.info("  - REMOVED: %s (%s)", c["org_name"], c.get("rating", "?"))
            elif c["type"] == "rating_change":
                logger.info("  ~ RATING: %s %s → %s", c["org_name"], c["old_value"], c["new_value"])


if __name__ == "__main__":
    asyncio.run(main())
