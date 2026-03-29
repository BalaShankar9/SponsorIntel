-- SponsorIntel Full Schema Migration
-- Creates all tables, enums, indexes for the platform

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE sponsorrating AS ENUM ('A', 'B');
CREATE TYPE sponsortype AS ENUM ('Worker', 'Temporary Worker');
CREATE TYPE changetype AS ENUM ('added', 'removed', 'rating_upgrade', 'rating_downgrade', 'route_added', 'route_removed', 'location_change', 'name_change', 'reactivated');
CREATE TYPE eventtype AS ENUM ('sponsor_added', 'sponsor_removed', 'rating_change', 'new_job_detected', 'job_expired', 'company_enriched', 'news_detected', 'risk_flag_raised', 'risk_flag_cleared', 'score_changed', 'csv_imported', 'filing_detected', 'officer_change', 'insolvency_event');
CREATE TYPE severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE jobsource AS ENUM ('reed', 'adzuna', 'jooble', 'indeed', 'linkedin', 'glassdoor', 'totaljobs', 'cwjobs', 'gov_findajob', 'guardian', 'nhs_jobs', 'career_page', 'remotive', 'arbeitnow', 'jobicy', 'themuse', 'himalayas', 'remoteok', 'wwr', 'teaching_vacancies', 'devitjobs', 'hn_hiring', 'charityjob');
CREATE TYPE contracttype AS ENUM ('permanent', 'contract', 'temporary', 'apprenticeship');
CREATE TYPE seniority AS ENUM ('entry', 'mid', 'senior', 'lead', 'director', 'executive');
CREATE TYPE userplan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE subscriptionstatus AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE applicationstatus AS ENUM ('watching', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn');
CREATE TYPE alerttype AS ENUM ('new_sponsor', 'rating_change', 'new_job', 'company_news', 'risk_flag', 'sponsor_removed', 'score_change');
CREATE TYPE alertchannel AS ENUM ('email', 'in_app', 'both');
CREATE TYPE reviewsource AS ENUM ('glassdoor', 'trustpilot', 'google');
CREATE TYPE enrichmentlevel AS ENUM ('0', '1', '2', '3', '4', '5');

-- ============================================================
-- SPONSORS (core entity)
-- ============================================================
CREATE TABLE sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_name VARCHAR(500) NOT NULL,
    organisation_name_normalised VARCHAR(500) NOT NULL,
    town_city VARCHAR(200),
    county VARCHAR(200),
    type_and_rating VARCHAR(200),
    rating sponsorrating,
    sponsor_type sponsortype,
    route TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    first_seen_date TIMESTAMP,
    last_seen_date TIMESTAMP,
    consecutive_a_rating_days INTEGER DEFAULT 0,
    times_rating_changed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_sponsors_name_norm ON sponsors (organisation_name_normalised);
CREATE INDEX ix_sponsors_town ON sponsors (town_city);
CREATE INDEX ix_sponsors_county ON sponsors (county);
CREATE INDEX ix_sponsors_rating ON sponsors (rating);
CREATE INDEX ix_sponsors_active ON sponsors (is_active);
CREATE INDEX ix_sponsors_name_trgm ON sponsors USING gin (organisation_name_normalised gin_trgm_ops);

-- ============================================================
-- CSV IMPORTS
-- ============================================================
CREATE TABLE csv_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(500) NOT NULL,
    source_url VARCHAR(1000),
    checksum_md5 VARCHAR(32) UNIQUE NOT NULL,
    record_count INTEGER DEFAULT 0,
    added_count INTEGER DEFAULT 0,
    removed_count INTEGER DEFAULT 0,
    changed_count INTEGER DEFAULT 0,
    imported_at TIMESTAMP DEFAULT NOW(),
    is_auto BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- SPONSOR SNAPSHOTS
-- ============================================================
CREATE TABLE sponsor_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    csv_import_id UUID NOT NULL REFERENCES csv_imports(id),
    snapshot_date TIMESTAMP DEFAULT NOW(),
    organisation_name VARCHAR(500) NOT NULL,
    town_city VARCHAR(200),
    county VARCHAR(200),
    type_and_rating VARCHAR(200),
    route TEXT[]
);

CREATE INDEX ix_snapshots_sponsor ON sponsor_snapshots (sponsor_id);

-- ============================================================
-- SPONSOR CHANGES
-- ============================================================
CREATE TABLE sponsor_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    csv_import_id UUID REFERENCES csv_imports(id),
    change_type changetype NOT NULL,
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    detected_at TIMESTAMP DEFAULT NOW(),
    significance_score INTEGER
);

CREATE INDEX ix_changes_sponsor ON sponsor_changes (sponsor_id);
CREATE INDEX ix_changes_type ON sponsor_changes (change_type);
CREATE INDEX ix_changes_detected ON sponsor_changes (detected_at);

