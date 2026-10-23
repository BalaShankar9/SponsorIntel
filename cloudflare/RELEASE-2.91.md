# Sponsor Intel 2.91 — deliberate discovery observations

## Problem and change

The 20 October Nu Quantum review needed an append-only precision correction: the new-lead form prefilled a current instant but showed only minutes. Entering the same visible minute could leave its original hidden seconds in the saved evidence.

New discovery observations now start blank. A reviewer enters the actual observation or deliberately confirms **I checked the source just now**. Observation, optional posting/closing times and follow-ups use explicitly labelled UTC fields, showing retained seconds/milliseconds and a local-time equivalent. This avoids ambiguous local clock-change hours. Minute-only input becomes zero seconds/milliseconds; it does not establish finer source precision.

The save reads the visible form values and validates exact calendar dates before creating a request. Existing instants survive unrelated edits, optional unknown dates stay null and uncertain retries retain the exact original request. Server recording timestamps, source identity, immutable revisions, source admission, source/model allowances and automated scouting are unchanged. No migration, new dependency, source fetch, model call or production evidence write is required.

## Validation

- **737/737 tests pass** on pinned Node 24.19.0. Three additions cover four time zones and clock-change/leap-day boundaries, minute/millisecond precision, invalid dates, deliberate observations, actual discovery save/replay/history, and the rendered real form. An initial new assertion incorrectly expected a React comment in static markup; correcting that test expectation left production behaviour unchanged.
- TypeScript/build, **19 prerenders**, browser budgets and Worker dry run pass. Initial JavaScript 390,965 bytes / 119,415 gzip; CSS 109,950 / 22,776 gzip. Application/research source identities are unchanged. No install or dependency graph change; same-day recovery/security evidence applies.
- A real browser against the fictional local desk/API/database verified: blank observation prevents a save; a minute-only new record stores zero seconds; a deliberately lost acknowledgement retries exactly once without another decision; an unrelated edit preserves `.127` seconds; an explicit minute correction appends history. Four save attempts plus one initial fixture yield four revisions/audits, including one replay. No production test record or external call.
- Phone viewport/document are both **390px**, form **358px**, date fields **332px**, without horizontal overflow. UTC milliseconds and the local-time explanation are visible. The explicit current-time button changes only the unsaved form. Temporary tab, viewport override, preview process and generated preview directory were removed.

## Publication and rollback

**Deployed 20 October 2026 at 17:37:01.004 UTC**: Worker **2ef44b92-944f-4a78-8316-23be998100c3**, deployment **2db003ee-6f18-4442-8e87-7c62cab4b81e**, runtime commit `b7f3639dff3788347c73fef3bc3dc2f671cf46a1`, 100% traffic. Excluded health returned 2.91.0. Owner browser verification completed 23 October at 01:08 UTC: blank required observation, explicitly UTC-labelled millisecond fields and unchanged unknown optional dates. The new form was closed without saving. Compatible rollback is Worker **ae6db52c-5740-4a5e-be60-688f4e418ae9**, runtime source **311ebedc921ca125f54907833ce3827a92a424e1**. Keep additive tables, every existing review and all later receipts; do not restore a database for this UI rollback.

Before publication, read-only D1 at **20 October 17:34:30.268 UTC** retains **27 leads / 72 revisions / 62 owner-review audit rows**. The difference includes automatic candidates; it is not a claim that every revision has an owner audit. Preserve exact rows across deployment and verify the owner form without saving a synthetic lead. Schema remains **43 migrations / 182 objects** with the successful same-day 16:19:46.010 UTC identity/recovery-point check. This is not customer restore acceptance.

The existing PR remains open/unmerged. Inspect hosted checks on the exact pushed head; the existing account billing lock is separate from passing local validation. Full autonomy, broader sourcing, independent model quality and business outcomes remain open.

The saved 20 October before/after snapshots were compared exactly on 23 October: all discovery leads/revisions/owner-review audit rows and all fourteen operational groups match. This verifies the deployment interval, not an absence of later legitimate scheduled changes. See `tests/evidence/discovery-time-2026-10-20.json`. Runtime-head checks 118782866136 and 118782846638 were billing-blocked before execution; GitGuardian 118782895510 passed.
