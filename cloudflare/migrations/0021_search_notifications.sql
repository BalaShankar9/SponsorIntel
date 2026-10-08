-- Private, explicitly enabled monitors; no emails or marketing subscription.
CREATE TABLE search_monitors (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES career_workspaces(user_id) ON DELETE CASCADE,
 search_id TEXT NOT NULL,
 filters TEXT NOT NULL CHECK(json_valid(filters)),
 started_at TEXT NOT NULL,
 attempted_at TEXT,
 checked_at TEXT,
 UNIQUE(user_id,search_id)
);
CREATE INDEX search_monitors_due ON search_monitors(attempted_at,id);
CREATE TABLE search_matches (
 monitor_id TEXT NOT NULL REFERENCES search_monitors(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 detected_at TEXT NOT NULL,
 read_at TEXT,
 PRIMARY KEY(monitor_id,job_id)
);
-- Search edits/removals revoke their monitor and all associated matches in
-- the same transaction as workspace saving. A stale scanner cannot revive it.
CREATE TRIGGER search_monitor_workspace_change AFTER UPDATE OF data ON career_workspaces BEGIN
 DELETE FROM search_monitors WHERE user_id=NEW.user_id AND NOT EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(NEW.data) THEN NEW.data ELSE '{}' END,'$.searches') s
  WHERE json_extract(s.value,'$.id')=search_monitors.search_id
  AND json_object('q',COALESCE(json_extract(s.value,'$.q'),''),'location',COALESCE(json_extract(s.value,'$.location'),''),'sponsorship',COALESCE(json_extract(s.value,'$.sponsorship'),''),'level',COALESCE(json_extract(s.value,'$.level'),''),'salary',COALESCE(json_extract(s.value,'$.salary'),''),'sector',COALESCE(json_extract(s.value,'$.sector'),''),'licence',COALESCE(json_extract(s.value,'$.licence'),''))=search_monitors.filters
 );
END;
