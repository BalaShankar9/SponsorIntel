-- Source-supplied date or zoned timestamp, and its canonical UTC expiry.
-- NULL means no verified deadline was supplied. Existing observations and
-- personal application workspaces are intentionally untouched.
ALTER TABLE jobs ADD COLUMN application_deadline TEXT;
ALTER TABLE jobs ADD COLUMN closes_at TEXT;
