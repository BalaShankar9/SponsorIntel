# Sponsor Intel: build and launch roadmap

Owner: Codex implementation lead, with Bala as product owner. Updated 4 October 2026.

The product promise: help international students and migrants find credible UK opportunities, understand the evidence, and prepare good applications. Judge success by useful applications and interviews, not scrolling time or raw job counts.

## Foundation already delivered: 2.0

- Cloudflare Worker, D1, managed HTTPS and sponsorintel.london.
- Official sponsor register, employer research and a personal shortlist.
- Integrated Hire Stack application workspace: private accounts, CV import, document preparation, interview preparation, application tracking and export.
- Explicit-consent writing assistance, data ownership controls and recovery codes.

## Job quality and immigration clarity — 2.1

- Read complete provider descriptions, including Lever requirement lists and final exclusions.
- Filter speculative talent pools, duplicate links and locations outside the UK; retain unknown sponsorship as unknown.
- Add Figma, Octopus Energy and Funding Circle through boards linked from official employer career pages. This is still a selected employer collection, not market-wide coverage.
- Show advert pay wording, employment/workplace metadata and source check times.
- Watch selected GOV.UK guidance and recent Immigration Rules publications every 15 minutes. Store a baseline, subsequent changes, source health and bounded version history.
- Introduce Student, Graduate, Skilled Worker and Health & Care explanations, each pinned to its official source version. Hide explanations after a source change, withdrawal, failure or one hour without a successful check.
- Distinguish observation time, source-reported publication/edit time and confirmed effective dates. Never label the initial import as breaking news.
- Validate parser edge cases, changed sources, stale summaries, failed refreshes, mobile usability and live deployment. See the release record for actual acceptance results.

## Next: widen coverage and measure trust

1. Add verified sources in healthcare, universities, hospitality, engineering, public services and graduate schemes. The first 26 boards are live in 2.4; target 50 next, prioritising explicit early-career sponsorship; add a source only after its official ownership and access terms are checked. NHS Jobs and Work Hub remain direct discovery links until a permitted integration is verified.
2. Build an explicit employer-name alias review queue for sponsor-register matching. Separate register status from a vacancy’s sponsorship wording and the applicant’s eligibility.
3. Add source-provided closing dates and occupation data where available. Never infer an expiry date or occupation code from a title alone.
4. The contextual report-this-advert flow is live in 2.3. Add operator triage with the relevant source snapshot; prioritise scams, wrong sponsorship wording, closed adverts and incorrect locations.
5. Audit at least 50 varied adverts before making accuracy claims. Review every positive sponsorship label in that sample and record precision by source; any false positive blocks a stronger “verified sponsorship” claim.
6. Record successful/failed runs and freshness over time, with owner diagnostics for stale sources. Last-success timestamps alone are not an uptime history.

Acceptance: original adverts are reachable; claims have a quotation and timestamp; closed/stale jobs leave search; failed ingestion retains prior data with visible status; quality is measured separately from coverage.

## Then: a dependable immigration briefing

1. Broaden the allowlisted official sources to relevant Home Office announcements, guidance changes and Statements of Changes. Read implementation provisions and underlying attachments before simplifying a newly published rule.
2. Add a controlled explanation-review queue with old/new source comparison, effective-date checks and review history. AI may draft from supplied official text; publication needs a checked source version and appropriate review.
3. Add clear categories: proposal, consultation, confirmed future change, in force and withdrawn. An announcement is not automatically a rule in force.
4. Add a glossary and carefully checked translations of the highest-use explanations; retain the English official source alongside them.
5. Offer topic subscriptions and a weekly digest only after verified email delivery and unsubscribe controls work. Important changes should explain who may be affected, what changed, when and the next question to check.

Acceptance: a source change invalidates an old summary; effective dates are explicitly evidenced; no personalised visa decision is generated; outage and correction history are visible. The 15-minute schedule is near real time and does not guarantee instant or comprehensive coverage.

## Account reliability and the complete application journey

1. Verify account email ownership and deliver single-use password recovery links. Preserve the existing recovery-code path and handle pre-existing unverified accounts safely.
2. Add consent-based saved-search notifications, followed by calendar reminders and application follow-ups.
3. Improve CV/JD evidence matching without inventing experience, qualifications or sponsorship. Show missing evidence as questions, not eligibility verdicts.
4. Add server-managed document versions and restore controls; provide explicit deletion/export. Keep guest work useful without forcing account creation.
5. Check mobile keyboard use, screen readers, loading states and flaky connections across the full save → prepare → apply → follow-up journey.

Acceptance: two accounts cannot access one another’s work; retries cannot overwrite newer work silently; emails go only to verified destinations; delivery, bounce, unsubscribe and recovery cases are tested.

