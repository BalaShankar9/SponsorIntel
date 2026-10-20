# Private application batches

First preparation slice, **2.89 / 20 October 2026**. This implements part of the owner's application-tool request in `APPLICATION_AND_SPONSOR_GROWTH_PLAN.md`. It does **not** implement autonomous employer submission, applicant approval for dispatch or a background preparation service.

## Applicant flow

In **My applications → Prepare a group of applications**, a signed-in user selects between one and 100 distinct saved roles, including an explicit select-all control and individual exclusions. This is the displayed saved-role snapshot, not every job in the public catalogue or future vacancies. The existing workspace limit remains 100.

The user requests deterministic evidence notes from the synced CV and selected working adverts. Shared terms, source excerpts and gaps are aids for review, never a proficiency, eligibility or hiring score. This does not call AI, generate final CVs/letters, answer screening questions or contact an employer. The existing single-role Studio remains separate.

Missing name/email/CV/advert/link, manual-entry uncertainty, existing applied/interview/offer/closed stages and employer CV restrictions are made visible. Current catalogue availability and reviewed source versions use the existing preparation guards. Missing, held, awaiting-refresh, expired, removed, stale or changed originals cannot prepare new notes. Link presence is not proof that an employer form is accepting applications.

Notes are frozen at creation. Opening or rechecking reads current workspace and catalogue facts. Material profile, advert, document or stage changes flag the old notes; removed saved roles retain historical notes without pretending to be current. Unsynced client data hides notes until a matching server workspace check. Ordinary observation timestamps and private tracking notes do not change the preparation identity. A returned current role without earlier notes is flagged for a new selection rather than claiming notes were prepared.

Users can pause, reopen or end a batch. These controls manage this preparation record; **there is no background dispatch to stop**. Ending is terminal and does not erase notes/history. Repeating unchanged inputs and availability returns the existing record. Changed material inputs or source availability can create a new reviewed selection. Maximum 20 retained batches/account and 100 state revisions/batch; ending does not refund the retained-record allowance. This bounded first slice has no batch-delete or batch-import control.

## Privacy and integrity

Separate private `application_batches` / `application_batch_events` tables avoid old workspace clients discarding new fields. Session identity scopes every read/write; mutations also require the expected account and same-origin JSON request. Inputs are read from the account workspace, not client-supplied reports or another user's records. A workspace revision/user-existence check occurs inside the creation transaction. Account deletion cascades batches and history; an already authenticated in-flight save cannot recreate them.

Snapshot and history updates are database-blocked. Creation uses an exact request reference, workspace fingerprint and source-availability fingerprint; state edits use an expected revision. A lost response is reconciled by replaying the same reference. The browser retains only the pending path, request reference, account, selected IDs and hashes in account-scoped session storage, not CV content. An uncertain response cannot silently initiate a different action. Cross-account UI responses are discarded, and server account mismatches are rejected.

One bounded catalogue query covers at most 100 job IDs. The evidence payload is capped at 1.5 million UTF-8 bytes; oversize returns an explicit failure without truncating notes. Batch API reads/writes have a 60/account/hour rate cap, distinct from all existing AI/source/Google/email/social allowances. No provider credentials, external request queue or submission status are stored. HTTP responses remain private/no-store.

The private JSON download is an archive for inspection, **not an importable workspace backup**. It can contain CV excerpts. Existing account workspace backups and browser recovery copies do not include these separate batches. Account removal deletes the server copies, not files the user downloaded. Do not insert fictional batches into production or test deletion on real accounts.

## Provider route inventory and next gates

Current supported submission providers: **none**. Existing Greenhouse, Lever, Workable, BambooHR, SmartRecruiters, school and employer application links are discovery/original-route evidence. A public job feed or an Apply link does not grant application API access. HireStack-derived document generation remains the existing MIT-attributed single-role tool; it is not an employer connector.

Next implement applicant-approved fact/answer packs, an explicit destination-and-document preview, immutable approval versions, per-role queue states and revocation. Then assess one permitted provider's documented route and actual permissions. Validate a fictional or provider test environment for attachment correctness, duplicate dispatch, stale facts, changed answers, lost acknowledgements, cancellation and account isolation. Only a separately applicant-authorised real pilot can establish actual submission/receipt reconciliation. Unknown screening answers, attestations, CAPTCHA, account creation/terms and new access require the defined applicant handoff. No fabricated answers, bypass or silent mass send.

Approval must pin job, destination, documents, answers and consent. Material changes invalidate it. A click, saved draft, generated note or the user's manual Applied stage is not a provider-confirmed submission. Keep prepared, authorised, attempted, confirmed, uncertain and interview outcomes separate. No promotion of the currently evaluated writer/reviewer is implied.

## Release and rollback

Migration **0043** adds two tables, an owner index and two immutability triggers: **43 migrations / 182 objects** expected. Keep additive private data/history on Worker rollback to 2.88; the prior UI cannot display batches but does not delete them. Never restore production to fix a code defect. Use `RECOVERY_RUNBOOK.md` for exact identity/recovery checks.

Actual isolated Worker/auth/D1 tests cover account/origin isolation, exact replay, simultaneous state edits, immutable snapshots, changed/removed roles and CVs, terminal end, account cascade, concurrent deletion/workspace edits, the 20-record race and all 100 selected manual roles. Fictional browser checks cover select-all/exclusion, lost-save replay, retained pause after reload, unavailable/changed labels, mobile overflow and terminal end. These tests establish implementation behaviour, not application-writing quality, employer acceptance or hiring outcomes.
