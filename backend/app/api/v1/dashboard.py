"""
Dashboard personalization endpoints.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.job import Job
from app.models.sponsor import Sponsor
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/briefing")
async def daily_briefing(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Daily briefing: new sponsors, rating changes, watchlist jobs."""
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    # Load user profile for personalization
    profile_result = await db.execute(
        text("SELECT * FROM user_profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    profile = profile_result.mappings().one_or_none()

    # New A-rated sponsors in last 7 days
    new_a_query = (
        select(func.count(Sponsor.id))
        .where(
            Sponsor.rating == "A",
            Sponsor.first_seen_date >= week_ago.date(),
        )
    )
    new_a_count = (await db.execute(new_a_query)).scalar() or 0

    # New jobs matching user's target locations in last 7 days
    new_jobs_query = select(func.count(Job.id)).where(
        Job.created_at >= week_ago,
        Job.sponsorship_likelihood >= 60,
    )
    new_jobs_count = (await db.execute(new_jobs_query)).scalar() or 0

    # Watchlist companies with new activity
    watchlist_activity_count = 0
    try:
        wl_result = await db.execute(
            text("""
                SELECT COUNT(DISTINCT w.sponsor_id)
                FROM watchlist w
                JOIN jobs j ON j.sponsor_id = w.sponsor_id
                WHERE w.user_id = :uid
                  AND j.created_at >= :since
            """),
            {"uid": str(user.id), "since": week_ago},
        )
        watchlist_activity_count = wl_result.scalar() or 0
    except Exception:
        pass  # watchlist table may not exist yet

    items = []
    if new_a_count > 0:
        items.append({
            "type": "new_sponsors",
            "text": f"{new_a_count} new A-rated sponsor{'s' if new_a_count != 1 else ''} this week",
            "link": "/search?rating=A&sort=first_seen_date&dir=desc",
            "color": "green",
        })
    if new_jobs_count > 0:
        items.append({
            "type": "new_jobs",
            "text": f"{new_jobs_count} new sponsorship-likely job{'s' if new_jobs_count != 1 else ''}",
            "link": "/jobs",
            "color": "cyan",
        })
    if watchlist_activity_count > 0:
        items.append({
            "type": "watchlist",
            "text": f"{watchlist_activity_count} watchlist compan{'ies' if watchlist_activity_count != 1 else 'y'} posted new jobs",
            "link": "/watchlist",
            "color": "amber",
        })
    if not items:
        items.append({
            "type": "quiet",
            "text": "All quiet on the sponsorship front. No major changes today.",
            "link": "/dashboard",
            "color": "dim",
        })

    return {
        "date": now.strftime("%A, %d %B %Y"),
        "items": items,
        "profile_setup": profile is not None and profile.get("setup_completed", False),
    }
