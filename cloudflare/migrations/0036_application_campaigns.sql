-- Additive version boundary. Old evidence, daily uniqueness and pause survive.
CREATE TABLE application_eval_campaigns(
 id TEXT PRIMARY KEY,profile TEXT UNIQUE,created_at TEXT NOT NULL,
 actor TEXT,reason TEXT NOT NULL,request_key TEXT UNIQUE,request_hash TEXT,
 CHECK(id='legacy-v1' OR (profile IS NOT NULL AND actor IS NOT NULL AND request_key IS NOT NULL AND request_hash IS NOT NULL))
);
INSERT INTO application_eval_campaigns(id,created_at,reason) VALUES('legacy-v1',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'Original retained campaign; this boundary was recorded at migration, not at the original run time. Source profiles and failed outcomes preserved.');
CREATE TABLE application_eval_campaign_control(singleton INTEGER PRIMARY KEY CHECK(singleton=1),campaign_id TEXT NOT NULL REFERENCES application_eval_campaigns(id));
INSERT INTO application_eval_campaign_control VALUES(1,'legacy-v1');
ALTER TABLE application_eval_runs ADD COLUMN campaign_id TEXT REFERENCES application_eval_campaigns(id);
UPDATE application_eval_runs SET campaign_id='legacy-v1' WHERE campaign_id IS NULL;
CREATE INDEX application_eval_campaign_runs ON application_eval_runs(campaign_id,created_at);
CREATE TRIGGER application_eval_legacy_insert AFTER INSERT ON application_eval_runs WHEN NEW.campaign_id IS NULL BEGIN
 UPDATE application_eval_runs SET campaign_id='legacy-v1' WHERE id=NEW.id;
END;
CREATE TRIGGER application_eval_campaign_immutable BEFORE UPDATE ON application_eval_campaigns BEGIN SELECT RAISE(ABORT,'Application campaign is immutable'); END;
CREATE TRIGGER application_eval_campaign_preserve BEFORE DELETE ON application_eval_campaigns BEGIN SELECT RAISE(ABORT,'Application campaign history is retained'); END;
CREATE TRIGGER application_eval_campaign_profile BEFORE INSERT ON application_eval_runs
 WHEN NEW.campaign_id IS NOT NULL AND NEW.campaign_id!='legacy-v1' AND NOT EXISTS(SELECT 1 FROM application_eval_campaigns WHERE id=NEW.campaign_id AND profile=NEW.profile)
 BEGIN SELECT RAISE(ABORT,'Application campaign profile mismatch'); END;
CREATE TRIGGER application_eval_campaign_identity BEFORE UPDATE OF campaign_id ON application_eval_runs WHEN OLD.campaign_id IS NOT NULL AND NEW.campaign_id IS NOT OLD.campaign_id
 BEGIN SELECT RAISE(ABORT,'Application run campaign is immutable'); END;
