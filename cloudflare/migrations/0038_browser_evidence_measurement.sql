-- Separate browser-reported actions from successful server responses.
CREATE TABLE analytics_evidence_daily (
 day TEXT NOT NULL, dimension TEXT NOT NULL DEFAULT '',
 count INTEGER NOT NULL DEFAULT 0 CHECK(count>=0),
 PRIMARY KEY(day,dimension)
);
INSERT INTO metadata(key,value) VALUES('analytics_browser_evidence_v1',json_object('version',1,'enabled_at',strftime('%Y-%m-%dT%H:%M:%fZ','now')));
