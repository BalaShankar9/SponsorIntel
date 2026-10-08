# Sponsor Intel 2.20 — durable support review and Google connection repair

Reports previously appeared only in the latest-50 owner list, and business findings stopped counting them after seven days. The new private Support queue keeps every unresolved report available, routes its category, supports stable pagination, and records an outcome and append-only review history. Overdue technical/information reports remain visible in business findings. A version predicate, operation ID and atomic audit prevent stale or duplicate updates. Neither customer messages nor private notes are sent to AI; review actions do not send customer replies.

The owner authorized a dedicated Google connection and separately accepted the API terms. Search Console API is enabled for Sponsor Intel Search; the dedicated service account has Restricted access to `https://sponsorintel.london/` and no Google Cloud project roles. One credential is stored in the Worker secret; its temporary local JSON has been removed. No billing account or subscription was added.

The first owner-triggered Google read on 8 October failed before a token response. Isolated Workerd execution reproduced an unsupported `redirect: error` request option. The reader now uses `manual` and rejects every non-success response, so assertions/tokens are not forwarded through redirects. The failed production receipt stays unchanged at one request; no real credential retry, quota reset or paid AI call was made. Actual Google data and scheduled reads remain unverified until the next eligible day.

## Validation and deployment

- 248 local tests pass, including eight new support tests and redirect rejection for 301/302/303/307/308. Typecheck, production build, 17 public prerenders and Worker dry-run passed.
- Isolated Workerd/D1 ran the real reader with synthetic responses: ten runtime-constructed requests completed; replay made no additional request. No external Google or model service was called. This validates transport compatibility and state handling, not live Google permission or metrics.
- Local browser verification saved a synthetic report review, removed it from the unresolved view, retained its original message and displayed the history. At 390px the document width remained 390px. Original script-shaped text remained escaped. See `tests/evidence/search-support-runtime-2026-10-08.json`.
- Migration 0017 applied after D1 recovery bookmark `0000029d-0000003e-000050fe-9b1fed68e31a357ca8c688d7bc98faf7`. It is additive and changes no original message or timestamp.
- Live Worker `d36c81ab-8325-4fc1-ab2a-54820e0f9b70` reports 2.20.0. The signed-in owner sees the Support queue, correctly showing zero reports. Unauthenticated support/history/search/dashboard requests return 403 with no-store.
- Production verification retained zero feedback records and zero support reviews; no synthetic customer report was added to production. The Google receipt remains `failed`, trigger `owner`, requests `1`, `network_unavailable`.
- GitHub hosted CI remains a separate gate. Local checks do not resolve the account billing lock observed on the previous head. Check the current commit's job annotations after push.

## Next acceptance

The next eligible Google read is through the genuine hourly business workflow on 9 October UTC (normally 00:45 UTC / 01:45 Europe/London). Verify its trigger, exact property, report period, actual data, inspection results and request count, then observe another day's scheduled read. No success, ranking improvement or sustained autonomous execution is inferred from local tests.

Support routing and review are available; autonomous bug fixing and customer reply delivery are not implemented. The real-advert research campaign, useful editorial output, actual social delivery, independent alerting and premium demand retain their separate acceptance requirements.

## Recovery

A Worker rollback does not roll back D1. Keep the additive support schema and its audit/history. Pause business/search using the existing owner controls where needed. Never delete a failed Google run or release its daily reservation to manufacture success. If a future investigation needs broader permissions, a new subscription or customer-data transmission, obtain the applicable authorization first.
