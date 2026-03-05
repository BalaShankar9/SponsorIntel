"""
Tests for the 7-factor sponsor scoring engine.
"""

from unittest.mock import MagicMock
from datetime import datetime, timedelta

from app.models.enums import SponsorRating
from app.services.scoring import (
    _clamp,
    compute_compliance_score,
    compute_financial_health_score,
    compute_growth_signal_score,
    compute_hiring_activity_score,
    compute_legitimacy_score,
    compute_reputation_score,
    compute_track_record_score,
    detect_risk_flags,
)


def _make_sponsor(**kwargs):
    """Create a mock Sponsor with sensible defaults."""
    sponsor = MagicMock()
    sponsor.rating = kwargs.get("rating", SponsorRating.A)
    sponsor.consecutive_a_rating_days = kwargs.get("consecutive_a_rating_days", 0)
    sponsor.times_rating_changed = kwargs.get("times_rating_changed", 0)
    sponsor.first_seen_date = kwargs.get("first_seen_date", datetime.utcnow() - timedelta(days=365))
    sponsor.is_active = kwargs.get("is_active", True)
    return sponsor


def _make_profile(**kwargs):
    """Create a mock CompanyProfile with sensible defaults."""
    profile = MagicMock()
    profile.company_status = kwargs.get("company_status", "active")
    profile.has_insolvency_history = kwargs.get("has_insolvency_history", False)
    profile.has_ccjs = kwargs.get("has_ccjs", False)
    profile.accounts_overdue = kwargs.get("accounts_overdue", False)
    profile.has_charges = kwargs.get("has_charges", False)
    profile.charge_count = kwargs.get("charge_count", 0)
    profile.glassdoor_rating = kwargs.get("glassdoor_rating", None)
    profile.glassdoor_review_count = kwargs.get("glassdoor_review_count", None)
    profile.trustpilot_rating = kwargs.get("trustpilot_rating", None)
    profile.trustpilot_review_count = kwargs.get("trustpilot_review_count", None)
    profile.google_rating = kwargs.get("google_rating", None)
    profile.google_review_count = kwargs.get("google_review_count", None)
    profile.website_url = kwargs.get("website_url", None)
    profile.has_careers_page = kwargs.get("has_careers_page", False)
    profile.website_domain_age_days = kwargs.get("website_domain_age_days", 0)
    profile.employee_count_estimate = kwargs.get("employee_count_estimate", 0)
    profile.social_links = kwargs.get("social_links", {})
    profile.employee_growth_12m = kwargs.get("employee_growth_12m", None)
    profile.confirmation_statement_overdue = kwargs.get("confirmation_statement_overdue", False)
    return profile


class TestClamp:
    def test_clamp_within_range(self):
        assert _clamp(50) == 50

    def test_clamp_below(self):
        assert _clamp(-10) == 0

    def test_clamp_above(self):
        assert _clamp(150) == 100


class TestComplianceScore:
    def test_a_rating_boost(self):
        sponsor = _make_sponsor(rating=SponsorRating.A)
        score = compute_compliance_score(sponsor)
        assert score == 90  # 50 + 40

    def test_b_rating_penalty(self):
        sponsor = _make_sponsor(rating=SponsorRating.B)
        score = compute_compliance_score(sponsor)
        assert score == 20  # 50 - 30

    def test_long_a_rating_bonus(self):
        sponsor = _make_sponsor(
            rating=SponsorRating.A,
            consecutive_a_rating_days=400,
        )
        score = compute_compliance_score(sponsor)
        assert score == 100  # 50 + 40 + 15, clamped to 100

    def test_very_long_a_rating_bonus(self):
        sponsor = _make_sponsor(
            rating=SponsorRating.A,
            consecutive_a_rating_days=800,
        )
        score = compute_compliance_score(sponsor)
        assert score == 100  # 50 + 40 + 25, clamped to 100

    def test_frequent_changes_penalty(self):
        sponsor = _make_sponsor(
            rating=SponsorRating.A,
            times_rating_changed=3,
        )
        score = compute_compliance_score(sponsor)
        assert score == 75  # 50 + 40 - 15


class TestFinancialHealthScore:
    def test_no_profile(self):
        assert compute_financial_health_score(None) == 50

    def test_active_company(self):
        profile = _make_profile(company_status="active")
        assert compute_financial_health_score(profile) == 65

    def test_insolvency_penalty(self):
        profile = _make_profile(has_insolvency_history=True)
        assert compute_financial_health_score(profile) == 35  # 50 + 15 - 30

    def test_all_negative_flags(self):
        profile = _make_profile(
            has_insolvency_history=True,
            has_ccjs=True,
            accounts_overdue=True,
            has_charges=True,
            charge_count=10,
        )
        score = compute_financial_health_score(profile)
        assert score == 0  # 50 + 15 - 30 - 20 - 25 - 10 = -20, clamped