## Launch and growth

- Fix the GitHub account billing lock so hosted checks can execute; retain reproducible local checks meanwhile.
- Run a small student/migrant pilot, then repair the highest-impact confusion before public promotion. Do not contact people without Bala’s instructions.
- Track consent-respecting activation (save a credible role and prepare an application), repeat use, applications, interviews, source freshness and corrections. Set targets after a real baseline exists.
- Add employer pages and source-backed career guides that are useful in search results. Avoid mass-generated thin pages, fabricated testimonials and guaranteed-outcome claims.
- Add partnerships and employer contribution tools only after the core evidence and reporting workflow works.

## Reuse and operating costs

Use the existing Cloudflare application and the integrated Hire Stack workspace. Avoid a second overlapping account system. GOV.UK Content API and the public Greenhouse, Lever and Ashby job interfaces are the initial sources; they do not require user-supplied keys for these reads. Check provider conditions and limits before expanding use. Optional Companies House or licensed job integrations require this product’s own credentials and explicit cost checks. Never use somebody else’s API key found online.

Email preparation checked on 4 October: Cloudflare's sending-domain inventory does not yet include sponsorintel.london, and this Worker has no send binding. Cloudflare's [current email documentation](https://developers.cloudflare.com/email-service/) supports transactional verification/recovery through a Worker binding. Its [pricing](https://developers.cloudflare.com/email-service/platform/pricing/) includes 3,000 messages per account per month on Workers Paid, with usage above that billed separately; this is a shared account allowance, not a dedicated free Sponsor Intel allocation. The next implementation should onboard a dedicated sending subdomain, verify its DNS, add bounded sends and single-use expiring tokens, test with a local capture transport, and complete an authorised real-inbox delivery test before enabling it for visitors. Use a suitable consent-based delivery service for any newsletter or marketing digest; do not assume the transactional service permits bulk campaigns.

## Release discipline

Use the existing launch branch and draft PR. Before each production schema change, capture a D1 recovery bookmark; run appropriate local checks, deploy, verify the live user journey and record the Worker version. A green local test or configured schedule is not proof of a successful scheduled production run. Keep completed, configured and externally blocked work distinct.


## Search and community launch — 2.2 progress

Eight public pages now pre-render from the application components, including three practical guides and a data-methodology page. Canonical redirects, search/share metadata, a branded preview, generated sitemap, real 404s and private-page noindex are deployed. Search Console ownership is verified; see `cloudflare/RELEASE-2.2.md` for the observed sitemap and indexing status. The user chose a WhatsApp draft and posting guide, so no group messages were sent. `docs/GROWTH_PLAN.md` defines the pilot, Google measurement, useful content and next page-level improvements. This is a visibility foundation, not evidence of a ranking or traffic increase.


## Feedback access — 2.3 progress

The Feedback button is now visible across pages on desktop and mobile. Visitors can submit an idea, bug or information correction without an account, attach the relevant public job/employer/update, and keep a receipt reference. Safe optional page context improves diagnosis without collecting CVs or private workspace contents. Local persistence/security tests and a production delivery check passed. Reports remain in the private D1 store for authenticated operator review; email alerts, a customer-facing support inbox and automatic issue triage are not enabled. See `cloudflare/RELEASE-2.3.md`.


## Opportunity data and presentation — 2.4 progress

The current release expands public employer collection from eight to 26 boards across seven employer sectors. The checked catalogue contains 765 UK vacancies, 48 early-career titles, 51 adverts with stated or conditional sponsorship wording, and 67 with GBP pay evidence. These are point-in-time counts, not promises of eligibility, availability or coverage. Only two early-career results also have positive or conditional sponsorship wording, so graduate opportunities remain the most important coverage gap.

Visitors can open one-click collections, combine sector/pay/role/location/visa-wording filters, save the full search and use the existing Hire Stack preparation flow. Source handling now resolves ambiguous hybrid-office locations, respects structured secondary locations, rejects explicitly overseas postings and relocation titles, checks structured deadlines, and excludes prospect/template posts. A refresh lease and atomic board transactions preserve the last complete data on failure. No paid feed or new API credential was required. See `cloudflare/JOB-SOURCES.md` and `cloudflare/RELEASE-2.4.md`.

Next source priorities: broader graduate schemes with explicit sponsorship, NHS/clinical opportunities through permitted feeds, university research roles, hospitality and regional employers. Current healthcare coverage consists of selected life-science services, not the NHS market. A 50-advert independent accuracy audit, source-run history, reviewed sponsor-name aliases and source-provided closing dates remain outstanding. Do not present the larger catalogue as independently verified sponsorship.
