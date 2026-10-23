-- Derivative public-advert cache; no applicants, credentials or customer files.
CREATE TABLE source_posting_cache (
 source_id TEXT NOT NULL, posting_id TEXT NOT NULL, version TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)), checked_at TEXT NOT NULL,
 PRIMARY KEY(source_id,posting_id)
);
CREATE TABLE source_collection_progress (
 source_id TEXT PRIMARY KEY, started_at TEXT NOT NULL, checked_at TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total BETWEEN 0 AND 500), ready INTEGER NOT NULL CHECK(ready BETWEEN 0 AND total),
 fetched INTEGER NOT NULL CHECK(fetched BETWEEN 0 AND 40),
 state TEXT NOT NULL CHECK(state IN ('collecting','ready'))
);
ALTER TABLE jobs ADD COLUMN description_checked_at TEXT;
