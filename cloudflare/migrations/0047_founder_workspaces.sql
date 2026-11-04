-- Private founder work is separate from the older career payload. No automatic
-- import, model access, analytics or external submission is introduced.
CREATE TABLE founder_workspaces (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision > 0),
 payload TEXT NOT NULL,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
-- Replay receipts contain hashes, not prior private workbook contents.
CREATE TABLE founder_save_receipts (
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision > 0),
 saved_at TEXT NOT NULL,
 PRIMARY KEY(user_id,request_key)
);
