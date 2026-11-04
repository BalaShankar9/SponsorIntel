# Sponsor Intel 2.48 — retained source-check diagnostics

Source retries used to record a generic fetch failure, leaving the owner and operating agents unable to identify the failing public advert or collection stage. New failure receipts retain a bounded, server-owned diagnostic and survive both successful retries and terminal outcomes.

## Behavior

The paged employer collector distinguishes request/timeouts, response status, pagination, identity changes, unsupported public sections, storage and lease failures. It retains only an allowlisted code, stage, numeric public advert reference, page offset, request count and response status. Raw provider exceptions, bodies, URLs, stack traces and credentials are not retained. Other adapters without a classified cause remain explicitly unclassified; this release does not invent a diagnosis for legacy receipts.

The existing maximum of three attempts is unchanged. Failed attempts retain their request reservations. A successful partial collection still has no published roles; a complete publication keeps earlier failed-attempt evidence. The owner dashboard shows up to ten affected checks from the most recent fifteen runs, including recovered checks. This is a diagnostic aid, not automatic parser repair or permission to bypass source restrictions.

## Validation and deployment

467 local tests pass using the pinned Node runtime, followed by the focused rendering test after a singular/plural copy correction. TypeScript, production build, 17 prerenders, asset budgets and Worker dry-run pass. Actual isolated SourceWorkflow/D1 execution injects one fictional 503 response, waits for the real workflow retry, preserves the diagnostic during private collection, publishes only a complete later catalogue and makes no network request on replay. It uses 46 fixture requests and 150 conservatively reserved slots. No live failure was manufactured. The initial runtime checks exceeded the local setup time limit; batched empty-schema setup reduced round trips, and the full suite subsequently passed with bounded local concurrency.

Production Worker `5ca33c35-76fc-4394-b980-1192f6f809bf` is deployed. The live owner browser shows the new history panel, the real older unclassified failure, and the later completed 51/249 private collection separately. Public browser totals remain 926 roles, 35 employers and 55 sponsorship-mentioned adverts. Rollback baseline is 2.47.1 Worker `f6193a11-3be4-4870-8e60-195bfbe6d00c`. There is no schema migration; the read-only recovery inspection at 19:16:09 UTC matches all 129 objects across 31 migrations and confirms an available current recovery point. No customer data was exported or restored.

## Genuine scheduled monitoring

The 18:45 UTC business run `business-497634` completed at 18:46:35.509 UTC, independently confirmed by Cloudflare. Its movement capture at 18:46:22.273 records 12 entries, 10 exits, one sponsorship claim gained and none lost: 924 → 926 jobs and 54 → 55 claims. It correctly records PortmanDentex as normal collection progress at 51/249, with no partial public catalogue. This closes the previously pending post-repair monitoring gate.

PortmanDentex continues on its normal 00:30 UTC 9 October schedule; no extra owner collection or counter reset was forced. Complete publication, its first successful unattended continuation and a future natural classified-failure receipt remain unobserved. LinkedIn jobs and ordinary recruiting posts remain reviewed discovery leads; continuous automated LinkedIn ingestion is disconnected. No production AI/Google retry, email, social post or paid service was added.

Evidence: `tests/evidence/source-diagnostics-2026-10-08.json`.
