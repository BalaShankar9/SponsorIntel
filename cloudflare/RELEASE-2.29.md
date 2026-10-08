# 2.29 — Verified-owner operational email

Owners can opt into short failure and recovery notices at `/admin#operation-alerts`. The existing quarter-hour handler scans the latest high/critical business findings and detects failed or overdue business runs outside BusinessWorkflow. Changed incidents, bounded daily reminders and subsequent recovery are eligible; healthy scans remain silent.

The destination is always the currently verified owner account. Messages contain counts, timestamp, receipt identifier and the fixed admin link, without CVs, customer reports or private analytics. Per-owner/global daily limits, current permission/destination checks, settings revisions and a durable send reservation prevent uncontrolled sends. Unknown provider outcomes hold further mail instead of retrying. The dashboard distinguishes provider acceptance from actual receipt confirmation and exposes pause controls.

## Verification

- 323 tests pass, including twelve new test cases for consent, privacy, incident/recovery, concurrent sends, unknown outcomes, revocation, stale revisions, endpoint isolation, sender timeouts and storage-enforced limits. Typecheck/build, 17 prerenders and Worker dry-run pass.
- Isolated Workerd/D1 executes the actual scheduled handler with fictional records and a local-only email binding: one simulated incident, no duplicate on replay and one recovery. Its captured messages match their receipt IDs and contain no planted private content. This is local execution evidence, not real mail delivery.
- Real local owner sign-in, pause/resume and a 390px layout pass; the page has no horizontal overflow.
- The owner authorised their verified owner email. The live preference was enabled at 07:12:10.241 UTC on 8 October. Exactly one connection test was accepted, with receipt `a9ca9c79-6d3d-4b08-824d-21d119b82b3e`.
- Gmail received that exact body and Message-ID at approximately 07:12:30 UTC, in **Spam**. SPF, aligned DKIM and DMARC passed. The dashboard confirmation was recorded after reading the message. No second test, filter change or mailbox relabelling was performed. Mailbox delivery is established; dependable Inbox placement is not.
- Genuine scheduled scan at 07:15:38.506 UTC: one opted-in owner, zero attempts, zero accepted and zero held. The current findings required no alert. No production incident was manufactured. Anonymous access returns 403/no-store.
- The latest observed business run `business-497622` completed from its scheduled trigger at 06:45:50.225 UTC. Shared 8 October AI usage remains four starts/six calls; this release made no production AI call, Google retry or social send.

Evidence: `tests/evidence/operation-alerts-runtime-2026-10-08.json` and `operation-alerts-production-2026-10-08.json`. The live screenshot is in the task outputs as `sponsorintel-owner-alerts-live.png`. See `docs/OPERATION_ALERTS.md` for scope, limits and reconciliation.

## Deployment and rollback

Production health reports 2.29.0, Worker `14a6d48e-27bd-447e-ad95-cd0cae9a3e7a`. Additive migration 0022 is applied. Pre-migration D1 recovery bookmark: `000002c8-00000000-000050fe-94eef85ab29345ce1be2cfc0a51d24ad`. Previous Worker `7bbdc1c9-5a15-4de7-99d9-2ccb214a1417` is the code rollback point; retain the additive tables and later user activity rather than restoring the whole database.

No new sender identity, permission, paid subscription, AI allowance or schedule was added. The existing approved Cloudflare email binding is used. Hosted CI billing remains separate from local passing checks; inspect the checks against the pushed head in the draft PR.

## Remaining limits

Checks still share Cloudflare and D1 with the website. They cannot independently detect a complete provider outage. The existing daily Codex follow-up depends on its local scheduler/access. Bounce/event ingestion, reliable Inbox placement and real production incident/recovery acceptance remain open. Social delivery, successful Google reporting, real model evaluation and a fully autonomous business remain separate acceptance requirements.
