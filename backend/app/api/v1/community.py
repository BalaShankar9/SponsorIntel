"""
Community layer API: ratings, salary reports, success stories.
"""

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin, require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/community", tags=["community"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RatingSubmit(BaseModel):
    sponsor_id: str
    interaction_type: str = Field(..., pattern=r"^(applied|interviewed|sponsored|worked_here)$")
    rating_overall: int = Field(..., ge=1, le=5)
    rating_process: Optional[int] = Field(None, ge=1, le=5)
    rating_interview: Optional[int] = Field(None, ge=1, le=5)
    rating_sponsorship: Optional[int] = Field(None, ge=1, le=5)
    rating_culture: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class SalaryReportSubmit(BaseModel):
    sponsor_id: str
    role_title: str = Field(..., max_length=300)
    salary_annual: int = Field(..., ge=10000, le=500000)
    visa_route: Optional[str] = Field(None, max_length=100)
    year: int = Field(..., ge=2015, le=2030)


class SuccessStorySubmit(BaseModel):
    sponsor_id: str
    story_text: str = Field(..., min_length=20, max_length=5000)
    visa_route: Optional[str] = Field(None, max_length=100)
    year: Optional[int] = Field(None, ge=2015, le=2030)
    is_anonymous: bool = True


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------

@router.post("/ratings")
async def submit_rating(
    data: RatingSubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Submit or update a community rating for a sponsor."""
    await db.execute(
        text("""
            INSERT INTO community_ratings (
                user_id, sponsor_id, interaction_type, rating_overall,
                rating_process, rating_interview, rating_sponsorship,
                rating_culture, comment
            ) VALUES (
                :uid, :sid, :interaction, :overall,
                :process, :interview, :sponsorship, :culture, :comment
            )
            ON CONFLICT (user_id, sponsor_id) DO UPDATE SET
                interaction_type = EXCLUDED.interaction_type,
                rating_overall = EXCLUDED.rating_overall,
                rating_process = EXCLUDED.rating_process,
                rating_interview = EXCLUDED.rating_interview,
                rating_sponsorship = EXCLUDED.rating_sponsorship,
                rating_culture = EXCLUDED.rating_culture,
                comment = EXCLUDED.comment,
                is_approved = FALSE,
                updated_at = now()
        """),
        {
            "uid": str(user.id),
            "sid": data.sponsor_id,
            "interaction": data.interaction_type,
            "overall": data.rating_overall,
            "process": data.rating_process,
            "interview": data.rating_interview,
            "sponsorship": data.rating_sponsorship,
            "culture": data.rating_culture,
            "comment": data.comment,
        },
    )
    await db.commit()
    return {"status": "submitted", "message": "Your rating is pending approval."}


@router.get("/ratings/{sponsor_id}")
async def get_ratings(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get approved community ratings for a sponsor."""
    result = await db.execute(
        text("""
            SELECT rating_overall, rating_process, rating_interview,
                   rating_sponsorship, rating_culture, interaction_type,
                   comment, created_at
            FROM community_ratings
            WHERE sponsor_id = :sid AND is_approved = TRUE
            ORDER BY created_at DESC
            LIMIT 50
        """),
        {"sid": str(sponsor_id)},
    )
    rows = result.mappings().all()

    if not rows:
        return {"ratings": [], "averages": None, "count": 0}

    avg_overall = sum(r["rating_overall"] for r in rows) / len(rows)
    return {
        "ratings": [dict(r) for r in rows],
        "averages": {"overall": round(avg_overall, 1)},
        "count": len(rows),
    }


# ---------------------------------------------------------------------------
# Salary Reports
# ---------------------------------------------------------------------------

@router.post("/salary-reports")
async def submit_salary_report(
    data: SalaryReportSubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Submit an anonymous salary report."""
    await db.execute(
        text("""
            INSERT INTO salary_reports (user_id, sponsor_id, role_title, salary_annual, visa_route, year)
            VALUES (:uid, :sid, :role, :salary, :route, :year)
        """),
        {
            "uid": str(user.id),
            "sid": data.sponsor_id,
            "role": data.role_title,
            "salary": data.salary_annual,
            "route": data.visa_route,
            "year": data.year,
        },
    )
    await db.commit()
    return {"status": "submitted"}


@router.get("/salary-reports/{sponsor_id}")
async def get_salary_reports(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated salary reports (only if >= 3 reports for anonymity)."""
    result = await db.execute(
        text("""
            SELECT role_title, visa_route,
                   COUNT(*) as report_count,
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary_annual) as median_salary,
                   MIN(salary_annual) as min_salary,
                   MAX(salary_annual) as max_salary
            FROM salary_reports
            WHERE sponsor_id = :sid
            GROUP BY role_title, visa_route
            HAVING COUNT(*) >= 3
        """),
        {"sid": str(sponsor_id)},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Success Stories
# ---------------------------------------------------------------------------

@router.post("/success-stories")
async def submit_success_story(
    data: SuccessStorySubmit,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Submit a success story."""
    await db.execute(
        text("""
            INSERT INTO success_stories (user_id, sponsor_id, story_text, visa_route, year, is_anonymous)
            VALUES (:uid, :sid, :story, :route, :year, :anon)
        """),
        {
            "uid": str(user.id),
            "sid": data.sponsor_id,
            "story": data.story_text,
            "route": data.visa_route,
            "year": data.year,
            "anon": data.is_anonymous,
        },
    )
    await db.commit()
    return {"status": "submitted", "message": "Your story is pending admin approval."}


@router.get("/success-stories/{sponsor_id}")
async def get_success_stories(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get approved success stories for a sponsor."""
    result = await db.execute(
        text("""
            SELECT story_text, visa_route, year, is_anonymous, created_at
            FROM success_stories
            WHERE sponsor_id = :sid AND is_approved = TRUE
            ORDER BY created_at DESC
        """),
        {"sid": str(sponsor_id)},
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Admin Moderation
# ---------------------------------------------------------------------------

@router.get("/admin/pending")
async def get_pending(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Get pending community items for admin review."""
    ratings = await db.execute(
        text("""
            SELECT cr.*, s.organisation_name
            FROM community_ratings cr
            JOIN sponsors s ON s.id = cr.sponsor_id
            WHERE cr.is_approved = FALSE
            ORDER BY cr.created_at DESC LIMIT 50
        """)
    )
    stories = await db.execute(
        text("""
            SELECT ss.*, s.organisation_name
            FROM success_stories ss
            JOIN sponsors s ON s.id = ss.sponsor_id
            WHERE ss.is_approved = FALSE
            ORDER BY ss.created_at DESC LIMIT 50
        """)
    )
    return {
        "pending_ratings": [dict(r) for r in ratings.mappings().all()],
        "pending_stories": [dict(r) for r in stories.mappings().all()],
    }


@router.post("/admin/approve/{item_type}/{item_id}")
async def approve_item(
    item_type: str,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Approve a community rating or success story."""
    if item_type not in ("rating", "story"):
        raise HTTPException(status_code=400, detail="Invalid item type")

    table = "community_ratings" if item_type == "rating" else "success_stories"
    await db.execute(
        text(f"UPDATE {table} SET is_approved = TRUE, approved_at = now() WHERE id = :id"),
        {"id": str(item_id)},
    )
    await db.commit()
    return {"status": "approved"}


@router.post("/admin/reject/{item_type}/{item_id}")
async def reject_item(
    item_type: str,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Reject (delete) a community rating or success story."""
    if item_type not in ("rating", "story"):
        raise HTTPException(status_code=400, detail="Invalid item type")

    table = "community_ratings" if item_type == "rating" else "success_stories"
    await db.execute(
        text(f"DELETE FROM {table} WHERE id = :id"),
        {"id": str(item_id)},
    )
    await db.commit()
    return {"status": "rejected"}
