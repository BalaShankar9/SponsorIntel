import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    AlertChannel,
    AlertType,
    ApplicationStatus,
    SubscriptionStatus,
    UserPlan,
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[Optional[str]] = mapped_column(String(200))
    name: Mapped[Optional[str]] = mapped_column(String(200))
    oauth_provider: Mapped[Optional[str]] = mapped_column(String(50))
    oauth_id: Mapped[Optional[str]] = mapped_column(String(200))
    plan: Mapped[UserPlan] = mapped_column(
        Enum(UserPlan), nullable=False, default=UserPlan.FREE
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    subscription: Mapped[Optional["Subscription"]] = relationship(
        back_populates="user", uselist=False
    )
    watchlist_items: Mapped[List["WatchlistItem"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    notes: Mapped[List["UserNote"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    alerts: Mapped[List["Alert"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}')>"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    plan: Mapped[UserPlan] = mapped_column(Enum(UserPlan), nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(200))
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(200))
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.ACTIVE
    )
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="subscription")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), nullable=False, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    priority: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[Optional[ApplicationStatus]] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.WATCHING
    )
    applied_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    next_followup: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="watchlist_items")


class UserNote(Base):
    __tablename__ = "user_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="notes")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    alert_type: Mapped[AlertType] = mapped_column(Enum(AlertType), nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSONB)
    channel: Mapped[AlertChannel] = mapped_column(
        Enum(AlertChannel), nullable=False, default=AlertChannel.IN_APP
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="alerts")
    history: Mapped[List["AlertHistory"]] = relationship(
        back_populates="alert", cascade="all, delete-orphan"
    )


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("alerts.id"), nullable=False, index=True
    )
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB)
    read: Mapped[bool] = mapped_column(Boolean, default=False)

    alert: Mapped["Alert"] = relationship(back_populates="history")
