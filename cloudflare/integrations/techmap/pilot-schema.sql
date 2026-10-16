-- PILOT ONLY. Not a production migration or an enabled source.
-- Provision a single row after checking the subscription, remaining allowance,
-- exact billing-period bounds and permission to evaluate the data. No auto-reset.
CREATE TABLE IF NOT EXISTS techmap_pilot_budget (
  provider TEXT PRIMARY KEY CHECK (provider = 'techmap'),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  approval_reference TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL CHECK (period_end > period_start),
  max_requests INTEGER NOT NULL CHECK (max_requests BETWEEN 1 AND 80),
  used_requests INTEGER NOT NULL DEFAULT 0 CHECK (used_requests >= 0)
);
