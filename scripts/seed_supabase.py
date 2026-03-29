"""
Seed Supabase with sponsor data from CSV.
Connects directly via psycopg2 — no Docker, no SQLAlchemy needed.

Usage:
    python scripts/seed_supabase.py
"""

import csv
import hashlib
import os
import re
import time
import uuid
from datetime import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras

# Supabase connection (direct Postgres)
DB_HOST = os.environ.get("DB_HOST", "aws-1-eu-west-2.pooler.supabase.com")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "postgres")
DB_USER = os.environ.get("DB_USER", "postgres.sbjbqjuzjjjpdilmpzkb")
DB_PASS = os.environ.get("DB_PASS", "1EEftANWGyMkHhH33hkoa2PDwhJVnl4c")

# Industry classification
INDUSTRY_PATTERNS = {
    "Healthcare": ["hospital", "health", "medical", "pharma", "nhs", "clinic", "care home", "dental", "nursing", "surgery", "therapist", "care"],
    "Technology": ["tech", "software", "digital", "cyber", "data", "cloud", "ai ", "saas", "app ", "computing", "systems", "it "],
    "Finance": ["bank", "capital", "invest", "financ", "insur", "mortgage", "wealth", "fund ", "trading", "fintech"],
    "Education": ["university", "school", "college", "academy", "education", "training", "learning", "tutor"],
    "Legal": ["solicitor", "law firm", "legal", "barrister", "advocate"],
    "Construction": ["construction", "building", "architect", "engineer", "plumb", "electr", "roofing"],
    "Hospitality": ["hotel", "restaurant", "cafe", "catering", "hospitality", "pub ", "bar "],
    "Retail": ["retail", "shop", "store", "supermarket", "market", "ecommerce"],
    "Food & Drink": ["food", "beverage", "bakery", "butcher", "dairy", "brewery"],
    "Consulting": ["consult", "advisory", "strateg"],
    "Manufacturing": ["manufactur", "factory", "production", "industr"],
    "Transport": ["transport", "logistics", "shipping", "freight", "delivery", "courier"],
    "Energy": ["energy", "solar", "wind", "oil", "gas ", "petrol", "utility"],
    "Recruitment": ["recruit", "staffing", "employment", "agency"],
    "Real Estate": ["property", "estate agent", "lettings", "housing"],
    "Charity": ["charity", "foundation", "trust", "voluntary", "non-profit"],
    "Media": ["media", "broadcast", "publish", "newspaper", "magazine"],
    "Telecommunications": ["telecom", "mobile", "broadband", "network"],
    "Agriculture": ["farm", "agri", "livestock", "crop"],
    "Arts & Entertainment": ["theatre", "museum", "gallery", "entertainment", "cinema"],
}


def normalise(name: str) -> str:
    name = name.upper().strip()
    name = re.sub(r"[^A-Z0-9 ]", "", name)
    return re.sub(r"\s+", " ", name).strip()


def classify_industry(name: str) -> str:
    lower = name.lower()
    for industry, keywords in INDUSTRY_PATTERNS.items():
        if any(kw in lower for kw in keywords):
            return industry
    return "Other"


def parse_rating(type_and_rating: str):
    if not type_and_rating:
        return None, None
    if " (A rating)" in type_and_rating:
        return "A", type_and_rating.replace(" (A rating)", "").strip()
    elif " (B rating)" in type_and_rating:
        return "B", type_and_rating.replace(" (B rating)", "").strip()
    return None, type_and_rating.strip()


def parse_sponsor_type(stype: str):
    if not stype:
        return None
    if "Temporary" in stype:
        return "Temporary Worker"
    return "Worker"


def main():
    csv_path = Path("data/2026-02-27_-_Worker_and_Temporary_Worker.csv")
    if not csv_path.exists():
        print(f"ERROR: CSV not found at {csv_path}")
        return

    print(f"Connecting to Supabase...")
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS, sslmode="require")
    conn.autocommit = False
    cur = conn.cursor()

    # Check if already seeded
    cur.execute("SELECT COUNT(*) FROM sponsors")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"Database already has {existing:,} sponsors. Skipping seed.")
        cur.close()
        conn.close()
        return

    # Read CSV
    print(f"Reading CSV: {csv_path.name}...")
    rows = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Read {len(rows):,} rows from CSV")

    # Also create a CSV import record
    csv_bytes = csv_path.read_bytes()
    checksum = hashlib.md5(csv_bytes).hexdigest()
    import_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    cur.execute("""
        INSERT INTO csv_imports (id, filename, checksum_md5, record_count, added_count, imported_at, is_auto)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (import_id, csv_path.name, checksum, len(rows), len(rows), now, False))

    # Insert sponsors in batches
    BATCH = 1000
    sponsors = []
    start = time.time()

    for i, row in enumerate(rows):
        org_name = row.get("Organisation Name", "").strip()
        if not org_name:
            continue

        town = row.get("Town/City", "").strip() or None
        county = row.get("County", "").strip() or None
        type_and_rating = row.get("Type & Rating", "").strip() or None

        rating, stype_str = parse_rating(type_and_rating)
        sponsor_type = parse_sponsor_type(stype_str)

        # Parse route from "Route" column
        route_raw = row.get("Route", "").strip()
        route = [r.strip() for r in route_raw.split(",")] if route_raw else None

        sid = str(uuid.uuid4())
        sponsors.append((
            sid, org_name, normalise(org_name), town, county,
            type_and_rating, rating, sponsor_type,
            route, True, now, now, 0, 0, now, now,
        ))

    print(f"Inserting {len(sponsors):,} sponsors in batches of {BATCH}...")

    for i in range(0, len(sponsors), BATCH):
        batch = sponsors[i:i + BATCH]
        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO sponsors (
                id, organisation_name, organisation_name_normalised,
                town_city, county, type_and_rating, rating, sponsor_type,
                route, is_active, first_seen_date, last_seen_date,
                consecutive_a_rating_days, times_rating_changed,
                created_at, updated_at
            ) VALUES %s""",
            batch,
            template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        )

        done = min(i + BATCH, len(sponsors))
        elapsed = time.time() - start
        rate = done / elapsed if elapsed > 0 else 0
        print(f"  {done:,}/{len(sponsors):,} ({100*done/len(sponsors):.0f}%) | {rate:.0f}/sec")

    conn.commit()
    print(f"\nInserted {len(sponsors):,} sponsors in {time.time()-start:.1f}s")

    # Classify industries
    print("Classifying industries...")
    cur.execute("SELECT id, organisation_name FROM sponsors")
    all_sponsors = cur.fetchall()

    industry_counts = {}
    updates = []
    for sid, name in all_sponsors:
        industry = classify_industry(name)
        industry_counts[industry] = industry_counts.get(industry, 0) + 1
        # We don't have industry on sponsors table — it's on company_profiles
        # So we'll handle this during profile bootstrap

    print(f"Industry distribution (top 10):")
    for ind, cnt in sorted(industry_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {ind}: {cnt:,}")

    cur.close()
    conn.close()
    print("\nDone! Sponsors seeded successfully.")


if __name__ == "__main__":
    main()
