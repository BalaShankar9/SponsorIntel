"""
Bootstrap CompanyProfile records for all sponsors.

Creates a CompanyProfile (enrichment_level=LEVEL_0) for every sponsor
that doesn't already have one. This is the prerequisite for all
enrichment pipelines — without a profile, no enrichment can run.

Usage:
    DATABASE_URL=postgresql+asyncpg://... python -m app.scripts.bootstrap_profiles
"""

import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import func, select, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 1000


async def bootstrap_profiles():
    from app.core.database import async_session
    from app.models.company import CompanyProfile
    from app.models.enums import EnrichmentLevel
    from app.models.sponsor import Sponsor

    async with async_session() as db:
        # Count sponsors without profiles
        total_sponsors = (await db.execute(select(func.count(Sponsor.id)))).scalar()
        existing_profiles = (await db.execute(select(func.count(CompanyProfile.id)))).scalar()
        to_create = total_sponsors - existing_profiles

        logger.info(
            "Sponsors: %d | Existing profiles: %d | To create: %d",
            total_sponsors, existing_profiles, to_create,
        )

        if to_create == 0:
            logger.info("All sponsors already have profiles. Nothing to do.")
            return

        # Get sponsor IDs that DON'T have a profile yet
        subq = select(CompanyProfile.sponsor_id)
        result = await db.execute(
            select(Sponsor.id)
            .where(Sponsor.id.not_in(subq))
            .order_by(Sponsor.id)
        )
        sponsor_ids = [row[0] for row in result.all()]

        logger.info("Found %d sponsors needing profiles. Creating in batches of %d...", len(sponsor_ids), BATCH_SIZE)

        created = 0
        for i in range(0, len(sponsor_ids), BATCH_SIZE):
            batch = sponsor_ids[i : i + BATCH_SIZE]
            for sid in batch:
                profile = CompanyProfile(
                    id=uuid.uuid4(),
                    sponsor_id=sid,
                    enrichment_level=EnrichmentLevel.LEVEL_0,
                    enrichment_priority=0,
                    failure_count=0,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(profile)

            await db.flush()
            created += len(batch)
            logger.info("  Created %d / %d profiles (%.1f%%)", created, len(sponsor_ids), 100 * created / len(sponsor_ids))

        await db.commit()
        logger.info("Bootstrap complete: %d CompanyProfile records created.", created)


if __name__ == "__main__":
    asyncio.run(bootstrap_profiles())
