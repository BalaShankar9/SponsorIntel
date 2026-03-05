"""Tests for database models and enums."""
import uuid
from datetime import datetime

import pytest

from app.models.enums import (
    AlertChannel,
    AlertType,
    ApplicationStatus,
    ChangeType,
    ContractType,
    EnrichmentLevel,
    EventType,
    JobSource,
    ReviewSource,
    Seniority,
    Severity,
    SponsorRating,
    SponsorType,
    SubscriptionStatus,
    UserPlan,
)
from app.models.sponsor import Sponsor, CsvImport, SponsorSnapshot, SponsorChange
from app.models.company import CompanyProfile, CompanyOfficer, CompanyAlias
from app.models.job import Job, SalaryBenchmark, ShortageOccupation
from app.models.scoring import SponsorScore
from app.models.event import Event
from app.models.user import User, Alert, WatchlistItem


class TestSponsorModel:
    """Test Sponsor model instantiation."""

    def test_sponsor_can_be_instantiated(self):
        sponsor = Sponsor(
            organisation_name="Acme Ltd",
            organisation_name_normalised="acme ltd",
        )
        assert sponsor.organisation_name == "Acme Ltd"
        assert sponsor.organisation_name_normalised == "acme ltd"

    def test_sponsor_has_name_normalised_field(self):
        """Verify the normalised name field exists on the model."""
        columns = Sponsor.__table__.columns
        assert "organisation_name_normalised" in columns
        assert columns["organisation_name_normalised"].index is True

    def test_sponsor_defaults(self):
        sponsor = Sponsor(
            organisation_name="Test Corp",
            organisation_name_normalised="test corp",
        )
        assert sponsor.is_active is None or sponsor.is_active is True
        assert sponsor.consecutive_a_rating_days is None or sponsor.consecutive_a_rating_days == 0
        assert sponsor.times_rating_changed is None or sponsor.times_rating_changed == 0

    def test_sponsor_table_name(self):
        assert Sponsor.__tablename__ == "sponsors"

    def test_sponsor_has_trgm_index(self):
        """Verify the GIN trigram index is defined."""
        index_names = [idx.name for idx in Sponsor.__table__.indexes]
        assert "ix_sponsors_name_trgm" in index_names


class TestEnumValues:
    """Test all enum values exist and are correct."""

    def test_sponsor_rating(self):
        assert SponsorRating.A.value == "A"
        assert SponsorRating.B.value == "B"
        assert len(SponsorRating) == 2

    def test_sponsor_type(self):
        assert SponsorType.WORKER.value == "Worker"
        assert SponsorType.TEMPORARY_WORKER.value == "Temporary Worker"
        assert len(SponsorType) == 2

    def test_change_type(self):
        expected = {
            "added", "removed", "rating_upgrade", "rating_downgrade",
            "route_added", "route_removed", "location_change",
            "name_change", "reactivated",
        }
        actual = {ct.value for ct in ChangeType}
        assert actual == expected

    def test_event_type(self):
        expected = {
            "sponsor_added", "sponsor_removed", "rating_change",
            "new_job_detected", "job_expired", "company_enriched",
            "news_detected", "risk_flag_raised", "risk_flag_cleared",
            "score_changed", "csv_imported", "filing_detected",
            "officer_change", "insolvency_event",
        }
        actual = {et.value for et in EventType}
        assert actual == expected

    def test_severity(self):
        assert Severity.INFO.value == "info"
        assert Severity.WARNING.value == "warning"
        assert Severity.CRITICAL.value == "critical"

    def test_job_source(self):
        expected = {
            "reed", "adzuna", "indeed", "linkedin", "glassdoor",
            "totaljobs", "cwjobs", "gov_findajob", "guardian",
            "nhs_jobs", "career_page",
        }
        actual = {js.value for js in JobSource}
        assert actual == expected

    def test_contract_type(self):
        expected = {"permanent", "contract", "temporary", "apprenticeship"}
        actual = {ct.value for ct in ContractType}
        assert actual == expected

    def test_seniority(self):
        expected = {"entry", "mid", "senior", "lead", "director", "executive"}
        actual = {s.value for s in Seniority}
        assert actual == expected

    def test_user_plan(self):
        assert UserPlan.FREE.value == "free"
        assert UserPlan.PRO.value == "pro"
        assert UserPlan.ENTERPRISE.value == "enterprise"

    def test_subscription_status(self):
        expected = {"active", "cancelled", "past_due", "trialing"}
        actual = {ss.value for ss in SubscriptionStatus}
        assert actual == expected

    def test_application_status(self):
        expected = {"watching", "applied", "interviewing", "offered", "rejected", "withdrawn"}
        actual = {a.value for a in ApplicationStatus}
        assert actual == expected

    def test_alert_type(self):
        expected = {
            "new_sponsor", "rating_change", "new_job",
            "company_news", "risk_flag", "sponsor_removed", "score_change",
        }
        actual = {at.value for at in AlertType}
        assert actual == expected

    def test_alert_channel(self):
        expected = {"email", "in_app", "both"}
        actual = {ac.value for ac in AlertChannel}
        assert actual == expected

    def test_review_source(self):
        expected = {"glassdoor", "trustpilot", "google"}
        actual = {rs.value for rs in ReviewSource}
        assert actual == expected

    def test_enrichment_level(self):
        values = {el.value for el in EnrichmentLevel}
        assert values == {0, 1, 2, 3, 4, 5}


class TestOtherModels:
    """Test other model instantiation."""

    def test_user_can_be_instantiated(self):
        user = User(email="test@example.com", name="Test User")
        assert user.email == "test@example.com"

    def test_event_table_name(self):
        assert Event.__tablename__ == "events"

    def test_job_table_has_unique_constraint(self):
        constraints = [c.name for c in Job.__table__.constraints if hasattr(c, "name")]
        assert "uq_jobs_source_source_job_id" in constraints

    def test_sponsor_score_fields(self):
        columns = SponsorScore.__table__.columns
        factor_cols = [
            "compliance_score", "financial_health_score",
            "hiring_activity_score", "reputation_score",
            "legitimacy_score", "track_record_score", "growth_signal_score",
        ]
        for col in factor_cols:
            assert col in columns, f"Missing column: {col}"

    def test_company_profile_has_50_plus_columns(self):
        col_count = len(CompanyProfile.__table__.columns)
        assert col_count >= 50, f"CompanyProfile has only {col_count} columns, expected 50+"
