"""
7-factor sponsor scoring engine.

Each factor returns 0-100. The composite score is a weighted average.
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import CompanyProfile
from app.models.enums import SponsorRating
from app.models.job import Job
from app.models.scoring import SponsorScore
from app.models.sponsor import Sponsor


def _clamp(value: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Factor 1: Compliance
# ---------------------------------------------------------------------------

def compute_compliance_score(sponsor: Sponsor) -> int:
    """Compliance score based on rating history."""
    score = 50

    if sponsor.rating == SponsorRating.A:
        score += 40
    elif sponsor.rating == SponsorRating.B:
        score -= 30

    days = sponsor.consecutive_a_rating_days or 0
    if days > 730:
        score += 25
    elif days > 365:
        score += 15

    if (sponsor.times_rating_changed or 0) > 2:
        score -= 15

    return _clamp(score)


# ---------------------------------------------------------------------------
# Factor 2: Financial Health
# ---------------------------------------------------------------------------

def compute_financial_health_score(profile: Optional[CompanyProfile]) -> int:
    """Financial health based on Companies House data."""
    if not profile:
        return 50

    score = 50

    if profile.company_status and profile.company_status.lower() == "active":
        score += 15

    if profile.has_insolvency_history:
        score -= 30

    if profile.has_ccjs:
        score -= 20

    if profile.accounts_overdue:
        score -= 25

    if profile.has_charges and (profile.charge_count or 0) > 5:
        score -= 10

    return _clamp(score)


# ---------------------------------------------------------------------------
# Factor 3: Hiring Activity
# ---------------------------------------------------------------------------

def compute_hiring_activity_score(job_count: int, job_diversity: int) -> int:
    """Hiring activity based on number of jobs and title diversity."""
    if job_count == 0:
        return 20

    score = 30
    score += min(job_count * 5, 40)
    score += min(job_diversity * 3, 20)

    return _clamp(score)


# ---------------------------------------------------------------------------
# Factor 4: Reputation
# ---------------------------------------------------------------------------

def compute_reputation_score(profile: Optional[CompanyProfile]) -> int:
    """Reputation based on review platforms."""
    if not profile:
        return 50

    scores: List[float] = []

    if profile.glassdoor_rating is not None:
        # Map 1-5 to 0-100
        base = (profile.glassdoor_rating - 1) / 4.0 * 100
        # Weight by review count (diminishing returns)
        review_weight = min((profile.glassdoor_review_count or 1) / 100, 1.0)
        scores.append(base * (0.5 + 0.5 * review_weight))

    if profile.trustpilot_rating is not None:
        base = (profile.trustpilot_rating - 1) / 4.0 * 100
        review_weight = min((profile.trustpilot_review_count or 1) / 100, 1.0)
        scores.append(base * (0.5 + 0.5 * review_weight))

    if profile.google_rating is not None:
        base = (profile.google_rating - 1) / 4.0 * 100
        review_weight = min((profile.google_review_count or 1) / 100, 1.0)
        scores.append(base * (0.5 + 0.5 * review_weight))

    if not scores:
        return 50

    return _clamp(int(sum(scores) / len(scores)))


# ---------------------------------------------------------------------------
# Factor 5: Legitimacy
# ---------------------------------------------------------------------------

def compute_legitimacy_score(profile: Optional[CompanyProfile]) -> int:
    """Legitimacy based on online presence signals."""
    if not profile:
        return 40

    score = 30  # base for having a profile at all

    if profile.website_url:
        score += 15

    if profile.has_careers_page:
        score += 15

    domain_age = profile.website_domain_age_days or 0
    if domain_age > 1095:
        score += 15
    elif domain_age > 365:
        score += 10

    employee_count = profile.employee_count_estimate or 0
    if employee_count > 100:
        score += 15
    elif employee_count > 10:
        score += 10

    social = profile.social_links or {}
    if len(social) >= 2:
        score += 10

    return _clamp(score)


# ---------------------------------------------------------------------------
# Factor 6: Track Record
# ---------------------------------------------------------------------------

def compute_track_record_score(sponsor: Sponsor) -> int:
    """Track record based on tenure on the register."""
    score = 30

    if sponsor.first_seen_date:
        years = (datetime.utcnow() - sponsor.first_seen_date).days / 365.25
        score += min(int(years * 5), 30)

    # Never had B rating
    if (sponsor.times_rating_changed or 0) == 0 and sponsor.rating == SponsorRating.A:
        score += 20

    return _clamp(score)


# ---------------------------------------------------------------------------
# Factor 7: Growth Signal
# ---------------------------------------------------------------------------

def compute_growth_signal_score(
    profile: Optional[CompanyProfile],
    recent_job_trend: float,
) -> int:
    """Growth signal based on employee growth and job posting trends."""
    score = 30

    if profile and profile.employee_growth_12m is not None:
        growth = profile.employee_growth_12m
        if growth > 0:
            # Cap contribution at +40 for very high growth
            score += min(int(growth * 100), 40)
        else:
            score += max(int(growth * 50), -20)

    if recent_job_trend > 0:
        score += 20

    return _clamp(score)


# ---------------------------------------------------------------------------
# Composite scorer
# ---------------------------------------------------------------------------

_WEIGHTS = {
    "compliance": 0.20,
    "financial": 0.15,
    "hiring": 0.15,
    "reputation": 0.15,
    "legitimacy": 0.10,
    "track_record": 0.15,
    "growth": 0.10,
}


def detect_risk_flags(
    sponsor: Sponsor,
    profile: Optional[CompanyProfile],
) -> List[str]:
    """Detect risk flags from sponsor and company profile data."""
    flags: List[str] = []

    if sponsor.rating == SponsorRating.B:
        flags.append("B_rating")

    if profile:
        if profile.accounts_overdue:
            flags.append("accounts_overdue")
        if profile.has_insolvency_history:
            flags.append("insolvency_history")
        if not profile.website_url:
            flags.append("no_website")
        if profile.has_ccjs:
            flags.append("ccjs_found")
        if profile.confirmation_statement_overdue:
            flags.append("confirmation_statement_overdue")
    else:
        flags.append("no_company_profile")

    if not sponsor.is_active:
        flags.append("sponsor_inactive")

    return flags


async def compute_sponsor_score(
    db: AsyncSession,
    sponsor_id: uuid.UUID,
) -> SponsorScore:
    """
    Compute the full 7-factor score for a sponsor.
    Persists and returns the SponsorScore record.
    """
    # Fetch sponsor
    sponsor = await db.get(Sponsor, sponsor_id)
    if not sponsor:
        raise ValueError(f"Sponsor {sponsor_id} not found")

    # Fetch company profile
    profile_result = await db.execute(
        select(CompanyProfile).where(CompanyProfile.sponsor_id == sponsor_id)
    )
    profile: Optional[CompanyProfile] = profile_result.scalar_one_or_none()

    # Job counts
    job_count_result = await db.execute(
        select(func.count(Job.id)).where(
            Job.sponsor_id == sponsor_id,
            Job.is_expired == False,  # noqa: E712
        )
    )
    job_count = job_count_result.scalar() or 0

    job_diversity_result = await db.execute(
        select(func.count(func.distinct(Job.title_normalised))).where(
            Job.sponsor_id == sponsor_id,
            Job.is_expired == False,  # noqa: E712
        )
    )
    job_diversity = job_diversity_result.scalar() or 0

    # Compute recent_job_trend (simple: positive if any active jobs)
    recent_job_trend = 1.0 if job_count > 0 else 0.0

    # Compute all 7 factors
    compliance = compute_compliance_score(sponsor)
    financial = compute_financial_health_score(profile)
    hiring = compute_hiring_activity_score(job_count, job_diversity)
    reputation = compute_reputation_score(profile)
    legitimacy = compute_legitimacy_score(profile)
    track_record = compute_track_record_score(sponsor)
    growth = compute_growth_signal_score(profile, recent_job_trend)

    # Weighted average
    overall = int(
        compliance * _WEIGHTS["compliance"]
        + financial * _WEIGHTS["financial"]
        + hiring * _WEIGHTS["hiring"]
        + reputation * _WEIGHTS["reputation"]
        + legitimacy * _WEIGHTS["legitimacy"]
        + track_record * _WEIGHTS["track_record"]
        + growth * _WEIGHTS["growth"]
    )
    overall = _clamp(overall)

    risk_flags = detect_risk_flags(sponsor, profile)

    score = SponsorScore(
        id=uuid.uuid4(),
        sponsor_id=sponsor_id,
        computed_at=datetime.utcnow(),
        overall_score=overall,
        compliance_score=compliance,
        financial_health_score=financial,
        hiring_activity_score=hiring,
        reputation_score=reputation,
        legitimacy_score=legitimacy,
        track_record_score=track_record,
        growth_signal_score=growth,
        risk_flags=risk_flags,
        score_version=1,
    )

    db.add(score)
    await db.flush()

    return score
