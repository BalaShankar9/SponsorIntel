import enum


class SponsorRating(str, enum.Enum):
    A = "A"
    B = "B"


class SponsorType(str, enum.Enum):
    WORKER = "Worker"
    TEMPORARY_WORKER = "Temporary Worker"


class ChangeType(str, enum.Enum):
    ADDED = "added"
    REMOVED = "removed"
    RATING_UPGRADE = "rating_upgrade"
    RATING_DOWNGRADE = "rating_downgrade"
    ROUTE_ADDED = "route_added"
    ROUTE_REMOVED = "route_removed"
    LOCATION_CHANGE = "location_change"
    NAME_CHANGE = "name_change"
    REACTIVATED = "reactivated"


class EventType(str, enum.Enum):
    SPONSOR_ADDED = "sponsor_added"
    SPONSOR_REMOVED = "sponsor_removed"
    RATING_CHANGE = "rating_change"
    NEW_JOB_DETECTED = "new_job_detected"
    JOB_EXPIRED = "job_expired"
    COMPANY_ENRICHED = "company_enriched"
    NEWS_DETECTED = "news_detected"
    RISK_FLAG_RAISED = "risk_flag_raised"
    RISK_FLAG_CLEARED = "risk_flag_cleared"
    SCORE_CHANGED = "score_changed"
    CSV_IMPORTED = "csv_imported"
    FILING_DETECTED = "filing_detected"
    OFFICER_CHANGE = "officer_change"
    INSOLVENCY_EVENT = "insolvency_event"


class Severity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class JobSource(str, enum.Enum):
    REED = "reed"
    ADZUNA = "adzuna"
    INDEED = "indeed"
    LINKEDIN = "linkedin"
    GLASSDOOR = "glassdoor"
    TOTALJOBS = "totaljobs"
    CWJOBS = "cwjobs"
    GOV_FINDAJOB = "gov_findajob"
    GUARDIAN = "guardian"
    NHS_JOBS = "nhs_jobs"
    CAREER_PAGE = "career_page"


class ContractType(str, enum.Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    APPRENTICESHIP = "apprenticeship"


class Seniority(str, enum.Enum):
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    DIRECTOR = "director"
    EXECUTIVE = "executive"


class UserPlan(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"
    TRIALING = "trialing"


class ApplicationStatus(str, enum.Enum):
    WATCHING = "watching"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class AlertType(str, enum.Enum):
    NEW_SPONSOR = "new_sponsor"
    RATING_CHANGE = "rating_change"
    NEW_JOB = "new_job"
    COMPANY_NEWS = "company_news"
    RISK_FLAG = "risk_flag"
    SPONSOR_REMOVED = "sponsor_removed"
    SCORE_CHANGE = "score_change"


class AlertChannel(str, enum.Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    BOTH = "both"


class ReviewSource(str, enum.Enum):
    GLASSDOOR = "glassdoor"
    TRUSTPILOT = "trustpilot"
    GOOGLE = "google"


class EnrichmentLevel(int, enum.Enum):
    LEVEL_0 = 0
    LEVEL_1 = 1
    LEVEL_2 = 2
    LEVEL_3 = 3
    LEVEL_4 = 4
    LEVEL_5 = 5
