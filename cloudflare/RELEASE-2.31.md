# 2.31 — Load owner tools when needed

Public visitors previously downloaded every owner management screen because the shared account navigation and dashboard came from the same eagerly imported module. Account navigation and page tracking now remain in a small shared module; the admin route downloads its dashboard and management styles on demand. Owner APIs still enforce authentication on the server. A failed dashboard download shows a recovery message and an explicit reload button; navigation remains available.

| Initial resources | 2.30 | 2.31 | Reduction |
| --- | ---: | ---: | ---: |
| JavaScript, uncompressed bytes | 501,398 | 403,092 | 19.6% |
| JavaScript, build gzip bytes | 148,289 | 122,981 | 17.1% |
| CSS, uncompressed bytes | 125,984 | 103,091 | 18.2% |
| CSS, build gzip bytes | 25,661 | 21,679 | 15.5% |

Both build gzip measurements use Node's same default compression. The deferred owner files contain 99,656 JavaScript bytes and 22,893 CSS bytes. This changes when management code is downloaded; owners still need it when opening the dashboard. Public guides remain rendered into their initial HTML.

The build now checks the entire eager dependency graph: JavaScript at most 420,000 raw / 130,000 gzip bytes; CSS at most 110,000 raw / 23,000 gzip bytes. It also rejects eager owner imports or public owner preloads and checks headings across all 17 public prerenders. These are project budgets, not web-standard performance thresholds.

## Verification

- All 336 existing tests, typecheck/build, browser budget and Worker dry-run passed. No database migration or dependency update.
- In isolated Workerd, `/jobs` requested only the public entry and stylesheet. Admin navigation then fetched both owner assets successfully. Blocking only the local owner script produced the recovery message; restoring the request and using its reload button reopened the signed-in fictional owner dashboard. Returning to jobs worked.
- Production reports 2.31.0. Live jobs showed 885 current roles; owner tools loaded only on admin navigation and the return to jobs succeeded, without recorded console warnings/errors. `/api/admin/dashboard` still returns 403/no-store anonymously; `/admin` remains private/no-store and noindex. Jobs and immigration HTML include the new public entry and no owner preload.
- One uncached desktop browser comparison recorded JavaScript transfer bytes of 152,981 before / 127,038 after, and CSS 30,271 / 25,529, both served with zstd. These include protocol overhead and are not the reproducible build gzip figures. Browser extensions were present; no network throttling or clean field-measurement sample was collected. This verifies fewer bytes, not Core Web Vitals, a Lighthouse score, faster timings for every visitor, or ranking gains.
- The viewport control did not apply: both attempts still measured 1,384px. No new 390px acceptance is claimed. The control was reset and local development server stopped after inspection.
- The genuine quarter-hour alert scan completed at 08:00:40.084 UTC with one owner and zero attempts/holds. No new email, model call, Google retry or social post was sent. There are still zero genuine provider lifecycle events; the next hourly queue-health snapshot remains a separate acceptance gate.

Evidence: `tests/evidence/browser-loading-2026-10-08.json`. Live preview: task output `sponsorintel-faster-jobs-live.png`.

## Deployment and limits

Worker `4ba65df7-691c-42c8-a4d6-20888f234489`; rollback to `79264854-357a-466e-ad63-d942327168bd` retains the existing email consumer. Preserve current database and queue activity. Schedules, permissions, alert settings, AI limits and provider connections are unchanged.

The initial bundle is smaller but still contains public and application-workspace features. Further splitting needs separate navigation, document and rendering checks. Successful search reporting, real social delivery, independent model-quality evaluation, reliable email Inbox placement and fully autonomous business outcomes remain unproven. Hosted CI's account billing block is separate from local validation.

Implementation references: [React lazy loading](https://react.dev/reference/react/lazy) and [Vite async chunk loading](https://vite.dev/guide/features#async-chunk-loading-optimization). Installed React 18.3.1 / Vite 6.4.3 builds were used for actual verification; no package upgrade was inferred from current documentation.
