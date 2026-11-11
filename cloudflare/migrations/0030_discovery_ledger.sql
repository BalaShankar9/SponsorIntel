-- Private source leads. Revisions retain evidence and decisions; none publish jobs.
CREATE TABLE discovery_leads (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TABLE discovery_revisions (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES discovery_leads(id),
  revision INTEGER NOT NULL CHECK(revision>0),
  content TEXT NOT NULL CHECK(json_valid(content)),
  job_proof TEXT CHECK(job_proof IS NULL OR json_valid(job_proof)),
  actor TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  UNIQUE(lead_id,revision)
);
CREATE INDEX discovery_revision_time ON discovery_revisions(recorded_at);
CREATE TRIGGER discovery_leads_immutable BEFORE UPDATE ON discovery_leads BEGIN SELECT RAISE(ABORT,'Lead identity is immutable'); END;
CREATE TRIGGER discovery_leads_retained BEFORE DELETE ON discovery_leads BEGIN SELECT RAISE(ABORT,'Lead history must be retained'); END;
CREATE TRIGGER discovery_revisions_immutable BEFORE UPDATE ON discovery_revisions BEGIN SELECT RAISE(ABORT,'Discovery revisions are immutable'); END;
CREATE TRIGGER discovery_revisions_retained BEFORE DELETE ON discovery_revisions BEGIN SELECT RAISE(ABORT,'Discovery history must be retained'); END;
