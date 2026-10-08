# Release 2.26 — Immigration explanations with inspectable evidence

The updates page now covers all 19 monitored guidance sections with 53 plain-English points, each backed by selected verbatim GOV.UK excerpts. Fourteen guides previously had no explanation; the Student overview had a changed source and was correctly hidden. All 19 explanations were reviewed against public Content API snapshots read on 8 October 2026. Coverage includes student finances/courses, employer sponsorship costs, business routes, other visa routes and the immigration health surcharge.

The existing source-hash, withdrawal, fetch-error and one-hour freshness checks remain. Every point must also have a bounded supporting quotation present in the current source. Missing or mismatched evidence hides the explanation. A future check timestamp beyond five minutes is rejected. Literal quote matching establishes provenance, not legal accuracy, semantic entailment or personal eligibility; the full official guidance and its exceptions remain authoritative.

Two reviewed Student wording comparisons attach only to the exact retained before/after versions observed on 7 October at 23:15 UTC. The overview adds explicit Erasmus+ traineeship/study wording; the course page adds the RQF level 2-or-above Erasmus+ category. These notes are not a claim that the law changed, and no effective date is inferred from detection or the unchanged GOV.UK publication date. A missing baseline, mismatched transition, later source change or stale guide hides the comparison. The public API never returns the complete stored source bodies.

The hourly business workflow now flags changed, withdrawn or unsupported guidance explanations for priority review and missing explanations as a normal-priority gap. It does not automatically rewrite legal guidance or mark a new hash as reviewed. No new cron, AI call, service, subscription or database migration is introduced.

## Source expansion boundary

NHS Jobs' published acceptable-use conditions require prior written agreement for commercial use. The official employer integration page does not establish Sponsor Intel's republication rights. `docs/SOURCE_COVERAGE.md` records this gate; `docs/NHS_JOBS_ACCESS_REQUEST.md` contains an unsent access request. No outreach, account, agreement or feed was activated.

## Validation and release

297 tests pass, including all 19 complete public-source fixtures, both actual Student transitions, missing/incorrect quotations, missing history, stale/changed evidence, public-body exclusion and business finding creation/resolution. These tests do not establish independent legal review. The first release build stopped at ENOSPC; only npm's rebuildable download cache was cleared before retrying. Local runtime, browser, build, dry-run and production readback results are recorded in the accompanying evidence files once verified.

Previous production Worker: `c646d909-a5ed-4079-a5e3-29dcec8fd261` (2.25). Code rollback needs no database restoration. A rollback would return the older limited set of explanations and omit reviewed change notes; it must not rewrite source versions, observations, AI allowances or editorial decisions.

Production Worker `023b0e28-630b-4827-9723-bee94c67aa60` reports 2.26.0. Live readback confirms 19 current explanations, 53 cited points and two exact historical comparisons; their original event IDs and timestamps are unchanged. The existing source refresh checked all 24 sources again at 2026-10-08T05:30:38.006Z. The signed-in browser has no unexpected alert and exposes the new evidence panels; the mobile local preview is readable at 390 px without horizontal overflow. Build, 17 public prerenders and dry-run pass. See `tests/evidence/immigration-explanations-runtime-2026-10-08.json` and `tests/evidence/immigration-explanations-production-2026-10-08.json`.

The last observed business run remains `business-497620` from 04:45 UTC; the new explanation-finding branch awaits the next genuine hourly run. Shared production AI usage remains four starts/six calls, and the Instagram welcome remains version 1 / Needs review. The existing daily heartbeat now includes source-version/quotation review. No NHS message, social publication, model request or paid service was triggered.
