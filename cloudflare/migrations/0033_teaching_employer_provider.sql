-- Preserve every retained source identity, review, owner relation and state.
-- No source is created or approved by this provider-constraint migration.
CREATE TABLE employer_boards_expanded (
 id TEXT PRIMARY KEY, company TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN ('greenhouse','lever','ashby','teaching-vacancies')),
 board TEXT NOT NULL, careers TEXT NOT NULL, sector TEXT NOT NULL,
 sponsor_id TEXT NOT NULL, evidence TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','paused')),
 created_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by TEXT REFERENCES user(id) ON DELETE SET NULL,
 UNIQUE(provider,board)
);
INSERT INTO employer_boards_expanded(id,company,provider,board,careers,sector,sponsor_id,evidence,state,created_at,reviewed_at,reviewed_by)
 SELECT id,company,provider,board,careers,sector,sponsor_id,evidence,state,created_at,reviewed_at,reviewed_by FROM employer_boards;
DROP TABLE employer_boards;
ALTER TABLE employer_boards_expanded RENAME TO employer_boards;
