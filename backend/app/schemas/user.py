"""
Pydantic schemas for user-facing endpoints: watchlist, notes, alerts.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ---- Watchlist ----

class WatchlistItemCreate(BaseModel):
    sponsor_id: UUID
    notes: str | None = None
    priority: str = "medium"


class WatchlistItemUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    priority: str | None = None
    next_followup: datetime | None = None


class WatchlistItemResponse(BaseModel):
    id: UUID
    sponsor_id: UUID
    sponsor_name: str | None = None
    sponsor_score: int | None = None
    status: str | None = None
    priority: int | None = None
    notes: str | None = None
    applied_date: datetime | None = None
    next_followup: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Alerts ----

class AlertCreate(BaseModel):
    alert_type: str
    config: dict = {}
    channel: str = "email"


class AlertUpdate(BaseModel):
    alert_type: str | None = None
    config: dict | None = None
    channel: str | None = None
    is_active: bool | None = None


class AlertResponse(BaseModel):
    id: UUID
    alert_type: str
    config: dict | None = None
    channel: str
    is_active: bool
    last_triggered: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertHistoryResponse(BaseModel):
    id: UUID
    alert_id: UUID
    triggered_at: datetime
    payload: dict | None = None
    read: bool

    model_config = {"from_attributes": True}


# ---- Notes ----

class NoteCreate(BaseModel):
    sponsor_id: UUID
    content: str


class NoteUpdate(BaseModel):
    content: str


class NoteResponse(BaseModel):
    id: UUID
    sponsor_id: UUID
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
