# Owner failure and recovery alerts

Release 2.29 adds opt-in operational mail at `/admin#operation-alerts`. On 8 October 2026 the owner selected their verified Sponsor Intel owner email. The preference was enabled through the signed-in owner dashboard, and exactly one authorised connection test was sent.

The matching receipt reached the owner's Gmail **Spam** folder at 07:12 UTC. Gmail reported SPF, aligned DKIM and DMARC passing. The exact body receipt and provider Message-ID matched, and the dashboard receipt was confirmed after reading that message. This proves delivery to the mailbox, not reliable Inbox placement, owner attention, or incident response. No spam rule was weakened, mailbox filter added, message relabelled or second test sent. Before relying on urgent email, improve and re-observe genuine delivery placement; the owner can mark the recognised test Not spam. Do not treat that manual reclassification as proof of future Inbox delivery.

## Scope and controls

- The existing quarter-hour Cloudflare schedule reads the latest hourly high/critical business findings and detects a failed or more-than-two-hour-overdue business run. It runs outside BusinessWorkflow, but still relies on the same Worker/provider and database.
- Only a currently verified owner can opt in. The destination comes from that account, never from an arbitrary submitted address. Ownership, verified email, destination, settings revision and pause are checked again before the provider call. An account address change requires re-confirming the setting.
- Messages contain only counts, timestamp, receipt identifier and the fixed admin link. They exclude CVs, customer reports, search terms, personal analytics and free-form incident text. Inspect details after signing in.
- Changed findings produce an incident alert; unchanged findings get at most one reminder every 24 hours. Recovery is sent only after a previous reported incident clears. Healthy scans do not send routine email.
- Limits are four reserved sends per owner per UTC day, including at most one test, five enabled owners and twenty sends globally per day. Reservations count even when the outcome is unknown. Business pause stops automatic mail; an explicitly requested connection test can still run.
- A durable reservation precedes sending. A timeout, missing provider receipt or uncertain outcome holds further messages for that owner. Do not reset or replay it. First reconcile the exact receipt in the recipient mailbox and provider records. Only actual receipt permits the dashboard confirmation; a missing message does not justify inventing a confirmation. There is no automatic retry or arbitrary override.
- Provider acceptance and receipt confirmation remain separate states. Terminal receipts are kept for 90 days; unresolved sends remain for reconciliation. Private endpoints require owner access, enforce request origin and return no-store responses.

## Acceptance and recovery

Twelve new test cases plus the existing suite pass (323 total). The actual local Workerd/D1 scheduled handler generated a simulated incident, suppressed a duplicate and generated recovery using fictional records and a local-only email binding. These are execution tests, not production outages or real incident delivery. The one real connection test used Cloudflare Email Service and was verified in Gmail as described above.

The daily Codex heartbeat remains separate, depends on its local scheduler/access, and is not a new independent cloud uptime provider. Complete Cloudflare outage detection, bounce/event ingestion, dependable inbox placement and real production incident/recovery acceptance remain open. See `AUTONOMY_ACCEPTANCE.md` and the 2.29 release/evidence files. Do not manufacture a production incident or consume another test to force acceptance.

To stop mail, disable the owner checkbox; pausing business operations stops automatic mail globally. A provider call already started cannot be recalled. For code rollback, restore the previous Worker while preserving additive migration 0022 and its receipt tables. Do not restore the whole database over later user activity.
