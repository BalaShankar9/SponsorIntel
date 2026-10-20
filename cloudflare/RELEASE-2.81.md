# 2.81 — Review untouched LinkedIn company reports

The existing daily MarketingWorkflow reviewed sourced guides, vacancy cards and the eligible Instagram welcome, but not the dated LinkedIn company reports produced by BusinessWorkflow. The current company report was still an unreviewed template despite having valid published evidence.

Future attempts use policy `sourced-guides-company-report-v7`. After the existing welcome eligibility check, the same daily workflow can select one untouched, original company report and use one configured critic call. It retains the exact caption, snapshot date, link and original expiry in a new immutable evidence version. Five excerpts come from the same renderer and retained snapshot used by the public report. Arithmetic, scope, limitations and link are given to the critic. Exact quote validation establishes receipt structure, not semantic correctness.

Only a `report-template` company draft at version/revision 1 can enter. Personal drafts, edits, holds, previously reviewed versions, media, expired evidence and a pending/uncertain recorded native company queue are excluded. The report must still be the published current version and match the unchanged company outbox text. Source content and the exact target are checked before the call and again before a decision. Atomic write guards preserve changed publication/outbox state, owner revision, pauses and pending delivery. A rejection or uncertain model outcome stays held with no rewriting or paid retry. Confirmed stopped-workflow supervision can hold only this run's unchanged evidence version.

This is **review preparation only**. No LinkedIn connection, automatic publisher, provider queue read, posting slot or delivery is created. Native account, duplicate/queue, exact copy and current source checks remain necessary before an authorised schedule. Facebook/Instagram limits are unchanged. Old v6 compact inputs and v5 legacy contexts remain unchanged; a used day cannot acquire another attempt after deployment.

## Validation and limits

- **689 tests pass**, plus TypeScript, build, 18 prerenders, browser budgets and Worker dry run on pinned Node 24.19.0. Tests cover one-call/replay behavior, expiry preservation, full unit/quotation coverage, owner changes, withdrawal/replacement, queue and outbox changes, pauses, atomic races, lost acknowledgements and stopped-workflow supervision.
- An actual isolated Workerd/D1/MarketingWorkflow executes the new branch with a deterministic fictional critic, one retained call, an unchanged personal draft and zero provider sends. This is execution evidence, not model-quality acceptance.
- A read-only production eligibility check on 18 October found company brief `dafbf66c-90aa-4773-bc1e-c1470b0a9bb1` at v1/r1. Its 55/952 dated 14 October caption matches public version `business-497777`; original expiry remains 21 October 17:46:07.946 UTC. No production model call, review, version or provider action was made by the check.
- No migration, model/provider parameter change, spending increase, hold clearance or new service. Same-day recovery/schema and dependency audit remain applicable with unchanged schema/lockfile dependency graph. Existing publication text is byte-for-byte unchanged.

Compatible rollback: **2.80 Worker `7840cbd7-0c53-443e-b116-69082e1567a2`**. Preserve any new immutable review records. Do not roll back while a new report-review workflow is active without inspecting its original status; a code rollback is not permission to rerun a consumed day or resume held work.

The first genuine production review is still pending; the 18 October daily attempt already completed under v6. Inspect the original next eligible daily run, exact model receipt and current report before any later provider handoff. No autonomous publishing or growth result is claimed.

Live **2.81.0**, Worker `c308c706-ec9a-40ce-ba45-26a8c721d0ac`, runtime commit `3ca60ccc770b85db9bb8b93fc76ab3196a424aff`. Excluded health and owner browser verified **18 October 01:17–01:18 UTC**. All fourteen selected operational groups match before/after deployment, with zero foreign-key errors. The original v6 daily result and 2 starts/8 calls remain; the new report review has not run. Runtime-head Linux checks **117552372601/117552365848** were billing-blocked before execution (original annotations inspected); GitGuardian **117552369557** passed. Final documentation-head checks are recorded separately in PR 1.

## Production follow-up — 20 October 2026

The genuine `marketing-2026-10-19` v7 company-report attempt used one critic call, then held the unchanged report when the returned evidence structure failed validation. The original provider diagnostic records `contract_validation`, finish reason `stop`, 955 prompt and 10 completion tokens. Cloudflare independently completed through `hold-stopped-run-1`; the brief is Held v2/r3, with its earlier version and original expiry retained. This proves actual production execution and the failure hold, not a valid independent review or LinkedIn delivery. No retry, rewrite or publishing is authorised by this observation. See `tests/evidence/operations-resume-2026-10-20.json`.
