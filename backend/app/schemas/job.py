"""
Pydantic schemas for job-related endpoints.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class JobListItem(BaseModel):
    id: UUID
    title_raw: str
    company_name_raw: str
    location_raw: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_text_raw: str | None = None
    source: str
    sponsorship_likelihood: int | None = None
    posted_date: datetime | None = None
    url: str | None = None
    is_on_shortage_list: bool | None = False

    model_config = {"from_attributes": True}


class JobDetail(JobListItem):
    description_full: str | None = None
    skills_extracted: list[str] | None = None
    sponsorship_signals: dict | None = None
    contract_type: str | None = None
    seniority: str | None = None
    location_city: str | None = None
    location_region: str | None = None
    location_is_remote: bool = False
    salary_currency: str | None = None
    salary_period: str | None = None
    experience_years_min: int | None = None
    experience_years_max: int | None = None
    meets_salary_threshold: bool | None = None
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    is_expired: bool = False
    sponsor_id: UUID | None = None

    model_config = {"from_attributes": True}


class PaginatedJobs(BaseModel):
    data: list[JobListItem]
    total: int
    page: int
    pages: int


class JobStats(BaseModel):
    total_active: int
    new_7_days: int
    sponsorship_likely_count: int
    median_salary: float | None = None
    by_source: dict[str, int]
    by_city: list[dict]
