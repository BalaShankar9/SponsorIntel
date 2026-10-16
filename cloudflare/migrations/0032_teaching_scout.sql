-- Bounded public-source discovery; never inserts or updates public jobs.
ALTER TABLE business_controls ADD COLUMN discovery INTEGER NOT NULL DEFAULT 1 CHECK(discovery IN (0,1));
CREATE TABLE discovery_scout_runs (
 day TEXT PRIMARY KEY,
 run_id TEXT NOT NULL,
 claim TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('running','completed','held','failed')),
 reason TEXT NOT NULL,
 started_at TEXT NOT NULL,
 finished_at TEXT,
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 0 AND 2),
 reserved_requests INTEGER NOT NULL DEFAULT 0 CHECK(reserved_requests BETWEEN 0 AND 4),
 requests INTEGER NOT NULL DEFAULT 0 CHECK(requests BETWEEN 0 AND 4),
 retained INTEGER NOT NULL DEFAULT 0 CHECK(retained BETWEEN 0 AND 2),
 inspected INTEGER NOT NULL DEFAULT 0 CHECK(inspected BETWEEN 0 AND 2),
 search_pages INTEGER NOT NULL DEFAULT 0 CHECK(search_pages BETWEEN 0 AND 2)
);
CREATE TABLE discovery_scout_items (
 day TEXT NOT NULL REFERENCES discovery_scout_runs(day),
 source_url TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('checking','retained','rejected','duplicate','held')),
 reason TEXT NOT NULL,
 lead_id TEXT REFERENCES discovery_leads(id),
 evidence TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(evidence)),
 observed_at TEXT NOT NULL,
 PRIMARY KEY(day,source_url)
);
