import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ContractType, Seniority


class JobDedupCluster(Base):
    __tablename__ = "job_dedup_clusters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    canonical_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    source_count: Mapped[int] = mapped_column(Integer, default=1)
    sources: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    jobs: Mapped[List["Job"]] = relationship(back_populates="dedup_cluster")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sponsor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), index=True
    )

    # Source
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_job_id: Mapped[Optional[str]] = mapped_column(String(200))

    # Title
    title_raw: Mapped[str] = mapped_column(String(500), nullable=False)
    title_normalised: Mapped[Optional[str]] = mapped_column(String(500), index=True)
    soc_code: Mapped[Optional[str]] = mapped_column(String(20), index=True)

    # Company
    company_name_raw: Mapped[str] = mapped_column(String(500), nullable=False)
    company_name_normalised: Mapped[Optional[str]] = mapped_column(
        String(500), index=True
    )

    # Location
    location_raw: Mapped[Optional[str]] = mapped_column(String(500))
    location_city: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    location_region: Mapped[Optional[str]] = mapped_column(String(200))
    location_is_remote: Mapped[bool] = mapped_column(Boolean, default=False)

    # Salary
    salary_min: Mapped[Optional[float]] = mapped_column(Float)
    salary_max: Mapped[Optional[float]] = mapped_column(Float)
    salary_currency: Mapped[Optional[str]] = mapped_column(String(10), default="GBP")
    salary_period: Mapped[Optional[str]] = mapped_column(String(20))
    salary_text_raw: Mapped[Optional[str]] = mapped_column(String(200))

    # Classification
    contract_type: Mapped[Optional[str]] = mapped_column(String(50))
    seniority: Mapped[Optional[str]] = mapped_column(String(50))

    # Description
    description_full: Mapped[Optional[str]] = mapped_column(Text)
    description_snippet: Mapped[Optional[str]] = mapped_column(String(1000))

    # Sponsorship signals
    sponsorship_likelihood: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    sponsorship_signals: Mapped[Optional[dict]] = mapped_column(JSONB)
    is_on_shortage_list: Mapped[Optional[bool]] = mapped_column(Boolean)
    meets_salary_threshold: Mapped[Optional[bool]] = mapped_column(Boolean)

    # Skills
    skills_extracted: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    experience_years_min: Mapped[Optional[int]] = mapped_column(Integer)
    experience_years_max: Mapped[Optional[int]] = mapped_column(Integer)

    # Source URL
    source_url: Mapped[Optional[str]] = mapped_column(String(2000))

    # Dates
    posted_date: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False)
    days_open: Mapped[Optional[int]] = mapped_column(Integer)

    # Dedup
    dedup_cluster_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_dedup_clusters.id")
    )
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    dedup_cluster: Mapped[Optional["JobDedupCluster"]] = relationship(
        back_populates="jobs"
    )

    __table_args__ = (
        UniqueConstraint("source", "source_job_id", name="uq_jobs_source_source_job_id"),
    )

    def __repr__(self) -> str:
        return f"<Job(id={self.id}, title='{self.title_raw}')>"


class SalaryBenchmark(Base):
    __tablename__ = "salary_benchmarks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    soc_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title_normalised: Mapped[str] = mapped_column(String(500), nullable=False)
    location_region: Mapped[Optional[str]] = mapped_column(String(200))
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    p10: Mapped[Optional[float]] = mapped_column(Float)
    p25: Mapped[Optional[float]] = mapped_column(Float)
    median: Mapped[Optional[float]] = mapped_column(Float)
    p75: Mapped[Optional[float]] = mapped_column(Float)
    p90: Mapped[Optional[float]] = mapped_column(Float)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[Optional[str]] = mapped_column(String(100))
    meets_visa_threshold: Mapped[Optional[bool]] = mapped_column(Boolean)
    visa_salary_threshold: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class ShortageOccupation(Base):
    __tablename__ = "shortage_occupations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    soc_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    job_title: Mapped[str] = mapped_column(String(500), nullable=False)
    salary_threshold: Mapped[Optional[float]] = mapped_column(Float)
    standard_threshold: Mapped[Optional[float]] = mapped_column(Float)
    effective_from: Mapped[Optional[datetime]] = mapped_column(DateTime)
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
