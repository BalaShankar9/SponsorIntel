-- Private immutable advert snapshots; no customer data or public write route.
CREATE TABLE agent_reference_cases (
 dataset TEXT NOT NULL, job_id TEXT NOT NULL, record TEXT NOT NULL CHECK(json_valid(record)),
 PRIMARY KEY(dataset,job_id)
);
CREATE TRIGGER agent_reference_no_update BEFORE UPDATE ON agent_reference_cases
 BEGIN SELECT RAISE(ABORT,'Reference snapshots are immutable; use a new version.'); END;
CREATE TRIGGER agent_reference_no_delete BEFORE DELETE ON agent_reference_cases
 BEGIN SELECT RAISE(ABORT,'Reference snapshots are immutable; use a new version.'); END;
ALTER TABLE agent_investigations ADD COLUMN reference_batch TEXT;
CREATE UNIQUE INDEX agent_reference_attempt ON agent_investigations(reference_batch) WHERE reference_batch IS NOT NULL;
-- Also protect receipts during a rollback to an older Worker cleanup query.
CREATE TRIGGER agent_reference_attempt_no_delete BEFORE DELETE ON agent_investigations
 WHEN OLD.reference_batch IS NOT NULL BEGIN SELECT RAISE(IGNORE); END;
