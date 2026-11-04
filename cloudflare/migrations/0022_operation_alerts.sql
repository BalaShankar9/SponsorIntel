-- Opt-in operational mail for verified owners. No customer content or tokens.
CREATE TABLE operation_alert_settings (
 user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), destination TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL,
 last_fingerprint TEXT, last_alert_at TEXT, last_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE operation_alert_deliveries (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 settings_revision INTEGER NOT NULL, destination TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('incident','recovery','test')),
 fingerprint TEXT NOT NULL, source_run TEXT,
 critical_count INTEGER NOT NULL, high_count INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('reserved','accepted','uncertain','cancelled','confirmed')),
 created_at TEXT NOT NULL, finished_at TEXT, message_id TEXT, received_at TEXT
);
CREATE UNIQUE INDEX operation_alert_one_uncertain ON operation_alert_deliveries(user_id) WHERE state IN ('reserved','uncertain');
CREATE INDEX operation_alert_time ON operation_alert_deliveries(created_at);
CREATE TRIGGER operation_alert_owner_limit_insert BEFORE INSERT ON operation_alert_settings
 WHEN NEW.enabled=1 AND (SELECT COUNT(*) FROM operation_alert_settings WHERE enabled=1 AND user_id<>NEW.user_id)>=5
 BEGIN SELECT RAISE(ABORT,'Five alert owners already enabled'); END;
CREATE TRIGGER operation_alert_owner_limit_update BEFORE UPDATE OF enabled ON operation_alert_settings
 WHEN NEW.enabled=1 AND (SELECT COUNT(*) FROM operation_alert_settings WHERE enabled=1 AND user_id<>NEW.user_id)>=5
 BEGIN SELECT RAISE(ABORT,'Five alert owners already enabled'); END;
