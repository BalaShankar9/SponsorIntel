-- supabase/migrations/20260323001001_intel_core_tables.sql

-- Enable pg_trgm for dedup fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- intel_items: core feed items from all scanners
-- ============================================================
CREATE TABLE intel_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(1000) NOT NULL,
    source_name VARCHAR(200) NOT NULL,
    source_url VARCHAR(2000),
    source_category VARCHAR(50) NOT NULL CHECK (source_category IN ('government', 'legal', 'news', 'community')),
    published_at TIMESTAMPTZ,
    content_text TEXT,
    content_snippet VARCHAR(500),

    -- Classification
    topic VARCHAR(50) CHECK (topic IN ('rule_change', 'policy_update', 'court_decision', 'statistics', 'opinion', 'news', 'community')),
    impact_level VARCHAR(20) CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
    visa_routes_affected TEXT[],
    nationalities_affected TEXT[],
    industries_affected TEXT[],

    -- AI Analysis
    summary TEXT,
    who_affected TEXT,
    action_required TEXT,
    before_after JSONB,

    -- Processing
    status VARCHAR(20) NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'classified', 'analyzed', 'deduped')),
    dedup_cluster_id UUID,
    scanner_agent VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_intel_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_intel_items_updated_at BEFORE UPDATE ON intel_items
FOR EACH ROW EXECUTE FUNCTION update_intel_items_updated_at();

CREATE INDEX idx_intel_items_status ON intel_items (status, created_at DESC);
CREATE INDEX idx_intel_items_topic ON intel_items (topic, created_at DESC);
CREATE INDEX idx_intel_items_impact ON intel_items (impact_level, created_at DESC);
CREATE INDEX idx_intel_items_published ON intel_items (published_at DESC);
CREATE INDEX idx_intel_items_routes ON intel_items USING gin (visa_routes_affected);
CREATE INDEX idx_intel_items_title_trgm ON intel_items USING gin (title gin_trgm_ops);

-- ============================================================
-- intel_policies: policy lifecycle tracker
-- ============================================================
CREATE TABLE intel_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('proposed', 'consultation', 'parliamentary_debate', 'enacted', 'effective')),
    visa_routes_affected TEXT[],
    source_url VARCHAR(2000),
    effective_date DATE,
    last_update_summary TEXT,
    last_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_policies_stage ON intel_policies (stage);
CREATE INDEX idx_intel_policies_routes ON intel_policies USING gin (visa_routes_affected);

-- ============================================================
-- intel_policy_follows: user follows for policies
-- ============================================================
CREATE TABLE intel_policy_follows (
    user_id UUID NOT NULL REFERENCES users(id),
    policy_id UUID NOT NULL REFERENCES intel_policies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, policy_id)
);

-- ============================================================
-- intel_calendar: upcoming immigration dates
-- ============================================================
CREATE TABLE intel_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type VARCHAR(50),
    visa_routes TEXT[],
    source_url VARCHAR(2000),
    is_confirmed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_calendar_date ON intel_calendar (event_date);

-- ============================================================
-- intel_statistics: visa grant rates, processing times, etc.
-- ============================================================
CREATE TABLE intel_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_type VARCHAR(100) NOT NULL,
    visa_route VARCHAR(100),
    nationality VARCHAR(100),
    period VARCHAR(20),
    value FLOAT NOT NULL,
    previous_value FLOAT,
    change_pct FLOAT,
    source VARCHAR(200),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_stats_type ON intel_statistics (stat_type, period);
CREATE INDEX idx_intel_stats_route ON intel_statistics (visa_route, period);

-- Enable Realtime for intel_items
ALTER PUBLICATION supabase_realtime ADD TABLE intel_items;
