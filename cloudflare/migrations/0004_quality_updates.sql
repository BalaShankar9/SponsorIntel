ALTER TABLE jobs ADD COLUMN salary_excerpt TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN employment_type TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN workplace TEXT NOT NULL DEFAULT '';

CREATE TABLE immigration_sources (
 id TEXT PRIMARY KEY, topic TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL,
 kind TEXT NOT NULL, content_hash TEXT, content TEXT, source_updated_at TEXT,
 checked_at TEXT, last_success TEXT, error TEXT, withdrawn INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE immigration_versions (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL, content_hash TEXT NOT NULL,
 content TEXT NOT NULL, detected_at TEXT NOT NULL, source_updated_at TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('baseline','changed','published'))
);
CREATE INDEX immigration_versions_source ON immigration_versions(source_id,detected_at DESC);
CREATE INDEX immigration_versions_time ON immigration_versions(detected_at DESC);
CREATE TABLE feed_locks (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
