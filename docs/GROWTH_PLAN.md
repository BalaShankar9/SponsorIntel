# Sponsor Intel: community launch and search growth

Prepared 4 October 2026. The purpose is to attract people who can use the product, help them take a useful first step and learn which information they need next. A ranking position is an outcome to measure, not a promise.

## First release: delivered in 2.2

- Eight public pages deliver readable HTML from the actual React components before JavaScript runs. Unique titles, descriptions, canonical URLs, social previews and WebSite/WebPage/Breadcrumb metadata share one route definition. Live employer, vacancy and immigration data still loads from current APIs, rather than being frozen into the build.
- Three linked practical guides explain checking a sponsor, interpreting an advert and building a shortlist. An About & sources page explains scope, freshness, extraction limits and how to report a correction. No invented professional credentials or outcomes.
- The sitemap includes only the eight public canonical pages. Missing routes return HTTP 404; personal workspace pages carry server-level noindex and private/no-store caching. Search filters and campaign links retain a clean canonical. The www host redirects to the primary address, while the legacy workers.dev site remains available with noindex on its pages.
- A small, branded 1200×630 sharing image gives community links a clear preview. The homepage invites people to research three employers. Campaign parameters no longer accidentally trigger a filtered-results state.
- Google Search Console ownership for the HTTPS primary address has been verified using the owner's signed-in Google account. The homepage indexing request was accepted into Google's crawl queue. Google's live sitemap fetch succeeded, but the sitemap report still showed a fetch warning after one resubmission; successful processing and actual indexing remain unconfirmed. See the release evidence for the observed result.

## Community launch: a small, useful first audience

The user chose a message and posting guide rather than automated sending. No WhatsApp messages have been sent by this task.

1. Start with two or three relevant communities where the owner participates and project recommendations are welcome: international students, graduates, local migrant communities or relevant professional groups. Write a personal introduction for that group. Avoid mass forwarding or repeatedly posting the same advert.
2. Share one clear link and ask people to search their city and save three employers. Explain that the beta is free to explore and that a sponsor licence does not establish sponsorship for every vacancy. For groups mainly discussing rule changes, use the updates page and describe the selected official-source coverage accurately.
3. Ask the first five to ten willing users what they tried, what confused them and whether they found a useful next step. Invite feedback through the site. Do not ask for passport details or immigration documents in a group.
4. Reply to questions and publish a useful follow-up only when there is a real improvement, new guide or checked official change to share. Give readers a reason to return through fresh evidence and practical progress, without artificial urgency or repeated reminders.

## Next build priorities

| Priority | Work | Evidence needed before calling it complete |
| --- | --- | --- |
| 1 | Resolve any Search Console crawl issues, then inspect the homepage and key guides | Successful Google live fetch and sitemap processing; distinguish accepted indexing requests from actual indexing |
| 2 | Improve the first search-to-shortlist journey from pilot feedback | Users complete city search, open the evidence, save an employer and find their next action without help |
| 3 | Add useful employer and vacancy detail URLs | Stable identity, original source links, current evidence, expiry handling and meaningful content; no bulk thin pages |
| 4 | Consider Google JobPosting markup for individual, eligible live job pages | All required fields, genuine single-vacancy content, correct apply route and removal/expiry behaviour; never attach it to a results page or invent sponsorship/salary details |
| 5 | Expand guide topics around real questions | Clear audience, independently checked official sources, named product publisher, preparation date, review trigger and useful next action |
| 6 | Earn relevant references | Helpful resources that university societies, career services and community organisers choose to link to; owner-approved outreach, no purchased link packages |
| 7 | Measure repeat usefulness | A defined, privacy-conscious measurement plan for searches, saves, applications and returns; do not infer visitor or conversion counts from a successful deployment |

## Measurement and review

Use Search Console for Google impressions, clicks, click-through rate, queries, pages and indexing problems. Establish a baseline after it has processed enough data. Review which queries already produce impressions and improve the most relevant page before creating many new pages. Measure branded and non-branded discovery separately. No initial ranking or traffic claim is supported yet.

Search Console does not count WhatsApp visitors or product actions. Campaign parameters alone do not create analytics. Start with a small user feedback log; add suitable aggregate measurement before reporting community conversion rates. Keep CV text, personal immigration details and application content out of analytics events.

For each future release, check raw HTTP HTML as well as the rendered mobile interface, canonical URLs, structured data, sitemap membership, robots behaviour, public links and real 404s. Preserve the Google verification tag. Readability and source accuracy take priority over keyword repetition.

## Reference standards

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): readable initial content, consistent canonical signals and real links/status codes.
- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): useful content, descriptive organisation and realistic expectations.
- [Google sitemap troubleshooting](https://support.google.com/webmasters/answer/7451001): submission, successful fetching and indexing are different states.
- [Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/): explicit Worker-first routing for canonicalisation and private/unknown-page handling.
