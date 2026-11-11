ALTER TABLE agent_investigations ADD COLUMN evaluation_suite TEXT NOT NULL DEFAULT 'end_to_end'
 CHECK(evaluation_suite IN ('end_to_end','critic'));
