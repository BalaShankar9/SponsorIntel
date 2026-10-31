-- An explicit paused comparison; existing campaign, receipts and budgets remain.
ALTER TABLE agent_investigations ADD COLUMN reference_profile TEXT;
CREATE TABLE research_reference_control (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 campaign TEXT NOT NULL CHECK(campaign IN ('real-adverts-2026-10-08-v1','real-adverts-2026-10-08-compact-v2')),
 enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), revision INTEGER NOT NULL DEFAULT 0,
 profile TEXT CHECK(profile IS NULL OR json_valid(profile)), reason TEXT NOT NULL DEFAULT '',
 updated_at TEXT, actor TEXT
);
INSERT INTO research_reference_control(singleton,campaign,enabled) VALUES(1,'real-adverts-2026-10-08-v1',1);
CREATE TABLE research_reference_reviews (
 request_id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL UNIQUE, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER research_reference_reviews_no_update BEFORE UPDATE ON research_reference_reviews
 BEGIN SELECT RAISE(ABORT,'Reference comparison reviews are append only.'); END;
CREATE TRIGGER research_reference_reviews_no_delete BEFORE DELETE ON research_reference_reviews
 BEGIN SELECT RAISE(ABORT,'Reference comparison reviews are append only.'); END;
CREATE TRIGGER research_reference_run_pin BEFORE UPDATE OF policy,models,reference_batch,reference_profile ON agent_investigations
 WHEN OLD.reference_profile IS NOT NULL AND (NEW.policy IS NOT OLD.policy OR NEW.models IS NOT OLD.models OR NEW.reference_batch IS NOT OLD.reference_batch OR NEW.reference_profile IS NOT OLD.reference_profile)
 BEGIN SELECT RAISE(ABORT,'A comparison attempt keeps its original identity.'); END;
CREATE TRIGGER research_reference_start_guard BEFORE INSERT ON agent_investigations
 WHEN (NEW.reference_batch GLOB 'real-adverts-2026-10-08-compact-v2-*' OR NEW.reference_profile IS NOT NULL) AND (
  NEW.reference_profile IS NULL OR
  NEW.kind<>'evaluation' OR NEW.evaluation_suite<>'end_to_end' OR NEW.policy<>'investigator-v4-compact-reference'
  OR NEW.reference_batch NOT GLOB 'real-adverts-2026-10-08-compact-v2-*'
  OR NOT EXISTS(SELECT 1 FROM research_reference_control WHERE singleton=1 AND campaign='real-adverts-2026-10-08-compact-v2' AND enabled=1 AND profile=NEW.reference_profile)
  OR NOT EXISTS(SELECT 1 FROM business_controls WHERE singleton=1 AND enabled=1 AND research=1))
 BEGIN SELECT RAISE(ABORT,'Reference comparison is paused or changed.'); END;
CREATE TRIGGER research_reference_call_guard BEFORE INSERT ON agent_research_steps
 WHEN EXISTS(SELECT 1 FROM agent_investigations r WHERE r.id=NEW.run_id AND r.reference_profile IS NOT NULL AND (
  NOT EXISTS(SELECT 1 FROM research_reference_control c WHERE c.singleton=1 AND c.campaign='real-adverts-2026-10-08-compact-v2' AND c.enabled=1 AND c.profile=r.reference_profile)
  OR NOT EXISTS(SELECT 1 FROM business_controls WHERE singleton=1 AND enabled=1 AND research=1)))
 BEGIN SELECT RAISE(ABORT,'Reference comparison is paused or changed.'); END;
