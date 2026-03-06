"""
Analytics API endpoints.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import optional_auth
from app.core.database import get_db
from app.models.company import CompanyProfile
from app.models.enums import ChangeType, SponsorRating
from app.models.event import Event
from app.models.job import Job
from app.models.sponsor import CsvImport, Sponsor, SponsorChange
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsTrends,
    DashboardOverview,
    FilterOptions,
    TrendPoint,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


@router.get("/overview", response_model=DashboardOverview)
async def overview(db: AsyncSession = Depends(get_db)):
    """Dashboard overview counts."""
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    total_sponsors = (
        await db.execute(
            select(func.count(Sponsor.id)).where(Sponsor.is_active == True)  # noqa: E712
        )
    ).scalar() or 0

    a_rated = (
        await db.execute(
            select(func.count(Sponsor.id)).where(
                Sponsor.is_active == True,  # noqa: E712
                Sponsor.rating == SponsorRating.A,
            )
        )
    ).scalar() or 0

    b_rated = (
        await db.execute(
            select(func.count(Sponsor.id)).where(
                Sponsor.is_active == True,  # noqa: E712
                Sponsor.rating == SponsorRating.B,
            )
        )
    ).scalar() or 0

    added_30d = (
        await db.execute(
            select(func.count(SponsorChange.id)).where(
                SponsorChange.change_type == ChangeType.ADDED,
                SponsorChange.detected_at >= thirty_days_ago,
            )
        )
    ).scalar() or 0

    removed_30d = (
        await db.execute(
            select(func.count(SponsorChange.id)).where(
                SponsorChange.change_type == ChangeType.REMOVED,
                SponsorChange.detected_at >= thirty_days_ago,
            )
        )
    ).scalar() or 0

    changed_30d = (
        await db.execute(
            select(func.count(SponsorChange.id)).where(
                SponsorChange.detected_at >= thirty_days_ago,
                SponsorChange.change_type.notin_([ChangeType.ADDED, ChangeType.REMOVED]),
            )
        )
    ).scalar() or 0

    total_jobs = (
        await db.execute(
            select(func.count(Job.id)).where(Job.is_expired == False)  # noqa: E712
        )
    ).scalar() or 0

    total_enriched = (
        await db.execute(
            select(func.count(CompanyProfile.id)).where(
                CompanyProfile.enriched_at.isnot(None)
            )
        )
    ).scalar() or 0

    return DashboardOverview(
        total_sponsors=total_sponsors,
        a_rated=a_rated,
        b_rated=b_rated,
        added_30d=added_30d,
        removed_30d=removed_30d,
        changed_30d=changed_30d,
        total_jobs=total_jobs,
        total_enriched=total_enriched,
    )


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------


@router.get("/trends", response_model=AnalyticsTrends)
async def trends(
    period: str = Query("12m", regex="^(1m|3m|6m|12m)$"),
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(optional_auth),
):
    """Growth and rating trends over time."""
    months = {"1m": 1, "3m": 3, "6m": 6, "12m": 12}[period]
    since = datetime.utcnow() - timedelta(days=months * 30)

    is_pro = user and user.plan.value in ("pro", "enterprise")
    limit_results = 5 if not is_pro else 50

    # Sponsor growth from CSV imports
    growth_rows = (
        await db.execute(
            select(
                func.date_trunc("month", CsvImport.imported_at).label("month"),
                func.sum(CsvImport.added_count).label("added"),
            )
            .where(CsvImport.imported_at >= since)
            .group_by(text("month"))
            .order_by(text("month"))
        )
    ).all()

    sponsor_growth = [
        TrendPoint(date=str(row.month.date()) if row.month else "", value=int(row.added or 0))
        for row in growth_rows
    ]

    # Rating changes
    upgrades = (
        await db.execute(
            select(func.count(SponsorChange.id)).where(
                SponsorChange.change_type == ChangeType.RATING_UPGRADE,
                SponsorChange.detected_at >= since,
            )
        )
    ).scalar() or 0

    downgrades = (
        await db.execute(
            select(func.count(SponsorChange.id)).where(
                SponsorChange.change_type == ChangeType.RATING_DOWNGRADE,
                SponsorChange.detected_at >= since,
            )
        )
    ).scalar() or 0

    # Top cities
    city_rows = (
        await db.execute(
            select(Sponsor.town_city, func.count(Sponsor.id).label("cnt"))
            .where(Sponsor.is_active == True, Sponsor.town_city.isnot(None))  # noqa: E712
            .group_by(Sponsor.town_city)
            .order_by(text("cnt DESC"))
            .limit(limit_results)
        )
    ).all()
    top_cities = [{"city": r[0], "count": r[1]} for r in city_rows]

    # Top industries
    industry_rows = (
        await db.execute(
            select(
                CompanyProfile.industry_primary,
                func.count(CompanyProfile.id).label("cnt"),
            )
            .where(CompanyProfile.industry_primary.isnot(None))
            .group_by(CompanyProfile.industry_primary)
            .order_by(text("cnt DESC"))
            .limit(limit_results)
        )
    ).all()
    top_industries = [{"industry": r[0], "count": r[1]} for r in industry_rows]

    # Top hiring (sponsors with most active jobs)
    hiring_rows = (
        await db.execute(
            select(
                Sponsor.id,
                Sponsor.organisation_name,
                func.count(Job.id).label("job_count"),
            )
            .join(Job, Job.sponsor_id == Sponsor.id)
            .where(Job.is_expired == False)  # noqa: E712
            .group_by(Sponsor.id, Sponsor.organisation_name)
            .order_by(text("job_count DESC"))
            .limit(limit_results)
        )
    ).all()
    top_hiring = [
        {"id": str(r[0]), "name": r[1], "job_count": r[2]} for r in hiring_rows
    ]

    return AnalyticsTrends(
        sponsor_growth=sponsor_growth,
        rating_changes={"upgrades": upgrades, "downgrades": downgrades},
        top_cities=top_cities,
        top_industries=top_industries,
        top_hiring=top_hiring,
    )


# ---------------------------------------------------------------------------
# Recent changes feed
# ---------------------------------------------------------------------------


@router.get("/changes")
async def recent_changes(
    limit: int = Query(50, ge=1, le=200),
    change_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Recent sponsor changes feed."""
    query = (
        select(SponsorChange, Sponsor.organisation_name)
        .join(Sponsor, Sponsor.id == SponsorChange.sponsor_id)
        .order_by(SponsorChange.detected_at.desc())
    )

    if change_type:
        query = query.where(SponsorChange.change_type == change_type)

    query = query.limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(c.id),
            "sponsor_id": str(c.sponsor_id),
            "sponsor_name": name,
            "change_type": c.change_type.value,
            "field_changed": c.field_changed,
            "old_value": c.old_value,
            "new_value": c.new_value,
            "detected_at": c.detected_at.isoformat(),
            "significance_score": c.significance_score,
        }
        for c, name in rows
    ]


