-- Original publication is distinct from our first observation and source edits.
-- Existing rows remain unknown until a successful source refresh supplies it.
ALTER TABLE jobs ADD COLUMN source_first_published_at TEXT;
