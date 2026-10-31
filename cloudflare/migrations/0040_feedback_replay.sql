-- Opaque retry identity only; no account, IP or extra report content is attached.
ALTER TABLE feedback ADD COLUMN request_key TEXT;
ALTER TABLE feedback ADD COLUMN request_hash TEXT;
CREATE UNIQUE INDEX feedback_request_key ON feedback(request_key) WHERE request_key IS NOT NULL;
