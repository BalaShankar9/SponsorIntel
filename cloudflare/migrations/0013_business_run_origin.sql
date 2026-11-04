-- Historical runs have no provable origin. New runs record the actual dispatcher.
ALTER TABLE business_runs ADD COLUMN trigger_kind TEXT NOT NULL DEFAULT 'unknown'
 CHECK(trigger_kind IN ('unknown','owner','scheduled'));
