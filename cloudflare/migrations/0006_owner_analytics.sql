-- Owner access is tied to a provisioned user ID, never a claimed email address.
CREATE TABLE admin_members (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL
);
CREATE TABLE analytics_daily (
 day TEXT NOT NULL, event TEXT NOT NULL, dimension TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,event,dimension)
);
CREATE TABLE employer_boards (
 id TEXT PRIMARY KEY, company TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN ('greenhouse','lever','ashby')),
 board TEXT NOT NULL, careers TEXT NOT NULL, sector TEXT NOT NULL,
 sponsor_id TEXT NOT NULL, evidence TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','paused')),
 created_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by TEXT REFERENCES user(id) ON DELETE SET NULL,
 UNIQUE(provider,board)
);
CREATE TABLE source_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, checked_at TEXT NOT NULL,
 success INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX source_runs_time ON source_runs(checked_at DESC);
CREATE TABLE admin_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL
);
