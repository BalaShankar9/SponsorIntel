-- supabase/migrations/20260324_army_tables.sql
-- Agent Army Phase 1: Core tables for the 181-agent military framework

-- 1. army_agents — Agent Registry
CREATE TABLE IF NOT EXISTS army_agents (
    id VARCHAR(50) PRIMARY KEY,
    division VARCHAR(30) NOT NULL,
    squad VARCHAR(30),
    role VARCHAR(30) NOT NULL,
    persona_name VARCHAR(100),
    persona_title VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',
    default_tier INTEGER DEFAULT 2,
    config JSONB DEFAULT '{}',
    capabilities TEXT[],
    dependencies TEXT[],
    last_heartbeat_at TIMESTAMPTZ,
    total_tasks_completed BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,
    avg_duration_ms INTEGER,
    total_llm_cost_usd FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_agents_division ON army_agents (division, status);
CREATE INDEX IF NOT EXISTS idx_army_agents_squad ON army_agents (division, squad);

-- 2. army_missions — Task Execution Log
CREATE TABLE IF NOT EXISTS army_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL REFERENCES army_agents(id),
    mission_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    input JSONB,
    output JSONB,
    tier_requested INTEGER,
    tier_used INTEGER,
    llm_provider VARCHAR(30),
    llm_model VARCHAR(100),
    llm_tokens_in INTEGER,
    llm_tokens_out INTEGER,
    llm_cost_usd FLOAT,
    duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    parent_mission_id UUID,
    division VARCHAR(30),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_missions_agent ON army_missions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_missions_status ON army_missions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_missions_type ON army_missions (mission_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_missions_division ON army_missions (division, created_at DESC);

-- 3. army_signals — Lateral Intel Channel Log
CREATE TABLE IF NOT EXISTS army_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL,
    publisher_agent_id VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    severity VARCHAR(10) DEFAULT 'info',
    consumed_by TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_signals_channel ON army_signals (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_signals_severity ON army_signals (severity, created_at DESC);

-- 4. army_routing_history — Self-Learning Data
CREATE TABLE IF NOT EXISTS army_routing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL,
    tier_used INTEGER NOT NULL,
    input_complexity_score FLOAT,
    result_quality_score FLOAT,
    cost_usd FLOAT,
    latency_ms INTEGER,
    could_downgrade BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_routing_task ON army_routing_history (task_type, created_at DESC);

-- 5. army_tier_config — Current Routing Thresholds
CREATE TABLE IF NOT EXISTS army_tier_config (
    task_type VARCHAR(50) PRIMARY KEY,
    default_tier INTEGER NOT NULL,
    min_tier INTEGER DEFAULT 0,
    max_tier INTEGER DEFAULT 4,
    confidence_count INTEGER DEFAULT 0,
    last_downgrade_attempt TIMESTAMPTZ,
    last_upgrade_at TIMESTAMPTZ,
    avg_quality_at_current_tier FLOAT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. army_division_status — Division Heartbeats
CREATE TABLE IF NOT EXISTS army_division_status (
    division VARCHAR(30) PRIMARY KEY,
    commander_agent_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'operational',
    agents_active INTEGER,
    agents_paused INTEGER,
    agents_error INTEGER,
    missions_last_hour INTEGER,
    errors_last_hour INTEGER,
    avg_latency_ms INTEGER,
    llm_cost_last_hour FLOAT,
    data_processed_last_hour INTEGER,
    heartbeat_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

-- army_agents: public read, service role write
ALTER TABLE army_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read agents" ON army_agents
    FOR SELECT USING (true);
CREATE POLICY "Service role manages agents" ON army_agents
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_missions: public read, service role write
ALTER TABLE army_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read missions" ON army_missions
    FOR SELECT USING (true);
CREATE POLICY "Service role manages missions" ON army_missions
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_signals: public read, service role write
ALTER TABLE army_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read signals" ON army_signals
    FOR SELECT USING (true);
CREATE POLICY "Service role manages signals" ON army_signals
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_routing_history: service role only
ALTER TABLE army_routing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages routing" ON army_routing_history
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_tier_config: public read, service role write
ALTER TABLE army_tier_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tier config" ON army_tier_config
    FOR SELECT USING (true);
CREATE POLICY "Service role manages tier config" ON army_tier_config
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_division_status: public read, service role write
ALTER TABLE army_division_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read division status" ON army_division_status
    FOR SELECT USING (true);
CREATE POLICY "Service role manages division status" ON army_division_status
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Seed Data
-- ============================================================

-- Default tier routing thresholds
INSERT INTO army_tier_config (task_type, default_tier, min_tier, max_tier) VALUES
    ('spam_check', 1, 0, 2),
    ('title_cleanup', 1, 0, 2),
    ('language_detect', 1, 0, 1),
    ('salary_parse', 0, 0, 0),
    ('url_validate', 0, 0, 0),
    ('dedup_hash', 0, 0, 0),
    ('date_normalize', 0, 0, 0),
    ('keyword_match', 0, 0, 1),
    ('job_enrichment', 2, 1, 3),
    ('soc_classify', 2, 1, 3),
    ('company_match', 2, 1, 3),
    ('sponsorship_analysis', 2, 1, 3),
    ('tech_stack_extract', 2, 1, 3),
    ('work_model_detect', 1, 0, 2),
    ('deep_analysis', 3, 2, 4),
    ('report_generation', 3, 2, 4),
    ('policy_impact', 3, 2, 4),
    ('lawyer_match', 3, 2, 4),
    ('legal_document', 4, 3, 4),
    ('executive_briefing', 4, 3, 4),
    ('multi_doc_synthesis', 4, 3, 4),
    ('general', 2, 0, 4)
ON CONFLICT (task_type) DO NOTHING;

-- Initial division status
INSERT INTO army_division_status (division, status) VALUES
    ('acquisition', 'operational'),
    ('intelligence', 'operational'),
    ('quality', 'operational'),
    ('operations', 'operational'),
    ('research', 'operational'),
    ('command', 'operational')
ON CONFLICT (division) DO NOTHING;
