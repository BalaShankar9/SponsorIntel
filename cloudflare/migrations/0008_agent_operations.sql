-- Additive operational records. No CVs, credentials or raw adverts are stored here.
CREATE TABLE agent_runs (
 id TEXT PRIMARY KEY, trigger_kind TEXT NOT NULL, actor TEXT,
 state TEXT NOT NULL CHECK(state IN ('queued','running','completed','attention','failed','dispatch_failed')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT,
 source_id TEXT, requests INTEGER NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 150),
 policy_version TEXT NOT NULL DEFAULT 'sources-v1', summary TEXT
);
CREATE INDEX agent_runs_time ON agent_runs(created_at DESC);
CREATE TABLE agent_tasks (
 run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
 source_id TEXT NOT NULL, company TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','published','needs_review','failed','skipped')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 started_at TEXT, finished_at TEXT, count INTEGER NOT NULL DEFAULT 0,
 evidence TEXT, error_code TEXT,
 PRIMARY KEY(run_id,source_id)
);
CREATE TABLE agent_source_controls (
 source_id TEXT PRIMARY KEY, paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
 reason TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, actor TEXT,
 failures INTEGER NOT NULL DEFAULT 0, cooldown_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE agent_daily_budget (
 day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 500),
 briefs INTEGER NOT NULL DEFAULT 0 CHECK(briefs BETWEEN 0 AND 2)
);
CREATE TABLE agent_reviews (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL, source_id TEXT NOT NULL,
 kind TEXT NOT NULL, evidence TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved','acknowledged')),
 created_at TEXT NOT NULL, resolved_at TEXT, actor TEXT
);
CREATE INDEX agent_reviews_state ON agent_reviews(state,created_at DESC);
CREATE TABLE agent_briefs (
 id TEXT PRIMARY KEY, created_at TEXT NOT NULL, model TEXT NOT NULL,
 input_snapshot TEXT NOT NULL, output TEXT NOT NULL, actor TEXT NOT NULL
);
-- Transaction fence: a lost publication lease fails the whole D1 batch.
CREATE TABLE agent_write_guard (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), held INTEGER NOT NULL CHECK(held=1)
);