-- ============================================================
-- COMPANY PROFILES (enrichment data)
-- ============================================================
CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID UNIQUE NOT NULL REFERENCES sponsors(id),

    -- Companies House
    companies_house_number VARCHAR(20),
    company_status VARCHAR(50),
    incorporation_date TIMESTAMP,
    company_type VARCHAR(100),
    sic_codes JSONB,
    industry_primary VARCHAR(200),
    industry_tags TEXT[],
    registered_address JSONB,
    trading_address JSONB,

    -- Financial
    has_charges BOOLEAN,
    charge_count INTEGER,
    has_insolvency_history BOOLEAN,
    has_ccjs BOOLEAN,
    last_accounts_date TIMESTAMP,
    next_accounts_due TIMESTAMP,
    accounts_overdue BOOLEAN,
    confirmation_statement_overdue BOOLEAN,
    estimated_revenue_band VARCHAR(100),
    credit_risk_score INTEGER,

    -- Workforce
    employee_count_estimate INTEGER,
    employee_count_source VARCHAR(100),
    employee_growth_6m FLOAT,
    employee_growth_12m FLOAT,
    linkedin_url VARCHAR(500),
    linkedin_follower_count INTEGER,

    -- Reputation
    glassdoor_rating FLOAT,
    glassdoor_review_count INTEGER,
    glassdoor_ceo_approval FLOAT,
    glassdoor_recommend_pct FLOAT,
    trustpilot_rating FLOAT,
    trustpilot_review_count INTEGER,
    google_rating FLOAT,
    google_review_count INTEGER,

    -- Online Presence
    website_url VARCHAR(500),
    website_domain_age_days INTEGER,
    has_careers_page BOOLEAN,
    social_links JSONB,
    tech_stack_detected TEXT[],

    -- Meta
    legitimacy_score INTEGER,
    enrichment_level enrichmentlevel,
    enrichment_priority INTEGER,
    enriched_at TIMESTAMP,
    enrichment_version INTEGER,
    next_enrichment_due TIMESTAMP,
    failure_count INTEGER DEFAULT 0,
    last_error TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_profiles_sponsor ON company_profiles (sponsor_id);
CREATE INDEX ix_profiles_ch ON company_profiles (companies_house_number);
CREATE INDEX ix_profiles_industry ON company_profiles (industry_primary);

-- ============================================================
-- COMPANY OFFICERS
-- ============================================================
CREATE TABLE company_officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES company_profiles(id),
    name VARCHAR(300) NOT NULL,
    role VARCHAR(200),
    appointed_on TIMESTAMP,
    resigned_on TIMESTAMP,
    nationality VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    other_directorships_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_officers_profile ON company_officers (profile_id);

-- ============================================================
-- COMPANY PSCs
-- ============================================================
CREATE TABLE company_pscs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES company_profiles(id),
    name VARCHAR(300) NOT NULL,
    nationality VARCHAR(100),
    country_of_residence VARCHAR(100),
    natures_of_control JSONB,
    notified_on TIMESTAMP,
    ceased_on TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_pscs_profile ON company_pscs (profile_id);

-- ============================================================
-- COMPANY NEWS
-- ============================================================
CREATE TABLE company_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES company_profiles(id),
    headline VARCHAR(500) NOT NULL,
    source VARCHAR(200),
    url VARCHAR(1000),
    published_at TIMESTAMP,
    sentiment VARCHAR(20),
    sentiment_score FLOAT,
    keywords TEXT[],
    is_risk_signal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_news_profile ON company_news (profile_id);

-- ============================================================
-- COMPANY REVIEWS
-- ============================================================
CREATE TABLE company_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES company_profiles(id),
    source reviewsource NOT NULL,
    rating FLOAT,
    title VARCHAR(500),
    text_snippet TEXT,
    mentions_visa BOOLEAN DEFAULT FALSE,
    mentions_sponsorship BOOLEAN DEFAULT FALSE,
    sentiment VARCHAR(20),
    review_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_reviews_profile ON company_reviews (profile_id);

-- ============================================================
-- COMPANY ALIASES
-- ============================================================
CREATE TABLE company_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    alias_name VARCHAR(500) NOT NULL,
    alias_source VARCHAR(100),
    confidence FLOAT,
    verified_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_aliases_sponsor ON company_aliases (sponsor_id);
