# 2.30 — Provider email lifecycle monitoring

The owner dashboard can now distinguish a send accepted by Cloudflare from a lifecycle event reported by the recipient's mail server. The new consumer handles delivery, deferral, bounce, failure, rejection and complaint events for the exact Sponsor Intel sending domain. Neither SMTP acceptance nor a configured connection proves Inbox placement or owner attention.

The consumer pins the account, zone, subscription, sender, schema and time range. It has no public ingestion endpoint. Records keep bounded identifiers, a recipient hash, fixed categories and timestamps; bodies, subjects, SMTP responses, reset links and plain addresses are discarded. Existing queue-write principals remain inside the trusted Cloudflare account boundary. Duplicates and reordered events preserve failure/complaint information. A hard bounce or complaint holds subsequent operational alerts; other terminal failures hold them for 24 hours. No event sends or retries email, releases an uncertain unmatched send, changes authentication behaviour or removes provider suppression.

The hourly business snapshot includes queue health, recent failure-event counts and blocked owner destinations. Unavailable metrics, delayed events or unprocessed messages become findings. Both queue metric reads have a five-second bound. The owner panel shows these signals without exposing other recipients. Events are not unique-message counts or an inbox-delivery rate.

## Validation and live state

- All 336 tests, typecheck/build, 17 public prerenders and Worker dry-run pass. Thirteen new cases cover privacy, source isolation, exact receipt correlation, ordering/duplicates, blocks, unknown sends, concurrent conflicts, retry acknowledgement, retention, queue findings and hung metric calls.
- Local Workerd/D1/Queues processes synthetic envelopes through the actual consumer. A delivery event matches a local email-simulator receipt, a duplicate adds no record, and a hard bounce prevents another send. Owner confirmation remains unset. The real local owner interface and 390px layout pass; the blocked test control is disabled.
- An invalid foreign-account event fails twice under the local test retry limit, then reaches a local-only dead-letter spy consumer. Miniflare discards messages without a local consumer, so the spy records only the event ID and acknowledges it. This proves dispatch, not production retention or genuine provider delivery.
- The production subscription was enabled at 07:49:09.600 UTC on 8 October and read back as enabled. Cloudflare confirms the exact domain and six events; its consumer settings are batch 10, concurrency 1, three retries and 60-second retry delay. Both queues retain messages for 86,400 seconds; the production dead-letter queue has no consumer.
- Production reports 2.30.0. Owner UI reads both queue metrics successfully, with zero waiting/unprocessed events, zero retained lifecycle events and zero recipient holds. The earlier confirmed connection test remains the only real operational email. Anonymous access returns 403/no-store. No synthetic event was sent to production and no extra real email, AI call, Google retry or social post was sent.
- Genuine scheduled business run `business-497623` finished at 07:45:49.326 UTC before deployment. The normal daily sponsor-register refresh also completed: 127,949 employer records from the 7 October official source, observed at 07:15:42.693 and imported at 07:17:22.124 UTC. Shared AI usage remains four starts/six calls.

Evidence: `tests/evidence/email-events-runtime-2026-10-08.json` and `email-events-production-2026-10-08.json`. Live screenshot: task output `sponsorintel-email-delivery-live.png`. Operations, source documentation, privacy boundaries and reconciliation steps are in `docs/OPERATION_ALERTS.md`.

## Deployment and rollback

Worker `79264854-357a-466e-ad63-d942327168bd`; additive migration 0023 applied. Pre-migration bookmark: `000002cc-00000000-000050fe-8f0f72d863b373a6f0d1a9202e2b4389`. Previous Worker: `14a6d48e-27bd-447e-ad95-cd0cae9a3e7a`. Before rolling back to code without this consumer, disable the event subscription and inspect queue state. Preserve queued events, receipt tables and later user activity; do not purge queues or restore the whole database to undo code.

Two dedicated queues and one domain-scoped subscription were added within the existing Cloudflare account. No paid plan, provider credential or scope, email sending identity, schedule or AI limit changed. Existing service usage limits still apply. The build flags the existing large main chunk (now approximately 501 kB uncompressed); that performance work remains separate. Hosted CI results belong to the pushed head in the draft PR; local checks do not resolve the GitHub billing lock.

## Remaining acceptance

The first genuine provider event, exact native Message-ID correlation, production failure/recovery handling and the next genuine hourly queue-health collection remain unobserved. Reliable Inbox placement remains unresolved after the earlier test reached Gmail Spam. Empty queues cannot establish subscription liveness without expected real traffic. Complete provider-outage detection remains separate. The full autonomy goal is still active.
