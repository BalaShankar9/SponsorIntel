"""
Admin API endpoints.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.company import CompanyProfile
from app.models.enums import EnrichmentLevel
from app.models.job import Job
from app.models.sponsor import CsvImport, Sponsor
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Engine status
# ---------------------------------------------------------------------------


@router.get("/engine-status")
async def engine_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Scraper health: last run time, counts per source, queue size."""
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)

    # Last CSV import
    last_import_result = await db.execute(
        select(CsvImport)
        .order_by(CsvImport.imported_at.desc())
        .limit(1)
    )
    last_import = last_import_result.scalar_one_or_none()

    # Jobs scraped in last 24h by source
    source_rows = (
        await db.execute(
            select(Job.source, func.count(Job.id))
            .where(Job.scraped_at >= day_ago)
            .group_by(Job.source)
        )
    ).all()
    jobs_by_source_24h = {str(r[0].value): r[1] for r in source_rows}

    # Total active sponsors
    total_sponsors = (
        await db.execute(
            select(func.count(Sponsor.id)).where(Sponsor.is_active == True)  # noqa: E712
        )
    ).scalar() or 0

    # Total jobs
    total_jobs = (
        await db.execute(select(func.count(Job.id)))
    ).scalar() or 0

    return {
        "last_csv_import": {
            "filename": last_import.filename if last_import else None,
            "imported_at": last_import.imported_at.isoformat() if last_import else None,
            "record_count": last_import.record_count if last_import else 0,
            "added": last_import.added_count if last_import else 0,
            "removed": last_import.removed_count if last_import else 0,
            "changed": last_import.changed_count if last_import else 0,
        },
        "jobs_scraped_24h": jobs_by_source_24h,
        "total_sponsors": total_sponsors,
        "total_jobs": total_jobs,
    }


# ---------------------------------------------------------------------------
# Enrichment progress
# ---------------------------------------------------------------------------


@router.get("/enrichment-progress")
async def enrichment_progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Count companies at each enrichment level."""
    total_profiles = (
        await db.execute(select(func.count(CompanyProfile.id)))
    ).scalar() or 0

    enriched = (
        await db.execute(
            select(func.count(CompanyProfile.id)).where(
                CompanyProfile.enriched_at.isnot(None)
            )
        )
    ).scalar() or 0

    not_enriched = (
        await db.execute(
            select(func.count(CompanyProfile.id)).where(
                CompanyProfile.enriched_at.is_(None)
            )
        )
    ).scalar() or 0

    # By enrichment level
    level_rows = (
        await db.execute(
            select(
                CompanyProfile.enrichment_level,
                func.count(CompanyProfile.id),
            )
            .group_by(CompanyProfile.enrichment_level)
        )
    ).all()
    by_level = {
        (r[0].value if r[0] else "none"): r[1] for r in level_rows
    }

    # Failure stats
    failed = (
        await db.execute(
            select(func.count(CompanyProfile.id)).where(
                CompanyProfile.failure_count > 0
            )
        )
    ).scalar() or 0

    return {
        "total_profiles": total_profiles,
        "enriched": enriched,
        "not_enriched": not_enriched,
        "by_level": by_level,
        "failed": failed,
    }


# ---------------------------------------------------------------------------
# Import history
# ---------------------------------------------------------------------------


@router.get("/import-history")
async def import_history(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """CSV import log."""
    result = await db.execute(
        select(CsvImport)
        .order_by(CsvImport.imported_at.desc())
        .limit(limit)
    )
    imports = result.scalars().all()

    return [
        {
            "id": str(i.id),
            "filename": i.filename,
            "source_url": i.source_url,
            "checksum_md5": i.checksum_md5,
            "record_count": i.record_count,
            "added_count": i.added_count,
            "removed_count": i.removed_count,
            "changed_count": i.changed_count,
            "imported_at": i.imported_at.isoformat(),
            "is_auto": i.is_auto,
        }
        for i in imports
    ]


# ---------------------------------------------------------------------------
# Trigger scrape
# ---------------------------------------------------------------------------


@router.post("/trigger-scrape")
async def trigger_scrape(
    source: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Manually trigger a scrape task via Celery."""
    from app.tasks.scraping import SCRAPER_MAP, scrape_jobs, scrape_register

    if source == "register":
        task = scrape_register.delay()
        return {"task_id": task.id, "source": "register", "status": "queued"}

    if source not in SCRAPER_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source '{source}'. Valid: {list(SCRAPER_MAP.keys()) + ['register']}",
        )

    task = scrape_jobs.delay(source)
    return {"task_id": task.id, "source": source, "status": "queued"}
