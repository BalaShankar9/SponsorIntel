-- Add review history without changing the existing pause, timestamp or actor.
ALTER TABLE application_eval_controls ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE application_eval_controls ADD COLUMN reason TEXT NOT NULL DEFAULT '';
CREATE TABLE application_eval_control_reviews(
 request_key TEXT PRIMARY KEY, request_hash TEXT NOT NULL,
 revision INTEGER NOT NULL UNIQUE CHECK(revision>0),
 campaign_id TEXT NOT NULL REFERENCES application_eval_campaigns(id),
 action TEXT NOT NULL CHECK(action IN ('resume','pause')),
 profile TEXT, reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER application_eval_control_reviews_no_update BEFORE UPDATE ON application_eval_control_reviews
 BEGIN SELECT RAISE(ABORT,'Application control reviews are append only.'); END;
CREATE TRIGGER application_eval_control_reviews_no_delete BEFORE DELETE ON application_eval_control_reviews
 BEGIN SELECT RAISE(ABORT,'Application control reviews are append only.'); END;
