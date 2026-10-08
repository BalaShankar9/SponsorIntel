-- Public advert diagnostics only. No customer records or page bodies.
CREATE TABLE job_link_checks (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES business_runs(id) ON DELETE CASCADE,
 source_id TEXT NOT NULL, job_id TEXT NOT NULL, day TEXT NOT NULL,
 company TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, source_seen_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','checking','checked','needs_review','uncertain','skipped')),
 reason TEXT, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
 claim TEXT, reserved_requests INTEGER NOT NULL DEFAULT 0 CHECK(reserved_requests IN (0,4)), evidence TEXT,
 UNIQUE(source_id,day), UNIQUE(run_id,source_id)
);
CREATE INDEX job_link_checks_job ON job_link_checks(job_id,created_at);
CREATE INDEX job_link_checks_source ON job_link_checks(source_id,created_at DESC);
CREATE TABLE job_link_daily_budget (
 day TEXT PRIMARY KEY, reserved_requests INTEGER NOT NULL DEFAULT 0 CHECK(reserved_requests BETWEEN 0 AND 160)
);
INSERT INTO metadata(key,value) VALUES('job_link_checks_started',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