class TestHiringActivityScore:
    def test_no_jobs(self):
        assert compute_hiring_activity_score(0, 0) == 20

    def test_some_jobs(self):
        score = compute_hiring_activity_score(5, 3)
        assert score == 64  # 30 + 25 + 9

    def test_many_jobs_capped(self):
        score = compute_hiring_activity_score(20, 15)
        # 30 + min(100, 40) + min(45, 20) = 30 + 40 + 20 = 90
        assert score == 90


class TestReputationScore:
    def test_no_profile(self):
        assert compute_reputation_score(None) == 50

    def test_no_ratings(self):
        profile = _make_profile()
        assert compute_reputation_score(profile) == 50

    def test_perfect_glassdoor(self):
        profile = _make_profile(glassdoor_rating=5.0, glassdoor_review_count=200)
        score = compute_reputation_score(profile)
        assert score == 100

    def test_low_glassdoor(self):
        profile = _make_profile(glassdoor_rating=1.0, glassdoor_review_count=100)
        score = compute_reputation_score(profile)
        assert score == 0


class TestLegitimacyScore:
    def test_no_profile(self):
        assert compute_legitimacy_score(None) == 40

    def test_full_presence(self):
        profile = _make_profile(
            website_url="https://example.com",
            has_careers_page=True,
            website_domain_age_days=1200,
            employee_count_estimate=200,
            social_links={"linkedin": "x", "twitter": "y"},
        )
        score = compute_legitimacy_score(profile)
        assert score == 100  # 30 + 15 + 15 + 15 + 15 + 10 = 100

    def test_minimal_profile(self):
        profile = _make_profile()
        score = compute_legitimacy_score(profile)
        assert score == 30  # just the base


class TestTrackRecordScore:
    def test_new_sponsor(self):
        sponsor = _make_sponsor(first_seen_date=datetime.utcnow())
        score = compute_track_record_score(sponsor)
        # 30 + 0 years + 20 (never changed, A rating) = 50
        assert score == 50

    def test_long_tenure_never_b(self):
        sponsor = _make_sponsor(
            first_seen_date=datetime.utcnow() - timedelta(days=int(365.25 * 8)),
            times_rating_changed=0,
            rating=SponsorRating.A,
        )
        score = compute_track_record_score(sponsor)
        # 30 + 30 (capped at 30) + 20 = 80
        assert score == 80


class TestGrowthSignalScore:
    def test_no_profile(self):
        score = compute_growth_signal_score(None, 0.0)
        assert score == 30

    def test_positive_growth_and_jobs(self):
        profile = _make_profile(employee_growth_12m=0.15)
        score = compute_growth_signal_score(profile, 1.0)
        # 30 + 15 + 20 = 65
        assert score == 65

    def test_negative_growth(self):
        profile = _make_profile(employee_growth_12m=-0.2)
        score = compute_growth_signal_score(profile, 0.0)
        # 30 + max(-10, -20) = 30 - 10 = 20
        assert score == 20


class TestRiskFlags:
    def test_b_rating_flag(self):
        sponsor = _make_sponsor(rating=SponsorRating.B)
        flags = detect_risk_flags(sponsor, None)
        assert "B_rating" in flags

    def test_no_profile_flag(self):
        sponsor = _make_sponsor()
        flags = detect_risk_flags(sponsor, None)
        assert "no_company_profile" in flags

    def test_accounts_overdue_flag(self):
        sponsor = _make_sponsor()
        profile = _make_profile(accounts_overdue=True)
        flags = detect_risk_flags(sponsor, profile)
        assert "accounts_overdue" in flags

    def test_insolvency_flag(self):
        sponsor = _make_sponsor()
        profile = _make_profile(has_insolvency_history=True)
        flags = detect_risk_flags(sponsor, profile)
        assert "insolvency_history" in flags

    def test_no_website_flag(self):
        sponsor = _make_sponsor()
        profile = _make_profile(website_url=None)
        flags = detect_risk_flags(sponsor, profile)
        assert "no_website" in flags

    def test_inactive_flag(self):
        sponsor = _make_sponsor(is_active=False)
        profile = _make_profile()
        flags = detect_risk_flags(sponsor, profile)
        assert "sponsor_inactive" in flags


class TestWeightedAverage:
    def test_weights_sum_to_one(self):
        from app.services.scoring import _WEIGHTS
        total = sum(_WEIGHTS.values())
        assert abs(total - 1.0) < 0.001
