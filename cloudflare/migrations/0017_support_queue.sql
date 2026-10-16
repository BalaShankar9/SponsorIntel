-- Route from the submitter's category only; never send private messages to AI.
ALTER TABLE feedback ADD COLUMN support_queue TEXT NOT NULL DEFAULT 'product'
 CHECK(support_queue IN ('engineering','evidence','product'));
ALTER TABLE feedback ADD COLUMN support_state TEXT NOT NULL DEFAULT 'new'
 CHECK(support_state IN ('new','in_progress','resolved','closed'));
ALTER TABLE feedback ADD COLUMN support_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feedback ADD COLUMN support_updated_at TEXT;
UPDATE feedback SET support_queue=CASE kind WHEN 'bug' THEN 'engineering' WHEN 'data' THEN 'evidence' ELSE 'product' END;
CREATE TRIGGER feedback_route AFTER INSERT ON feedback BEGIN
 UPDATE feedback SET support_queue=CASE NEW.kind WHEN 'bug' THEN 'engineering' WHEN 'data' THEN 'evidence' ELSE 'product' END WHERE id=NEW.id;
END;
CREATE INDEX feedback_support ON feedback(support_state,support_queue,created_at,id);
CREATE TABLE support_events (
 operation_id TEXT PRIMARY KEY,
 feedback_id TEXT NOT NULL REFERENCES feedback(id),
 actor TEXT NOT NULL,
 from_state TEXT NOT NULL,
 to_state TEXT NOT NULL CHECK(to_state IN ('new','in_progress','resolved','closed')),
 expected_version INTEGER NOT NULL,
 note TEXT NOT NULL CHECK(length(note) BETWEEN 10 AND 1600),
 created_at TEXT NOT NULL,
 UNIQUE(feedback_id,expected_version)
);
CREATE INDEX support_events_history ON support_events(feedback_id,expected_version DESC);
CREATE TRIGGER support_event_apply AFTER INSERT ON support_events BEGIN
 UPDATE feedback SET support_state=NEW.to_state,support_version=support_version+1,support_updated_at=NEW.created_at
 WHERE id=NEW.feedback_id AND support_version=NEW.expected_version;
 INSERT INTO admin_audit(actor,action,target,created_at) VALUES(NEW.actor,'support:'||NEW.to_state,NEW.feedback_id,NEW.created_at);
END;
CREATE TRIGGER support_event_no_update BEFORE UPDATE ON support_events
 BEGIN SELECT RAISE(ABORT,'Support history is immutable. Add a new review.'); END;
CREATE TRIGGER support_event_no_delete BEFORE DELETE ON support_events
 BEGIN SELECT RAISE(ABORT,'Support history is immutable. Add a new review.'); END;
