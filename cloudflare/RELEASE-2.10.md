# Release 2.10 — agent operations

Published 7 October 2026 at https://sponsorintel.london. Worker `d49f5f7d-787f-4d5a-8f15-facaf3e25d01` serves version 2.10.0. Previous Worker: `504c8624-ee0d-4056-a933-eb748e4390ae`. Additive D1 migration `0008_agent_operations.sql` was applied and the `sponsorintel-sources` Workflow binding deployed. Existing account storage, primary domain and three cron expressions remain configured.

## What operates now

The six-hour employer collector now dispatches a durable Cloudflare Workflow. Each approved source has its own checkpoint and persistent D1 task. The collector normalises the feed, checks exact advert sponsorship evidence, repeated IDs/links and unusual count drops, then commits the full board and publication receipt together. A transaction fence rejects writes after the worker loses its publication lease. Repeated or recovered execution reads the receipt and does not republish a completed task.

Source identity is rechecked against the approved source list before fetching. A current reviewed employer licence is recorded separately from advert wording. A missing licence link never becomes a positive sponsorship label. A source returning zero UK roles after at least ten, or losing more than 60% after at least twenty, is held for review. No held snapshot is published. Previous successful records retain their original freshness timestamp and still leave discovery after three days. An open hold resolves after a later batch passes checks; there is no unchecked "publish anyway" button.

The owner-only **Admin → Agent operations** section shows actual tasks, attempts, evidence summaries, open holds, source health, request allowances and recent history. Pausing a source hides its jobs and stops subsequent fetching; resume permits a fresh successful run rather than resurrecting old jobs. Check execution status reconciles platform completion. Recover interrupted run is available for unfinished runs over ten minutes old and preserves task receipts and budgets. Private mutations require the existing immutable owner identity and a same-origin request.

The AI coordinator sends only server-generated source-health findings to the existing Cloudflare model. It returns a ranked subset of existing finding IDs. The server rejects invented IDs, duplicate IDs, extra execution fields, malformed output and truncated responses. Displayed facts and actions come from the original server findings. No CV, account details or user feedback is included; no suggested action is executed. The first live brief identified unresolved employer identity work. This is bounded prioritisation, not an unrestricted autonomous manager.

## Limits and operations

- One queued/running source run at a time; at most 150 request reservations per run and 500 per UTC day.
- Three fetch attempts per source task, with delayed retries; three source failures create a six-hour cooldown. Expired runs stop fetching after two hours.
- Failed/uncertain fetches remain counted. Limits are application request caps, not a statement about account-wide Cloudflare billing.
- Two on-request AI brief attempts per UTC day, including failed attempts. No automatic generation or paid plan upgrade.
- Completed run/task and brief records are retained for 30 days; resolved reviews for 90 days. Open findings remain until resolved. Pruning uses the existing six-hour handler.
- The authenticated `POST /api/admin/refresh-jobs` now returns a dispatch receipt, not a synchronous `sources` result. Use the owner dashboard or Workflow status for completion.
- Workflows API references: [Worker bindings](https://developers.cloudflare.com/workflows/build/workers-api/) and [durable execution rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/). The app uses fixed step names, persisted step results and small step receipts; raw job batches do not cross Workflow result boundaries.

## Acceptance

All **99 automated tests** passed under Node 24.19.0. Fifteen new operational cases cover atomic rollback/replay, evidence disagreement, abrupt feed drops, request limits, source cooldown, pause/resume, lost leases, expired runs, uncertain dispatch, recovery, model-output validation and private endpoint checks. TypeScript, the production build, generated binding types and Wrangler dry-run compilation passed.

A real local Workflow published 29 sources and failed the previously observed local Greater Manchester connection within its three-attempt limit. Stopping the local development server during retry did not automatically resume that local engine. An explicit restart reused the 29 completed receipts without repeating their fetches and completed the final attempt, with 32 total reservations. This confirms the journal/recovery path; it is not evidence of an unattended production interruption recovery. Local UI pause/resume hid and then restored Zopa's 31 current roles after a successful source-only run.

The first **production** owner-triggered run (`owner-ccabcd17-8ce6-4860-be67-ed487f5b0aea`) completed 30 sources at 12:16:24 UTC, with one attempt each and **30 requests**. Greater Manchester succeeded with six roles. There were no open automated quality holds. Public acceptance at approximately 12:17 UTC reported **845 UK roles**, including 759 at licence-linked companies, 50 with positive/conditional sponsorship wording, 49 early-career titles and 102 with GBP pay wording. Only two early-career roles also had positive/conditional sponsorship wording. Collections overlap and do not establish eligibility or guaranteed sponsorship.

The live AI coordinator produced validated priorities on its first production attempt. A preceding local test initially exhausted its model response before returning valid JSON; disabling optional thinking and bounding the response fixed that test, and the failed attempt remained counted. No malformed model response was shown as a recommendation.

Anonymous reads and mutations on all four new tested admin endpoints returned 403. The existing owner browser session loaded the private dashboard successfully. The mobile document measured 390px wide at a 390px viewport after fixing a grid minimum-width overflow. No browser console errors were observed. The existing opportunity smoke check passed all 12 checks. Evidence is saved in `tests/evidence/agent-operations-2026-10-07.json`.

The six-hour trigger was deployed; this release's initial source acceptance was manual. A successful scheduled run and a longer reliability observation are still required. Hosted GitHub checks remain a separate gate from local/runtime acceptance because the account has a billing lock.

## Boundaries and next work

The Techmap LinkedIn pilot remains disconnected: subscription terms, access, private sample collection and publication review are outstanding. No provider subscription, new external API key or LinkedIn partnership was created. The old Python agent stack remains separate. The Agents SDK has not been installed; this source pipeline uses Workflows and ordinary checks, with one bounded AI prioritisation component.

Source scouting, reviewed immigration explanations, support triage and growth planning are not autonomous in this release. The 50-advert audit, 20 CV/advert evaluation and longer operational observation remain necessary before measured quality claims or broader agent authority. Existing email inbox placement, licensed ratings/regulator coverage and dependency maintenance remain in the roadmap.

For rollback, inspect and stop active workflow execution before changing the publisher, preserve receipts and owner pause decisions, and prefer a compatible Worker correction. Old Worker code does not know the new source controls. The schema is additive and need not be removed to roll back code. A full database restore would discard newer user activity and must never be treated as a routine code rollback.

A Time Travel bookmark for 12:10 UTC, before this migration, was retrieved after deployment and saved in the private owner output folder. It was not captured before the migration; future releases should capture the bookmark before making the schema change as required by the roadmap.
