-- Private content review, never permission for automated employer submission.
CREATE TABLE application_pack_reviews (
 batch_id TEXT NOT NULL REFERENCES application_batches(id) ON DELETE CASCADE,
 role_id TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 10),
 batch_revision INTEGER NOT NULL,
 facts_version INTEGER NOT NULL,
 facts_hash TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 payload_hash TEXT NOT NULL,
 payload_bytes INTEGER NOT NULL CHECK(payload_bytes BETWEEN 1 AND 300000),
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 approved_at TEXT NOT NULL,
 PRIMARY KEY(batch_id,role_id,version), UNIQUE(batch_id,request_key),
 FOREIGN KEY(batch_id,facts_version) REFERENCES application_fact_packs(batch_id,version) ON DELETE CASCADE
);
CREATE TABLE application_pack_revocations (
 batch_id TEXT NOT NULL,
 role_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 revoked_at TEXT NOT NULL,
 PRIMARY KEY(batch_id,role_id,version), UNIQUE(batch_id,request_key),
 FOREIGN KEY(batch_id,role_id,version) REFERENCES application_pack_reviews(batch_id,role_id,version) ON DELETE CASCADE
);
CREATE TRIGGER application_pack_review_immutable BEFORE UPDATE ON application_pack_reviews
BEGIN SELECT RAISE(ABORT,'Application pack reviews are immutable'); END;
CREATE TRIGGER application_pack_revocation_immutable BEFORE UPDATE ON application_pack_revocations
BEGIN SELECT RAISE(ABORT,'Application pack revocations are immutable'); END;
