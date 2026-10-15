# 2.76 — Sponsor licence directory by town and city

The owner requested a city-wise sponsor licence list. `/sponsors-by-city` now gives that journey its own navigation entry and a discover-page link: searchable places, listing counts, most-listings/A–Z ordering, route filters and paginated employer lists. City lists can be shared by URL. Employer cards retain official names, town/city, county, ratings and routes, link to the existing licence/save dialog, and separately link to the jobs collection by workplace search. No vacancy, employer identity or sponsorship classification is added or inferred.

The directory reads the current imported Worker/Temporary Worker register snapshot on each request. It groups only case differences in the original town/city field, preserves spelling variants/boroughs and includes separate county records in the same-name place list. Blank locations are excluded with an explicit count. Counts are employer-and-location listings after the existing route-row consolidation, not distinct UK companies or vacancies. The source date, last import check, OGL attribution, official source and failed/stale-refresh warning remain visible. No geocoder, purchased dataset, new external request allowance or database migration.

The same read-only query drives the public API and initial HTML. Native GET forms, place links and pagination work without JavaScript; browser data is bound to its exact search and a short-lived render timestamp. Back/forward cache restoration reloads the current snapshot. Query parameters use bounded, parameter-bound literal matching. Employer search uses `name`, keeping the existing `employer` detail-link identity separate. Clear filters preserves only the selected city. Database/template failure returns retryable noindex 503, never a fabricated zero-count page.

Only the main directory enters the sitemap. Filtered/paged lists remain usable and shareable with self-canonical URLs and noindex/follow; this does not create thousands of thin SEO landing pages or guarantee ranking. Private/unknown query fields do not enter generated links or bootstrap identity.

## Validation

- 655 full-suite tests pass on pinned Node 24.19.0/npm 11.8.0. After final wording/clear-filter polish, all seven directory tests pass again. TypeScript/build, 18 public prerenders, existing browser size budgets and Worker dry run pass.
- Actual SQLite queries cover current/old snapshots, missing locations, case-only grouping, same-name/different-county records, literal wildcard/SQL-shaped input, route/name filters and deterministic pagination. An actual isolated Worker/D1 proves initial HTML, escaped source/boot data, redirects and outage responses with zero external I/O.
- Built-app fictional browser QA verifies city selection, employer/route combination without a wrong licence dialog, clear filters, page two and a 390px viewport/document with no overflow. No production synthetic activity or personal records.
- Initial validation caught a browser CSS budget overrun and a stylesheet import incompatible with isolated Worker bundling. Both were corrected without increasing budgets. Early seed placeholder and redirect-observation mistakes were corrected in the fixture; failed outputs remain local diagnostic evidence, not passing checks.
- Dependency graph unchanged except application version; the same-UTC-day audit remains zero high/critical and three known moderate Mammoth-chain findings. No install or permission change. Disk was approximately 10 GiB before runtime.

## Deployment boundary

Rollback: **2.75 Worker acf4dc86-be65-4d54-a471-e13698ad06b9**. No schema or customer-data change, restore, forced refresh, new AI/Google request, source approval, social schedule or hold release. Same-day read-only recovery at 22:54:48.625 UTC matched all 40 migrations/166 schema objects and a current recovery point; it is not a customer restore test.

Pre-deployment public register inspection retains the **14 October snapshot**, 128,015 listings, last check 15 October 07:15:53.298 UTC and an existing refresh-error flag. The official publication page shows a 15 October version. This release must display the retained date/warning and cannot clear that finding. Reconcile the original failed attempt and next genuine daily refresh separately; do not force an import to manufacture freshness. All operational holds, budgets and pending Facebook job 397276739 remain unchanged.

Live receipt and exact-head CI results follow after deployment.
