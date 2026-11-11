-- Prospective observations only: existing jobs are not backfilled as discoveries.
CREATE TABLE job_movement_runs (
  id TEXT PRIMARY KEY,
  claim TEXT NOT NULL,
  observed_at TEXT NOT NULL UNIQUE,
  previous_at TEXT,
  trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('owner','scheduled','unknown')),
  baseline INTEGER NOT NULL CHECK(baseline IN (0,1)),
  before_counts TEXT NOT NULL,
  counts TEXT NOT NULL DEFAULT '{}',
  changes TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE job_movement_state (
  job_id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  sponsorship TEXT NOT NULL,
  evidence TEXT NOT NULL,
  available INTEGER NOT NULL CHECK(available IN (0,1)),
  observed_at TEXT NOT NULL
);
CREATE TABLE job_movement_events (
  run_id TEXT NOT NULL REFERENCES job_movement_runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('entered','returned','left','sponsorship_changed','evidence_changed')),
  reason TEXT NOT NULL,
  before_sponsorship TEXT,
  after_sponsorship TEXT,
  before_evidence TEXT,
  after_evidence TEXT,
  PRIMARY KEY(run_id,job_id)
);
CREATE INDEX job_movement_events_job ON job_movement_events(job_id,run_id);
