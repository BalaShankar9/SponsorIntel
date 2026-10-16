-- Private fictional development tests. No customer data and no automatic promotion.
CREATE TABLE application_eval_controls(singleton INTEGER PRIMARY KEY CHECK(singleton=1),enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),updated_at TEXT,actor TEXT);
INSERT INTO application_eval_controls(singleton) VALUES(1);
CREATE TABLE application_eval_runs(
 id TEXT PRIMARY KEY,day TEXT NOT NULL UNIQUE,
 trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('scheduled','owner')),
 state TEXT NOT NULL CHECK(state IN ('queued','running','completed','held','failed','paused')),
 created_at TEXT NOT NULL,finished_at TEXT,profile TEXT NOT NULL,case_ids TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0 CHECK(calls BETWEEN 0 AND 6),result TEXT,error TEXT
);
CREATE UNIQUE INDEX application_eval_one_active ON application_eval_runs((1)) WHERE state IN ('queued','running');
CREATE TABLE application_eval_steps(
 run_id TEXT NOT NULL REFERENCES application_eval_runs(id),case_id TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('write','baseline','candidate')),
 state TEXT NOT NULL CHECK(state IN ('calling','completed','rejected','failed')),
 created_at TEXT NOT NULL,finished_at TEXT,raw TEXT,output TEXT,usage TEXT,error TEXT,
 PRIMARY KEY(run_id,case_id,stage)
);
-- Retained comparison evidence is not affected by routine business-run cleanup.
