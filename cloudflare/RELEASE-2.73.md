# Sponsor Intel 2.73 — share the discovery allowance across owners and the scout

The automatic education scout enforced the existing five-new-leads UTC-day allowance, but the owner form could retain further identities after that allowance was full. An actual isolated Worker/D1 test reproduced two concurrent owner saves both succeeding when only one slot remained.

New owner identities now check the same retained-record count inside their write transaction. Automatic candidates, rejected leads and duplicate decisions all count on their first recorded day. Concurrent owners and an in-flight scout cannot add a sixth identity. Existing reviews remain available, and an identical unconfirmed request returns its original receipt before checking the allowance. Changed request contents still fail. A refused new identity creates no empty lead, revision or audit record. Historical records and spent source reservations are preserved.

The Discovery queue shows the UTC day, used and remaining allowance, and next day in the owner's local time. Filtering the queue does not change that count. A refusal retains the form; later admission requires a fresh evidence check, and a new day never clears a source/review hold. This strengthens the existing limit; it does not add a LinkedIn ingestion feed, publish jobs or raise request allowances.

## Validation

- **642 tests pass** on pinned Node 24.19.0. The actual Worker/D1 regressions cover combined automatic/owner admission, concurrent last-slot competition across two owners, lost acknowledgement recovery at capacity, changed-content rejection, duplicate identity handling, later revisions, an in-flight scout losing its last slot and UTC-day rollover without changing history. All source responses are fictional local fixtures.
- TypeScript/build, 17 prerenders, browser budgets and deployment dry-run pass. The lockfile changes only the application version; the same-day dependency audit remains applicable. No schema migration is needed; the successful 17:19 recovery inspection matches 40 migrations/166 schema objects.
- No production save or forced scout is needed for acceptance. Production owner reads and state preservation are recorded after deployment below. Future scheduled execution remains a separate gate.

## Rollback

The previous Worker is `0f7f72c2-63e5-4275-a4bc-356a2ae14486` (2.72). Its feedback replay protection remains intact. Rolling back would remove server enforcement for new owner discovery identities; operators would again need to enforce the five-lead ceiling manually. Preserve every discovery record, owner hold, source reservation and additive schema. Do not restore the database.

Deployment and live verification are pending at this code checkpoint.
