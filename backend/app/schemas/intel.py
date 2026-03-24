"""Intel feature Pydantic V2 schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---- Enums as literals (avoid DB-level Enum migration churn) ----

SourceCategory = str  # "government" | "legal" | "news" | "community"
IntelTopic = str      # "rule_change" | "policy_update" | "court_decision" | "statistics" | "opinion" | "news" | "community"
ImpactLevel = str     # "critical" | "high" | "medium" | "low"
PolicyStage = str     # "proposed" | "consultation" | "parliamentary_debate" | "enacted" | "effective"
NotifChannel = str    # "in_app" | "email_instant" | "email_digest"

VALID_TOPICS = {"rule_change", "policy_update", "court_decision", "statistics", "opinion", "news", "community"}
VALID_IMPACTS = {"critical", "high", "medium", "low"}
VALID_STAGES = {"proposed", "consultation", "parliamentary_debate", "enacted", "effective"}
VALID_CHANNELS = {"in_app", "email_instant", "email_digest"}


class IntelItemBase(BaseModel):
    title: str = Field(..., max_length=1000)
    source_name: str = Field(..., max_length=200)
    source_url: Optional[str] = Field(None, max_length=2000)
    source_category: SourceCategory
    published_at: Optional[datetime] = None
    content_snippet: Optional[str] = Field(None, max_length=500)

    @field_validator("source_category")
    @classmethod
    def validate_source_category(cls, v: str) -> str:
        if v not in {"government", "legal", "news", "community"}:
            raise ValueError("source_category must be one of: government, legal, news, community")
        return v


class IntelItemSummary(IntelItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    topic: Optional[IntelTopic] = None
    impact_level: Optional[ImpactLevel] = None
    visa_routes_affected: Optional[list[str]] = None
    summary: Optional[str] = None
    status: str
    created_at: datetime


class IntelItemDetail(IntelItemSummary):
    content_text: Optional[str] = None
    nationalities_affected: Optional[list[str]] = None
    industries_affected: Optional[list[str]] = None
    who_affected: Optional[str] = None
    action_required: Optional[str] = None
    before_after: Optional[dict] = None
    dedup_cluster_id: Optional[uuid.UUID] = None
    scanner_agent: Optional[str] = None
    updated_at: datetime


class IntelFeedResponse(BaseModel):
    data: list[IntelItemSummary]
    total: int
    page: int = Field(..., ge=1)
    pages: int = Field(..., ge=0)
    per_page: int = Field(20, ge=1, le=100)


class IntelFeedQuery(BaseModel):
    topic: Optional[IntelTopic] = None
    impact: Optional[ImpactLevel] = None
    visa_route: Optional[str] = None
    nationality: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TOPICS:
            raise ValueError(f"topic must be one of: {VALID_TOPICS}")
        return v

    @field_validator("impact")
    @classmethod
    def validate_impact(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_IMPACTS:
            raise ValueError(f"impact must be one of: {VALID_IMPACTS}")
        return v


class TimelineNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    published_at: Optional[datetime] = None
    impact_level: Optional[ImpactLevel] = None
    visa_routes_affected: Optional[list[str]] = None
    summary: Optional[str] = None
    before_after: Optional[dict] = None


class TimelineResponse(BaseModel):
    nodes: list[TimelineNode]
    total: int


class IntelCalendarEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    event_date: date
    event_type: Optional[str] = None
    visa_routes: Optional[list[str]] = None
    source_url: Optional[str] = Field(None, max_length=2000)
    is_confirmed: bool = True


class CalendarResponse(BaseModel):
    events: list[IntelCalendarEvent]
    month: int = Field(..., ge=1, le=12)
    year: int


class IntelStatistic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    stat_type: str = Field(..., max_length=100)
    visa_route: Optional[str] = Field(None, max_length=100)
    nationality: Optional[str] = Field(None, max_length=100)
    period: Optional[str] = Field(None, max_length=20)
    value: float
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    source: Optional[str] = Field(None, max_length=200)
    published_at: Optional[datetime] = None


class StatsResponse(BaseModel):
    statistics: list[IntelStatistic]
    total: int
    visa_route: Optional[str] = None


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    stage: PolicyStage
    visa_routes_affected: Optional[list[str]] = None
    source_url: Optional[str] = Field(None, max_length=2000)
    effective_date: Optional[date] = None
    last_update_summary: Optional[str] = None
    last_updated_at: Optional[datetime] = None
    created_at: datetime
    is_followed: bool = False

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        if v not in VALID_STAGES:
            raise ValueError(f"stage must be one of: {VALID_STAGES}")
        return v


class PolicyListResponse(BaseModel):
    policies: list[PolicyResponse]
    total: int


class SubscriptionCreate(BaseModel):
    filter_topics: Optional[list[str]] = None
    filter_visa_routes: Optional[list[str]] = None
    filter_nationalities: Optional[list[str]] = None
    filter_industries: Optional[list[str]] = None
    filter_min_impact: ImpactLevel = "medium"
    channel: NotifChannel = "in_app"

    @field_validator("filter_topics")
    @classmethod
    def validate_topics(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None:
            invalid = set(v) - VALID_TOPICS
            if invalid:
                raise ValueError(f"Invalid topics: {invalid}")
        return v

    @field_validator("filter_min_impact")
    @classmethod
    def validate_min_impact(cls, v: str) -> str:
        if v not in VALID_IMPACTS:
            raise ValueError(f"filter_min_impact must be one of: {VALID_IMPACTS}")
        return v

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        if v not in VALID_CHANNELS:
            raise ValueError(f"channel must be one of: {VALID_CHANNELS}")
        return v


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    filter_topics: Optional[list[str]] = None
    filter_visa_routes: Optional[list[str]] = None
    filter_nationalities: Optional[list[str]] = None
    filter_industries: Optional[list[str]] = None
    filter_min_impact: str
    channel: str
    is_active: bool
    created_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    intel_item_id: Optional[uuid.UUID] = None
    subscription_id: Optional[uuid.UUID] = None
    title: str = Field(..., max_length=500)
    body: Optional[str] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime
    item_impact_level: Optional[ImpactLevel] = None
    item_source_name: Optional[str] = None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    pages: int


class DigestSection(BaseModel):
    heading: str
    items: list[IntelItemSummary]


class DigestPreviewResponse(BaseModel):
    subject: str
    generated_at: datetime
    top_items: list[IntelItemSummary]
    statistics_snapshot: list[IntelStatistic]
    upcoming_calendar: list[IntelCalendarEvent]
    personalized_items: list[IntelItemSummary]
    sections: list[DigestSection]


class LawyerSearchRequest(BaseModel):
    visa_route: str = Field(..., min_length=2, max_length=100)
    nationality: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=200)
    case_complexity: str = Field("straightforward", pattern="^(straightforward|complex|appeal)$")
    budget_range: str | None = Field(None, max_length=100)
    language_pref: str | None = Field(None, max_length=100)
    page: int = Field(1, ge=1)
    per_page: int = Field(10, ge=1, le=20)


class LawyerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    firm_name: str | None
    registration_type: str
    registration_number: str
    oisc_level: int | None
    accreditations: list[str]
    practice_areas: list[str]
    city: str | None
    offers_remote: bool
    combined_rating: float | None
    google_review_count: int
    trustpilot_review_count: int
    fee_initial_consultation: str | None
    fee_hourly_range: str | None
    website: str | None
    distance_miles: float | None = None
    match_score: float
    why_matched: str


class LawyerSearchResponse(BaseModel):
    results: list[LawyerSummary]
    total: int
    page: int
    per_page: int
    search_id: UUID


class LawyerDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    firm_name: str | None
    registration_type: str
    registration_number: str
    oisc_level: int | None
    practising_status: str
    accreditations: list[str]
    practice_areas: list[str]
    languages: list[str]
    fee_initial_consultation: str | None
    fee_hourly_range: str | None
    fee_fixed_range: str | None
    offers_legal_aid: bool
    address: str | None
    city: str | None
    postcode: str | None
    offers_remote: bool
    google_rating: float | None
    google_review_count: int
    trustpilot_rating: float | None
    trustpilot_review_count: int
    combined_rating: float | None
    website: str | None
    email: str | None
    phone: str | None
    bio: str | None
    profile_photo_url: str | None
    disciplinary_history: list[dict]
    last_verified_at: datetime | None
    source_url: str | None


class LawyerReviewItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    source: str
    author_name: str | None
    rating: float
    review_text: str | None
    review_date: datetime | None
    visa_route_mentioned: str | None
    sentiment: str | None


class LawyerReviewsResponse(BaseModel):
    reviews: list[LawyerReviewItem]
    total: int
    page: int
    per_page: int
    avg_rating: float | None


class LawyerCompareResponse(BaseModel):
    lawyers: list[LawyerDetail]
    comparison_dimensions: list[str]
