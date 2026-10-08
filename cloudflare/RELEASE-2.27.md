# Release 2.27 — Readable immigration guidance in the initial page

The production `/updates` response previously contained a loading placeholder; the 19 guidance explanations appeared only after JavaScript fetched their data. The Worker now renders the same React guidance component into the initial public HTML using the current, validated database response. It includes source quotations, reviewed wording comparisons, status notices and ordinary topic links. This helps script-free readers and crawlers without a bot-only content branch or additional keyword pages.

The existing application shell, canonical `/updates` address and metadata remain. Filtered views link to the same canonical page and stay out of the sitemap. The browser starts from the public snapshot, consumes it after initialization and requests a fresh check; later visits cannot reuse it. Bootstrap snapshots older than one minute or implausibly future-dated are rejected, and evidence that has expired in transit cannot reappear. Returning to a visible tab triggers a check; an older overlapping response cannot replace a later request's result.

HTML reads share the API's hash, quote, withdrawal and freshness rules. There is no build-time copy of live guidance. Responses use `no-store`, remove static-asset validators, and exclude full source bodies and private account data. Missing source data, asset/template failures or database failures return a retryable, non-indexable 503 with an official guidance link. The Workers preview hostname stays noindex. Page refreshes do not manufacture sitemap modification dates or claim improved rankings.

## Validation

303 tests pass. New coverage checks initial content and official excerpts, working topic links and invalid topics, changed/stale source holds, text escaping, bootstrap age and expiry, and retryable unavailable responses. Build, 17 public static shells and Worker dry-run pass. The build produces a shell for `/updates`; its current guidance is rendered only when the live route is requested.

An isolated Workerd/D1 environment with no AI, email, cron, workflow or remote database bindings verifies actual HTML rewriting, 19/3/6 guidance cards for all/Student/Business views, equal visible output for browser and Googlebot requests, canonical and freshness headers, public-only embedded data, and immediate withdrawal of text after a synthetic local source-hash change. A temporary local table rename verifies a real database failure returns 503 without stale guidance; the original table is restored. Browser checks cover the rendered content and opening official quotations with page scripts disabled; the normal scripting setting is restored afterward. Do not equate rendering with Google indexing or ranking acceptance.

Run `node scripts/check-immigration-pages.mjs https://sponsorintel.london` for a bounded, read-only initial-HTML acceptance check. No Search Console request or AI call is made by this check.

## Deployment and rollback

Previous Worker: `023b0e28-630b-4827-9723-bee94c67aa60` (2.26). No database migration, dependency upgrade, additional service, subscription, cron or model allowance is introduced. Code rollback restores the former client-loaded guidance page while preserving all source versions, editorial decisions and budgets. Production acceptance is recorded separately after deployment.

References: Google's [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) recommends server rendering for users and crawlers; Cloudflare's [HTMLRewriter API](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/) provides the supported response transform. Neither establishes search ranking gains.

Production Worker `9a8e9bef-c6ee-45c8-bb35-bfc5e6cd69ae` reports 2.27.0. The public HTML acceptance check passes for all/Student/Business views (19/3/6 cards), and the preview host is noindex. The signed-in live browser consumes the public bootstrap and changes topics correctly. See `tests/evidence/immigration-seo-runtime-2026-10-08.json` and `tests/evidence/immigration-seo-production-2026-10-08.json`.

Independently, the actual scheduled business run `business-497621` completed at 05:45:40.549 UTC on 8 October. Its snapshot includes all 19 guidance statuses as explained and no full source bodies, proving the 2.26 collection on a genuine unattended run. Production AI usage remains four starts/six calls; this release makes no Google, model or social publishing request.
