# Release 2.98.16 — reduce school-page traversal work

The genuine 4 November 00:30 source run retained nine CPU-limit failures, including all three New City College attempts. That identifies a constrained collection path, not the exact operation that exceeded the limit. The school parser also had a measurable local inefficiency: every recursive tree query allocated and copied the matching results of every subtree into each ancestor.

This release replaces that query traversal with one iterative, document-order walk and one result array. It visits every node, including descendants of a match; it does not stop after the first match or hide duplicate titles, identifiers, visa rows, school captions or catalogue cards. Both the school importer and the shared visible-campus reader use the same helper. Complete original wording, conditions, source dates, campus identity, catalogue comparison, advert holds, publication transactions and request reservations are unchanged. No source is added or resumed.

The local comparison uses an exact immutable pre-change commit and fictional pages. Complete outputs and structured rejection diagnostics must match before timing. Alternating warmed batches measure Node thread CPU; they are not Cloudflare CPU measurements, real-source compatibility, proof of the historical failure's cause, or proof that a complete collection fits the platform allowance. Cloudflare's [current limits](https://developers.cloudflare.com/workflows/reference/limits/) retain a 10 ms Free CPU allowance per step. No plan, CPU limit or runtime policy changes here.

Only `worker/teaching-vacancies.js`, `worker/teaching-location.js` and the new `worker/teaching-tree.js` differ from the isolated 2.98.15 runtime, plus release metadata. Main remains prepared 2.99.0 and must not be deployed wholesale. Research/application source manifests are unchanged. Forty-six applied migrations; no private import, Founder saving or migration 0047. Compatible rollback: **2.98.15 / 0ffc4794-45f2-4aa7-becf-05c40d934db8**.

Validation and any subsequent deployment evidence are retained in `tests/evidence/teaching-parser-2026-11-04/`. Genuine later scheduled publication needs its own original provider and application receipts. This does not clear capacity, the unresolved business supervisor, private-saving, model, source or publishing holds.

## Verified local result

All **45** complete-result/error-diagnostic comparisons match the immutable `58ca3efee2a30b82d38d728d834f61c9342900c8` baseline. Four fictional local samples (1–613 KB) show median Node thread-CPU reductions of **21–35%**. The largest page still takes 57.7 ms in that local measurement; it cannot establish Free-platform capacity. The comparison script and samples are reproducible from the retained exact commit and unchanged dependency graph.

All **55 focused tests** pass on the isolated release, including actual Workflow/D1 publication, a held advert, repeated catalogue checks, conflicts, request ceilings, school deduplication and pauses. TypeScript, build, 21 prerenders, browser budgets and deployment dry run pass on Node 24.19.0. Six public Studio/initial assets, the Job notes ZIP and approved privacy bytes are unchanged. The earlier validation was interrupted: three test failures and its unfinished build log are retained. After confirming the original processes were absent and all 374 prepared source files were unchanged, the identical tests/build completed; no timeout or test was weakened. No full-suite or hosted-check pass is claimed.

## Genuine 06:30 outcome, before this change

Original `scheduled-1793773855003` completed on 4 November at **07:22:19.656 UTC**, with **29 published / seven failed / two skipped**, 147 run reservations and **281 daily reservations**. Its 188 provider steps retain **26 CPU-limit failed attempts**. New City College, Wintermute, Eucalyptus and four university feeds failed; King's Lynn was held by the request budget and PortmanDentex remained paused. No workflow was forced, replaced or restarted.

The provider reports workflow resource version `5f1fdc10-c828-4902-a001-3e5f93c0e63b`; its metadata dates to 28 October, while the original run includes the later source-admission/lease steps. That resource identifier is not assumed to be the Worker deployment ID or proof of stale executable code. No configuration update was made based on that inference. This scheduled dispatch after 2.98.15 does not prove the uncertainty path, complete publication or sustained reliability. The original receipt is `scheduled-0630.json`.
