# 2.98.2 — exact licence lookup cost repair

Prepared 28 October 2026 after an actual public job-search outage. A QA-only live Worker trace attributes the 500 to D1's exhausted free daily row-read allowance. Cloudflare login was renewed with exactly the existing eight scopes; no plan, permission, limit or owner hold changed.

## Change

The reviewed-employer lookup previously allowed SQLite to choose `sponsors_skilled`, scanning the current Skilled Worker register before filtering a few exact IDs. Cloudflare's refreshed Last 24 hours dashboard showed 478 executions and 58.62 million rows read for this query. These are rounded provider metrics, not a complete UTC-day bill.

The lookup now starts from the deduplicated reviewed IDs and uses a CROSS JOIN to search the existing `(snapshot,id)` primary key. Current snapshot, freshness, approved-source identity, Skilled Worker flag and route checks remain. No stale cache, positive-label upgrade or schema migration is introduced. All research/application source manifests and control identities remain unchanged.

## Evidence and limits

A real isolated Miniflare/D1 test with 128,000 fictional register rows returns the same three exact eligible records from five requested IDs, excluding a non-Skilled-Worker record, missing record and old-snapshot-only record. Before ANALYZE, reads fall from **128,005 to 9**. After ANALYZE, both plans are efficient (14 versus 9). The empty-ID result stays empty. Existing opportunity tests cover stale/failed/future register observations, withdrawn records, approved identities and sponsorship labels. This is local query-cost evidence, not measured production savings.

A proposed generic outage-response change was removed when the source-manifest guard correctly detected a change to the reviewed research entry point. The first full run (Node 24.22.1, updated bundled runtime) had 777 passes and that one failure; its build also failed at the guard. No manifest was rewritten and that intermediate change was not deployed. Final validation uses the project's exact Node 24.19.0 pin, restored from the official archive with verified SHA256.

Today's recovery inspection is **unavailable**, not healthy. Initial authentication failed; a later schema read reported D1 quota error 7500; after renewal the information read did not complete within the inspector timeout. The last complete identity/bookmark/schema check remains 26 October. This release changes no schema, data, reservation or control. Compatible code rollback is **2.98.1**, Worker `ac307219-732a-4d29-8d23-eff5da834cf4`.

The exhausted allowance remains in effect; a code deployment does not reset it. Registry cleanup is a separate cost problem: the same dashboard showed 55.69M rows read/18.56M written across 145 executions of the two-snapshot retention delete. Its invocation origin and excessive cost still require investigation. No deletion or cleanup was triggered by this repair. Register imports, directory scans and account-wide activity also need capacity review; this patch alone does not establish sustainable free operation.

The original business-497989 still returns missing-instance 10400, not terminal evidence. Its hold remains. Source provider receipt scheduled-1793169055003 did complete on 28 October at 06:32:06.528 UTC with 37 published sources/one skip on the 2.98.1 source version; current D1 aggregates and the later source schedule are unavailable. No forced run, model/Google call, source collection, marketing send or application is added.

Current receipt: `tests/evidence/database-capacity-2026-10-28.json`. See `docs/OPERATIONS-2026-10-28.md` and the current checkpoint for final validation, deployment and outstanding incident status.

Primary references: [D1 query indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/), [D1 billing and limits](https://developers.cloudflare.com/d1/platform/pricing/). The installed dependency graph has zero known npm audit advisories today; Undici 7.30.1 matches the [vendor's patched version](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c).