CREATE INDEX ix_aliases_name ON company_aliases (alias_name);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE job_dedup_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_job_id UUID,
    source_count INTEGER DEFAULT 1,
    sources TEXT[],
    first_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID REFERENCES sponsors(id),
    source jobsource NOT NULL,
    source_job_id VARCHAR(200),
    title_raw VARCHAR(500) NOT NULL,
    title_normalised VARCHAR(500),
    soc_code VARCHAR(20),
    company_name_raw VARCHAR(500) NOT NULL,
    company_name_normalised VARCHAR(500),
    location_raw VARCHAR(500),
    location_city VARCHAR(200),
    location_region VARCHAR(200),
    location_is_remote BOOLEAN DEFAULT FALSE,
    salary_min FLOAT,
    salary_max FLOAT,
    salary_currency VARCHAR(10) DEFAULT 'GBP',
    salary_period VARCHAR(20),
    salary_text_raw VARCHAR(200),
    contract_type contracttype,
    seniority seniority,
    description_full TEXT,
    description_snippet VARCHAR(1000),
    sponsorship_likelihood INTEGER,
    sponsorship_signals JSONB,
    is_on_shortage_list BOOLEAN,
    meets_salary_threshold BOOLEAN,
    skills_extracted TEXT[],
    experience_years_min INTEGER,
    experience_years_max INTEGER,
    source_url VARCHAR(2000),
    posted_date TIMESTAMP,
    expiry_date TIMESTAMP,
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    is_expired BOOLEAN DEFAULT FALSE,
    days_open INTEGER,
    dedup_cluster_id UUID REFERENCES job_dedup_clusters(id),
    scraped_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (source, source_job_id)
);

CREATE INDEX ix_jobs_sponsor ON jobs (sponsor_id);
CREATE INDEX ix_jobs_source ON jobs (source);
CREATE INDEX ix_jobs_title ON jobs (title_normalised);
CREATE INDEX ix_jobs_company ON jobs (company_name_normalised);
CREATE INDEX ix_jobs_city ON jobs (location_city);
CREATE INDEX ix_jobs_soc ON jobs (soc_code);
CREATE INDEX ix_jobs_sponsorship ON jobs (sponsorship_likelihood);
CREATE INDEX ix_jobs_posted ON jobs (posted_date);

-- ============================================================
-- SALARY BENCHMARKS
-- ============================================================
CREATE TABLE salary_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soc_code VARCHAR(20) NOT NULL,
    title_normalised VARCHAR(500) NOT NULL,
    location_region VARCHAR(200),
    period VARCHAR(20) NOT NULL,
    p10 FLOAT,
    p25 FLOAT,
    median FLOAT,
    p75 FLOAT,
    p90 FLOAT,
    sample_size INTEGER DEFAULT 0,
    source VARCHAR(100),
    meets_visa_threshold BOOLEAN,
    visa_salary_threshold FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_salary_soc ON salary_benchmarks (soc_code);

-- ============================================================
-- SHORTAGE OCCUPATIONS
-- ============================================================
CREATE TABLE shortage_occupations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soc_code VARCHAR(20) NOT NULL,
    job_title VARCHAR(500) NOT NULL,
    salary_threshold FLOAT,
    standard_threshold FLOAT,
    effective_from TIMESTAMP,
    effective_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_shortage_soc ON shortage_occupations (soc_code);

-- ============================================================
-- SPONSOR SCORES
-- ============================================================
CREATE TABLE sponsor_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    computed_at TIMESTAMP DEFAULT NOW(),
    overall_score INTEGER NOT NULL,
    compliance_score INTEGER,
    financial_health_score INTEGER,
    hiring_activity_score INTEGER,
    reputation_score INTEGER,
    legitimacy_score INTEGER,
    track_record_score INTEGER,
    growth_signal_score INTEGER,
    risk_flags JSONB,
    score_version INTEGER DEFAULT 1
);

CREATE INDEX ix_scores_sponsor ON sponsor_scores (sponsor_id);
CREATE INDEX ix_scores_computed ON sponsor_scores (computed_at);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type eventtype NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB,
    severity severity NOT NULL DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_events_type ON events (event_type);
CREATE INDEX ix_events_type_created ON events (event_type, created_at);
CREATE INDEX ix_events_entity ON events (entity_type, entity_id);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) UNIQUE NOT NULL,
    password_hash VARCHAR(200),
    name VARCHAR(200),
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(200),
    plan userplan NOT NULL DEFAULT 'free',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX ix_users_email ON users (email);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    plan userplan NOT NULL,
    stripe_customer_id VARCHAR(200),
    stripe_subscription_id VARCHAR(200),
    status subscriptionstatus NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- WATCHLIST ITEMS
-- ============================================================
CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    notes TEXT,
    priority INTEGER,
    status applicationstatus DEFAULT 'watching',
    applied_date TIMESTAMP,
    next_followup TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_watchlist_user ON watchlist_items (user_id);
CREATE INDEX ix_watchlist_sponsor ON watchlist_items (sponsor_id);

-- ============================================================
-- USER NOTES
-- ============================================================
CREATE TABLE user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_notes_user ON user_notes (user_id);
CREATE INDEX ix_notes_sponsor ON user_notes (sponsor_id);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    alert_type alerttype NOT NULL,
    config JSONB,
    channel alertchannel NOT NULL DEFAULT 'in_app',
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_alerts_user ON alerts (user_id);

-- ============================================================
-- ALERT HISTORY
-- ============================================================
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id),
    triggered_at TIMESTAMP DEFAULT NOW(),
    payload JSONB,
    read BOOLEAN DEFAULT FALSE
);

CREATE INDEX ix_alert_history_alert ON alert_history (alert_id);
