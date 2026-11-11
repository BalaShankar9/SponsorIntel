# 2.71 — Count every employer approval check

13 October 2026. Approving a Greenhouse, Lever or Ashby employer feed previously fetched its catalogue without reserving a request in the shared source budget. School approvals already reserved their bounded 24-request cost. This meant ordinary approval checks could run even after the existing 500-request daily source allowance was used.

All supported approval checks now reserve their provider's complete request cost before provider I/O: one for Greenhouse, Lever and Ashby, or 24 for a school. The existing atomic admission rejects a check when the remaining allowance cannot cover it. Failed and uncertain admitted reads keep their reservations; refused checks neither fetch nor increment the counter. Approval still uses the current owner, legal-employer, sponsor, review and complete-feed checks. There is no additional allowance, provider, source admission, automatic retry or historical counter backfill.

The regression failed against 2.70 in a real isolated Worker/D1 because the Greenhouse reader started before any reservation. With the fix it checks all four supported providers, competing requests for the last slot, provider failure, a subsequent refused attempt, and a 24-request school with only 23 slots left. All data is fictional and outbound provider traffic is forbidden in this fixture. Existing school/atomic-publication tests remain unchanged.

Validation: 639 tests pass on pinned Node 24.19.0/npm 11.8.0; TypeScript/build, 17 prerenders and browser budgets pass. Worker dry-run also passes. Live verification will be recorded after deployment. No schema or dependency graph change; the successful same-day recovery check (39 migrations/165 objects) and official dependency audit apply. Hosted CI must be checked at the exact pushed head independently of these local checks.

Preferred compatible rollback is 2.70.0 Worker `256f87ad-e530-4ea2-8c63-07f781df96b9`. It preserves data but reintroduces the ordinary approval-accounting gap: avoid ordinary feed approvals after a rollback until the repair is reapplied. Never reset or deduct reservations. Existing comparison, source, social and review decisions remain authoritative.

Danu's live careers catalogue and exact Biotech Automation Engineer original were inspected again during this work. The vacancy remains conditional on the employer considering sponsorship later in the role. Source reuse and a validated custom collection route are still unresolved; no source was configured, role published, recruiter contacted, application submitted or discovery allowance bypassed.

## Live verification

Live Worker `047bb4a8-0305-414d-b75c-1eac953514d3`, code `53ce9ddcde341326902d909394450e5aae0f44b8`, reports 2.71.0 at 16:47:33 UTC. Excluded health/jobs reads return 200, anonymous owner board/dashboard reads return 403, and the unchanged owner bundle matches byte-for-byte. The job response has 935 roles. No real approval was triggered for QA.

Eleven protected control/history groups match across deployment. Runs, model steps and shared AI budget changed during the genuine scheduled comparison `application-comparison-ab82508c3c1b5ae41fc5add0-2026-10-13`, independently confirmed complete by Cloudflare at 16:47:08 UTC. It retained six completed stages for two fictional cases, using six calls; today's shared allowance is two starts/six calls. The owner lab shows 2/20 selected-comparison cases and six newly unassessed outputs. This closes the first scheduled execution gate after the reviewed resume, not independent writing-quality acceptance. No forced invocation or operator model request occurred.

Exact code-head Linux checks 115420451967/115420418949 were blocked before execution by GitHub's billing lock; both annotations inspected. GitGuardian 115420463117 passed. Evidence: `tests/evidence/approval-budget-2026-10-13.json` and `application-scheduled-2026-10-13.json`.
