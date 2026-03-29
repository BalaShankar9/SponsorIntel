import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ChangeType, SponsorRating, SponsorType

if TYPE_CHECKING:
    from app.models.company import CompanyAlias, CompanyProfile
    from app.models.scoring import SponsorScore


class Sponsor(Base):
    __tablename__ = "sponsors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organisation_name: Mapped[str] = mapped_column(String(500), nullable=False)
    organisation_name_normalised: Mapped[str] = mapped_column(
        String(500), nullable=False, index=True
    )
    town_city: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    county: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    type_and_rating: Mapped[Optional[str]] = mapped_column(String(200))
    rating: Mapped[Optional[SponsorRating]] = mapped_column(
        Enum(SponsorRating), index=True
    )
    sponsor_type: Mapped[Optional[str]] = mapped_column(String(100))
    route: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    first_seen_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_seen_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    consecutive_a_rating_days: Mapped[int] = mapped_column(Integer, default=0)
    times_rating_changed: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    snapshots: Mapped[List["SponsorSnapshot"]] = relationship(
        back_populates="sponsor", cascade="all, delete-orphan"
    )
    changes: Mapped[List["SponsorChange"]] = relationship(
        back_populates="sponsor", cascade="all, delete-orphan"
    )
    profile: Mapped[Optional["CompanyProfile"]] = relationship(
        back_populates="sponsor", uselist=False
    )
    scores: Mapped[List["SponsorScore"]] = relationship(
        back_populates="sponsor", cascade="all, delete-orphan"
    )
    aliases: Mapped[List["CompanyAlias"]] = relationship(
        back_populates="sponsor", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "ix_sponsors_name_trgm",
            "organisation_name_normalised",
            postgresql_using="gin",
            postgresql_ops={"organisation_name_normalised": "gin_trgm_ops"},
        ),
    )

    def __repr__(self) -> str:
        return f"<Sponsor(id={self.id}, name='{self.organisation_name}')>"


class CsvImport(Base):
    __tablename__ = "csv_imports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000))
    checksum_md5: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    added_count: Mapped[int] = mapped_column(Integer, default=0)
    removed_count: Mapped[int] = mapped_column(Integer, default=0)
    changed_count: Mapped[int] = mapped_column(Integer, default=0)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_auto: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    snapshots: Mapped[List["SponsorSnapshot"]] = relationship(back_populates="csv_import")
    changes: Mapped[List["SponsorChange"]] = relationship(back_populates="csv_import")

    def __repr__(self) -> str:
        return f"<CsvImport(id={self.id}, filename='{self.filename}')>"


class SponsorSnapshot(Base):
    __tablename__ = "sponsor_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), nullable=False, index=True
    )
    csv_import_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("csv_imports.id"), nullable=False
    )
    snapshot_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    organisation_name: Mapped[str] = mapped_column(String(500), nullable=False)
    town_city: Mapped[Optional[str]] = mapped_column(String(200))
    county: Mapped[Optional[str]] = mapped_column(String(200))
    type_and_rating: Mapped[Optional[str]] = mapped_column(String(200))
    route: Mapped[Optional[list]] = mapped_column(ARRAY(String))

    # Relationships
    sponsor: Mapped["Sponsor"] = relationship(back_populates="snapshots")
    csv_import: Mapped["CsvImport"] = relationship(back_populates="snapshots")


class SponsorChange(Base):
    __tablename__ = "sponsor_changes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), nullable=False, index=True
    )
    csv_import_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("csv_imports.id")
    )
    change_type: Mapped[ChangeType] = mapped_column(
        Enum(ChangeType), nullable=False, index=True
    )
    field_changed: Mapped[Optional[str]] = mapped_column(String(100))
    old_value: Mapped[Optional[str]] = mapped_column(Text)
    new_value: Mapped[Optional[str]] = mapped_column(Text)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    significance_score: Mapped[Optional[int]] = mapped_column(Integer)

    # Relationships
    sponsor: Mapped["Sponsor"] = relationship(back_populates="changes")
    csv_import: Mapped[Optional["CsvImport"]] = relationship(back_populates="changes")
