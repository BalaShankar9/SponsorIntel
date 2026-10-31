CREATE TABLE IF NOT EXISTS student_sponsors (
  snapshot TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  locations TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  routes TEXT NOT NULL,
  compliance TEXT NOT NULL,
  PRIMARY KEY (snapshot,id)
);
CREATE INDEX IF NOT EXISTS student_sponsors_name ON student_sponsors(snapshot,name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS student_sponsors_city ON student_sponsors(snapshot,city COLLATE NOCASE);
