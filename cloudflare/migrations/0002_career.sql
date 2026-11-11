CREATE TABLE IF NOT EXISTS jobs (
 id TEXT PRIMARY KEY, board_id TEXT NOT NULL, company TEXT NOT NULL, title TEXT NOT NULL,
 location TEXT NOT NULL, description TEXT NOT NULL, apply_url TEXT NOT NULL, provider TEXT NOT NULL,
 source_updated_at TEXT, sponsorship TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '', level TEXT NOT NULL,
 first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS jobs_active ON jobs(active,last_seen,first_seen);
CREATE INDEX IF NOT EXISTS jobs_board ON jobs(board_id);
CREATE TABLE IF NOT EXISTS job_sources (id TEXT PRIMARY KEY,company TEXT NOT NULL,careers_url TEXT NOT NULL,checked_at TEXT,last_success TEXT,count INTEGER NOT NULL DEFAULT 0,error TEXT);
CREATE TABLE IF NOT EXISTS career_workspaces (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_codes (user_id TEXT PRIMARY KEY, hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_usage (key TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL);
