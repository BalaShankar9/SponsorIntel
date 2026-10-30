# 2.98.5 — reuse a fully checked unchanged student directory

30 October 2026. The student-register check previously staged every row into a new snapshot on each successful run, even when the complete directory was identical. This consumed database writes without changing public records. It is separate from the worker-register cleanup repaired in 2.98.4.

The check still requests the official publication and complete CSV, validates publication identity, schema, dates, route values, row/body bounds and size changes. It compares every normalized field of every record with the retained snapshot. Identical content reuses that snapshot and records the newly observed source URL/date, source-row count and successful check. A matching URL or row count alone is insufficient. Changed data still stages and verifies a complete new snapshot before activation. No source date is advanced without the actual complete check.

Metadata activation now requires the same previous metadata and an unexpired owned lease in the same SQL statement. An older attempt cannot overwrite a newer decision. Failure recording uses that guard too, so a lost activation acknowledgement or cleanup failure cannot roll the public pointer back. Cleanup checks the current metadata and lease; no manual cleanup or deletion of customer records is added.

Actual isolated D1 with 501 fictional sponsors measured **2,009 writes for the initial complete import and four writes for a repeated identical complete check**. The latter makes no directory-row changes. Tests also cover a new official attachment with identical content, changed status/fields at the same URL, missing/truncated/invalid source, expired/replaced ownership, interrupted staging, lost activation acknowledgement and cleanup failure. These are local measurements, not observed production savings.

## Capacity remains unresolved

The original Cloudflare invocation `ea1d3d6f05148840893c133eb616aa0b` for `*/15 * * * *`, 30 October **10:00:32.530 UTC**, reports the account's **daily D1 row-write limit exhausted**. Its retained event is `immigration_source_failed`, source `student-money`, Worker `c32a41a1-f0dd-4925-8d5d-cd459934cce1`. This is guidance refresh, not the student-directory importer. The invocation shows three errors, CPU 15 ms, wall time 609 ms; it does not establish a CPU-limit failure for that invocation.

The student-directory metadata independently confirms a successful full check at 07:15:30.564 UTC, 937 sponsors/1,289 source rows from the 29 October CSV. The worker register remains at 27 October with its last check on 28 October. This rules out a failed student-directory refresh as the explanation for that day's worker-register staleness. The exact worker-register termination point remains unproven; sampled logs cannot establish absence of execution.

Job reads returning 200 do not establish working writes, private saves, all source refreshes or business supervision. Cloudflare's [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) documents 100,000 writes/day on Free, counting index writes too. Its [Workflow limits](https://developers.cloudflare.com/workflows/reference/limits/) separately document 10 ms CPU per Free step. The larger worker register and observed source CPU failures still require a capacity decision or further architectural work. No paid plan, increased limit, forced refresh, synthetic failure, budget reset, external send or owner-hold change is part of this release.

## Release verification

No schema or dependency graph change. Same-day recovery evidence remains 46 migrations/204 matching objects with a current recovery point at 11:42:37 UTC; it is not a restore or retention-window test. Same-day zero-known-advisory audit is reused with an unchanged dependency graph. Pinned runtime: Node 24.19.0. Exact tests, build, deployment and CI results are retained in `tests/evidence/student-reuse-2026-10-30.json` as they complete. Compatible rollback: **2.98.4 Worker `edc38235-3127-4ba6-bcdf-b6aa561ccef7`**. Use separate version upload/deploy, preserving existing triggers. Production reuse and its savings await the next genuine complete student check; do not force one for acceptance.

## Publication receipt

Runtime `24260aa01a43a2ab813e2ce085b056f3bde250e8` is live at 100% as Worker `7307c8e5-3743-4140-ab2f-a33741e5112b`, deployment `76cd4009-0ab2-4555-959e-34c7a933fdbd`, 30 October 12:17:19.467788 UTC. Upload/deploy both exited 0 and triggers were not resubmitted. Excluded HTTP checks confirm version 2.98.5, jobs 200 with 1,019 roles/54 sponsorship-mentioned adverts and study 200 with the existing 937-record snapshot (751 match the default Student-route filter). Stale worker-register evidence remains unavailable for licence relationships. No student check or customer write was forced.

All **790 tests**, TypeScript/build, 20 prerenders, browser budgets and version-upload dry run pass on pinned Node 24.19.0. Hosted runtime jobs **124057034249/124057009194** did not start because of the GitHub account billing lock; annotations were inspected. GitGuardian **124057100365** is neutral/skipped for PR size. These are not hosted acceptance. Final documentation-head checks remain separately required; PR #1 stays open/unmerged.
