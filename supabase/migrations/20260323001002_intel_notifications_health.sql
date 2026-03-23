-- supabase/migrations/20260323001002_intel_notifications_health.sql

-- ============================================================
-- intel_subscriptions: user alert subscriptions
-- ============================================================
CREATE TABLE intel_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    filter_topics TEXT[],
    filter_visa_routes TEXT[],
    filter_nationalities TEXT[],
    filter_industries TEXT[],
    filter_min_impact VARCHAR(20) DEFAULT 'medium',
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email_instant', 'email_digest')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_subs_user ON intel_subscriptions (user_id);
CREATE INDEX idx_intel_subs_active ON intel_subscriptions (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_intel_subs_impact ON intel_subscriptions (filter_min_impact) WHERE is_active = TRUE;

-- ============================================================
-- intel_notifications: per-user notifications
-- ============================================================
CREATE TABLE intel_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    intel_item_id UUID REFERENCES intel_items(id),
    subscription_id UUID REFERENCES intel_subscriptions(id),
    title VARCHAR(500) NOT NULL,
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_notif_user ON intel_notifications (user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX idx_intel_notif_user_item ON intel_notifications (user_id, intel_item_id);

-- ============================================================
-- intel_source_health_log: scanner run health
-- ============================================================
CREATE TABLE intel_source_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(50) NOT NULL,
    scanner_task VARCHAR(100) NOT NULL,
    ran_at TIMESTAMPTZ DEFAULT now(),
    duration_ms INTEGER,
    items_fetched INTEGER DEFAULT 0,
    items_new INTEGER DEFAULT 0,
    items_filtered INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
    error_message TEXT,
    http_status_code INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    is_circuit_open BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_health_source ON intel_source_health_log (source_key, ran_at DESC);
CREATE INDEX idx_intel_health_errors ON intel_source_health_log (status, ran_at DESC) WHERE status != 'success';

-- ============================================================
-- intel_quality_samples: LLM classification accuracy tracking
-- ============================================================
CREATE TABLE intel_quality_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_item_id UUID REFERENCES intel_items(id),
    llm_topic VARCHAR(50),
    llm_impact VARCHAR(20),
    llm_confidence FLOAT,
    human_topic VARCHAR(50),
    human_impact VARCHAR(20),
    is_correct BOOLEAN,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
