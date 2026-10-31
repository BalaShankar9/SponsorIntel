# 2.98.4 — avoid scanning retained sponsor snapshots during cleanup

30 October 2026. The existing register cleanup used two inequality conditions, which scan both retained snapshots even when there are no obsolete rows. The 28 October provider dashboard attributed substantial read/write usage to this query; its invocation count was not proof of successful imports.

Cleanup now selects obsolete row IDs through three indexed snapshot ranges. It retains the same current/previous snapshots, handles either ordering and equal identities, and deletes only the selected obsolete public-register rows. The same SQL statement requires the active metadata snapshot still to match the completed import: an older invocation cannot clean up after another snapshot activates. Customer tables, reservations and review history are untouched. No schema change, limit increase, forced import or manual cleanup is required.

In real isolated local D1 with two fictional 128,000-row retained registers, the previous query reads 256,000 rows; the new query reads **4**, both before and after ANALYZE. Adding three obsolete rows in the lower/middle/upper ranges deletes exactly those three, reads 15 rows and leaves all 256,000 retained rows. Separate tests cover reversed/equal snapshots, missing/newer metadata, post-publication cleanup failure and lost activation acknowledgement. These are measured local costs, not production savings or free-plan capacity acceptance.

## Current operational limits

Read-only recovery at 11:42:37 UTC matches the exact production database identity, 46 migrations and 204 objects, with a current recovery point. This is not a customer restore or retention-window test. Job search returns 1,019 jobs/37 employers/54 sponsorship-mentioned adverts; the licence register's last check is 28 October, beyond its two-day freshness window, so licence-linked counts are unavailable. Zero displayed licence matches must not be interpreted as employers losing their licences.

Original scheduled source run `scheduled-1793341855003` is independently complete at 07:20:26.193 UTC, but its application result is attention: ten sources published and 28 failed. Its original step attempts contain 22 CPU-limit errors and 68 source-operation-lock errors. Cloudflare documents a 10 ms step CPU limit on Workers Free. The 28 October account observation was Workers Free; no plan change is authorised or performed here. CPU failures and the absent supervisor instance `business-497989` remain separate unresolved blockers. This SQL repair cannot be claimed to fix them or the register's stale refresh.

Full register import/delete write capacity, remaining directory scans and sustained source execution still need verification and a capacity decision. No provider call is retried to manufacture success. Original failures, budgets, pauses and review holds remain intact. The next genuine register/source runs need their own receipts.

## Release checks

Full-suite, build, dry-run, deployment and exact-head CI results are recorded in `tests/evidence/register-cleanup-2026-10-30.json` when available. Dependency graph is unchanged; the fresh npm audit reports zero known advisories. Source identity manifests are unchanged. Compatible rollback is 2.98.3 Worker `c32a41a1-f0dd-4925-8d5d-cd459934cce1`. Use separate version upload/deployment to retain existing triggers. No schema rollback or production restore.

Primary provider references: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workflow limits](https://developers.cloudflare.com/workflows/reference/limits/). The full operator receipt is `docs/OPERATIONS-2026-10-30.md`.

## Publication receipt

Runtime `99ce87865656e17150726591003ac5ef1e5571ac` is live at 100% as Worker `edc38235-3127-4ba6-bcdf-b6aa561ccef7`, deployment `7d1441a0-a529-4fa7-83ee-22b6afecb690`, 30 October 11:51:49.574065 UTC. Version upload/deploy both exited 0; triggers were not resubmitted. Excluded live checks confirm health version 2.98.4, jobs 200 with the same 1,019/54 counts and stale licence relationship state, and Founder hub 200. No cleanup/import was forced; production execution/savings are pending the next genuine register run.

All 783 local tests, TypeScript/build, 20 prerenders, browser budgets and version-upload dry run pass. Exact runtime-head GitHub check jobs 124046899744 and 124046897533 could not start because the account billing lock has returned. GitGuardian 124046895040 was neutral/skipped for PR size. These failures do not negate the earlier 2.98.3 hosted successes, or count as hosted acceptance for 2.98.4. PR #1 remains open and unmerged.
