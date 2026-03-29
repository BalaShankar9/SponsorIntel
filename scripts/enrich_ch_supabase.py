"""
Bulk Companies House enrichment for Supabase.
Streams CH CSV, matches against sponsor names, updates profiles.
Runs locally — no Docker needed.

Usage:
    python scripts/enrich_ch_supabase.py
"""

import csv
import json
import os
import re
import time
import uuid
from datetime import datetime

import psycopg2
import psycopg2.extras

DB_HOST = os.environ.get("DB_HOST", "aws-1-eu-west-2.pooler.supabase.com")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "postgres")
DB_USER = os.environ.get("DB_USER", "postgres.sbjbqjuzjjjpdilmpzkb")
DB_PASS = os.environ.get("DB_PASS", "1EEftANWGyMkHhH33hkoa2PDwhJVnl4c")

CH_CSV = "backend/data/ch_bulk.csv"
BATCH = 500


def normalize(name: str) -> str:
    name = name.upper().strip()
    # Strip anything after T/A or TRADING AS
    name = re.split(r'\s+T/A\s+|\s+TRADING AS\s+|\.T/A[- ]', name)[0]
    # Strip appended company numbers
    name = re.sub(r'-\d{6,}$', '', name)
    # Remove common suffixes
    for suffix in [" LIMITED", " LTD", " LTD.", " PLC", " LLP", " LP", " INC",
                   " CORPORATION", " CORP", " CO.", " CO", " CIC", " C.I.C", " C.I.C."]:
        name = name.replace(suffix, "")
    name = re.sub(r"[^A-Z0-9 ]", "", name)
    return re.sub(r"\s+", " ", name).strip()


def main():
    print("Connecting to Supabase...")
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS, sslmode="require")
    conn.autocommit = False
    cur = conn.cursor()

    # Phase 1: Get all sponsor names
    print("Fetching sponsor names...")
    cur.execute("SELECT s.id, s.organisation_name, cp.id FROM sponsors s JOIN company_profiles cp ON cp.sponsor_id = s.id WHERE cp.companies_house_number IS NULL")
    rows = cur.fetchall()
    print(f"  {len(rows):,} profiles need CH data")

    # Build lookup: normalized_name -> [(sponsor_id, profile_id), ...]
    name_to_profiles = {}
    for sponsor_id, org_name, profile_id in rows:
        norm = normalize(org_name)
        if norm:
            if norm not in name_to_profiles:
                name_to_profiles[norm] = []
            name_to_profiles[norm].append((sponsor_id, profile_id))

    wanted = set(name_to_profiles.keys())
    print(f"  {len(wanted):,} unique normalized names to match")

    # Phase 2: Stream CH CSV
    print(f"Streaming CH CSV: {CH_CSV}...")
    start = time.time()
    ch_matches = {}
    row_count = 0

    with open(CH_CSV, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        reader.fieldnames = [n.strip() for n in reader.fieldnames]
        for row in reader:
            row_count += 1
            row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}
            name = row.get("CompanyName", "")
            number = row.get("CompanyNumber", "")
            if not name or not number:
                continue

            norm = normalize(name)
            if norm not in wanted:
                continue

            # Extract data
            sic_codes = []
            for i in range(1, 5):
                sic = row.get(f"SICCode.SicText_{i}", "").strip()
                if sic:
                    sic_codes.append(sic)

            address_parts = []
            for field in ["RegAddress.AddressLine1", "RegAddress.AddressLine2",
                         "RegAddress.PostTown", "RegAddress.County",
                         "RegAddress.Country", "RegAddress.PostCode"]:
                val = row.get(field, "").strip()
                if val:
                    address_parts.append(val)

            ch_matches[norm] = {
                "company_number": number,
                "company_status": row.get("CompanyStatus", "").strip(),
                "company_type": row.get("CompanyCategory", "").strip(),
                "incorporation_date": row.get("IncorporationDate", "").strip(),
                "sic_codes": sic_codes,
                "registered_address": {"full_address": ", ".join(address_parts)} if address_parts else None,
                "has_charges": row.get("Mortgages.NumMortCharges", "0") != "0",
                "charge_count": int(row.get("Mortgages.NumMortCharges", "0") or 0),
            }

            if row_count % 1000000 == 0:
                print(f"  scanned {row_count:,} rows, {len(ch_matches):,} matches...")

    elapsed = time.time() - start
    print(f"  Scanned {row_count:,} rows, {len(ch_matches):,} matches in {elapsed:.0f}s")

    # Phase 3: Update profiles
    print(f"Updating profiles...")
    start = time.time()
    matched = 0
    no_match = 0
    updates = []

    for norm, profiles in name_to_profiles.items():
        match = ch_matches.get(norm)
        now = datetime.utcnow().isoformat()

        for sponsor_id, profile_id in profiles:
            if match:
                inc_date = None
                if match["incorporation_date"]:
                    try:
                        from dateutil.parser import parse as parse_date
                        inc_date = parse_date(match["incorporation_date"]).isoformat()
                    except Exception:
                        pass

                updates.append((
                    match["company_number"],
                    match["company_status"],
                    match["company_type"],
                    json.dumps(match["sic_codes"]) if match["sic_codes"] else None,
                    json.dumps(match["registered_address"]) if match["registered_address"] else None,
                    match["has_charges"],
                    match["charge_count"],
                    inc_date,
                    '1',  # enrichment_level LEVEL_1
                    now,
                    str(profile_id),
                ))
                matched += 1
            else:
                # Mark as enriched (attempted) even without match
                updates.append((
                    None, None, None, None, None, None, None, None,
                    '1', now, str(profile_id),
                ))
                no_match += 1

        # Flush in batches
        if len(updates) >= BATCH:
            _flush_updates(cur, updates)
            conn.commit()
            total = matched + no_match
            elapsed = time.time() - start
            rate = total / elapsed if elapsed > 0 else 0
            if total % 5000 < BATCH:
                print(f"  {total:,}/{len(rows):,} ({100*total/len(rows):.0f}%) | {rate:.0f}/sec | matched={matched:,} ({100*matched/max(total,1):.0f}%)")
            updates = []

    # Flush remaining
    if updates:
        _flush_updates(cur, updates)
        conn.commit()

    elapsed = time.time() - start
    total = matched + no_match
    print(f"\nDONE: {total:,} processed | {matched:,} matched ({100*matched/max(total,1):.0f}%) | {no_match:,} no match | {elapsed:.0f}s")

    cur.close()
    conn.close()


def _flush_updates(cur, updates):
    for u in updates:
        cur.execute("""
            UPDATE company_profiles SET
                companies_house_number = COALESCE(%s, companies_house_number),
                company_status = COALESCE(%s, company_status),
                company_type = COALESCE(%s, company_type),
                sic_codes = COALESCE(%s::jsonb, sic_codes),
                registered_address = COALESCE(%s::jsonb, registered_address),
                has_charges = COALESCE(%s, has_charges),
                charge_count = COALESCE(%s, charge_count),
                incorporation_date = COALESCE(%s::timestamp, incorporation_date),
                enrichment_level = %s,
                enriched_at = %s,
                updated_at = %s
            WHERE id = %s::uuid
        """, (*u[:10], u[9], u[10]))


if __name__ == "__main__":
    main()
