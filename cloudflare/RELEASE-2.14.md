# Sponsor Intel 2.14 — marketing records and review desk

7 October 2026. The private owner dashboard now retains the path from a sourced brief to editorial decisions and observed provider delivery. Content versions, decisions and receipts are separate records. Editing copy revokes its previous review; concurrent changes cannot both win. HTTP callers receive their owner identity from the session and cannot impersonate another reviewer. Authors cannot approve their own version.

The desk imports four previously observed launch schedules: three Facebook posts through Metricool and one native LinkedIn company post. Their exact copy and original observation dates remain visible. These imports do not claim a retrospective independent review or publication. The native LinkedIn reference is an observation reference, not an invented provider post ID. Facebook's three PENDING records were read back again through the connector during this release.

The business workflow prepares report briefs hourly from the existing outbox and suppresses a second brief for the same report/destination. Matching old copy controls are hidden; source records are preserved. A personal report brief is held for independent editorial review, overlap with the launch content and a reviewed campaign mapping. Prepare & reconcile is replay-safe and preserves that hold.

## Boundaries

This release records decisions and observations. It does not select new marketing ideas, write posts with a model, independently fact-check copy, call social publishing APIs, cancel external schedules or learn from performance. The current review UI records the operator's assessment. Future planner/writer/reviewer stages will consume these versioned records.

A scheduling observation requires reviewed, unexpired content, an exact allowed account/provider, a reference and evidence notes. Scheduled time cannot exceed the oldest source's seven-day evidence lifetime. A withdrawn or replaced report cannot receive a new review or schedule. Published observations require a post URL on the selected social network; an operator must still verify the account, text and provider state. Saved manual observations are not API-verified deliveries. Uncertain outcomes cannot be retried as a new schedule. External posting limits and source checks still apply.

Instagram remains absent from the destination allowlist while its professional profile and publisher access are unfinished. No credentials, account permissions, model settings, spending limits or social schedules were changed. The ledger reads no customer profiles, CVs or application documents. Its allowed evidence URLs currently cover Sponsor Intel and GOV.UK; direct employer promotion needs a later evidence adapter.

## Verification

- All **154** project tests passed. Thirteen marketing tests cover stale/malformed evidence, self-review and actor impersonation, edits invalidating review, wrong destinations, uncertain delivery, missing publication URLs, concurrent updates, duplicate receipt ownership, idempotency, old report versions, launch reconciliation and customer-data exclusion.
- Production typecheck/build, 17-page prerender and Wrangler dry-run packaging passed. Local Workerd accepted the schema and exercised import, replay and a synthetic review against isolated local D1. No model call or external publishing request was made by that harness; it is outside the repository and was never deployed.
- Live anonymous marketing access returned 403. In the signed-in owner UI, reconciliation produced five briefs: four recorded schedules and one personal report proposal. Holding the personal draft persisted the reason; repeating reconciliation created zero briefs and retained the hold.
- Remote D1 confirmed four scheduled briefs, one held brief, four historical schedule events, one proposal and one hold. There are no publication events for these four queued posts. Desktop and 390px-wide layouts were checked; the desk had no horizontal overflow. Proof: the parent task's `outputs/marketing-desk-live.png` and `outputs/marketing-desk-mobile.png`.
- Live business workflow `business-497613` completed at `2026-10-07T21:33:07.241Z`. Its marketing result was `prepared: 0, external_posts_sent: 0`; it retained existing records. The report was not due, no stale jobs were retired and research stayed held by its existing availability/budget controls. This was an owner-triggered acceptance run through the same cloud workflow, not evidence of a later cron tick or desktop heartbeat execution.
- Live acceptance caught a source/queue timestamp mismatch. A report snapshot predates outbox creation by a few seconds; expiry now uses the earlier snapshot time, with a regression test. The first import retained the four schedule records safely, and retry after correction created only the missing personal brief.

## Deployment and recovery

Current Worker: `1bc441fd-a33b-4de1-88be-57bd99b28cfe` at https://sponsorintel.london. Pre-feature code rollback: `a2514058-0d68-47d3-ae15-83cfe2b3d537`. Migration `0011_marketing_ledger.sql` adds four tables, indexes and a duplicate-receipt trigger; it does not change customer tables. It applied successfully locally and remotely.

A D1 Time Travel bookmark for **2026-10-07T21:23:00Z**, before the migration, was retrieved after application: `0000025c-00000044-000050fd-208f5981c3c53ed3270c1ffa3d24f4c1`. No restore was performed. Prefer code rollback while retaining additive tables and later records; do not restore the whole database over newer user activity to undo a code defect.

Implementation reference: [D1 prepared statements and transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/). Next build stages and review limitations are in `docs/MARKETING_AGENTS.md`.
