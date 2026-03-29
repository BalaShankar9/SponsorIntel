"""
Admin API endpoints.
"""

import csv
import hashlib
import io
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.company import CompanyProfile
from app.models.enums import EnrichmentLevel
from app.models.event import Event
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

    # Last CSV import events from Event table per scraper type
    scraper_event_rows = (
        await db.execute(
            select(
                Event.event_type,
                func.max(Event.created_at).label("last_run"),
                func.count(Event.id).label("total_runs"),
            )
            .where(
                Event.event_type.in_(["csv_imported", "new_job_detected"])
            )
            .group_by(Event.event_type)
        )
    ).all()
    scraper_health = {
        str(r[0].value if hasattr(r[0], "value") else r[0]): {
            "last_run": r[1].isoformat() if r[1] else None,
            "total_runs": r[2],
        }
        for r in scraper_event_rows
    }

    # CSV import success rate
    total_imports = (
        await db.execute(select(func.count(CsvImport.id)))
    ).scalar() or 0
    successful_imports = (
        await db.execute(
            select(func.count(CsvImport.id)).where(CsvImport.added_count >= 0)
        )
    ).scalar() or 0
    success_rate = (
        round(successful_imports / total_imports * 100, 1)
        if total_imports > 0
        else 0.0
    )

    return {
        "last_csv_import": {
            "filename": last_import.filename if last_import else None,
            "imported_at": last_import.imported_at.isoformat() if last_import else None,
            "record_count": last_import.record_count if last_import else 0,
            "added": last_import.added_count if last_import else 0,
            "removed": last_import.removed_count if last_import else 0,
            "changed": last_import.changed_count if last_import else 0,
        },
        "scraper_health": scraper_health,
        "success_rate_pct": success_rate,
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
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Paginated CSV import log."""
    total = (
        await db.execute(select(func.count(CsvImport.id)))
    ).scalar() or 0

    offset = (page - 1) * size
    result = await db.execute(
        select(CsvImport)
        .order_by(CsvImport.imported_at.desc())
        .offset(offset)
        .limit(size)
    )
    imports = result.scalars().all()

    return {
        "data": [
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
        ],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // size)),
    }


# ---------------------------------------------------------------------------
# Trigger scrape
# ---------------------------------------------------------------------------


@router.post("/trigger-scrape/{source}")
async def trigger_scrape(
    source: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Manually trigger a scrape task via Celery (requires admin auth)."""
    from app.tasks.scraping import SCRAPER_MAP, scrape_jobs, scrape_register

    if source == "register":
        task = scrape_register.delay()
        return {"task_id": task.id, "source": "register", "status": "queued"}

    if source not in SCRAPER_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown source '{source}'. Valid: {list(SCRAPER_MAP.keys()) + ['register']}",
        )

    task = scrape_jobs.delay(source)
    return {"task_id": task.id, "source": source, "status": "queued"}


