-- Private operational history. No customer profiles, CVs or browsing journeys.
CREATE TABLE marketing_briefs (
 id TEXT PRIMARY KEY, topic_key TEXT NOT NULL, destination TEXT NOT NULL,
 title TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('proposed','held','reviewed','scheduled','uncertain','published','failed','cancelled')),
 version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1,
 last_event TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(topic_key,destination)
);
CREATE TABLE marketing_versions (
 brief_id TEXT NOT NULL REFERENCES marketing_briefs(id), version INTEGER NOT NULL,
 purpose TEXT NOT NULL, text TEXT NOT NULL, sources TEXT NOT NULL, expires_at TEXT NOT NULL,
 writer TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(brief_id,version)
);
CREATE TABLE marketing_events (
 id TEXT PRIMARY KEY, brief_id TEXT NOT NULL REFERENCES marketing_briefs(id),
 revision INTEGER NOT NULL, version INTEGER NOT NULL, kind TEXT NOT NULL,
 actor TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 UNIQUE(brief_id,revision)
);
CREATE TABLE marketing_receipts (
 id TEXT PRIMARY KEY REFERENCES marketing_events(id), brief_id TEXT NOT NULL REFERENCES marketing_briefs(id),
 version INTEGER NOT NULL, destination TEXT NOT NULL, provider TEXT NOT NULL,
 external_id TEXT NOT NULL, state TEXT NOT NULL, scheduled_at TEXT,
 post_url TEXT, observed_at TEXT NOT NULL, evidence TEXT NOT NULL
);
CREATE INDEX marketing_recent ON marketing_briefs(updated_at DESC);
CREATE INDEX marketing_receipts_brief ON marketing_receipts(brief_id,observed_at DESC);
CREATE INDEX marketing_provider_identity ON marketing_receipts(provider,destination,external_id);
-- Enforced inside the receipt transaction, including concurrent submissions.
CREATE TRIGGER marketing_receipt_owner BEFORE INSERT ON marketing_receipts
WHEN EXISTS(SELECT 1 FROM marketing_receipts WHERE provider=NEW.provider AND destination=NEW.destination AND external_id=NEW.external_id AND brief_id<>NEW.brief_id)
BEGIN SELECT RAISE(ABORT,'Receipt belongs to another brief'); END;
