-- Agent Intelligence Engine: memory hierarchy + reinforcement learning
-- Part of Sub-Project 2

-- 1. Agent Memory — 5-tier persistent memory for learning
CREATE TABLE IF NOT EXISTS agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL,
    memory_tier VARCHAR(5) NOT NULL CHECK (memory_tier IN ('L1', 'L2', 'L3', 'L4', 'L5')),
    memory_key VARCHAR(200) NOT NULL,
    memory_value JSONB NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    decay_rate FLOAT DEFAULT 0.05,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_lookup ON agent_memory (agent_id, memory_tier, memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expiry ON agent_memory (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages agent memory" ON agent_memory FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- 2. Agent Learning — Q-table for reinforcement learning
CREATE TABLE IF NOT EXISTS agent_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL,
    state_key VARCHAR(200) NOT NULL,
    action VARCHAR(100) NOT NULL,
    q_value FLOAT DEFAULT 0.0,
    visit_count INTEGER DEFAULT 0,
    avg_reward FLOAT DEFAULT 0.0,
    last_updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_learning_sa ON agent_learning (agent_id, state_key, action);

ALTER TABLE agent_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages agent learning" ON agent_learning FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- 3. Governor audit log — rate limit tracking
CREATE TABLE IF NOT EXISTS governor_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50),
    domain VARCHAR(200) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rate_limited', 'budget_exceeded')),
    cost_estimate FLOAT DEFAULT 0.0,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governor_audit_domain ON governor_audit_log (domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governor_audit_action ON governor_audit_log (action, created_at DESC);

ALTER TABLE governor_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages governor log" ON governor_audit_log FOR ALL
    TO service_role USING (true) WITH CHECK (true);
