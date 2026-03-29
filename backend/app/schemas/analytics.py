"""
Pydantic schemas for analytics endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DashboardOverview(BaseModel):
    total_sponsors: int
    a_rated: int
    b_rated: int
    added_30d: int
    removed_30d: int
    changed_30d: int
    total_jobs: int
    total_enriched: int


class TrendPoint(BaseModel):
    date: str
    value: int


class RatingChanges(BaseModel):
    upgrades: int
    downgrades: int


class CityCount(BaseModel):
    city: str
    count: int


class IndustryCount(BaseModel):
    industry: str
    count: int


class HiringSponsor(BaseModel):
    id: str
    name: str
    job_count: int
    score: int | None = None


class AnalyticsTrends(BaseModel):
    sponsor_growth: list[TrendPoint]
    rating_changes: dict  # {upgrades: int, downgrades: int}
    top_cities: list[dict]
    top_industries: list[dict]
    top_hiring: list[dict]


class FilterOptions(BaseModel):
    cities: list[str]
    counties: list[str]
    routes: list[str]
    industries: list[str]


class EventResponse(BaseModel):
    id: str
    event_type: str
    entity_type: str
    entity_id: str
    payload: dict | None = None
    severity: str
    created_at: str


class PaginatedEvents(BaseModel):
    data: list[EventResponse]
    total: int
    page: int
    pages: int


class WebSocketEvent(BaseModel):
    """Event format for WebSocket broadcast."""
    id: str
    event_type: str
    severity: str
    title: str
    description: str
    sponsor_id: str | None = None
    sponsor_name: str | None = None
    created_at: str


class EngineStatus(BaseModel):
    last_csv_import: dict
    scraper_health: dict
    success_rate_pct: float
    jobs_scraped_24h: dict
    total_sponsors: int
    total_jobs: int


class EnrichmentProgress(BaseModel):
    total_profiles: int
    enriched: int
    not_enriched: int
    by_level: dict
    failed: int


class CsvImportRecord(BaseModel):
    id: str
    filename: str
    source_url: str | None = None
    checksum_md5: str
    record_count: int
    added_count: int
    removed_count: int
    changed_count: int
    imported_at: str
    is_auto: bool


class PaginatedImports(BaseModel):
    data: list[CsvImportRecord]
    total: int
    page: int
    pages: int
