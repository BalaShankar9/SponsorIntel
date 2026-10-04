ALTER TABLE feedback ADD COLUMN context TEXT NOT NULL DEFAULT '{}';
ALTER TABLE feedback ADD COLUMN app_version TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created_at DESC);
