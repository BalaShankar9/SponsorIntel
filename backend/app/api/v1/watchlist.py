"""
Watchlist API endpoints.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth, require_pro
from app.core.database import get_db
from app.models.enums import ApplicationStatus, UserPlan
from app.models.scoring import SponsorScore
from app.models.sponsor import Sponsor
from app.models.user import User, WatchlistItem
from app.schemas.user import (
    WatchlistItemCreate,
    WatchlistItemResponse,
    WatchlistItemUpdate,
)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])

# Watchlist limits per plan
_WATCHLIST_LIMITS = {
    UserPlan.PRO: 50,
    UserPlan.ENTERPRISE: 999999,  # effectively unlimited
}

# Status string -> enum mapping
_STATUS_MAP = {s.value: s for s in ApplicationStatus}


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[WatchlistItemResponse])
async def list_watchlist(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Return all watchlist items with sponsor info and latest scores."""
    # Latest score subquery
    score_sq = (
        select(
            SponsorScore.sponsor_id,
            SponsorScore.overall_score,
            func.row_number()
            .over(
                partition_by=SponsorScore.sponsor_id,
                order_by=SponsorScore.computed_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )
    latest_score = select(score_sq).where(score_sq.c.rn == 1).subquery("ls")

    result = await db.execute(
        select(
            WatchlistItem,
            Sponsor.organisation_name,
            latest_score.c.overall_score,
        )
        .join(Sponsor, Sponsor.id == WatchlistItem.sponsor_id)
        .outerjoin(latest_score, latest_score.c.sponsor_id == WatchlistItem.sponsor_id)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.created_at.desc())
    )
    rows = result.all()

    return [
        WatchlistItemResponse(
            id=item.id,
            sponsor_id=item.sponsor_id,
            sponsor_name=name,
            sponsor_score=score,
            status=item.status.value if item.status else None,
            priority=item.priority,
            notes=item.notes,
            applied_date=item.applied_date,
            next_followup=item.next_followup,
            created_at=item.created_at,
        )
        for item, name, score in rows
    ]


# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------


@router.post("/", response_model=WatchlistItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    body: WatchlistItemCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_pro),
):
    """Add a sponsor to the watchlist (Pro only)."""
    # Check limit
    current_count = (
        await db.execute(
            select(func.count(WatchlistItem.id)).where(
                WatchlistItem.user_id == user.id
            )
        )
    ).scalar() or 0

    limit = _WATCHLIST_LIMITS.get(user.plan, 0)
    if current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Watchlist limit reached ({limit}). Upgrade your plan for more.",
        )

    # Verify sponsor exists
    sponsor = (
        await db.execute(select(Sponsor).where(Sponsor.id == body.sponsor_id))
    ).scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    # Check duplicate
    existing = (
        await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == user.id,
                WatchlistItem.sponsor_id == body.sponsor_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sponsor already on watchlist",
        )

    # Map priority string to int
    priority_map = {"low": 1, "medium": 2, "high": 3}
    priority_int = priority_map.get(body.priority, 2)

    item = WatchlistItem(
        id=uuid.uuid4(),
        user_id=user.id,
        sponsor_id=body.sponsor_id,
        notes=body.notes,
        priority=priority_int,
        status=ApplicationStatus.WATCHING,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    await db.flush()

    return WatchlistItemResponse(
        id=item.id,
        sponsor_id=item.sponsor_id,
        sponsor_name=sponsor.organisation_name,
        sponsor_score=None,
        status=item.status.value if item.status else None,
        priority=item.priority,
        notes=item.notes,
        applied_date=item.applied_date,
        next_followup=item.next_followup,
        created_at=item.created_at,
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@router.put("/{item_id}", response_model=WatchlistItemResponse)
async def update_watchlist_item(
    item_id: uuid.UUID,
    body: WatchlistItemUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update a watchlist item."""
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.id == item_id,
            WatchlistItem.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    if body.status is not None:
        mapped = _STATUS_MAP.get(body.status)
        if not mapped:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Valid values: {list(_STATUS_MAP.keys())}",
            )
        item.status = mapped
        if mapped == ApplicationStatus.APPLIED and not item.applied_date:
            item.applied_date = datetime.utcnow()
    if body.notes is not None:
        item.notes = body.notes
    if body.priority is not None:
        priority_map = {"low": 1, "medium": 2, "high": 3}
        item.priority = priority_map.get(body.priority, item.priority)
    if body.next_followup is not None:
        item.next_followup = body.next_followup

    item.updated_at = datetime.utcnow()
    await db.flush()

    # Fetch sponsor name
    sponsor = (
        await db.execute(select(Sponsor).where(Sponsor.id == item.sponsor_id))
    ).scalar_one_or_none()

    return WatchlistItemResponse(
        id=item.id,
        sponsor_id=item.sponsor_id,
        sponsor_name=sponsor.organisation_name if sponsor else None,
        sponsor_score=None,
        status=item.status.value if item.status else None,
        priority=item.priority,
        notes=item.notes,
        applied_date=item.applied_date,
        next_followup=item.next_followup,
        created_at=item.created_at,
    )


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Remove a sponsor from the watchlist."""
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.id == item_id,
            WatchlistItem.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    await db.delete(item)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats")
async def watchlist_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Watchlist analytics: status breakdown, response rate."""
    items = (
        await db.execute(
            select(WatchlistItem).where(WatchlistItem.user_id == user.id)
        )
    ).scalars().all()

    total = len(items)
    status_counts: dict[str, int] = {}
    applied_count = 0
    response_count = 0

    for item in items:
        s = item.status.value if item.status else "watching"
        status_counts[s] = status_counts.get(s, 0) + 1
        if s in ("applied", "interviewing", "offered", "rejected", "withdrawn"):
            applied_count += 1
        if s in ("interviewing", "offered", "rejected"):
            response_count += 1

    response_rate = (
        round(response_count / applied_count * 100, 1) if applied_count > 0 else 0
    )

    return {
        "total": total,
        "status_breakdown": status_counts,
        "applied_count": applied_count,
        "response_count": response_count,
        "response_rate": response_rate,
    }
