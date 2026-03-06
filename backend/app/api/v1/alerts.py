"""
Alerts API endpoints.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth, require_pro
from app.core.database import get_db
from app.models.enums import AlertChannel, AlertType, UserPlan
from app.models.user import Alert, AlertHistory, User
from app.schemas.user import (
    AlertCreate,
    AlertHistoryResponse,
    AlertResponse,
    AlertUpdate,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])

_ALERT_LIMITS = {UserPlan.PRO: 10, UserPlan.ENTERPRISE: 999999}

# String -> enum helpers
_ALERT_TYPE_MAP = {t.value: t for t in AlertType}
_CHANNEL_MAP = {c.value: c for c in AlertChannel}


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[AlertResponse])
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Return all alerts for the current user."""
    result = await db.execute(
        select(Alert)
        .where(Alert.user_id == user.id)
        .order_by(Alert.created_at.desc())
    )
    alerts = result.scalars().all()
    return [
        AlertResponse(
            id=a.id,
            alert_type=a.alert_type.value,
            config=a.config,
            channel=a.channel.value,
            is_active=a.is_active,
            last_triggered=a.last_triggered,
            created_at=a.created_at,
        )
        for a in alerts
    ]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@router.post("/", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    body: AlertCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_pro),
):
    """Create a new alert (Pro only)."""
    # Check limit
    current_count = (
        await db.execute(
            select(func.count(Alert.id)).where(Alert.user_id == user.id)
        )
    ).scalar() or 0

    limit = _ALERT_LIMITS.get(user.plan, 0)
    if current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Alert limit reached ({limit}). Upgrade your plan for more.",
        )

    alert_type = _ALERT_TYPE_MAP.get(body.alert_type)
    if not alert_type:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid alert_type. Valid values: {list(_ALERT_TYPE_MAP.keys())}",
        )

    channel = _CHANNEL_MAP.get(body.channel, AlertChannel.EMAIL)

    alert = Alert(
        id=uuid.uuid4(),
        user_id=user.id,
        alert_type=alert_type,
        config=body.config,
        channel=channel,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(alert)
    await db.flush()

    return AlertResponse(
        id=alert.id,
        alert_type=alert.alert_type.value,
        config=alert.config,
        channel=alert.channel.value,
        is_active=alert.is_active,
        last_triggered=alert.last_triggered,
        created_at=alert.created_at,
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@router.put("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: uuid.UUID,
    body: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Update an alert."""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if body.alert_type is not None:
        mapped = _ALERT_TYPE_MAP.get(body.alert_type)
        if not mapped:
            raise HTTPException(status_code=400, detail="Invalid alert_type")
        alert.alert_type = mapped
    if body.config is not None:
        alert.config = body.config
    if body.channel is not None:
        mapped_ch = _CHANNEL_MAP.get(body.channel)
        if not mapped_ch:
            raise HTTPException(status_code=400, detail="Invalid channel")
        alert.channel = mapped_ch
    if body.is_active is not None:
        alert.is_active = body.is_active

    await db.flush()

    return AlertResponse(
        id=alert.id,
        alert_type=alert.alert_type.value,
        config=alert.config,
        channel=alert.channel.value,
        is_active=alert.is_active,
        last_triggered=alert.last_triggered,
        created_at=alert.created_at,
    )


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Delete an alert."""
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    await db.delete(alert)


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


@router.get("/history", response_model=list[AlertHistoryResponse])
async def alert_history(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Return alert trigger history for the current user."""
    result = await db.execute(
        select(AlertHistory)
        .join(Alert, Alert.id == AlertHistory.alert_id)
        .where(Alert.user_id == user.id)
        .order_by(AlertHistory.triggered_at.desc())
        .limit(limit)
    )
    history = result.scalars().all()
    return [
        AlertHistoryResponse(
            id=h.id,
            alert_id=h.alert_id,
            triggered_at=h.triggered_at,
            payload=h.payload,
            read=h.read,
        )
        for h in history
    ]
