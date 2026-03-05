import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EnrichmentLevel, ReviewSource

if TYPE_CHECKING:
    from app.models.sponsor import Sponsor


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sponsors.id"),
        unique=True,
        nullable=False,
        index=True,
    )

    # --- Companies House ---
    companies_house_number: Mapped[Optional[str]] = mapped_column(
        String(20), index=True
    )
    company_status: Mapped[Optional[str]] = mapped_column(String(50))
    incorporation_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    company_type: Mapped[Optional[str]] = mapped_column(String(100))
    sic_codes: Mapped[Optional[dict]] = mapped_column(JSONB)
    industry_primary: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    industry_tags: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    registered_address: Mapped[Optional[dict]] = mapped_column(JSONB)
    trading_address: Mapped[Optional[dict]] = mapped_column(JSONB)

    # --- Financial ---
    has_charges: Mapped[Optional[bool]] = mapped_column(Boolean)
    charge_count: Mapped[Optional[int]] = mapped_column(Integer)
    has_insolvency_history: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_ccjs: Mapped[Optional[bool]] = mapped_column(Boolean)
    last_accounts_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    next_accounts_due: Mapped[Optional[datetime]] = mapped_column(DateTime)
    accounts_overdue: Mapped[Optional[bool]] = mapped_column(Boolean)
    confirmation_statement_overdue: Mapped[Optional[bool]] = mapped_column(Boolean)
    estimated_revenue_band: Mapped[Optional[str]] = mapped_column(String(100))
    credit_risk_score: Mapped[Optional[int]] = mapped_column(Integer)

    # --- Workforce ---
    employee_count_estimate: Mapped[Optional[int]] = mapped_column(Integer)
    employee_count_source: Mapped[Optional[str]] = mapped_column(String(100))
    employee_growth_6m: Mapped[Optional[float]] = mapped_column(Float)
    employee_growth_12m: Mapped[Optional[float]] = mapped_column(Float)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500))
    linkedin_follower_count: Mapped[Optional[int]] = mapped_column(Integer)

    # --- Reputation ---
    glassdoor_rating: Mapped[Optional[float]] = mapped_column(Float)
    glassdoor_review_count: Mapped[Optional[int]] = mapped_column(Integer)
    glassdoor_ceo_approval: Mapped[Optional[float]] = mapped_column(Float)
    glassdoor_recommend_pct: Mapped[Optional[float]] = mapped_column(Float)
    trustpilot_rating: Mapped[Optional[float]] = mapped_column(Float)
    trustpilot_review_count: Mapped[Optional[int]] = mapped_column(Integer)
    google_rating: Mapped[Optional[float]] = mapped_column(Float)
    google_review_count: Mapped[Optional[int]] = mapped_column(Integer)

    # --- Online Presence ---
    website_url: Mapped[Optional[str]] = mapped_column(String(500))
    website_domain_age_days: Mapped[Optional[int]] = mapped_column(Integer)
    has_careers_page: Mapped[Optional[bool]] = mapped_column(Boolean)
    social_links: Mapped[Optional[dict]] = mapped_column(JSONB)
    tech_stack_detected: Mapped[Optional[list]] = mapped_column(ARRAY(String))

    # --- Meta ---
    legitimacy_score: Mapped[Optional[int]] = mapped_column(Integer)
    enrichment_level: Mapped[Optional[EnrichmentLevel]] = mapped_column(
        Enum(EnrichmentLevel)
    )
    enrichment_priority: Mapped[Optional[int]] = mapped_column(Integer)
    enriched_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    enrichment_version: Mapped[Optional[int]] = mapped_column(Integer)
    next_enrichment_due: Mapped[Optional[datetime]] = mapped_column(DateTime)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    sponsor: Mapped["Sponsor"] = relationship(back_populates="profile")
    officers: Mapped[List["CompanyOfficer"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    pscs: Mapped[List["CompanyPSC"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    news: Mapped[List["CompanyNews"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    reviews: Mapped[List["CompanyReview"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<CompanyProfile(id={self.id}, sponsor_id={self.sponsor_id})>"


class CompanyOfficer(Base):
    __tablename__ = "company_officers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("company_profiles.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    role: Mapped[Optional[str]] = mapped_column(String(200))
    appointed_on: Mapped[Optional[datetime]] = mapped_column(DateTime)
    resigned_on: Mapped[Optional[datetime]] = mapped_column(DateTime)
    nationality: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    other_directorships_count: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="officers")


class CompanyPSC(Base):
    __tablename__ = "company_pscs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("company_profiles.id"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    nationality: Mapped[Optional[str]] = mapped_column(String(100))
    country_of_residence: Mapped[Optional[str]] = mapped_column(String(100))
    natures_of_control: Mapped[Optional[dict]] = mapped_column(JSONB)
    notified_on: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ceased_on: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="pscs")


class CompanyNews(Base):
    __tablename__ = "company_news"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("company_profiles.id"),
        nullable=False,
        index=True,
    )
    headline: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(200))
    url: Mapped[Optional[str]] = mapped_column(String(1000))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float)
    keywords: Mapped[Optional[list]] = mapped_column(ARRAY(String))
    is_risk_signal: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="news")


class CompanyReview(Base):
    __tablename__ = "company_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("company_profiles.id"),
        nullable=False,
        index=True,
    )
    source: Mapped[ReviewSource] = mapped_column(Enum(ReviewSource), nullable=False)
    rating: Mapped[Optional[float]] = mapped_column(Float)
    title: Mapped[Optional[str]] = mapped_column(String(500))
    text_snippet: Mapped[Optional[str]] = mapped_column(Text)
    mentions_visa: Mapped[bool] = mapped_column(Boolean, default=False)
    mentions_sponsorship: Mapped[bool] = mapped_column(Boolean, default=False)
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))
    review_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="reviews")


class CompanyAlias(Base):
    __tablename__ = "company_aliases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sponsors.id"), nullable=False, index=True
    )
    alias_name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    alias_source: Mapped[Optional[str]] = mapped_column(String(100))
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    verified_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sponsor: Mapped["Sponsor"] = relationship(back_populates="aliases")
