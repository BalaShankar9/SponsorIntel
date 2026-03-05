import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.sponsor import Sponsor


class SponsorScore(Base):
    __tablename__ = "sponsor_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), nullable=False, index=True
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)

    # Factor scores
    compliance_score: Mapped[Optional[int]] = mapped_column(Integer)
    financial_health_score: Mapped[Optional[int]] = mapped_column(Integer)
    hiring_activity_score: Mapped[Optional[int]] = mapped_column(Integer)
    reputation_score: Mapped[Optional[int]] = mapped_column(Integer)
    legitimacy_score: Mapped[Optional[int]] = mapped_column(Integer)
    track_record_score: Mapped[Optional[int]] = mapped_column(Integer)
    growth_signal_score: Mapped[Optional[int]] = mapped_column(Integer)

    risk_flags: Mapped[Optional[dict]] = mapped_column(JSONB)
    score_version: Mapped[Optional[int]] = mapped_column(Integer, default=1)

    # Relationship
    sponsor: Mapped["Sponsor"] = relationship(back_populates="scores")

    def __repr__(self) -> str:
        return f"<SponsorScore(sponsor_id={self.sponsor_id}, overall={self.overall_score})>"
