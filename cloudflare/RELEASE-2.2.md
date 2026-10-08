# Sponsor Intel 2.2 — public search and community sharing

Released 4 October 2026 at https://sponsorintel.london. Worker version `18560b99-e92e-440d-8e02-eb6cccf46957`; application version `2.2.0`; source commit `88144835b19d3ee2f91eb549b3b099c38b02989e`. No database schema change or paid integration was needed. Existing schedules and the integrated Hire Stack workspace remain active.

## Delivered

Eight public routes now have pre-rendered HTML from the same React components visitors use, unique titles/descriptions, consistent canonical links, Open Graph/Twitter cards and valid JSON-LD objects. The build contains no account data, copied live feed snapshots or user-agent-specific content. JavaScript loads current feeds and personalised state after the initial page. Three new practical guides and an About & sources page provide useful, linked public content.

The Worker handles canonical path/www redirects, preserves query parameters, serves a real 404 for missing pages and sets server-level noindex/private caching for workspace pages. The fallback hostname has noindex on its pages. Public data reads are crawlable while private/auth/admin APIs remain disallowed. The sitemap is generated from the public route map. Social links include a 1200×630 JPEG preview, about 41 KB.

The homepage clearly introduces the employer search and suggests a three-employer shortlist. Campaign parameters no longer activate results on initial load or browser-back navigation. Public vacancy browsing renders without waiting for private account loading; actions that save to the career workspace remain disabled until it is ready.

## Acceptance

- 24 unit/persistence tests passed, including canonical redirects, private/404 routing, missing-asset failure and fallback-host exclusions.
- TypeScript, the production build, eight-page pre-render and Wrangler dry run passed.
- 15 SEO checks passed locally and against sponsorintel.london: all initial headings and page metadata, JSON-LD, eight sitemap URLs, seven private routes, four unknown routes, query-preserving redirects, image delivery, robots and HEAD.
- 19 public API/route checks passed locally and live; production checks finished at 14:27 UTC.
- 19 account/isolation/recovery/consent regression checks passed locally after the rendering change. Fictional test accounts were removed. Production account behaviour was not changed and was tested in release 2.1.
- Browser acceptance covered the published guide, mobile 390px layout with no horizontal overflow, the campaign-tagged mobile homepage and a city search returning the expected 617 Cardiff records. The social preview was inspected at its native 1200×630 dimensions.
- Live HTTPS returned version 2.2.0, www redirected to the primary domain with queries preserved, and workers.dev HTML carried noindex.
- GitHub Actions run 37209381754 executed zero steps. Its check annotation reports the existing account billing lock; this is not a failing executed test suite.

## Google and launch status

Search Console ownership of `https://sponsorintel.london/` was verified through the HTML tag in the owner's signed-in account. The eight-page sitemap was submitted. The first report showed “Couldn’t fetch”. Google's live sitemap test at 15:31 BST / 14:31 UTC then reported “URL is available to Google”, crawl allowed = Yes and page fetch = Successful. The homepage was initially unknown to Google; a subsequent indexing request was accepted and the UI confirmed addition to a priority crawl queue. The sitemap was resubmitted once after the successful live fetch. At the final check after resubmission, the sitemap report still showed “Couldn’t fetch”, type Unknown and zero discovered pages. This remains an external crawl/processing issue to recheck; it is not recorded as successful sitemap processing. The live Google fetch succeeded, HTTPS serves valid XML with HTTP 200, and robots allows the URL. No broader security controls were weakened to force a crawl. Verification, successful submission, successful crawling and actual search indexing are separate states. The initial performance reports are processing data.

The owner requested a WhatsApp message and posting guide. No WhatsApp group message was sent by this task. `docs/GROWTH_PLAN.md` records the pilot, content, measurement and search priorities. No third-party behavioural analytics or unapproved outreach was added.

## Recovery and limits

Rollback to Worker `d27b347a-c0e8-41c8-962f-31a518e7c7ab` restores 2.1 routing and assets without a database restore. Preserve the Google verification tag in any rollback/rebuild to retain ownership verification.

Live data listings still require JavaScript; the current change pre-renders the public interface and full guide content, not every employer or vacancy. There are no individual indexed job pages or JobPosting rich-result claims yet. Search ranking, traffic increases, WhatsApp preview caching and eventual Google indexing cannot be established by local checks. Content and promotion work must be judged against real user and Search Console evidence.
