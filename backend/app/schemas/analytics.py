"""
Pydantic schemas for analytics endpoints.
"""

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
