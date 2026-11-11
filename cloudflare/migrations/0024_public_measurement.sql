-- Do not relabel old, mixed operator/customer counts as a filtered baseline.
CREATE TABLE analytics_public_daily (
 day TEXT NOT NULL, event TEXT NOT NULL, dimension TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,event,dimension)
);
INSERT INTO metadata(key,value) VALUES('analytics_v2',json_object('version',2,'enabled_at',strftime('%Y-%m-%dT%H:%M:%fZ','now')));
