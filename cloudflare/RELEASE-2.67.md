# 2.67 — A focused owner dashboard

13 October 2026. The owner dashboard previously stacked every management tool into one page: the live page measured 24,779 pixels high at a 1,384-pixel browser width. Owners had to pass unrelated operational, marketing, research and source controls to reach common tasks.

Eight named sections now separate Overview, Jobs & reviews, Sources, Marketing, Analytics & SEO, People & support, Operations and AI quality. The overview shows existing aggregates, useful shortcuts and up to four findings ordered by severity, with the total and a link to all operational records. Missing or failed reads remain explicit. Source freshness, employer review forms and source controls expand on demand. Research and application comparisons share AI quality.

Desktop navigation stays within reach while scrolling; phones use a labelled native selector. URL fragments support bookmarks and browser Back, including the existing `#operation-alerts` email link. Section changes move focus to the current heading. Visited desks stay mounted but hidden so draft fields, selected records and expanded forms survive navigation; this is not persistence through reload or sign-out. Other desks start their ordinary reads on first visit. The business desk retains one shared instance for its summary and full controls. No source, model, permission, schedule, budget or publishing behaviour changes.

Validation: 627 tests, TypeScript/build, 17 prerenders, public browser budgets and Worker dry-run pass on pinned Node 24.19.0. The actual components in `tests/fixtures/admin-navigation-preview.mjs` were checked at desktop and 390-pixel phone width. Browser checks cover all eight sections, no horizontal overflow, parent draft and child search retention, Back, keyboard activation, bookmark reload and the old alert link. Fixture service failures were deliberately retained as errors; no fixture write request occurred. Production read-only checks are recorded separately after deployment.

No migration or dependency graph change. Same-day recovery and official dependency-advisory evidence apply; package version metadata alone changed. Rollback: 2.66 Worker `32aaec5b-081d-4323-8116-a368061e06c8`. Preserve all database decisions, paused comparisons, source/marketing holds and retained receipts. Hosted checks must be inspected at the exact pushed head; local success does not remove GitHub's billing lock.

## Live result

Worker `6c78d9d4-2857-44b4-ae3c-e2726fed0581` serves 2.67.0 from `ac808919ca0558719c9828b99466d4034e67b71b`. At 11:49:23 UTC, excluded health/jobs reads pass, anonymous dashboard/review reads return 403 and the exact served owner bundle matches the build. Eight protected control/history/budget hashes match; shared AI remains one start/zero calls. No production record or control was edited.

The authenticated desktop overview measures **1,280 pixels**, down from **24,779** at the same 1,384-pixel viewport (about 95% shorter). All eight live sections render. Phone checks found an intrinsic table-width issue in Analytics; the final minmax grid contains wide tables within their own scroll region, with a 390-pixel document on a 390-pixel viewport. Draft and child-state retention were tested only with fictional data. Existing paused workflows, holds, API access and budgets remain unchanged.

Initial deployment metadata still reported 2.66.0 despite the new owner bundle; that mismatch was caught and corrected before completion. A separate public-summary request initially displayed a retry banner; its read-only retry cleared the banner, and the final dashboard has no visible error. No workaround or permission change was used.

Code-head checks 115280507872/115280484408 did not start due to GitHub's billing lock; both annotations were inspected. GitGuardian 115280648267 passed. See `tests/evidence/admin-navigation-2026-10-13.json`.
