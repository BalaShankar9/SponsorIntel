"""
Sponsor API endpoints.
"""

import csv
import hashlib
import io
import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import String, case, func, or_, select, text  # noqa: F401
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import optional_auth, require_admin, require_pro
from app.core.database import get_db
from app.models.company import CompanyNews, CompanyOfficer, CompanyProfile
from app.models.job import Job
from app.models.scoring import SponsorScore
from app.models.sponsor import Sponsor, SponsorChange
from app.models.user import User
from app.schemas.sponsor import (
    CompanyProfileResponse,
    PaginatedSponsors,
    ScoreBreakdown,
    SponsorChangeResponse,
    SponsorDetail,
    SponsorListItem,
)

router = APIRouter(prefix="/sponsors", tags=["sponsors"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SORT_COLUMNS = {
    "organisation_name": Sponsor.organisation_name,
    "town_city": Sponsor.town_city,
    "first_seen_date": Sponsor.first_seen_date,
    "last_seen_date": Sponsor.last_seen_date,
}


def _latest_score_subquery():
    """Subquery that returns the most recent score per sponsor."""
    return (
        select(
            SponsorScore.sponsor_id,
            SponsorScore.overall_score,
            SponsorScore.compliance_score,
            SponsorScore.financial_health_score,
            SponsorScore.hiring_activity_score,
            SponsorScore.reputation_score,
            SponsorScore.legitimacy_score,
            SponsorScore.track_record_score,
            SponsorScore.growth_signal_score,
            SponsorScore.risk_flags,
            SponsorScore.computed_at,
            func.row_number()
            .over(
                partition_by=SponsorScore.sponsor_id,
                order_by=SponsorScore.computed_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )


# ---------------------------------------------------------------------------
# List / Search
# ---------------------------------------------------------------------------


@router.get("/", response_model=PaginatedSponsors)
async def list_sponsors(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    city: Optional[str] = None,
    county: Optional[str] = None,
    rating: Optional[str] = None,
    route: Optional[str] = None,
    industry: Optional[str] = None,
    is_active: Optional[bool] = None,
    min_score: Optional[int] = None,
    max_score: Optional[int] = None,
    score_min: Optional[int] = None,
    score_max: Optional[int] = None,
    has_jobs: Optional[bool] = None,
    sort: str = "organisation_name",
    sort_by: Optional[str] = None,
    dir: str = "asc",
    sort_order: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(optional_auth),
):
    """List sponsors with filtering, sorting, and pagination."""
    # Support alternate param names
    min_score = min_score if min_score is not None else score_min
    max_score = max_score if max_score is not None else score_max
    sort = sort_by if sort_by is not None else sort
    dir = sort_order if sort_order is not None else dir

    score_sq = _latest_score_subquery()
    latest_score = select(score_sq).where(score_sq.c.rn == 1).subquery("ls")

    # Active job count subquery
    job_count_sq = (
        select(
            Job.sponsor_id,
            func.count(Job.id).label("job_count"),
        )
        .where(Job.is_expired == False)  # noqa: E712
        .group_by(Job.sponsor_id)
        .subquery("jc")
    )

    query = (
        select(
            Sponsor,
            latest_score.c.overall_score,
            func.coalesce(job_count_sq.c.job_count, 0).label("active_job_count"),
        )
        .outerjoin(latest_score, latest_score.c.sponsor_id == Sponsor.id)
        .outerjoin(job_count_sq, job_count_sq.c.sponsor_id == Sponsor.id)
    )

    # --- Filters ---
    if search:
        query = query.where(
            Sponsor.organisation_name_normalised.ilike(f"%{search.lower()}%")
        )
    if city:
        query = query.where(func.lower(Sponsor.town_city) == city.lower())
    if county:
        query = query.where(func.lower(Sponsor.county) == county.lower())
    if rating:
        query = query.where(Sponsor.rating == rating.upper())
    if route:
        query = query.where(Sponsor.route.any(route))
    if is_active is not None:
        query = query.where(Sponsor.is_active == is_active)
    if min_score is not None:
        query = query.where(latest_score.c.overall_score >= min_score)
    if max_score is not None:
        query = query.where(latest_score.c.overall_score <= max_score)
    if has_jobs is True:
        query = query.where(job_count_sq.c.job_count > 0)
    if industry:
        query = query.outerjoin(
            CompanyProfile, CompanyProfile.sponsor_id == Sponsor.id
        ).where(func.lower(CompanyProfile.industry_primary) == industry.lower())

    # --- Count ---
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # --- Sort ---
    if sort == "score":
        order_col = latest_score.c.overall_score
    else:
        order_col = _SORT_COLUMNS.get(sort, Sponsor.organisation_name)

    if dir.lower() == "desc":
        query = query.order_by(order_col.desc().nullslast())
    else:
        query = query.order_by(order_col.asc().nullsfirst())

    # --- Free user limit ---
    if user is None or user.plan.value == "free":
        effective_total = min(total, 10)
        size = min(size, 10)
    else:
        effective_total = total

    pages = max(1, math.ceil(effective_total / size))
    offset = (page - 1) * size

    query = query.offset(offset).limit(size)
    result = await db.execute(query)
    rows = result.all()

    data = []
    for sponsor, score, job_count in rows:
        item = SponsorListItem(
            id=sponsor.id,
            organisation_name=sponsor.organisation_name,
            town_city=sponsor.town_city,
            county=sponsor.county,
            type_and_rating=sponsor.type_and_rating,
            rating=sponsor.rating.value if sponsor.rating else None,
            route=sponsor.route,
            is_active=sponsor.is_active,
            first_seen_date=sponsor.first_seen_date,
            last_seen_date=sponsor.last_seen_date,
            overall_score=score,
            active_job_count=job_count,
        )
        data.append(item)

    return PaginatedSponsors(data=data, total=effective_total, page=page, pages=pages)


@router.get("/search")
async def search_sponsors(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Fuzzy name search using trigram similarity."""
    query = (
        select(
            Sponsor.id,
            Sponsor.organisation_name,
            Sponsor.town_city,
            Sponsor.rating,
            Sponsor.is_active,
            func.similarity(
                Sponsor.organisation_name_normalised, q.lower()
            ).label("sim"),
        )
        .where(
            func.similarity(Sponsor.organisation_name_normalised, q.lower()) > 0.1
        )
        .order_by(text("sim DESC"))
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(r.id),
            "organisation_name": r.organisation_name,
            "town_city": r.town_city,
            "rating": r.rating.value if r.rating else None,
            "is_active": r.is_active,
            "similarity": round(r.sim, 3),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------


@router.get("/{sponsor_id}", response_model=SponsorDetail)
async def get_sponsor(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(optional_auth),
):
    """Get detailed sponsor information."""
    result = await db.execute(
        select(Sponsor)
        .options(selectinload(Sponsor.profile))
        .where(Sponsor.id == sponsor_id)
    )
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    # Latest score
    score_result = await db.execute(
        select(SponsorScore)
        .where(SponsorScore.sponsor_id == sponsor_id)
        .order_by(SponsorScore.computed_at.desc())
        .limit(1)
    )
    score = score_result.scalar_one_or_none()

    # Active job count
    jc_result = await db.execute(
        select(func.count(Job.id))
        .where(Job.sponsor_id == sponsor_id, Job.is_expired == False)  # noqa: E712
    )
    job_count = jc_result.scalar() or 0

    # Build profile response (pro users only)
    profile_resp = None
    score_resp = None
    is_pro = user and user.plan.value in ("pro", "enterprise")

    if is_pro and sponsor.profile:
        profile_resp = CompanyProfileResponse.model_validate(sponsor.profile)

    if is_pro and score:
        risk_flags_list = None
        if score.risk_flags:
            if isinstance(score.risk_flags, list):
                risk_flags_list = score.risk_flags
            elif isinstance(score.risk_flags, dict):
                risk_flags_list = score.risk_flags.get("flags", [])

        score_resp = ScoreBreakdown(
            overall_score=score.overall_score,
            compliance_score=score.compliance_score,
            financial_health_score=score.financial_health_score,
            hiring_activity_score=score.hiring_activity_score,
            reputation_score=score.reputation_score,
            legitimacy_score=score.legitimacy_score,
            track_record_score=score.track_record_score,
            growth_signal_score=score.growth_signal_score,
            risk_flags=risk_flags_list,
            computed_at=score.computed_at,
        )

    return SponsorDetail(
        id=sponsor.id,
        organisation_name=sponsor.organisation_name,
        town_city=sponsor.town_city,
        county=sponsor.county,
        type_and_rating=sponsor.type_and_rating,
        rating=sponsor.rating.value if sponsor.rating else None,
        route=sponsor.route,
        is_active=sponsor.is_active,
        first_seen_date=sponsor.first_seen_date,
        last_seen_date=sponsor.last_seen_date,
        overall_score=score.overall_score if score else None,
        active_job_count=job_count,
        consecutive_a_rating_days=sponsor.consecutive_a_rating_days,
        times_rating_changed=sponsor.times_rating_changed,
        profile=profile_resp,
        score_breakdown=score_resp,
    )


# ---------------------------------------------------------------------------
# Changes / Timeline / Jobs / Similar
# ---------------------------------------------------------------------------


@router.get("/{sponsor_id}/changes", response_model=list[SponsorChangeResponse])
async def get_sponsor_changes(
    sponsor_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return change history for a sponsor."""
    result = await db.execute(
        select(SponsorChange)
        .where(SponsorChange.sponsor_id == sponsor_id)
        .order_by(SponsorChange.detected_at.desc())
        .limit(limit)
    )
    changes = result.scalars().all()
    return [
        SponsorChangeResponse(
            id=c.id,
            change_type=c.change_type.value,
            field_changed=c.field_changed,
            old_value=c.old_value,
            new_value=c.new_value,
            detected_at=c.detected_at,
            significance_score=c.significance_score,
        )
        for c in changes
    ]


@router.get("/{sponsor_id}/timeline")
async def get_sponsor_timeline(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_pro),
):
    """Unified timeline of changes, news, jobs, officer changes (Pro only)."""
    # Verify sponsor exists
    sponsor = await db.execute(
        select(Sponsor).where(Sponsor.id == sponsor_id)
    )
    if not sponsor.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sponsor not found")

    timeline: list[dict] = []

    # 1) Sponsor changes
    changes_result = await db.execute(
        select(SponsorChange)
        .where(SponsorChange.sponsor_id == sponsor_id)
        .order_by(SponsorChange.detected_at.desc())
        .limit(50)
    )
    for c in changes_result.scalars().all():
        timeline.append({
            "type": "change",
            "date": c.detected_at.isoformat(),
            "summary": f"{c.change_type.value}: {c.field_changed or 'status'}",
            "detail": {"old": c.old_value, "new": c.new_value},
        })

    # 2) News articles
    profile_result = await db.execute(
        select(CompanyProfile.id).where(CompanyProfile.sponsor_id == sponsor_id)
    )
    profile_id = profile_result.scalar_one_or_none()
    if profile_id:
        news_result = await db.execute(
            select(CompanyNews)
            .where(CompanyNews.profile_id == profile_id)
            .order_by(CompanyNews.created_at.desc())
            .limit(20)
        )
        for n in news_result.scalars().all():
            timeline.append({
                "type": "news",
                "date": (n.published_at or n.created_at).isoformat(),
                "summary": n.headline,
                "detail": {
                    "source": n.source,
                    "url": n.url,
                    "sentiment": n.sentiment,
                },
            })

        # 3) Officer changes
        officers_result = await db.execute(
            select(CompanyOfficer)
            .where(CompanyOfficer.profile_id == profile_id)
            .order_by(CompanyOfficer.appointed_on.desc().nullslast())
            .limit(20)
        )
        for o in officers_result.scalars().all():
            event_date = o.resigned_on or o.appointed_on or o.created_at
            action = "resigned" if o.resigned_on else "appointed"
            timeline.append({
                "type": "officer",
                "date": event_date.isoformat() if event_date else None,
                "summary": f"{o.name} {action} as {o.role or 'officer'}",
                "detail": {"name": o.name, "role": o.role, "action": action},
            })

    # 4) Jobs
    jobs_result = await db.execute(
        select(Job)
        .where(Job.sponsor_id == sponsor_id)
        .order_by(Job.first_seen_at.desc())
        .limit(20)
    )
    for j in jobs_result.scalars().all():
        timeline.append({
            "type": "job",
            "date": (j.posted_date or j.first_seen_at).isoformat(),
            "summary": j.title_raw,
            "detail": {"company": j.company_name_raw, "location": j.location_raw},
        })

    # Sort by date descending
    timeline.sort(key=lambda x: x.get("date") or "", reverse=True)
    return timeline


@router.get("/{sponsor_id}/jobs")
async def get_sponsor_jobs(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return active jobs linked to this sponsor."""
    result = await db.execute(
        select(Job)
        .where(Job.sponsor_id == sponsor_id, Job.is_expired == False)  # noqa: E712
        .order_by(Job.posted_date.desc().nullslast())
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "title": j.title_raw,
            "company": j.company_name_raw,
            "location": j.location_raw,
            "salary_min": j.salary_min,
            "salary_max": j.salary_max,
            "salary_text": j.salary_text_raw,
            "source": j.source.value,
            "sponsorship_likelihood": j.sponsorship_likelihood,
            "posted_date": j.posted_date.isoformat() if j.posted_date else None,
        }
        for j in jobs
    ]


@router.get("/{sponsor_id}/similar")
async def get_similar_sponsors(
    sponsor_id: uuid.UUID,
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Find top 10 similar sponsors (same industry + city, ordered by score similarity)."""
    # Get reference sponsor + profile + latest score
    result = await db.execute(
        select(Sponsor)
        .options(selectinload(Sponsor.profile))
        .where(Sponsor.id == sponsor_id)
    )
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    # Get reference sponsor's latest score
    ref_score_result = await db.execute(
        select(SponsorScore.overall_score)
        .where(SponsorScore.sponsor_id == sponsor_id)
        .order_by(SponsorScore.computed_at.desc())
        .limit(1)
    )
    ref_score = ref_score_result.scalar() or 50  # default to 50 if no score

    # Get reference sponsor's industry
    ref_industry = None
    if sponsor.profile:
        ref_industry = sponsor.profile.industry_primary

    # Build latest score subquery for ordering by score similarity
    score_sq = _latest_score_subquery()
    latest_score = select(score_sq).where(score_sq.c.rn == 1).subquery("ls")

    # Build base query with score difference for ordering
    base_conditions = [
        Sponsor.id != sponsor_id,
        Sponsor.is_active == True,  # noqa: E712
    ]

    # Phase 1: Same industry AND same city (best match)
    phase1_conditions = list(base_conditions)
    if sponsor.town_city:
        phase1_conditions.append(
            func.lower(Sponsor.town_city) == sponsor.town_city.lower()
        )
    if ref_industry:
        phase1_conditions.append(
            CompanyProfile.industry_primary == ref_industry
        )

    phase1_query = (
        select(
            Sponsor,
            latest_score.c.overall_score.label("score"),
        )
        .outerjoin(CompanyProfile, CompanyProfile.sponsor_id == Sponsor.id)
        .outerjoin(latest_score, latest_score.c.sponsor_id == Sponsor.id)
        .where(*phase1_conditions)
        .order_by(
            func.abs(func.coalesce(latest_score.c.overall_score, 50) - ref_score).asc()
        )
        .limit(limit)
    )
    phase1_result = await db.execute(phase1_query)
    rows = phase1_result.all()
    similar_ids = {r[0].id for r in rows}
    similar_data = [(r[0], r[1]) for r in rows]

    # Phase 2: Same industry OR same city (if not enough)
    if len(similar_data) < limit:
        remaining = limit - len(similar_data)
        phase2_conditions = list(base_conditions)
        if similar_ids:
            phase2_conditions.append(Sponsor.id.notin_(similar_ids))

        or_clauses = []
        if sponsor.town_city:
            or_clauses.append(
                func.lower(Sponsor.town_city) == sponsor.town_city.lower()
            )
        if ref_industry:
            or_clauses.append(CompanyProfile.industry_primary == ref_industry)

        if or_clauses:
            phase2_conditions.append(or_(*or_clauses))

        phase2_query = (
            select(
                Sponsor,
                latest_score.c.overall_score.label("score"),
            )
            .outerjoin(CompanyProfile, CompanyProfile.sponsor_id == Sponsor.id)
            .outerjoin(latest_score, latest_score.c.sponsor_id == Sponsor.id)
            .where(*phase2_conditions)
            .order_by(
                func.abs(
                    func.coalesce(latest_score.c.overall_score, 50) - ref_score
                ).asc()
            )
            .limit(remaining)
        )
        phase2_result = await db.execute(phase2_query)
        for r in phase2_result.all():
            similar_ids.add(r[0].id)
            similar_data.append((r[0], r[1]))

    # Phase 3: Any active sponsor (fallback if still not enough)
    if len(similar_data) < limit:
        remaining = limit - len(similar_data)
        phase3_query = (
            select(
                Sponsor,
                latest_score.c.overall_score.label("score"),
            )
            .outerjoin(latest_score, latest_score.c.sponsor_id == Sponsor.id)
            .where(
                Sponsor.id != sponsor_id,
                Sponsor.is_active == True,  # noqa: E712
                Sponsor.id.notin_(similar_ids),
            )
            .order_by(
                func.abs(
                    func.coalesce(latest_score.c.overall_score, 50) - ref_score
                ).asc()
            )
            .limit(remaining)
        )
        phase3_result = await db.execute(phase3_query)
        for r in phase3_result.all():
            similar_data.append((r[0], r[1]))

    return [
        {
            "id": str(s.id),
            "organisation_name": s.organisation_name,
            "town_city": s.town_city,
            "rating": s.rating.value if s.rating else None,
            "overall_score": score,
        }
        for s, score in similar_data
    ]


# ---------------------------------------------------------------------------
# CSV Import (Admin)
# ---------------------------------------------------------------------------


@router.post("/import")
async def import_csv(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Admin-only manual CSV upload of sponsor data."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted",
        )

    contents = await file.read()
    md5 = hashlib.md5(contents).hexdigest()

    # Check for duplicate import
    from app.models.sponsor import CsvImport

    existing = await db.execute(
        select(CsvImport).where(CsvImport.checksum_md5 == md5)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This CSV has already been imported",
        )

    # Parse CSV
    text_content = contents.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text_content))
    rows = list(reader)

    csv_import = CsvImport(
        id=uuid.uuid4(),
        filename=file.filename or "upload.csv",
        checksum_md5=md5,
        record_count=len(rows),
        imported_at=datetime.utcnow(),
        is_auto=False,
    )
    db.add(csv_import)

    return {
        "import_id": str(csv_import.id),
        "filename": file.filename,
        "record_count": len(rows),
        "md5": md5,
    }
