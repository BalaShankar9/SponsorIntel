# Private account data boundaries

The application takes the account identity from its authenticated session, never a submitted user ID. Workspace writes use optimistic revisions: one of two simultaneous edits wins and the other receives a conflict. Search monitors are scoped to the same account. Account deletion requires a recent sign-in and atomically removes workspace, recovery material, sessions, credentials and the user; dependent search records cascade.

## Deletion race corrected in 2.59

Authentication can complete before another request deletes the account. The legacy workspace and recovery tables have no foreign key to the user. Their first-save/upsert statements must therefore check user existence atomically inside the insert. A preceding read is insufficient. If deletion wins, the request must report failure and cannot recreate private data. If the write wins, the subsequent deletion removes it. Workspace updates cannot recreate a deleted row.

The actual isolated Worker/auth/D1 test in `cloudflare/tests/workspace-account-runtime.test.mjs` verifies this ordering for both insert paths, with ordinary and minified bundles. A local service delays only the final SQL statement after authentication; all account and database operations are real local operations. Before the fix both cases returned 200 and retained one orphan row. After the fix they return 409/401 with no retained row. No production credentials, accounts, email or external AI service enter these tests.

The suite also verifies two-account isolation, origin checks, conflicting edits, fresh-session requirements, search ownership/deletion, recovery-code replacement, concurrent single-use redemption and revocation of previous sessions. These are focused regression checks, not a complete independent security audit. Production orphan inspection uses counts only and must never silently delete a row or expose its contents. Zero current orphans does not prove that the race never occurred historically.

## Recovery and deployment boundary

No database migration or existing-data rewrite is required. Keep the prepared research/application comparisons and their identities unchanged. The fix does not alter generation, workflow reservations or social delivery. Do not test account deletion on the owner's or a customer's account. Follow `RECOVERY_RUNBOOK.md` before any recovery action; restoring a database can reintroduce previously deleted data and credentials.
