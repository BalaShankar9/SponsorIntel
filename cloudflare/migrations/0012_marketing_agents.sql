CREATE TABLE marketing_agent_controls (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL, actor TEXT
);
INSERT INTO marketing_agent_controls(singleton,updated_at) VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE marketing_agent_runs (
 id TEXT PRIMARY KEY, day TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('queued','running','held','no_post','reviewed','failed')),
 created_at TEXT NOT NULL, finished_at TEXT, policy TEXT NOT NULL, models TEXT NOT NULL,
 context TEXT, result TEXT, brief_id TEXT, calls INTEGER NOT NULL DEFAULT 0 CHECK(calls BETWEEN 0 AND 5)
);
CREATE UNIQUE INDEX marketing_one_active ON marketing_agent_runs((1)) WHERE state IN ('queued','running');
CREATE TABLE marketing_agent_steps (
 run_id TEXT NOT NULL REFERENCES marketing_agent_runs(id), name TEXT NOT NULL,
 role TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('calling','completed','failed')),
 created_at TEXT NOT NULL, output TEXT, usage TEXT, PRIMARY KEY(run_id,name)
);
