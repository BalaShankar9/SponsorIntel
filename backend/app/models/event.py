import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import EventType, Severity


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB)
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity), nullable=False, default=Severity.INFO
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_events_type_created", "event_type", "created_at"),
        Index("ix_events_entity", "entity_type", "entity_id"),
    )

    def __repr__(self) -> str:
        return f"<Event(id={self.id}, type={self.event_type})>"
