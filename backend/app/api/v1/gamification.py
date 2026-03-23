"""
Gamification API: points, streaks, achievements.
"""

import json
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/gamification", tags=["gamification"])

DAILY_CAP = 50

POINT_MAP = {
    "watch": 5,
    "rate": 10,
    "salary_report": 15,
    "success_story": 20,
    "raw_tool": 5,
    "checkin": 3,
    "report_data": 25,
}

ACHIEVEMENTS = {
    "first_watch": {"label": "First Watch", "description": "Watched first company", "condition_type": "watch", "threshold": 1},
    "analyst": {"label": "Analyst", "description": "Used 5 RAW tools", "condition_type": "raw_tool", "threshold": 5},
    "researcher": {"label": "Researcher", "description": "Rated 10 sponsors", "condition_type": "rate", "threshold": 10},
    "deep_diver": {"label": "Deep Diver", "description": "Viewed 50 company profiles", "condition_type": "view_profile", "threshold": 50},
    "contributor": {"label": "Contributor", "description": "Submitted 5 community ratings", "condition_type": "rate", "threshold": 5},
    "streak_7": {"label": "Week Warrior", "description": "7-day check-in streak", "condition_type": "streak", "threshold": 7},
    "streak_30": {"label": "Monthly Master", "description": "30-day check-in streak", "condition_type": "streak", "threshold": 30},
}


class TrackActivity(BaseModel):
    activity_type: str = Field(..., pattern=r"^(watch|rate|salary_report|success_story|raw_tool|view_profile|report_data)$")
    target_id: Optional[str] = None


