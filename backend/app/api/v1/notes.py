"""
User notes API endpoints.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth
from app.core.database import get_db
from app.models.sponsor import Sponsor
from app.models.user import User, UserNote
from app.schemas.user import NoteCreate, NoteResponse, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


# ---------------------------------------------------------------------------
# List all notes
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[NoteResponse])
async def list_notes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Return all notes for the current user."""
    result = await db.execute(
        select(UserNote)
        .where(UserNote.user_id == user.id)
        .order_by(UserNote.updated_at.desc())
    )
    return [NoteResponse.model_validate(n) for n in result.scalars().all()]


# ---------------------------------------------------------------------------
# Notes for a specific sponsor
# ---------------------------------------------------------------------------


@router.get("/{sponsor_id}", response_model=list[NoteResponse])
async def get_sponsor_notes(
    sponsor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Return notes for a specific sponsor."""
    result = await db.execute(
        select(UserNote)
        .where(UserNote.user_id == user.id, UserNote.sponsor_id == sponsor_id)
        .order_by(UserNote.updated_at.desc())
    )
    return [NoteResponse.model_validate(n) for n in result.scalars().all()]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Create a new note on a sponsor."""
    # Verify sponsor exists
    sponsor = (
        await db.execute(select(Sponsor).where(Sponsor.id == body.sponsor_id))
    ).scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")

    note = UserNote(
        id=uuid.uuid4(),
        user_id=user.id,
        sponsor_id=body.sponsor_id,
        content=body.content,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(note)
    await db.flush()

    return NoteResponse.model_validate(note)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: uuid.UUID,
    body: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update a note."""
    result = await db.execute(
        select(UserNote).where(UserNote.id == note_id, UserNote.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.content = body.content
    note.updated_at = datetime.utcnow()
    await db.flush()

    return NoteResponse.model_validate(note)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Delete a note."""
    result = await db.execute(
        select(UserNote).where(UserNote.id == note_id, UserNote.user_id == user.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
