"""
Pydantic schemas for sponsor-related endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SponsorBase(BaseModel):
    organisation_name: str
    town_city: str | None = None
    county: str | None = None
    type_and_rating: str | None = None
    rating: str | None = None
    route: list[str] | None = None
    is_active: bool


class SponsorListItem(SponsorBase):
    id: UUID
    first_seen_date: datetime | None = None
    last_seen_date: datetime | None = None
    overall_score: int | None = None
    active_job_count: int | None = None

    model_config = {"from_attributes": True}


class SponsorDetail(SponsorListItem):
    consecutive_a_rating_days: int = 0
    times_rating_changed: int = 0
    profile: CompanyProfileResponse | None = None
    score_breakdown: ScoreBreakdown | None = None


class SponsorChangeResponse(BaseModel):
    id: UUID
    change_type: str
    field_changed: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    detected_at: datetime
    significance_score: int | None = None

    model_config = {"from_attributes": True}


class PaginatedSponsors(BaseModel):
    data: list[SponsorListItem]
    total: int
    page: int
    pages: int


class CompanyProfileResponse(BaseModel):
    id: UUID
    sponsor_id: UUID

    # Companies House
    companies_house_number: str | None = None
    company_status: str | None = None
    incorporation_date: datetime | None = None
    company_type: str | None = None
    sic_codes: dict | None = None
    industry_primary: str | None = None
    industry_tags: list[str] | None = None
    registered_address: dict | None = None
    trading_address: dict | None = None

    # Financial
    has_charges: bool | None = None
    charge_count: int | None = None
    has_insolvency_history: bool | None = None
    has_ccjs: bool | None = None
    last_accounts_date: datetime | None = None
    next_accounts_due: datetime | None = None
    accounts_overdue: bool | None = None
    confirmation_statement_overdue: bool | None = None
    estimated_revenue_band: str | None = None
    credit_risk_score: int | None = None

    # Workforce
    employee_count_estimate: int | None = None
    employee_count_source: str | None = None
    employee_growth_6m: float | None = None
    employee_growth_12m: float | None = None
    linkedin_url: str | None = None
    linkedin_follower_count: int | None = None

    # Reputation
    glassdoor_rating: float | None = None
    glassdoor_review_count: int | None = None
    glassdoor_ceo_approval: float | None = None
    glassdoor_recommend_pct: float | None = None
    trustpilot_rating: float | None = None
    trustpilot_review_count: int | None = None
    google_rating: float | None = None
    google_review_count: int | None = None

    # Online Presence
    website_url: str | None = None
    website_domain_age_days: int | None = None
    has_careers_page: bool | None = None
    social_links: dict | None = None
    tech_stack_detected: list[str] | None = None

    # Meta
    legitimacy_score: int | None = None
    enrichment_level: int | None = None
    enriched_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScoreBreakdown(BaseModel):
    overall_score: int
    compliance_score: int | None = None
    financial_health_score: int | None = None
    hiring_activity_score: int | None = None
    reputation_score: int | None = None
    legitimacy_score: int | None = None
    track_record_score: int | None = None
    growth_signal_score: int | None = None
    risk_flags: list[str] | None = None
    computed_at: datetime

    model_config = {"from_attributes": True}