# ---------------------------------------------------------------------------
# Geographic
# ---------------------------------------------------------------------------


@router.get("/geographic")
async def geographic(db: AsyncSession = Depends(get_db)):
    """City and region breakdown with counts."""
    city_rows = (
        await db.execute(
            select(Sponsor.town_city, func.count(Sponsor.id).label("cnt"))
            .where(Sponsor.is_active == True, Sponsor.town_city.isnot(None))  # noqa: E712
            .group_by(Sponsor.town_city)
            .order_by(text("cnt DESC"))
        )
    ).all()

    county_rows = (
        await db.execute(
            select(Sponsor.county, func.count(Sponsor.id).label("cnt"))
            .where(Sponsor.is_active == True, Sponsor.county.isnot(None))  # noqa: E712
            .group_by(Sponsor.county)
            .order_by(text("cnt DESC"))
        )
    ).all()

    return {
        "by_city": [{"city": r[0], "count": r[1]} for r in city_rows],
        "by_county": [{"county": r[0], "count": r[1]} for r in county_rows],
    }


# ---------------------------------------------------------------------------
# Filter options
# ---------------------------------------------------------------------------


@router.get("/filters", response_model=FilterOptions)
async def filter_options(db: AsyncSession = Depends(get_db)):
    """Unique values for all filter dropdowns."""
    cities = [
        r[0]
        for r in (
            await db.execute(
                select(Sponsor.town_city)
                .where(Sponsor.town_city.isnot(None))
                .distinct()
                .order_by(Sponsor.town_city)
            )
        ).all()
    ]

    counties = [
        r[0]
        for r in (
            await db.execute(
                select(Sponsor.county)
                .where(Sponsor.county.isnot(None))
                .distinct()
                .order_by(Sponsor.county)
            )
        ).all()
    ]

    routes_rows = (
        await db.execute(
            select(func.unnest(Sponsor.route).label("r"))
            .where(Sponsor.route.isnot(None))
            .distinct()
        )
    ).all()
    routes = sorted(set(r[0] for r in routes_rows))

    industries = [
        r[0]
        for r in (
            await db.execute(
                select(CompanyProfile.industry_primary)
                .where(CompanyProfile.industry_primary.isnot(None))
                .distinct()
                .order_by(CompanyProfile.industry_primary)
            )
        ).all()
    ]

    return FilterOptions(
        cities=cities,
        counties=counties,
        routes=routes,
        industries=industries,
    )


# ---------------------------------------------------------------------------
# Events feed
# ---------------------------------------------------------------------------


@router.get("/events")
async def events_feed(
    limit: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Recent events for the live signal feed."""
    query = select(Event).order_by(Event.created_at.desc())

    if event_type:
        query = query.where(Event.event_type == event_type)
    if severity:
        query = query.where(Event.severity == severity)

    query = query.limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "event_type": e.event_type.value,
            "entity_type": e.entity_type,
            "entity_id": str(e.entity_id),
            "payload": e.payload,
            "severity": e.severity.value,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]
