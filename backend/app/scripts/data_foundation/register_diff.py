"""Enhanced register diff — computes changes between CSV and DB."""

import logging
import re

logger = logging.getLogger(__name__)


def normalize_name(name: str) -> str:
    n = name.upper().strip()
    n = re.sub(r"[^A-Z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def compute_diff(csv_records: list[dict], db_sponsors: dict[str, dict]) -> dict:
    added, removed, rating_changes, route_changes = [], [], [], []
    csv_names = set()

    for record in csv_records:
        norm = normalize_name(record.get("organisation_name", ""))
        if not norm:
            continue
        csv_names.add(norm)
        existing = db_sponsors.get(norm)
        if not existing:
            added.append(record)
            continue
        old_rating = existing.get("rating")
        new_rating = record.get("rating")
        if old_rating and new_rating and old_rating != new_rating:
            rating_changes.append({
                "sponsor_id": existing.get("id"),
                "organisation_name": record["organisation_name"],
                "old_rating": old_rating,
                "new_rating": new_rating,
            })
        old_routes = set(existing.get("routes") or [])
        new_routes = set(record.get("routes") or [])
        if old_routes != new_routes:
            route_changes.append({
                "sponsor_id": existing.get("id"),
                "organisation_name": record["organisation_name"],
                "old_routes": list(old_routes),
                "new_routes": list(new_routes),
            })

    for norm_name, sponsor in db_sponsors.items():
        if norm_name not in csv_names:
            removed.append(sponsor)

    return {"added": added, "removed": removed, "rating_changes": rating_changes, "route_changes": route_changes}
