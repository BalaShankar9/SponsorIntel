-- Private preparation only. There is no submission/dispatch state or credential.
CREATE TABLE application_batches (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 input_hash TEXT NOT NULL,
 profile_hash TEXT NOT NULL,
 items TEXT NOT NULL CHECK(json_valid(items)),
 state TEXT NOT NULL CHECK(state IN ('active','paused','cancelled')),
 revision INTEGER NOT NULL CHECK(revision>0),
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 last_request_key TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(user_id,request_key), UNIQUE(user_id,input_hash)
);
CREATE INDEX application_batches_owner ON application_batches(user_id,created_at);
CREATE TABLE application_batch_events (
 batch_id TEXT NOT NULL REFERENCES application_batches(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','paused','cancelled')),
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(batch_id,revision), UNIQUE(batch_id,request_key)
);
CREATE TRIGGER application_batch_snapshot_immutable
BEFORE UPDATE OF user_id,input_hash,profile_hash,items,request_key,request_hash,created_at ON application_batches
BEGIN SELECT RAISE(ABORT,'Application batch inputs are immutable'); END;
CREATE TRIGGER application_batch_event_immutable
BEFORE UPDATE ON application_batch_events
BEGIN SELECT RAISE(ABORT,'Application batch history is immutable'); END;
