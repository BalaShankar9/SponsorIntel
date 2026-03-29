"""
Bootstrap CompanyProfile records for all sponsors in Supabase.
Creates LEVEL_0 profiles for every sponsor without one.
"""

import os
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

BATCH = 2000


def main():
    print("Connecting to Supabase...")
    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS, sslmode="require")
    conn.autocommit = False
    cur = conn.cursor()

    # Count sponsors without profiles
    cur.execute("SELECT COUNT(*) FROM sponsors")
    total_sponsors = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM company_profiles")
    existing = cur.fetchone()[0]

    to_create = total_sponsors - existing
    print(f"Sponsors: {total_sponsors:,} | Existing profiles: {existing:,} | To create: {to_create:,}")

    if to_create == 0:
        print("All sponsors already have profiles.")
        cur.close()
        conn.close()
        return

    # Get sponsor IDs without profiles
    cur.execute("""
        SELECT s.id FROM sponsors s
        LEFT JOIN company_profiles cp ON cp.sponsor_id = s.id
        WHERE cp.id IS NULL
        ORDER BY s.id
    """)
    sponsor_ids = [row[0] for row in cur.fetchall()]
    print(f"Found {len(sponsor_ids):,} sponsors needing profiles")

    start = time.time()
    created = 0

    for i in range(0, len(sponsor_ids), BATCH):
        batch = sponsor_ids[i:i + BATCH]
        now = datetime.utcnow().isoformat()
        values = [
            (str(uuid.uuid4()), str(sid), '0', 0, 0, now, now)
            for sid in batch
        ]

        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO company_profiles (
                id, sponsor_id, enrichment_level, enrichment_priority,
                failure_count, created_at, updated_at
            ) VALUES %s""",
            values,
            template="(%s, %s, %s, %s, %s, %s, %s)",
        )

        created += len(batch)
        elapsed = time.time() - start
        rate = created / elapsed if elapsed > 0 else 0
        print(f"  {created:,}/{len(sponsor_ids):,} ({100*created/len(sponsor_ids):.0f}%) | {rate:.0f}/sec")

    conn.commit()
    print(f"\nBootstrap complete: {created:,} profiles created in {time.time()-start:.1f}s")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
