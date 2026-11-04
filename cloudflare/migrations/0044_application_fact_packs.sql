-- Applicant-confirmed preparation facts only; no employer dispatch approval.
CREATE TABLE application_fact_packs (
 batch_id TEXT NOT NULL REFERENCES application_batches(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 20),
 batch_revision INTEGER NOT NULL,
 profile_hash TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 payload_hash TEXT NOT NULL,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 approved_at TEXT NOT NULL,
 PRIMARY KEY(batch_id,version), UNIQUE(batch_id,request_key)
);
CREATE TABLE application_fact_revocations (
 batch_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 revoked_at TEXT NOT NULL,
 PRIMARY KEY(batch_id,version), UNIQUE(batch_id,request_key),
 FOREIGN KEY(batch_id,version) REFERENCES application_fact_packs(batch_id,version) ON DELETE CASCADE
);
CREATE TRIGGER application_fact_pack_immutable BEFORE UPDATE ON application_fact_packs
BEGIN SELECT RAISE(ABORT,'Application fact confirmations are immutable'); END;
CREATE TRIGGER application_fact_revocation_immutable BEFORE UPDATE ON application_fact_revocations
BEGIN SELECT RAISE(ABORT,'Application fact revocations are immutable'); END;