@router.post("/trigger-agent/{agent_name}")
async def trigger_agent(
    agent_name: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Manually trigger an agent swarm task via Celery."""
    from app.tasks.agent_tasks import (
        run_hunter_task,
        run_validator_task,
        run_enrichment_task,
        run_freshness_task,
        run_discovery_task,
        run_ch_watcher_task,
    )

    task_map = {
        "hunter": lambda: run_hunter_task.delay(["free_apis"]),
        "hunter-api": lambda: run_hunter_task.delay(["api_key"]),
        "hunter-all": lambda: run_hunter_task.delay(),
        "validator": lambda: run_validator_task.delay(),
        "enrichment": lambda: run_enrichment_task.delay(),
        "freshness": lambda: run_freshness_task.delay(),
        "discovery": lambda: run_discovery_task.delay(),
        "ch-watcher": lambda: run_ch_watcher_task.delay(),
    }

    if agent_name not in task_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown agent '{agent_name}'. Valid: {list(task_map.keys())}",
        )

    task = task_map[agent_name]()
    return {"task_id": task.id, "agent": agent_name, "status": "queued"}


# ---------------------------------------------------------------------------
# CSV Import
# ---------------------------------------------------------------------------


@router.post("/import-csv")
async def import_csv(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Accept CSV file upload and trigger csv_import service."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted",
        )

    contents = await file.read()
    md5 = hashlib.md5(contents).hexdigest()

    # Check for duplicate import
    existing = await db.execute(
        select(CsvImport).where(CsvImport.checksum_md5 == md5)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This CSV has already been imported",
        )

    # Parse CSV to get record count
    text_content = contents.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text_content))
    rows = list(reader)

    import_id = uuid.uuid4()
    csv_import = CsvImport(
        id=import_id,
        filename=file.filename or "upload.csv",
        checksum_md5=md5,
        record_count=len(rows),
        imported_at=datetime.utcnow(),
        is_auto=False,
    )
    db.add(csv_import)

    # Queue the Celery import task if available
    try:
        from app.tasks.scraping import process_csv_import

        task = process_csv_import.delay(str(import_id))
        task_id = task.id
    except (ImportError, AttributeError):
        task_id = None

    return {
        "import_id": str(import_id),
        "filename": file.filename,
        "record_count": len(rows),
        "md5": md5,
        "task_id": task_id,
        "status": "queued" if task_id else "saved",
    }


# ---------------------------------------------------------------------------
# Circuit Breaker — self-healing monitoring
# ---------------------------------------------------------------------------


@router.get("/circuit-breaker")
async def get_circuit_breaker_status(user: User = Depends(require_admin)):
    """Get health status of all sources and paused sources."""
    from app.agents.circuit_breaker import get_all_health, get_paused_sources
    return {
        "paused_sources": get_paused_sources(),
        "source_health": get_all_health(),
    }


@router.post("/circuit-breaker/resume/{source}")
async def resume_source(source: str, user: User = Depends(require_admin)):
    """Manually resume a paused source."""
    from app.agents.circuit_breaker import force_resume, is_paused
    if not is_paused(source):
        return {"message": f"{source} is not paused"}
    force_resume(source)
    return {"message": f"{source} resumed"}


# ---------------------------------------------------------------------------
# Bootstrap — kick off full company data gathering
# ---------------------------------------------------------------------------


@router.post("/bootstrap/profiles")
async def bootstrap_profiles(
    batch_size: int = Query(default=500, le=2000),
    user: User = Depends(require_admin),
):
    """Trigger bootstrap of company profiles for all sponsors.

    Creates company_profile records and runs discovery (websites, LinkedIn, etc.)
    for every active sponsor. Processes in batches, auto-chains.
    """
    from app.tasks.agent_tasks import bootstrap_company_profiles_task
    task = bootstrap_company_profiles_task.delay(batch_size=batch_size, offset=0)
    return {"task_id": task.id, "message": f"Bootstrap started (batch_size={batch_size})"}


@router.post("/bootstrap/gather-jobs")
async def bootstrap_gather_jobs(
    batch_size: int = Query(default=200, le=1000),
    user: User = Depends(require_admin),
):
    """Trigger job gathering from all sponsor career pages.

    Scans every sponsor's career page and collects job listings.
    """
    from app.tasks.agent_tasks import gather_sponsor_jobs_task
    task = gather_sponsor_jobs_task.delay(batch_size=batch_size, offset=0)
    return {"task_id": task.id, "message": f"Job gathering started (batch_size={batch_size})"}


# ---------------------------------------------------------------------------
# Agent Team — run specific agents on demand
# ---------------------------------------------------------------------------


@router.post("/agents/run/{agent_name}")
async def run_agent(agent_name: str, user: User = Depends(require_admin)):
    """Trigger a specific agent pipeline on demand."""
    task_map = {
        "hunter": "agent.run_hunter",
        "validator": "agent.run_validator",
        "enrichment": "agent.run_enrichment",
        "freshness": "agent.run_freshness",
        "discovery": "agent.run_discovery",
        "ch_watcher": "agent.run_ch_watcher",
        "quality": "agent.run_quality",
        "orchestrator": "agent.run_orchestrator",
        "improvement": "agent.run_improvement",
    }
    task_name = task_map.get(agent_name)
    if not task_name:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown agent: {agent_name}. Available: {list(task_map.keys())}",
        )
    from app.tasks.celery_app import celery_app as app
    task = app.send_task(task_name)
    return {"task_id": task.id, "agent": agent_name, "message": f"{agent_name} agent triggered"}


@router.get("/agents/team")
async def get_team_roster(user: User = Depends(require_admin)):
    """Get the full 56-person team roster."""
    return {
        "total_employees": 56,
        "departments": [
            {
                "name": "Acquisition",
                "lead": {"name": "Aria Singh", "title": "Head of Job Sourcing"},
                "members": [
                    {"name": "Liam Foster", "title": "Free API Specialist"},
                    {"name": "Nadia Osman", "title": "Premium API Specialist"},
                    {"name": "Callum Hughes", "title": "Source Selection Analyst"},
                    {"name": "Fatima Al-Rashid", "title": "Search Priority Analyst"},
                    {"name": "Declan Murphy", "title": "Entity Resolution Specialist"},
                ],
            },
            {
                "name": "Quality Assurance",
                "leads": [
                    {"name": "Marcus Chen", "title": "Head of Data Quality"},
                    {"name": "Sophie Laurent", "title": "Data Completeness Auditor"},
                ],
                "members": [
                    {"name": "Olivia Barnes", "title": "Description Cleaning Specialist"},
                    {"name": "Idris Kamara", "title": "Company Name Normaliser"},
                    {"name": "Hannah Whitfield", "title": "Job Title Normaliser"},
                    {"name": "Ravi Sharma", "title": "Salary Validation Analyst"},
                    {"name": "Chloe Brennan", "title": "Date Validation Analyst"},
                    {"name": "Tariq Hussain", "title": "Spam Classification Specialist"},
                    {"name": "Megan Lloyd", "title": "Similarity Scoring Analyst"},
                    {"name": "Yusuf Diallo", "title": "Cluster Analysis Specialist"},
                    {"name": "Amara Osei", "title": "Completeness Scoring Analyst"},
                    {"name": "Finlay Scott", "title": "Gap Identification Specialist"},
                    {"name": "Isla Mckenzie", "title": "Source Health Monitor"},
                    {"name": "Kwame Asante", "title": "Hiring Score Analyst"},
                ],
            },
            {
                "name": "Intelligence",
                "lead": {"name": "Priya Kapoor", "title": "Lead Sponsorship Analyst"},
                "members": [
                    {"name": "George Palmer", "title": "Salary Parser"},
                    {"name": "Aisha Begum", "title": "Salary Normalisation Specialist"},
                    {"name": "Connor Walsh", "title": "Sponsorship Keyword Analyst"},
                    {"name": "Zainab Okonkwo", "title": "Sponsor Register Matcher"},
                    {"name": "Luke Chambers", "title": "Visa Threshold Analyst"},
                    {"name": "Meera Nair", "title": "Shortage List Specialist"},
                    {"name": "Owen Griffiths", "title": "Sponsorship Score Calculator"},
                    {"name": "Blessing Adeyemi", "title": "Certification Extraction Specialist"},
                    {"name": "Freya Thomson", "title": "Tech Stack Analyst"},
                    {"name": "Ibrahim Hassan", "title": "SOC Code Classifier"},
                    {"name": "Rosie Watts", "title": "Work Model Detector"},
                    {"name": "Nikhil Verma", "title": "Seniority Detection Analyst"},
                ],
            },
            {
                "name": "Operations",
                "leads": [
                    {"name": "James Okafor", "title": "Listings Lifecycle Manager"},
                    {"name": "Raj Patel", "title": "Chief Operations Coordinator"},
                ],
                "members": [
                    {"name": "Beth Crawford", "title": "HTTP Status Checker"},
                    {"name": "Samir Iqbal", "title": "Repost Detection Specialist"},
                    {"name": "Evie Donovan", "title": "Stale Listing Reaper"},
                    {"name": "Kofi Mensah", "title": "Market Velocity Analyst"},
                    {"name": "Alice Thornton", "title": "Metrics Collection Analyst"},
                    {"name": "Omar Farah", "title": "Anomaly Detection Specialist"},
                    {"name": "Ruby Sinclair", "title": "Alert Publishing Coordinator"},
                ],
            },
            {
                "name": "Research",
                "lead": {"name": "Elena Volkov", "title": "Company Research Director"},
                "members": [
                    {"name": "Jack Reeves", "title": "Website Discovery Specialist"},
                    {"name": "Priscilla Adu", "title": "LinkedIn Research Analyst"},
                    {"name": "Tom Fletcher", "title": "Careers Page Detective"},
                    {"name": "Naomi Tanaka", "title": "Contact Intelligence Specialist"},
                ],
            },
            {
                "name": "Compliance",
                "lead": {"name": "Daniel Mensah", "title": "Corporate Intelligence Officer"},
                "members": [
                    {"name": "Sienna Carr", "title": "Filing Compliance Checker"},
                    {"name": "Ade Ogundimu", "title": "Company Status Monitor"},
                    {"name": "Emily Hartley", "title": "Officer Tracking Specialist"},
                    {"name": "Rahul Khanna", "title": "Financial Health Analyst"},
                ],
            },
            {
                "name": "Improvement & R&D",
                "lead": {"name": "Dr. Alex Thornton", "title": "Head of Platform Intelligence"},
                "members": [
                    {"name": "Zara Mahmood", "title": "Keyword Optimisation Specialist"},
                    {"name": "Tomas Garcia", "title": "Source Discovery Scout"},
                    {"name": "Ines Dubois", "title": "Scoring Calibration Analyst"},
                ],
            },
        ],
    }
