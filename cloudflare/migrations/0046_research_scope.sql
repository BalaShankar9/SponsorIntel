-- Separate finite campaign. No old control, attempt, result or budget is reset.
ALTER TABLE agent_investigations ADD COLUMN scope_profile TEXT;
CREATE TABLE research_scope_control (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 prepared INTEGER NOT NULL DEFAULT 0 CHECK(prepared IN(0,1)),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1) AND enabled<=prepared),
 revision INTEGER NOT NULL DEFAULT 0, profile TEXT CHECK(profile IS NULL OR json_valid(profile)),
 reason TEXT NOT NULL DEFAULT '', actor TEXT, updated_at TEXT
);
INSERT INTO research_scope_control(singleton) VALUES(1);
CREATE TABLE research_scope_reviews (
 request_id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL UNIQUE, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER research_scope_reviews_no_update BEFORE UPDATE ON research_scope_reviews
 BEGIN SELECT RAISE(ABORT,'Scope reviews are append only.'); END;
CREATE TRIGGER research_scope_reviews_no_delete BEFORE DELETE ON research_scope_reviews
 BEGIN SELECT RAISE(ABORT,'Scope reviews are append only.'); END;
CREATE TRIGGER research_scope_no_reset BEFORE UPDATE ON research_scope_control
 WHEN OLD.prepared=1 AND (NEW.prepared<>1 OR NEW.profile IS NOT OLD.profile)
 BEGIN SELECT RAISE(ABORT,'A prepared scope campaign cannot be replaced or reset.'); END;
CREATE TRIGGER research_scope_no_delete BEFORE DELETE ON research_scope_control
 BEGIN SELECT RAISE(ABORT,'Scope controls cannot be deleted.'); END;
CREATE TRIGGER research_scope_legacy_hold BEFORE UPDATE ON research_reference_control
 WHEN EXISTS(SELECT 1 FROM research_scope_control WHERE prepared=1)
 BEGIN SELECT RAISE(ABORT,'Use the selected scope campaign controls. Earlier controls remain historical.'); END;
CREATE TRIGGER research_scope_start_guard BEFORE INSERT ON agent_investigations
 WHEN (EXISTS(SELECT 1 FROM research_scope_control WHERE prepared=1)
       OR NEW.scope_profile IS NOT NULL OR NEW.reference_batch GLOB 'real-adverts-2026-10-08-scope-v3-*') AND (
  NEW.scope_profile IS NULL OR NEW.reference_profile IS NOT NULL OR NEW.kind<>'evaluation'
  OR NEW.evaluation_suite IS NOT 'end_to_end' OR NEW.policy<>'investigator-v5-subject-scope'
  OR NEW.state<>'queued' OR NEW.calls<>0
  OR NEW.reference_batch IS NULL OR NEW.reference_batch NOT GLOB 'real-adverts-2026-10-08-scope-v3-[0-2][0-9]'
  OR CAST(substr(NEW.reference_batch,-2) AS INTEGER) NOT BETWEEN 1 AND 25
  OR NOT EXISTS(SELECT 1 FROM research_scope_control WHERE prepared=1 AND enabled=1 AND profile=NEW.scope_profile)
  OR NOT EXISTS(SELECT 1 FROM business_controls WHERE singleton=1 AND enabled=1 AND research=1)
  OR NOT EXISTS(SELECT 1 FROM business_daily WHERE day=substr(NEW.created_at,1,10) AND research_state='reserved')
  OR EXISTS(SELECT 1 FROM agent_research_steps WHERE state='calling'))
 BEGIN SELECT RAISE(ABORT,'Scope admission is paused, uncertain or changed.'); END;
CREATE TRIGGER research_scope_run_pin BEFORE UPDATE ON agent_investigations
 WHEN OLD.scope_profile IS NOT NULL AND (
 NEW.scope_profile IS NOT OLD.scope_profile OR NEW.reference_batch IS NOT OLD.reference_batch
 OR NEW.policy IS NOT OLD.policy OR NEW.models IS NOT OLD.models OR NEW.context IS NOT OLD.context
 OR NEW.created_at IS NOT OLD.created_at OR NEW.reference_profile IS NOT OLD.reference_profile
 OR NEW.kind IS NOT OLD.kind OR NEW.evaluation_suite IS NOT OLD.evaluation_suite
 OR NEW.calls<OLD.calls OR NEW.calls>4
 OR (OLD.state IN ('review','failed') AND (NEW.state<>OLD.state OR NEW.report IS NOT OLD.report OR NEW.error IS NOT OLD.error OR NEW.finished_at IS NOT OLD.finished_at)))
 BEGIN SELECT RAISE(ABORT,'Scope attempts retain identity, budget and terminal outcome.'); END;
CREATE TRIGGER research_scope_call_guard BEFORE INSERT ON agent_research_steps
 WHEN EXISTS(SELECT 1 FROM agent_investigations r WHERE r.id=NEW.run_id AND r.scope_profile IS NOT NULL AND (
  NEW.state<>'calling' OR r.state<>'running' OR r.calls>4
  OR NOT EXISTS(SELECT 1 FROM research_scope_control c WHERE c.prepared=1 AND c.enabled=1 AND c.profile=r.scope_profile)
  OR NOT EXISTS(SELECT 1 FROM business_controls WHERE singleton=1 AND enabled=1 AND research=1)))
 BEGIN SELECT RAISE(ABORT,'Scope calls are paused or changed.'); END;
CREATE TRIGGER research_scope_step_pin BEFORE UPDATE ON agent_research_steps
 WHEN EXISTS(SELECT 1 FROM agent_investigations WHERE id=OLD.run_id AND scope_profile IS NOT NULL) AND (
 OLD.state<>'calling' OR NEW.state NOT IN ('completed','failed','late_completed','late_failed')
 OR NEW.run_id<>OLD.run_id OR NEW.name<>OLD.name OR NEW.role<>OLD.role OR NEW.created_at<>OLD.created_at)
 BEGIN SELECT RAISE(ABORT,'Scope call receipts are immutable after completion.'); END;
CREATE TRIGGER research_scope_step_no_delete BEFORE DELETE ON agent_research_steps
 WHEN EXISTS(SELECT 1 FROM agent_investigations WHERE id=OLD.run_id AND scope_profile IS NOT NULL)
 BEGIN SELECT RAISE(ABORT,'Scope call receipts cannot be deleted.'); END;

CREATE TRIGGER research_scope_legacy_call_hold BEFORE INSERT ON agent_research_steps
 WHEN EXISTS(SELECT 1 FROM research_scope_control WHERE prepared=1)
 AND EXISTS(SELECT 1 FROM agent_investigations WHERE id=NEW.run_id AND scope_profile IS NULL)
 BEGIN SELECT RAISE(ABORT,'Earlier research cannot bypass the selected scope campaign.'); END;
CREATE TRIGGER research_scope_legacy_restart_hold BEFORE UPDATE OF state ON agent_investigations
 WHEN NEW.scope_profile IS NULL AND NEW.state IN ('queued','running')
 AND EXISTS(SELECT 1 FROM research_scope_control WHERE prepared=1)
 BEGIN SELECT RAISE(ABORT,'Earlier research cannot restart while the scope campaign is selected.'); END;
