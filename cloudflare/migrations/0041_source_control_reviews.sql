-- Preserve current pauses, reasons, timestamps, counters and existing audit rows.
-- Revision zero is the inherited state, not an invented historical review.
ALTER TABLE agent_source_controls ADD COLUMN control_revision INTEGER NOT NULL DEFAULT 0 CHECK(control_revision>=0);
CREATE TABLE source_control_reviews (
 request_key TEXT PRIMARY KEY, request_hash TEXT NOT NULL,
 source_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 paused INTEGER NOT NULL CHECK(paused IN (0,1)), reason TEXT NOT NULL,
 prior_paused INTEGER NOT NULL CHECK(prior_paused IN (0,1)), prior_reason TEXT NOT NULL,
 prior_record_updated_at TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(source_id,revision)
);
CREATE TRIGGER source_control_reviews_no_update BEFORE UPDATE ON source_control_reviews
 BEGIN SELECT RAISE(ABORT,'Source control reviews are append only.'); END;
CREATE TRIGGER source_control_reviews_no_delete BEFORE DELETE ON source_control_reviews
 BEGIN SELECT RAISE(ABORT,'Source control reviews are append only.'); END;
-- A previous Worker may keep updating failure/cooldown metadata after rollback,
-- but cannot overwrite an owner decision recorded by this version.
CREATE TRIGGER source_control_review_insert BEFORE INSERT ON agent_source_controls
 WHEN NEW.control_revision>0 AND NOT EXISTS(
  SELECT 1 FROM source_control_reviews r WHERE r.source_id=NEW.source_id AND r.revision=NEW.control_revision
  AND r.paused=NEW.paused AND r.reason=NEW.reason AND r.actor=NEW.actor AND r.created_at=NEW.updated_at)
 BEGIN SELECT RAISE(ABORT,'Source control review required.'); END;
CREATE TRIGGER source_control_review_update BEFORE UPDATE ON agent_source_controls
 WHEN (OLD.control_revision>0 OR NEW.control_revision>0)
 AND (NEW.paused!=OLD.paused OR NEW.reason!=OLD.reason OR NEW.actor IS NOT OLD.actor OR NEW.control_revision!=OLD.control_revision)
 AND (NEW.control_revision!=OLD.control_revision+1 OR NOT EXISTS(
  SELECT 1 FROM source_control_reviews r WHERE r.source_id=NEW.source_id AND r.revision=NEW.control_revision
  AND r.paused=NEW.paused AND r.reason=NEW.reason AND r.actor=NEW.actor AND r.created_at=NEW.updated_at
  AND r.prior_paused=OLD.paused AND r.prior_reason=OLD.reason AND r.prior_record_updated_at IS OLD.updated_at))
 BEGIN SELECT RAISE(ABORT,'Source control review required.'); END;
CREATE TRIGGER source_control_review_delete BEFORE DELETE ON agent_source_controls
 WHEN OLD.control_revision>0
 BEGIN SELECT RAISE(ABORT,'Recorded source controls cannot be removed.'); END;
