# Sponsor Intel 2.59 — preserve account deletion during concurrent saves

A deterministic test of the actual Worker, authentication and isolated D1 confirmed a privacy race: an authenticated first workspace save or recovery-code creation could wait while its account was deleted, then recreate its private row and return success. This was reproduced only with fictional accounts. A read-only aggregate inspection on 11 October found zero current orphan workspaces and zero orphan recovery-code rows in production; that does not establish historical absence.

Both inserts now test account existence in the same SQL statement as the write. A delayed first save returns 409 without retaining data; a delayed recovery-code request returns 401 without retaining or returning a code. Existing workspace revision checks remain in place. Account deletion keeps its atomic transaction. No migration, customer deletion, data export or automatic cleanup is included.

## Verification

All 585 tests pass on pinned Node 24.19.0 in 56.3 seconds. Four additional runtime tests use the actual Worker/auth/D1 with fictional users: cross-account read/write isolation, cross-origin rejection, stale and simultaneous edits, search-monitor ownership and removal, fresh-session requirements, recovery-code rotation and concurrent single use, session revocation, and both deletion races in ordinary and minified bundles. Only the timing of the final SQL write is controlled by a local test service; no request reaches a real provider. An initial timing harness stalled because of request-context promise rules; it was replaced before reproducing the bug, and the final barrier has a bounded timeout.

TypeScript, production build, 17 prerenders and browser budgets pass. Both prepared model-source identities are unchanged. Dependencies, AI contracts, quotas and workflow controls are unchanged; both model comparisons remain paused throughout 11 October. The same-day 17:33:20 UTC recovery inspection verified 37 migrations and 161 objects with a current recovery point. That is not a production restore or retention-window test.

The rollback reference is 2.58 Worker `6419c7c8-42d1-43d0-a9db-fc3cebee1aab`; rolling back would also remove this fix. Live verification and exact hosted-check results are recorded below after deployment. No production account is created or deleted as a test.
