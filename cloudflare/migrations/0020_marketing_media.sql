-- Additive companion table keeps older text-only versions and rollback compatible.
-- Assets are snapshotted by version, not looked up from a mutable current draft.
CREATE TABLE marketing_media_versions (
 brief_id TEXT NOT NULL, version INTEGER NOT NULL, assets TEXT NOT NULL,
 PRIMARY KEY(brief_id,version),
 FOREIGN KEY(brief_id,version) REFERENCES marketing_versions(brief_id,version)
);
