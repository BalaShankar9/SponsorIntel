"""
User profile API endpoints for dashboard personalization.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileSetup(BaseModel):
    visa_route: Optional[str] = Field(None, max_length=100)
    target_industries: Optional[list[str]] = None
    target_locations: Optional[list[str]] = None
    current_status: Optional[str] = Field(
        None,
        pattern=r"^(outside_uk|uk_different_visa|uk_graduate|uk_sponsored|uk_citizen_pr|other)$",
    )
    nationality: Optional[str] = Field(None, max_length=100)


class ProfileResponse(BaseModel):
    user_id: str
    visa_route: Optional[str] = None
    target_industries: Optional[list[str]] = None
    target_locations: Optional[list[str]] = None
    current_status: Optional[str] = None
    nationality: Optional[str] = None
    setup_completed: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/setup", response_model=ProfileResponse)
async def setup_profile(
    data: ProfileSetup,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create or update the user's profile preferences."""
    now = datetime.utcnow()
    # Upsert via raw SQL since user_profiles is a Supabase-managed table
    # (not an Alembic model)
    await db.execute(
        text("""
            INSERT INTO user_profiles (
                user_id, visa_route, target_industries, target_locations,
                current_status, nationality, setup_completed, created_at, updated_at
            ) VALUES (
                :user_id, :visa_route, :target_industries, :target_locations,
                :current_status, :nationality, TRUE, :now, :now
            )
            ON CONFLICT (user_id) DO UPDATE SET
                visa_route = EXCLUDED.visa_route,
                target_industries = EXCLUDED.target_industries,
                target_locations = EXCLUDED.target_locations,
                current_status = EXCLUDED.current_status,
                nationality = EXCLUDED.nationality,
                setup_completed = TRUE,
                updated_at = EXCLUDED.updated_at
        """),
        {
            "user_id": str(user.id),
            "visa_route": data.visa_route,
            "target_industries": data.target_industries,
            "target_locations": data.target_locations,
            "current_status": data.current_status,
            "nationality": data.nationality,
            "now": now,
        },
    )
    await db.commit()

    # Fetch back
    result = await db.execute(
        text("SELECT * FROM user_profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = result.mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=500, detail="Profile save failed")

    return ProfileResponse(
        user_id=str(row["user_id"]),
        visa_route=row["visa_route"],
        target_industries=row["target_industries"],
        target_locations=row["target_locations"],
        current_status=row["current_status"],
        nationality=row["nationality"],
        setup_completed=row["setup_completed"],
        created_at=str(row["created_at"]) if row["created_at"] else None,
        updated_at=str(row["updated_at"]) if row["updated_at"] else None,
    )


@router.get("/", response_model=ProfileResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Get the current user's profile."""
    result = await db.execute(
        text("SELECT * FROM user_profiles WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = result.mappings().one_or_none()
    if not row:
        # Return empty profile (setup not completed)
        return ProfileResponse(user_id=str(user.id))

    return ProfileResponse(
        user_id=str(row["user_id"]),
        visa_route=row["visa_route"],
        target_industries=row["target_industries"],
        target_locations=row["target_locations"],
        current_status=row["current_status"],
        nationality=row["nationality"],
        setup_completed=row["setup_completed"],
        created_at=str(row["created_at"]) if row["created_at"] else None,
        updated_at=str(row["updated_at"]) if row["updated_at"] else None,
    )
