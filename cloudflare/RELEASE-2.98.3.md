# 2.98.3 — independent public loading and recovery

28 October 2026. A failed featured-employer or city-suggestion request previously rejected the shared startup promise, discarding successful register metadata and leaving “Loading official register…” visible after the failure. Every app page also requested city suggestions, an aggregate scan of the register, even when the city field was unused.

Register metadata, featured employers and city suggestions now have independent loading, error and retry states. Suggestions load on first focus of the city field; featured employers load only on Discover. A retry requests only its failed section. Public reads used by this page have a 15-second deadline, cancellation on section unmount, and readable network/non-JSON errors. Failed employer search no longer reports “0 employers found”. Successful data from another section is retained; failed reads are not represented as empty results or current verified data.

The change reduces unnecessary requests, but does not alter database queries, imports, schedules, paid plans, control identities or research/application manifests. No production quota is reset. The earlier 2.98.2 exact licence-lookup repair remains included. Register cleanup/import cost and genuine post-reset service recovery remain separate open issues.

## Validation

- Pinned Node 24.19.0: 780/780 tests pass; TypeScript, production build, 20 prerenders, browser budgets and version-upload dry run pass.
- Built-app browser fixture, with fictional records only: partial featured failure preserves the register date; optional city failure preserves typed search; separate visible retries recover both sections; total failure terminates loading; a stalled register read times out while featured records remain visible; failed search reports unavailable and its retry recovers.
- Local request counters: initial Discover makes one metadata and one featured request, with no city request. A guide-page load makes one metadata request and no featured or city request. Production row savings have not yet been measured.
- The package lock changes only the application version; the existing same-day zero-advisory dependency audit applies to the unchanged graph.

## Live incident and rollback

A live Carpool database read at approximately 19:16 UTC still returned Cloudflare D1 code 7500: the shared account exceeded its free daily row-read limit. A zero-row constant query succeeds, as does one Sponsor Intel metadata read; those partial successes do not establish service recovery. Sponsor Intel job search was still returning 500 during this investigation. The provider resets the free allowance at 00:00 UTC; continued operation within the free allowance is not proven.

This release changes no schema or stored data. The last complete recovery identity/bookmark/schema inspection remains 26 October; today's inspection was unavailable under the recorded incident. Compatible code rollback is 2.98.2 Worker `c9d2f6b2-353f-408d-a828-7376bd24e878`. Upload/deploy versions separately so existing routes and four cron triggers are not resubmitted. Record actual deployment and live checks in the dated receipt before claiming publication.

Evidence: `tests/evidence/public-loading-2026-10-28.json`. Provider references: [D1 pricing and daily reset](https://developers.cloudflare.com/d1/platform/pricing/) and [separate version upload/deployment](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/).
