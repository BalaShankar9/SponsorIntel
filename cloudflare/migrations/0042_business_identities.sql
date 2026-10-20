-- Reviewed business relationships are separate from vacancy sponsorship claims.
CREATE TABLE business_identity_revisions (
 id TEXT PRIMARY KEY,
 identity_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 sponsor_id TEXT NOT NULL,
 sponsor_name TEXT NOT NULL,
 business_name TEXT NOT NULL,
 business_key TEXT NOT NULL,
 relationship TEXT NOT NULL CHECK(relationship IN ('trading_name','website_operator','operating_organisation','subsidiary','group_relationship')),
 website TEXT NOT NULL,
 careers_url TEXT NOT NULL,
 activity TEXT NOT NULL,
 locations TEXT NOT NULL,
 official_identifier TEXT NOT NULL,
 evidence_url TEXT NOT NULL,
 evidence_summary TEXT NOT NULL,
 rights_basis TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 review_due_at TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('approved','held','withdrawn')),
 review_method TEXT NOT NULL CHECK(review_method IN ('agent_assisted','owner_review')),
 note TEXT NOT NULL,
 actor TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,
 UNIQUE(identity_id,revision)
);
CREATE INDEX business_identity_sponsor ON business_identity_revisions(sponsor_id,identity_id,revision DESC);
CREATE VIEW business_identities AS SELECT r.* FROM business_identity_revisions r WHERE r.revision=(SELECT MAX(x.revision) FROM business_identity_revisions x WHERE x.identity_id=r.identity_id);
CREATE TRIGGER business_identity_immutable_update BEFORE UPDATE ON business_identity_revisions BEGIN SELECT RAISE(ABORT,'Business identity history is append only'); END;
CREATE TRIGGER business_identity_immutable_delete BEFORE DELETE ON business_identity_revisions BEGIN SELECT RAISE(ABORT,'Business identity history is append only'); END;
