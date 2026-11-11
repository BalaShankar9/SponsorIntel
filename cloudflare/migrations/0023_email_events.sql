-- Provider lifecycle metadata only: no addresses, subjects, message bodies or tokens.
CREATE TABLE email_delivery_events (
 event_id TEXT PRIMARY KEY, message_id TEXT NOT NULL, recipient_key TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('delivered','deferred','bounced','failed','rejected','complained')),
 priority INTEGER NOT NULL, bounce_type TEXT, occurred_at TEXT NOT NULL, received_at TEXT NOT NULL
);
CREATE INDEX email_delivery_message ON email_delivery_events(message_id,recipient_key,priority DESC,occurred_at DESC);
CREATE INDEX email_delivery_received ON email_delivery_events(received_at);
CREATE TABLE email_alert_blocks (
 recipient_key TEXT PRIMARY KEY,
 reason TEXT NOT NULL CHECK(reason IN ('hard_bounce','complaint','delivery_failure')),
 occurred_at TEXT NOT NULL, expires_at TEXT
);