@router.post("/checkin")
async def daily_checkin(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Daily check-in for streak and points."""
    uid = str(user.id)
    today = date.today()

    # Check if already checked in today
    existing = await db.execute(
        text("""
            SELECT id FROM user_activity
            WHERE user_id = :uid AND activity_type = 'checkin'
              AND created_at::date = :today
        """),
        {"uid": uid, "today": today},
    )
    if existing.first():
        return {"status": "already_checked_in", "points": 0}

    # Check daily cap
    day_points = await db.execute(
        text("""
            SELECT COALESCE(SUM(points), 0) as total
            FROM user_activity
            WHERE user_id = :uid AND created_at::date = :today
        """),
        {"uid": uid, "today": today},
    )
    current_daily = day_points.scalar() or 0
    if current_daily >= DAILY_CAP:
        return {"status": "daily_cap_reached", "points": 0}

    points = POINT_MAP["checkin"]

    # Record activity
    await db.execute(
        text("""
            INSERT INTO user_activity (user_id, activity_type, points, metadata)
            VALUES (:uid, 'checkin', :pts, '{}')
        """),
        {"uid": uid, "pts": points},
    )

    # Update streak
    await db.execute(
        text("""
            INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_check_in, total_points)
            VALUES (:uid, 1, 1, :today, :pts)
            ON CONFLICT (user_id) DO UPDATE SET
                current_streak = CASE
                    WHEN user_streaks.last_check_in = :yesterday THEN user_streaks.current_streak + 1
                    WHEN user_streaks.last_check_in = :today THEN user_streaks.current_streak
                    ELSE 1
                END,
                longest_streak = GREATEST(
                    user_streaks.longest_streak,
                    CASE
                        WHEN user_streaks.last_check_in = :yesterday THEN user_streaks.current_streak + 1
                        ELSE 1
                    END
                ),
                last_check_in = :today,
                total_points = user_streaks.total_points + :pts
        """),
        {"uid": uid, "today": today, "yesterday": today - timedelta(days=1), "pts": points},
    )

    await db.commit()

    # Check streak achievements
    streak_result = await db.execute(
        text("SELECT current_streak FROM user_streaks WHERE user_id = :uid"),
        {"uid": uid},
    )
    current_streak = streak_result.scalar() or 0
    for key, ach in ACHIEVEMENTS.items():
        if ach["condition_type"] == "streak" and current_streak >= ach["threshold"]:
            await db.execute(
                text("""
                    INSERT INTO user_achievements (user_id, achievement_key)
                    VALUES (:uid, :key)
                    ON CONFLICT (user_id, achievement_key) DO NOTHING
                """),
                {"uid": uid, "key": key},
            )
    await db.commit()

    return {"status": "checked_in", "points": points, "streak": current_streak}


@router.post("/track")
async def track_activity(
    data: TrackActivity,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Track an activity for points. Server validates idempotency."""
    uid = str(user.id)
    today = date.today()

    # Check idempotency for target-specific actions
    if data.target_id and data.activity_type in ("watch", "rate"):
        existing = await db.execute(
            text("""
                SELECT id FROM user_activity
                WHERE user_id = :uid AND activity_type = :atype
                  AND metadata->>'target_id' = :tid
            """),
            {"uid": uid, "atype": data.activity_type, "tid": data.target_id},
        )
        if existing.first():
            return {"status": "already_tracked", "points": 0}

    # Check daily cap
    day_points = await db.execute(
        text("""
            SELECT COALESCE(SUM(points), 0) as total
            FROM user_activity
            WHERE user_id = :uid AND created_at::date = :today
        """),
        {"uid": uid, "today": today},
    )
    current_daily = day_points.scalar() or 0
    if current_daily >= DAILY_CAP:
        return {"status": "daily_cap_reached", "points": 0}

    points = POINT_MAP.get(data.activity_type, 0)
    if points == 0:
        return {"status": "unknown_activity", "points": 0}

    metadata = json.dumps({"target_id": data.target_id} if data.target_id else {})

    await db.execute(
        text("""
            INSERT INTO user_activity (user_id, activity_type, points, metadata)
            VALUES (:uid, :atype, :pts, :meta::jsonb)
        """),
        {"uid": uid, "atype": data.activity_type, "pts": points, "meta": metadata},
    )

    # Update total points
    await db.execute(
        text("""
            INSERT INTO user_streaks (user_id, total_points)
            VALUES (:uid, :pts)
            ON CONFLICT (user_id) DO UPDATE SET
                total_points = user_streaks.total_points + :pts
        """),
        {"uid": uid, "pts": points},
    )

    await db.commit()

    # Check activity-based achievements
    for key, ach in ACHIEVEMENTS.items():
        if ach["condition_type"] == data.activity_type:
            count_result = await db.execute(
                text("""
                    SELECT COUNT(*) FROM user_activity
                    WHERE user_id = :uid AND activity_type = :atype
                """),
                {"uid": uid, "atype": data.activity_type},
            )
            total_count = count_result.scalar() or 0
            if total_count >= ach["threshold"]:
                await db.execute(
                    text("""
                        INSERT INTO user_achievements (user_id, achievement_key)
                        VALUES (:uid, :key)
                        ON CONFLICT (user_id, achievement_key) DO NOTHING
                    """),
                    {"uid": uid, "key": key},
                )
    await db.commit()

    return {"status": "tracked", "points": points}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get user's gamification stats: points, streak, achievements."""
    uid = str(user.id)

    streak_result = await db.execute(
        text("SELECT * FROM user_streaks WHERE user_id = :uid"),
        {"uid": uid},
    )
    streak = streak_result.mappings().one_or_none()

    achievements_result = await db.execute(
        text("SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = :uid"),
        {"uid": uid},
    )
    achievements = [
        {"key": r["achievement_key"], "unlocked_at": str(r["unlocked_at"])}
        for r in achievements_result.mappings().all()
    ]

    return {
        "total_points": streak["total_points"] if streak else 0,
        "current_streak": streak["current_streak"] if streak else 0,
        "longest_streak": streak["longest_streak"] if streak else 0,
        "last_check_in": str(streak["last_check_in"]) if streak and streak["last_check_in"] else None,
        "achievements": achievements,
        "achievement_definitions": {
            k: {"label": v["label"], "description": v["description"]}
            for k, v in ACHIEVEMENTS.items()
        },
    }
