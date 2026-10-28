# 28 October 2026 operations

## Incident and bounded repair

Excluded HTTP checks found intermittent health failures and repeated public `/api/jobs` HTTP 500. A QA-header-filtered Worker trace at 18:05 UTC identified the exact D1 daily free row-read limit error. The founder static route returned 200. Raw trace metadata stays outside the repository; the committed receipt contains only path, status, Worker identity and provider error, without IP, location, credentials or customer information.

Same-scope Cloudflare renewal succeeded. The read-only recovery check did not complete: initial authentication 10000, a later quota 7500 on the schema query, then a timed-out D1 info call after renewal. No successful receipt, restore, export or production data write was made. Last successful complete inspection is 26 October, 46 migrations/204 objects. No migration is part of today's repair.

The refreshed D1 dashboard's Last 24 hours view ended approximately 28 October 18:00 UTC. The exact reviewed-licence query accounts for 58.62M reads/478 calls. Snapshot cleanup separately accounts for 55.69M reads and 18.56M writes/145 executions. These rounded dashboard numbers are not UTC-day totals, user counts or billing measurements. The cleanup invocation origin and excessive frequency/cost are unresolved; do not infer 145 independent successful imports or initiate cleanup to investigate.

Release 2.98.2 makes the reviewed licence lookup use existing exact snapshot/ID primary-key searches rather than scanning the Skilled Worker register. Current metadata/freshness, approval, licence/route and role sponsorship semantics remain. An isolated real D1 fixture with 128,000 fictional records reads 9 rows instead of 128,005 before ANALYZE, returning the same three records. After ANALYZE the comparison is 9 versus 14. No stale cache, schema, model profile, allowance or hold change.

## Validation and deployment

The first proposed error-response edit touched the pinned research entry point. Its build and one of 778 tests failed the source-manifest guard. That edit and its two tests were removed; no manifest was rewritten. The bundled Node path had moved to 24.22.1, so final validation uses the exact 24.19.0 project pin installed from the official verified archive in `~/.cache/sponsorintel/node-v24.19.0-darwin-arm64/` (9.6 GiB free before validation). Personal files and the private local-state archive remain intact.

Final **776/776 tests pass** in 81.332 seconds on Node 24.19.0. TypeScript/build, 20 prerenders, browser budgets and Worker dry-run pass. Fresh audit has zero known advisories, the dependency graph is unchanged, and Undici 7.30.1 matches the official patched version. No claim of independent model accuracy, hosted Linux success or absence of unknown vulnerabilities.

Runtime commit **3ca2ff718dc341cc77dd369a07f0ee82ca6d8701** is published as Worker **c9d2f6b2-353f-408d-a828-7376bd24e878**, deployment **b9f8a475-26fa-4ce3-a433-20322c80f536**, 28 October **18:16:19.574092 UTC**, 100%. The deployment command exited 1 because Cloudflare rejected the cron-update phase with free-account trigger-limit error **10072**. Successful trigger phases were not rolled back. The authenticated Worker overview independently shows all four original schedules unchanged: daily register, six-hour sources, fifteen-minute tasks and hourly business. No cron retry, schedule removal, other-project modification or plan upgrade was made.

Live excluded checks at **18:18:09 UTC** confirm health version 2.98.2/200 and Founder hub/200; **jobs remain 500**. The allowance has not been reset by this code change. The outage is not resolved and production query savings cannot yet be measured. Compatible runtime rollback is 2.98.1 Worker **ac307219-732a-4d29-8d23-eff5da834cf4**; rolling back code cannot restore quota or clear holds.

Exact runtime-head checks **123010997854 / 123010963474** did not start because GitHub's account is billing-locked; annotations inspected. GitGuardian **123010990891** is neutral/skipped for PR size. PR #1 stays open/unmerged; final documentation head requires its own check.

## Original workflow evidence and deferred work

The latest provider source run **scheduled-1793169055003**, original queued 28 October 06:30:57.117 UTC, finished **06:32:06.528 UTC**, success, application attention: **37 published, one paused skip**, source version **8234260a-1fbe-4d16-bb73-e8668ecf5daa**. This establishes a genuine scheduled source execution on the previous 2.98.1 source resource. D1 aggregates and the later schedule remain unverified under today's capacity failure.

The original **business-497989** returns missing-instance **10400** after renewal. The latest listed complete business run remains **497990**, 23 October. Missing is not terminal: no application row was cleared, replaced, failed or resumed. Research/application holds, PortmanDentex, existing advert/discovery reviews and social holds remain unchanged. Current owner controls, usage, incidents and provider queues could not be fully reconciled through the database. No new discovery, AI/Google call, social/email send, application, source refresh or external contact was made.

## Next acceptance

After the provider's next UTC reset, read current health/jobs and recovery state once before new dependent work; do not infer recovery from the time alone. Verify the new exact lookup's real rows read, current public counts, genuine source receipt and retained schedules. Investigate register cleanup/read-heavy directories and account-wide capacity without raising limits or deleting customer data. Full register imports also need a sustainable write-capacity design; this one read fix does not prove reliable free operation. Keep the supervisor hold until original execution uncertainty has a reviewed resolution. Reconcile overdue evidence and social receipts when access is healthy; never compensate with duplicate sends or forced jobs.

Evidence: `cloudflare/tests/evidence/database-capacity-2026-10-28.json`, `cloudflare/RELEASE-2.98.2.md`. The previous checkpoint is preserved at `docs/history/OPERATOR_CHECKPOINT-2026-10-26-1255.md`. Full autonomy, quality acceptance, sustained growth and sales remain unproven.


## 19:30 UTC — public loading repair from LinkedIn portfolio review

The owner explicitly requested fixing Sponsor Intel and Carpool loading failures alongside LinkedIn cleanup. Released 2.98.3: independent register, featured and city suggestion state; on-focus suggestions and Discover-only featured requests; 15-second public-read deadline, individual retries and honest unavailable search heading. No backend query, schema, data, trigger, owner hold or spending change.

780/780 local tests, typecheck/build, 20 prerenders, browser budgets, version dry run and fictional built-app browser failure/recovery cases pass. Runtime 33f23ee49f0dd4c1b8ab75cdd80a068577cc4612 uploaded as c32a41a1-f0dd-4925-8d5d-cd459934cce1 and deployed at 100% via c63a593d-e5b1-43b0-87b2-0767acaf696d, 19:24:29.946389 UTC. Both commands exit 0; the triggers command was not run. Rollback remains compatible 2.98.2 c9d2f6b2-353f-408d-a828-7376bd24e878.

Excluded live health reports 2.98.3; served entry assets match the local tested bytes. Jobs remain 500. Carpool actual-row D1 read fails 7500 and signed-in Cardiff feed still fails after retry. Zero-row constant queries and one Sponsor metadata read succeeded; they are not service recovery. Browser production owner exclusion could not be confirmed under the outage, so actual app UI failure/recovery testing used the local production build with fictional responses. No synthetic customer events were sent.

Cloudflare account UI confirms Free at approximately 19:28; Paid is advertised $5/month plus usage. Private billing details are retained only in the local owner handoff. Owner decision pending; no payment/upgrade. Daily reset at 00:00 UTC remains a future recovery check, not a promise. Runtime hosted checks 123047898408 and 123047843723 now succeed; GitGuardian 123048221357 skips for PR size. Earlier billing-blocked checks remain valid historical evidence. Full source/research/marketing outcomes and genuine post-reset capacity remain unverified.
