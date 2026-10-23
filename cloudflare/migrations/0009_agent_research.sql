-- Private research only. These tables grant no publication or deployment authority.
CREATE TABLE agent_investigations (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('research','evaluation')),
 state TEXT NOT NULL CHECK(state IN ('queued','running','review','failed')),
 actor TEXT NOT NULL, created_at TEXT NOT NULL, finished_at TEXT,
 policy TEXT NOT NULL, models TEXT NOT NULL, context TEXT, report TEXT, error TEXT,
 calls INTEGER NOT NULL DEFAULT 0 CHECK(calls BETWEEN 0 AND 8)
);
CREATE UNIQUE INDEX agent_one_investigation ON agent_investigations((1)) WHERE state IN ('queued','running');
CREATE TABLE agent_research_steps (
 run_id TEXT NOT NULL REFERENCES agent_investigations(id) ON DELETE CASCADE,
 name TEXT NOT NULL, role TEXT NOT NULL, state TEXT NOT NULL,
 created_at TEXT NOT NULL, output TEXT, usage TEXT, duration_ms INTEGER,
 PRIMARY KEY(run_id,name)
);
CREATE TABLE agent_research_budget (
 day TEXT PRIMARY KEY, runs INTEGER NOT NULL DEFAULT 0 CHECK(runs BETWEEN 0 AND 4),
 calls INTEGER NOT NULL DEFAULT 0 CHECK(calls BETWEEN 0 AND 32)
);
CREATE TABLE agent_research_memory (
 job_id TEXT PRIMARY KEY, content_hash TEXT NOT NULL, verdict TEXT NOT NULL,
 quote TEXT NOT NULL, run_id TEXT NOT NULL, approved_by TEXT NOT NULL,
 approved_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
