# 2.32 — Current jobs in the first page response

The public jobs page previously returned a loading placeholder and no role links until its browser script fetched the collection. It now renders the same shared React search view using the public jobs query on the server. Visitors receive current role cards, search controls and ordinary pagination links in the first response. The browser starts from that snapshot and retains personal saved-search features.

Search and filter controls form a native GET submission, including the selectors outside the main search form. Each unfiltered result page has its own canonical URL; filtered views are noindex. Unknown and tracking parameters cannot enter generated links or structured data. List pages use CollectionPage, not JobPosting markup. The response is no-store, removes stale asset validators, and uses the existing availability and licence evidence rules. A missing template/database returns a retryable 503, not an indexable empty collection.

The public bootstrap is bound to the normalised search, accepted only for 60 seconds, and expires at the earliest closing deadline, observation expiry, register-evidence boundary or five-minute limit. An open browser tab removes the previous collection before a timed/visibility refresh; a failed request cannot retain expired cards. Stored observation dates are not changed by reads. This is bounded snapshot freshness, not a continuous employer feed.

The hourly business workflow now GETs the jobs page, while the other four checks remain HEAD requests. It checks a bounded response for a fresh snapshot, matching visible role links and canonical/pagination links, retaining only aggregate counts and timestamps. Missing/expired/broken content raises a high-priority finding and holds report publication. The monitor uses the same public URL as visitors and never stores HTML or customer search terms. Historical snapshots without this new field are not retroactively treated as failures.

## Verification

- All 345 tests pass; typecheck/build, the eager-browser asset budget and Worker dry-run pass. No migration, dependency upgrade, new paid service or raised allowance.
- Actual local Workerd responses contained 12 of 15 fictional roles on page one, three on page two, eight conditional roles in the sponsorship filter, and a truthful empty result. An out-of-range page redirected to the last page. A local database failure returned 503/no-store/noindex with no cards.
- Native search/filter submission and pagination worked with the module script removed by an isolated local asset wrapper. A separate script-disabled observation verified readable initial content; the browser helper could not interact while globally disabled, so that attempt is not counted as interaction acceptance. All wrappers and browser overrides were restored.
- One fictional role closed at 08:42:34.143 UTC. The open page showed it at 08:42:19.976 and zero matching roles at 08:43:09.053 without a reload; its original observation date was preserved.
- Production checks at 08:54 UTC passed for page one, page two, sponsorship filtering and an empty search: initial role IDs/counts matched the public API, correct canonical/noindex behavior, no-store, no owner preload and no JobPosting list markup. There were 885 current roles overall, including 50 with positive or conditional wording. These counts are dated observations, not guarantees of sponsorship.
- The live browser filter showed 50 matches with 12 visible cards. A real 390px viewport measured 390px document width; its temporary override was cleared. Screenshot: parent task output `sponsorintel-search-mobile-live.png`.
- The initial-content health function passed against the live page. Its first future genuine hourly invocation remains a separate acceptance gate; no production incident or forced run was created.

Evidence: `tests/evidence/job-search-pages-2026-10-08.json`. Repeatable read-only check: `node scripts/check-job-search-pages.mjs https://sponsorintel.london`.

## Observed unattended operation

Before this deployment, genuine scheduled run `business-497624` started at 08:45:38 UTC and completed at 08:45:51.261. All five HTTP/header checks passed, and the retained snapshot contains current incoming and dead-letter queue metrics: both zero at 08:45:45.112. This closes the first scheduled collection gate for the 2.30 email queue monitor. It does not prove a provider lifecycle event: none has arrived. The one earlier owner test reached Gmail Spam, and dependable Inbox delivery and real incident/recovery remain unverified. No new real email, production AI call, Google retry or social schedule was used for this release.

## Deployment and limits

Worker `fb2e847d-2f3c-4346-9431-3fba9c4f1957`; rollback Worker `4ba65df7-691c-42c8-a4d6-20888f234489` retains the email consumer. Preserve later database/queue activity on rollback. Schedules, publishing destinations, owner preferences and model allowances are unchanged.

The initial JavaScript remains within the existing 420 kB / 130 kB gzip budget. Rendering access and crawlable links do not establish indexing or ranking gains. Google reporting, independent model evaluation, observed social delivery, user retention and a fully autonomous company retain their separate acceptance gates. Hosted CI must be checked on the pushed commit; local tests do not establish its success.

References: [Google pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading), [JavaScript search basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [job structured-data requirements](https://developers.google.com/search/docs/appearance/structured-data/job-posting) and [Cloudflare HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/).
