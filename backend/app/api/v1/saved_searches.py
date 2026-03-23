"""
Saved searches CRUD endpoints.
"""

import uuid
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/searches", tags=["searches"])


class SaveSearchRequest(BaseModel):
    name: str = Field(..., max_length=200)
    filters: dict
    result_count: Optional[int] = None


class SavedSearchResponse(BaseModel):
    id: str
    name: str
    filters: dict
    result_count_at_save: Optional[int] = None
    last_viewed_at: Optional[str] = None
    created_at: Optional[str] = None


@router.post("/save", response_model=SavedSearchResponse)
async def save_search(
    data: SaveSearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Save a search with filters."""
    if user.plan.value == "free":
        count_result = await db.execute(
            text("SELECT COUNT(*) FROM saved_searches WHERE user_id = :uid"),
            {"uid": str(user.id)},
        )
        count = count_result.scalar() or 0
        if count >= 10:
            raise HTTPException(
                status_code=403,
                detail="Free plan allows max 10 saved searches. Upgrade to Pro for unlimited.",
            )

    new_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO saved_searches (id, user_id, name, filters, result_count_at_save)
            VALUES (:id, :uid, :name, :filters::jsonb, :count)
        """),
        {
            "id": new_id,
            "uid": str(user.id),
            "name": data.name,
            "filters": json.dumps(data.filters),
            "count": data.result_count,
        },
    )
    await db.commit()

    return SavedSearchResponse(
        id=new_id,
        name=data.name,
        filters=data.filters,
        result_count_at_save=data.result_count,
    )


@router.get("/", response_model=list[SavedSearchResponse])
async def list_searches(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """List user's saved searches."""
    result = await db.execute(
        text("""
            SELECT id, name, filters, result_count_at_save, last_viewed_at, created_at
            FROM saved_searches
            WHERE user_id = :uid
            ORDER BY created_at DESC
        """),
        {"uid": str(user.id)},
    )
    rows = result.mappings().all()
    return [
        SavedSearchResponse(
            id=str(r["id"]),
            name=r["name"],
            filters=r["filters"] if isinstance(r["filters"], dict) else {},
            result_count_at_save=r["result_count_at_save"],
            last_viewed_at=str(r["last_viewed_at"]) if r["last_viewed_at"] else None,
            created_at=str(r["created_at"]) if r["created_at"] else None,
        )
        for r in rows
    ]


@router.delete("/{search_id}")
async def delete_search(
    search_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Delete a saved search."""
    await db.execute(
        text("DELETE FROM saved_searches WHERE id = :id AND user_id = :uid"),
        {"id": str(search_id), "uid": str(user.id)},
    )
    await db.commit()
    return {"deleted": True}
