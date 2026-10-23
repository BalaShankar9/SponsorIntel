-- Owner-observed public post aggregates; no customers, journeys or provider tokens.
-- Observations do not change editorial decisions, schedules or delivery receipts.
CREATE TABLE marketing_performance (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 destination TEXT NOT NULL, post_url TEXT NOT NULL, observed_at TEXT NOT NULL,
 supersedes TEXT UNIQUE REFERENCES marketing_performance(id),
 payload TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX marketing_performance_recent ON marketing_performance(observed_at DESC);
CREATE UNIQUE INDEX marketing_performance_observation ON marketing_performance(
 destination,post_url,observed_at,json_extract(payload,'$.window_type'),
 coalesce(json_extract(payload,'$.window_start'),''),json_extract(payload,'$.window_end'),json_extract(payload,'$.timezone')
) WHERE supersedes IS NULL;
CREATE TRIGGER marketing_performance_no_update BEFORE UPDATE ON marketing_performance
BEGIN SELECT RAISE(ABORT,'Performance observations are append only'); END;
CREATE TRIGGER marketing_performance_no_delete BEFORE DELETE ON marketing_performance
BEGIN SELECT RAISE(ABORT,'Performance observations are append only'); END;
