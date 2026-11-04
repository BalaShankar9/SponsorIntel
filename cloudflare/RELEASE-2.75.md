# Sponsor Intel 2.75 — retain a real publishing schedule

A reviewed draft could be held in the owner desk, but there was no UI for recording its confirmed provider schedule. Reviewed cards now offer a collapsed **Record an existing provider schedule** form. It retains the actual provider reference, inspection and scheduled times, exact destination, evidence note and agent-assisted/owner attribution. An explicit check covers copy, source freshness, queue duplication and the existing posting allowance; registered artwork requires an ordered-image/accessibility check. These are operator attestations, not automatic provider verification.

The form records an existing schedule through the owner-authenticated ledger. It never publishes, schedules or cancels a post, clears a hold, starts a model or grants access. A proposed planner slot is not populated as a provider receipt. Evidence must remain valid through the scheduled time. Existing server-side review, version, account, media, opportunity and duplicate-receipt guards remain.

A network/gateway error or unrecognised acknowledgement freezes the complete serialized request, including its identity, timestamps and revision. The retry repeats only that ledger request. Competing hold actions on that card are disabled while the save is uncertain. A confirmed save followed by a failed refresh cannot become another save. This recovery identity lives in the open page only: after reload or navigation, reconcile the ledger and original provider job before doing anything else. A structured rejection permits correction. Unexpected storage failures now return HTTP 500, so they cannot be mistaken for rejected input; the client also treats the old generic HTTP 400 failure as uncertain.

The editorial no-post label is now **No post selected**: a lack of an eligible source/slot does not establish that marketing is unnecessary. No migration or dependency graph change is required.

## Validation

648 tests pass on pinned Node 24.19.0/npm 11.8.0 (69.1 seconds), with TypeScript, production build, 17 prerenders, browser budgets and Worker dry run. New tests exercise real Worker/auth/D1 access, wrong-account and cross-origin rejection, exact replay after a committed write loses its acknowledgement, conflicting requests and server-error classification. No external provider is called.

The actual desk in an isolated fictional browser fixture rejects a slot beyond expiry, preserves seconds while other fields change, freezes inputs and the competing hold after a simulated post-commit gateway failure, and successfully repeats the identical request. The database contains one receipt and one schedule event after two identical requests. The 390-pixel layout has a 390-pixel document and 290-pixel form, without horizontal overflow. An earlier socket-loss variant was transparently replayed by Chrome and also retained a single receipt; the gateway variant explicitly exercised the visible recovery state.

Same-day dependency audit remains applicable: only package root versions changed. Zero high/critical and three known moderate Mammoth-chain findings remain; no inspected patched upstream version. The private local-state archive and unrelated outputs are untouched.

Rollback target: **2.74 Worker 3bce99a0-2531-48fe-9a3f-5a8f9026c4c0**. It removes this receipt UI/error classification while retaining the ledger and all records. No database restore. Real publication and delivery remain separate acceptance gates. Live rollout evidence follows after verification.

## Live verification — 15 October UTC / 16 October UK

Live Worker **acf4dc86-be65-4d54-a471-e13698ad06b9**, code **b2d003304af23402c338a1a33f6548fbd9872be0**. The authorised same-scope OAuth renewal completed. At 22:54:48.625 UTC the recovery check matched all 40 migrations/166 objects with a current recovery point; no export or restore. Fourteen selected control, receipt, run, issue and allowance groups match across deployment, with no foreign-key errors. This is the listed aggregate/operational selection, not a customer-data comparison. AI remains three starts/eight calls and source reservations 388/500.

Excluded live checks return 200 for health, jobs and the shortlist guide, 403 for anonymous marketing admin, and exact deployed owner-bundle bytes. The authenticated owner desk shows the new form and revised no-post label. The earlier direct guide 403 no longer reproduces. Original business-497806, source scheduled-1792089037000 and marketing-2026-10-14 are independently Cloudflare complete/success. Application business/source receipts still say attention, with 36 published sources and PortmanDentex skipped; platform completion does not clear findings.

One real, already-reviewed Facebook guide was then scheduled through Metricool, after a current source, account, published/queued duplication and cadence check. Job **397276739** / UUID **5376123507090214631** is **Pending for 16 October 10:00 Europe/London (09:00 UTC)**. Exact copy is unchanged. One initial missing-publicationDate argument was rejected before creation; the corrected call created one job, which was read back exactly. The new form retained **v1/revision 3** at **23:02:23.623 UTC**, with observed time **23:01:14 UTC**; independent D1 and owner browser reads agree. No extra model/source reservation, post on another destination, hold release or email send occurred. Delivery and business results remain pending.

Code-head Linux checks **116715733543/116715717268** were blocked before execution by GitHub billing; annotations inspected. GitGuardian **116715722317** passed. No rerun, payment or merge. Evidence: `tests/evidence/marketing-schedule-2026-10-15.json` and `shortlist-schedule-2026-10-15.json`.
