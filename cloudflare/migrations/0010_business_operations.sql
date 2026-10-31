-- Operational records contain aggregate metrics and public source data only.
CREATE TABLE business_controls (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 publishing INTEGER NOT NULL DEFAULT 1 CHECK(publishing IN (0,1)), research INTEGER NOT NULL DEFAULT 1 CHECK(research IN (0,1)),
 updated_at TEXT NOT NULL, actor TEXT
);
INSERT INTO business_controls(singleton,updated_at) VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE business_runs (
 id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('queued','running','completed','attention','failed','paused')),
 created_at TEXT NOT NULL, finished_at TEXT, snapshot TEXT, result TEXT
);
CREATE UNIQUE INDEX business_one_active ON business_runs((1)) WHERE state IN ('queued','running');
CREATE TABLE business_steps (
 run_id TEXT NOT NULL REFERENCES business_runs(id) ON DELETE CASCADE, name TEXT NOT NULL,
 result TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(run_id,name)
);
CREATE TABLE business_issues (
 id TEXT PRIMARY KEY, category TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL,
 next_action TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('open','resolved')),
 first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE business_daily (
 day TEXT PRIMARY KEY, research_state TEXT NOT NULL CHECK(research_state IN ('reserved','started','held')),
 research_id TEXT, detail TEXT
);
CREATE TABLE insight_publications (
 slug TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, published_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('published','withdrawn')), data TEXT NOT NULL
);
CREATE TABLE insight_versions (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES insight_publications(slug), created_at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE TABLE social_outbox (
 id TEXT PRIMARY KEY, publication_id TEXT NOT NULL, audience TEXT NOT NULL CHECK(audience IN ('company','personal')),
 text TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('needs_connection','sent','superseded')),
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, destination TEXT, receipt TEXT
);
