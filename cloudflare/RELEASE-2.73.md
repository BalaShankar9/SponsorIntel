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

Live **2.73.0**, Worker **`048f4316-de47-43e2-a508-cc641324001b`**, code **`19139ea`**, verified **13 October 2026 at 17:58:39 UTC**. Excluded health/jobs return 200, anonymous discovery access 403, and the exact served owner bundle matches the build. Authenticated owner reads show **19 retained leads, 4/5 used today, 1 remaining**, unchanged when the list is filtered. The 390-pixel layout has a 390-pixel document width; the viewport and filters were restored, leaving Overview open.

Fourteen protected application/control groups and six discovery/source/job groups match across deployment: 19 identities, 41 revisions, original scout receipts and complete job/board tables remain unchanged. Shared AI stays two starts/six calls. No production form save, public job, forced workflow, model/Google attempt or social/email send was added. Code-head Linux checks 115453562105/115453535218 are billing-blocked before execution; annotations inspected. GitGuardian 115453542338 passed. These local checks do not establish hosted Linux execution.

Aggregate receipt: `cloudflare/tests/evidence/discovery-allowance-2026-10-13.json`. The separate genuine **business-497753** receipt now observes 19 leads and the completed comparison's 2/20 cases and 15/15 assessments. That 17:45 snapshot predates 2.73; the new allowance summary and next eligible scout still need their own genuine scheduled observation. See `business-1745-2026-10-13.json`.
