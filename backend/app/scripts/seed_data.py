"""
SponsorIntel Data Seed Script
Usage: python -m app.scripts.seed_data
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import select, func, text
from app.core.database import engine, Base, async_session
from app.core.security import hash_password
from app.models import *
from app.services.csv_import import import_csv
from app.utils.name_normaliser import normalise_company_name


# Industry classification heuristics (from existing prototype)
INDUSTRY_PATTERNS = {
    "Healthcare": [
        "hospital", "health", "medical", "pharma", "nhs", "clinic",
        "care home", "dental", "nursing", "surgery", "therapist", "care",
    ],
    "Technology": [
        "tech", "software", "digital", "cyber", "data", "cloud",
        "ai ", "saas", "app ", "computing", "systems", "it ",
    ],
    "Finance": [
        "bank", "capital", "invest", "financ", "insur", "mortgage",
        "wealth", "fund ", "trading", "fintech",
    ],
    "Education": [
        "university", "school", "college", "academy", "education",
        "training", "learning", "tutor",
    ],
    "Legal": ["solicitor", "law firm", "legal", "barrister", "advocate"],
    "Construction": [
        "construction", "building", "architect", "engineer",
        "plumb", "electr", "roofing",
    ],
    "Hospitality": [
        "hotel", "restaurant", "cafe", "catering", "hospitality",
        "pub ", "bar ",
    ],
    "Retail": [
        "retail", "shop", "store", "supermarket", "market", "ecommerce",
    ],
    "Manufacturing": ["manufactur", "factory", "production", "fabricat"],
    "Logistics": [
        "logistics", "transport", "delivery", "shipping",
        "freight", "courier", "warehouse",
    ],
    "Consulting": ["consult", "advisory", "strategy"],
    "Recruitment": [
        "recruit", "staffing", "talent", "hr ", "human resource",
    ],
    "Charity/NGO": [
        "charity", "foundation", "trust", "non-profit", "nonprofit",
    ],
    "Media": ["media", "broadcast", "news", "publish", "magazine"],
    "Energy": [
        "energy", "oil", "gas", "solar", "wind", "renewable", "power",
    ],
    "Telecommunications": ["telecom", "mobile", "wireless", "network"],
    "Food & Drink": [
        "food", "beverage", "drink", "bakery", "meat", "dairy",
    ],
    "Automotive": ["motor", "car ", "vehicle", "automotive", "garage"],
    "Agriculture": ["farm", "agri", "crop", "livestock"],
    "Real Estate": [
        "property", "real estate", "estate agent", "lettings",
    ],
}


def classify_industry(name: str) -> str:
    """Classify a company into an industry based on name keyword matching."""
    name_lower = name.lower()
    for industry, keywords in INDUSTRY_PATTERNS.items():
        for kw in keywords:
            if kw in name_lower:
                return industry
    return "Other"


async def seed():
    print("=" * 60)
    print("  SponsorIntel - Data Seed Script")
    print("=" * 60)
    print()

    # 1. Create tables
    print("[1/5] Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Enable extensions
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
    print("  Done.")

    # 2. Find CSV file
    print("[2/5] Looking for CSV file...")
    # Try multiple paths: relative to script, /app/data (Docker), and project root
    search_dirs = [
        Path(__file__).parent.parent.parent / "data",       # backend/data
        Path(__file__).parent.parent.parent.parent / "data", # project root/data
        Path("/app/data"),                                    # Docker mount
    ]
    csv_files = []
    for d in search_dirs:
        if d.exists():
            csv_files.extend(d.glob("*.csv"))

    if not csv_files:
        print("  ERROR: No CSV file found! Place your sponsor CSV in the data/ directory.")
        return

    csv_file = max(csv_files, key=os.path.getmtime)
    print(f"  Found: {csv_file.name} ({csv_file.stat().st_size / 1024 / 1024:.1f} MB)")

    # 3. Import CSV
    print("[3/5] Importing CSV data...")
    async with async_session() as db:
        # Check if already imported
        result = await db.execute(select(func.count(Sponsor.id)))
        existing_count = result.scalar()

        if existing_count > 0:
            print(f"  Database already has {existing_count:,} sponsors. Skipping import.")
            print("  To re-import, drop the database and run again.")
        else:
            file_content = csv_file.read_bytes()
            csv_import_record = await import_csv(
                db=db,
                file_content=file_content,
                filename=csv_file.name,
                source_url="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers",
                is_auto=False,
            )
            await db.commit()
            print(f"  Imported {csv_import_record.record_count:,} records")
            print(f"  Added: {csv_import_record.added_count:,}")

    # 4. Classify industries
    print("[4/5] Classifying industries...")
    async with async_session() as db:
        result = await db.execute(select(Sponsor))
        sponsors = result.scalars().all()

        industry_counts: dict[str, int] = {}
        for sponsor in sponsors:
            industry = classify_industry(sponsor.organisation_name)
            industry_counts[industry] = industry_counts.get(industry, 0) + 1

        print(f"  Classified {len(sponsors):,} sponsors into {len(industry_counts)} industries")
        # Print top 10
        sorted_industries = sorted(industry_counts.items(), key=lambda x: -x[1])
        for industry, count in sorted_industries[:10]:
            print(f"    {industry}: {count:,}")

    # 5. Create admin user
    print("[5/5] Creating admin user...")
    async with async_session() as db:
        existing = await db.execute(
            select(User).where(User.email == "admin@sponsorintel.com")
        )
        if existing.scalar_one_or_none():
            print("  Admin user already exists.")
        else:
            admin = User(
                email="admin@sponsorintel.com",
                password_hash=hash_password("admin123changeme"),
                name="Admin",
                plan=UserPlan.ENTERPRISE,
                is_admin=True,
            )
            db.add(admin)
            await db.commit()
            print("  Created admin@sponsorintel.com (password: admin123changeme)")
            print("  WARNING: CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!")

    # Summary
    print()
    print("=" * 60)
    print("  Seed Complete!")
    print("=" * 60)
    async with async_session() as db:
        total = (await db.execute(select(func.count(Sponsor.id)))).scalar()
        a_rated = (
            await db.execute(
                select(func.count(Sponsor.id)).where(
                    Sponsor.rating == SponsorRating.A
                )
            )
        ).scalar()
        b_rated = (
            await db.execute(
                select(func.count(Sponsor.id)).where(
                    Sponsor.rating == SponsorRating.B
                )
            )
        ).scalar()
        active = (
            await db.execute(
                select(func.count(Sponsor.id)).where(Sponsor.is_active == True)
            )
        ).scalar()

        cities_result = await db.execute(
            select(Sponsor.town_city, func.count(Sponsor.id))
            .where(Sponsor.town_city.isnot(None))
            .group_by(Sponsor.town_city)
            .order_by(func.count(Sponsor.id).desc())
            .limit(5)
        )
        top_cities = cities_result.all()

        print(f"  Total Sponsors: {total:,}")
        print(f"  A-Rated: {a_rated:,}")
        print(f"  B-Rated: {b_rated:,}")
        print(f"  Active: {active:,}")
        print(f"  Top Cities:")
        for city, count in top_cities:
            print(f"    {city}: {count:,}")
    print()
    print("  Next steps:")
    print("  1. Run: make up")
    print("  2. Visit: http://localhost:3333")
    print("  3. Login: admin@sponsorintel.com / admin123changeme")
    print()


if __name__ == "__main__":
    asyncio.run(seed())
