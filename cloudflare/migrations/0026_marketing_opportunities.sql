-- Pins a vacancy's evidence to a specific immutable marketing version.
-- Public identifiers and hashes only; no applicant or customer information.
CREATE TABLE marketing_opportunity_versions (
 brief_id TEXT NOT NULL, version INTEGER NOT NULL,
 job_id TEXT NOT NULL, fingerprint TEXT NOT NULL, link_check_id TEXT NOT NULL,
 checked_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 PRIMARY KEY(brief_id,version),
 FOREIGN KEY(brief_id,version) REFERENCES marketing_versions(brief_id,version)
);
CREATE INDEX marketing_opportunity_job ON marketing_opportunity_versions(job_id);
