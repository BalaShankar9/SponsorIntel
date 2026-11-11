-- Individual evidence conflicts do not waive complete source validation.
CREATE TABLE job_review_revisions (
 id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL,
 apply_url TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 state TEXT NOT NULL CHECK(state IN ('held','released')),
 title TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('deadline_conflict','sponsorship_conflict','availability_conflict','other')),
 evidence_url TEXT NOT NULL,
 note TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 follow_up_at TEXT,
 actor TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,
 UNIQUE(source_id,apply_url,revision),
 CHECK((state='held' AND follow_up_at IS NOT NULL) OR (state='released' AND follow_up_at IS NULL))
);
CREATE INDEX job_review_source ON job_review_revisions(source_id,apply_url,revision DESC);
CREATE VIEW job_review_holds AS SELECT r.* FROM job_review_revisions r WHERE r.revision=(SELECT MAX(x.revision) FROM job_review_revisions x WHERE x.source_id=r.source_id AND x.apply_url=r.apply_url);
CREATE TRIGGER job_review_immutable_update BEFORE UPDATE ON job_review_revisions BEGIN SELECT RAISE(ABORT,'Job review history is immutable'); END;
CREATE TRIGGER job_review_immutable_delete BEFORE DELETE ON job_review_revisions BEGIN SELECT RAISE(ABORT,'Job review history is immutable'); END;
-- Remember a matched stable job ID so a renamed advert URL cannot escape its
-- unresolved review. These identity links never transfer to another source.
CREATE TABLE job_review_targets(source_id TEXT NOT NULL,apply_url TEXT NOT NULL,job_id TEXT NOT NULL,PRIMARY KEY(source_id,apply_url,job_id));
CREATE INDEX job_review_target_job ON job_review_targets(job_id);
CREATE TRIGGER job_review_retire AFTER INSERT ON job_review_revisions BEGIN
 INSERT INTO job_review_targets SELECT NEW.source_id,NEW.apply_url,j.id FROM jobs j WHERE j.board_id=NEW.source_id AND j.apply_url=NEW.apply_url AND NOT EXISTS(SELECT 1 FROM job_review_targets t WHERE t.source_id=NEW.source_id AND t.apply_url=NEW.apply_url AND t.job_id=j.id);
 UPDATE jobs SET active=0 WHERE board_id=NEW.source_id AND (apply_url=NEW.apply_url OR id IN (SELECT job_id FROM job_review_targets WHERE source_id=NEW.source_id AND apply_url=NEW.apply_url));
END;
-- A released review requires a collection started after the decision. A late
-- result from an older in-flight collection cannot reactivate it.
CREATE TRIGGER job_review_insert_guard AFTER INSERT ON jobs BEGIN
 INSERT INTO job_review_targets SELECT h.source_id,h.apply_url,NEW.id FROM job_review_holds h WHERE h.source_id=NEW.board_id AND h.apply_url=NEW.apply_url AND NOT EXISTS(SELECT 1 FROM job_review_targets t WHERE t.source_id=h.source_id AND t.apply_url=h.apply_url AND t.job_id=NEW.id);
 UPDATE jobs SET active=0 WHERE id=NEW.id AND active=1 AND EXISTS(SELECT 1 FROM job_review_holds h JOIN job_review_targets t ON t.source_id=h.source_id AND t.apply_url=h.apply_url WHERE t.job_id=NEW.id AND h.source_id=NEW.board_id AND (h.state='held' OR NEW.last_seen<=h.recorded_at));
END;
CREATE TRIGGER job_review_update_guard AFTER UPDATE OF active,board_id,apply_url ON jobs WHEN NEW.active=1 BEGIN
 INSERT INTO job_review_targets SELECT h.source_id,h.apply_url,NEW.id FROM job_review_holds h WHERE h.source_id=NEW.board_id AND h.apply_url=NEW.apply_url AND NOT EXISTS(SELECT 1 FROM job_review_targets t WHERE t.source_id=h.source_id AND t.apply_url=h.apply_url AND t.job_id=NEW.id);
 UPDATE jobs SET active=0 WHERE id=NEW.id AND EXISTS(SELECT 1 FROM job_review_holds h JOIN job_review_targets t ON t.source_id=h.source_id AND t.apply_url=h.apply_url WHERE t.job_id=NEW.id AND h.source_id=NEW.board_id AND (h.state='held' OR NEW.last_seen<=h.recorded_at));
END;
