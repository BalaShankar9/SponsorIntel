-- Private aggregate Google search observations. No credentials or raw queries.
CREATE TABLE search_controls (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL, actor TEXT
);
INSERT INTO search_controls(singleton,updated_at) VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE search_runs (
 day TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('running','completed','partial','failed','paused')),
 trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('owner','scheduled')),
 created_at TEXT NOT NULL, finished_at TEXT, result TEXT,
 requests INTEGER NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 10)
);
