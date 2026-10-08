-- Append-only owner assessments of existing fictional evaluation outputs.
-- No model calls, customer documents, output overwrites or promotion control.
CREATE TABLE application_assessments(
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL,case_id TEXT NOT NULL,stage TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 output_fingerprint TEXT NOT NULL,profile_fingerprint TEXT NOT NULL,
 content TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,
 UNIQUE(run_id,case_id,stage,revision),
 FOREIGN KEY(run_id,case_id,stage) REFERENCES application_eval_steps(run_id,case_id,stage)
);
CREATE INDEX application_assessment_case ON application_assessments(case_id,created_at);
CREATE TRIGGER application_assessment_no_update BEFORE UPDATE ON application_assessments
 BEGIN SELECT RAISE(ABORT,'Assessment history is immutable. Append a revised assessment.'); END;
CREATE TRIGGER application_assessment_no_delete BEFORE DELETE ON application_assessments
 BEGIN SELECT RAISE(ABORT,'Assessment history is retained with its fictional evaluation.'); END;
