# 2.28 — Private saved-search matches

Saved searches can now be explicitly followed from My applications. The existing quarter-hour schedule checks newly added vacancies and records private matches. No existing account is subscribed automatically. No email, browser notification, AI call or external messaging service is used.

Search and notification queries share the same keyword, location, advert sponsorship, career level, pay, sector, licence and freshness filters. A licence match never implies that a vacancy offers sponsorship. Read-time filtering removes closed, stale or no-longer-matching jobs even if the background scan fails. Following establishes a server-time baseline; older listings do not become new alerts. The inbox shows up to 100 most recent current matches from the previous 14 days. It does not alert on every revision to an existing advert.

## Controls and privacy

Verified accounts opt in per saved search. Account-scoped APIs require a session, same-origin writes and bounded request bodies/rates. A unique monitor/job key preserves read state across replay. Seen receipts are bounded to the displayed snapshot and IDs, so later arrivals stay unread. Repeated enable requests preserve the baseline. Stale stop requests cannot cancel a replacement monitor. The current saved-filter version is checked before following.

Migration 0021 adds private monitors/matches and a workspace trigger. Updating filters or removing a search revokes its monitor and history in the workspace transaction; deleting the workspace cascades into these tables. A stale scan cannot revive a revoked monitor. Profile-only updates keep monitoring. UI import does not enable following; current recent matches and followed filters have a separate download. Fourteen-day retention is enforced by the scheduled cleanup and read path. No CV or private search string is added to aggregate business snapshots.

The scheduler processes at most 20 oldest-attempted monitors per invocation, including failure rotation; a large queue can take longer than 15 minutes. Missing, failed or overdue checks become business findings. A feed must actually ingest new jobs before matches can appear. Over 100 qualifying arrivals between checks may omit older arrivals; this is a bounded recent-matches inbox, not an exhaustive alert log.

## Validation

- 311 tests pass, including eight notification cases for opt-in/replay, cross-account isolation, snapshot-bound acknowledgements, stale mutations, atomic revoke/delete, source expiry/changes, licence/filter parity, bounded queue rotation and retention/health.
- Typecheck/build, 17 public prerenders and production Worker dry-run pass.
- Isolated Workerd/D1 uses the actual production scheduled handler and two fictional authenticated accounts. Two new jobs appear, while old/expired roles do not. Anonymous GET returns 401; foreign-origin mutation 403; cross-account acknowledge 404. Responses are no-store. No remote AI/email bindings were configured.
- Local browser sign-in, seen controls and final-bundle reload pass; the 390px viewport has zero horizontal overflow. Export button was exercised, but file delivery remains unverified: the browser event wait timed out and its internal downloads page is blocked by the browser URL policy.
- Production reports 2.28.0, the signed-in account shows the new entry point with existing applications intact, and private/public route checks pass. At 06:18 UTC there were zero opted-in searches and no first scheduled receipt yet. An actual production new-match delivery remains unobserved; no synthetic job/customer account was added remotely.

Evidence: `tests/evidence/search-notifications-runtime-2026-10-08.json` and `tests/evidence/search-notifications-production-2026-10-08.json`.

## Deployment and remaining gates

Worker `c60219cb-a52b-4e10-80ce-894f22fa52d1`, additive migration 0021. Pre-migration recovery bookmark: `000002bb-00000000-000050fe-64c7359e24f14a408137ec84f89c1db7`. Previous Worker `9a8e9bef-c6ee-45c8-bb35-bfc5e6cd69ae` can be restored with the additive tables retained; it will not scan/display matches. Do not restore the entire database to undo a code release or erase new user activity.

Cloudflare's current Email Service FAQ limits that service to transactional mail. Requested job-alert classification/appropriate email delivery, verified inbox placement and unsubscribe/bounce handling remain separate work; do not turn this into an account-email marketing campaign. Existing sender onboarding was checked read-only, with no new plan, terms or sends. See https://developers.cloudflare.com/email-service/reference/faq/ and https://developers.cloudflare.com/email-service/platform/pricing/.

The 8 October shared model allowance remains exhausted at four starts/six actual calls. No same-day model or Google retry was made. Social delivery, Google metrics, independent application/reference adjudication, outbound incident delivery, premium demand and fully autonomous business outcomes remain unproven. Hosted CI is checked on the resulting pushed head separately.
