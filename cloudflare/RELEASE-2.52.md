# Release 2.52 — individual advert evidence holds

An external deadline or sponsorship conflict previously required holding the entire proposed employer feed. The owner can now retain an evidence-backed hold on one exact advert, while complete catalogue and employer checks still apply to the source. The hold survives refreshes and, after an identity match, advert URL changes. Immutable decisions, request replay, concurrent-edit protection and atomic retirement preserve review history. A release requires new evidence and keeps the role inactive until a successful collection started after that decision observes it again.

Historical detail pages explain the hold or pending refresh, stay noindex and pause preparation. Current search, counts, sitemap and saved-search matches exclude the inactive role. The hourly business monitor records aggregate follow-up findings; the source receipt distinguishes collected adverts from held adverts. Private review notes never enter public details or aggregate findings. No employer, job, CV transmission, social post, model call or extra refresh is created by this release.

Migration 0034 adds two private tables, a latest-review view, indexes and triggers. It does not change existing source approval or job data when there are no reviews. Deployment requires the additive migration before the new Worker. A code rollback preserves all review tables/triggers; do not drop them or assume an older detail template can describe holds accurately.

See [the operating contract and limitations](../docs/ADVERT_REVIEWS.md), including exact-URL limitations before the first stable job identity match. King's Lynn Academy remains unconfigured; its actual cross-portal date conflict has not been resolved. The new control enables a later separately reviewed admission within existing daily limits.

## Verification

All 507 tests pass on pinned Node 24.19.0, together with TypeScript, production build, 17 prerenders, browser asset budgets and Wrangler dry run. The actual isolated Cloudflare SourceWorkflow/D1 test checks a complete fictional feed with one held and one unaffected advert and verifies replay without extra source requests. Browser verification confirms a recorded release remains paused and the review form fits a 390px viewport. These tests establish controls, not independent advert accuracy or automatic review decisions.


## Live receipt

Release 2.52.0 is deployed at sponsorintel.london as Worker `3a133af1-df7d-443c-8ea9-e15e77f2ba5f`. Migration 0034 applied successfully. The before/after job aggregate (1,005 retained records, 926 active, exact latest observation) and both employer-review states/timestamps matched; no foreign-key errors. Read-only recovery inspection at 21:18:10 UTC matched 34 migrations and all 141 schema objects exactly and confirmed a current recovery point. No customer export or restore was performed.

The signed-in owner browser shows the new desk with zero reviews; anonymous access returns 403. No fake production hold was created for testing. The public browser still shows 926 current jobs, 55 sponsorship-mentioned adverts and 873 licence-linked roles. Desktop and mobile local review/release checks used fictional data only. The code rollback reference is 2.51 Worker `86062f83-ce93-4f38-a4b8-3377960af3e0`; review tables and triggers must be retained. Hosted CI is checked on the pushed commit separately and remains subject to the existing account billing lock.
