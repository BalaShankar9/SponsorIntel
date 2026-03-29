"""
Jobs API endpoints.
"""

import math
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import optional_auth, require_pro
from app.core.database import get_db
from app.models.job import Job, SalaryBenchmark
from app.models.user import User
from app.schemas.job import JobDetail, JobListItem, JobStats, PaginatedJobs

router = APIRouter(prefix="/jobs", tags=["jobs"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SORT_COLUMNS = {
    "posted_date": Job.posted_date,
    "title": Job.title_raw,
    "salary_min": Job.salary_min,
    "salary_max": Job.salary_max,
    "sponsorship_likelihood": Job.sponsorship_likelihood,
    "company": Job.company_name_raw,
}


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@router.get("/", response_model=PaginatedJobs)
async def list_jobs(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    company: Optional[str] = None,
    city: Optional[str] = None,
    source: Optional[str] = None,
    min_salary: Optional[float] = None,
    max_salary: Optional[float] = None,
    sponsorship_min: Optional[int] = None,
    contract_type: Optional[str] = None,
    seniority: Optional[str] = None,
    on_shortage_list: Optional[bool] = None,
    sort: str = "posted_date",
    dir: str = "desc",
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(optional_auth),
):
    """List jobs with filtering, sorting, and pagination."""
    query = select(Job)

    # --- Filters ---
    if search:
        query = query.where(Job.title_raw.ilike(f"%{search}%"))
    if company:
        query = query.where(Job.company_name_raw.ilike(f"%{company}%"))
    if city:
        query = query.where(func.lower(Job.location_city) == city.lower())
    if source:
        query = query.where(Job.source == source)
    if min_salary is not None:
        query = query.where(Job.salary_max >= min_salary)
    if max_salary is not None:
        query = query.where(Job.salary_min <= max_salary)
    if contract_type:
        query = query.where(Job.contract_type == contract_type)
    if seniority:
        query = query.where(Job.seniority == seniority)
    if on_shortage_list is not None:
        query = query.where(Job.is_on_shortage_list == on_shortage_list)

    # Pro-only filter
    if sponsorship_min is not None:
        is_pro = user and user.plan.value in ("pro", "enterprise")
        if not is_pro:
            raise HTTPException(
                status_code=403,
                detail="Sponsorship likelihood filter requires the pro plan",
            )
        query = query.where(Job.sponsorship_likelihood >= sponsorship_min)

    # --- Count ---
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # --- Sort ---
    order_col = _SORT_COLUMNS.get(sort, Job.posted_date)
    if dir.lower() == "desc":
        query = query.order_by(order_col.desc().nullslast())
    else:
        query = query.order_by(order_col.asc().nullsfirst())

    pages = max(1, math.ceil(total / size))
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)

    result = await db.execute(query)
    jobs = result.scalars().all()

    data = [
        JobListItem(
            id=j.id,
            title_raw=j.title_raw,
            company_name_raw=j.company_name_raw,
            location_raw=j.location_raw,
            salary_min=j.salary_min,
            salary_max=j.salary_max,
            salary_text_raw=j.salary_text_raw,
            source=str(j.source),
            sponsorship_likelihood=j.sponsorship_likelihood,
            posted_date=j.posted_date,
            is_on_shortage_list=j.is_on_shortage_list or False,
        )
        for j in jobs
    ]

    return PaginatedJobs(data=data, total=total, page=page, pages=pages)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=JobStats)
async def job_stats(db: AsyncSession = Depends(get_db)):
    """Aggregate job statistics."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    total_active = (
        await db.execute(
            select(func.count(Job.id)).where(Job.is_expired == False)  # noqa: E712
        )
    ).scalar() or 0

    new_7d = (
        await db.execute(
            select(func.count(Job.id)).where(Job.first_seen_at >= week_ago)
        )
    ).scalar() or 0

    sponsorship_likely = (
        await db.execute(
            select(func.count(Job.id)).where(
                Job.sponsorship_likelihood >= 70,
                Job.is_expired == False,  # noqa: E712
            )
        )
    ).scalar() or 0

    median_salary = (
        await db.execute(
            select(func.percentile_cont(0.5).within_group(Job.salary_min)).where(
                Job.salary_min.isnot(None),
                Job.is_expired == False,  # noqa: E712
            )
        )
    ).scalar()

    # By source
    source_rows = (
        await db.execute(
            select(Job.source, func.count(Job.id))
            .where(Job.is_expired == False)  # noqa: E712
            .group_by(Job.source)
        )
    ).all()
    by_source = {str(row[0]): row[1] for row in source_rows}

    # By city
    city_rows = (
        await db.execute(
            select(Job.location_city, func.count(Job.id))
            .where(
                Job.is_expired == False,  # noqa: E712
                Job.location_city.isnot(None),
            )
            .group_by(Job.location_city)
            .order_by(func.count(Job.id).desc())
            .limit(20)
        )
    ).all()
    by_city = [{"city": row[0], "count": row[1]} for row in city_rows]

    return JobStats(
        total_active=total_active,
        new_7_days=new_7d,
        sponsorship_likely_count=sponsorship_likely,
        median_salary=round(median_salary, 0) if median_salary else None,
        by_source=by_source,
        by_city=by_city,
    )


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------


@router.get("/{job_id}", response_model=JobDetail)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get full job details."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobDetail.model_validate(job)


# ---------------------------------------------------------------------------
# Salary Benchmarks
# ---------------------------------------------------------------------------


@router.get("/salary-benchmarks")
async def salary_benchmarks(
    title: Optional[str] = None,
    soc_code: Optional[str] = None,
    region: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_pro),
):
    """Salary benchmarks by role/SOC code and region (Pro only)."""
    query = select(SalaryBenchmark)

    if soc_code:
        query = query.where(SalaryBenchmark.soc_code == soc_code)
    if title:
        query = query.where(
            SalaryBenchmark.title_normalised.ilike(f"%{title}%")
        )
    if region:
        query = query.where(
            func.lower(SalaryBenchmark.location_region) == region.lower()
        )

    result = await db.execute(query.limit(50))
    benchmarks = result.scalars().all()

    return [
        {
            "soc_code": b.soc_code,
            "title": b.title_normalised,
            "region": b.location_region,
            "period": b.period,
            "p10": b.p10,
            "p25": b.p25,
            "median": b.median,
            "p75": b.p75,
            "p90": b.p90,
            "sample_size": b.sample_size,
            "meets_visa_threshold": b.meets_visa_threshold,
            "visa_salary_threshold": b.visa_salary_threshold,
        }
        for b in benchmarks
    ]
