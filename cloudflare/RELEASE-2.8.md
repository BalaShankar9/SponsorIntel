# Release 2.8 — jobs at sponsor-licensed companies

Published on 7 October 2026 at https://sponsorintel.london/jobs?licence=matched. Worker version `0c5cd7b7-d483-4dd9-94cc-ab866bff32fd` serves app version 2.8.0. The prior 2.7 Worker is `b7c0c942-cf5c-47dd-9414-f69c0ab7af52`. This release requires no database migration, new credentials or paid feed.

## What visitors can do

The Licensed employers collection and Employer licence filter find current UK roles at companies with a reviewed link to an exact Skilled Worker register record. Users can combine this with advert sponsorship wording, role, location, career stage, sector and pay, and save the complete search. Both the list and role detail expose the same current register match. Role pages show the named legal entity, register date, last successful check and public identity source where available.

The link describes an employer brand or group. It does not prove which legal entity will employ or sponsor the applicant. A company licence never changes a vacancy's sponsorship classification. Unknown and negative adverts stay visibly unknown and negative. Unmatched companies may still be licensed.

Six initial links cover Monzo, GoCardless, Funding Circle, Zopa, Graphcore and Allica Bank. Their identity sources were reviewed on 6 October and their exact name/location IDs independently checked against the official 5 October CSV. The source ledger is in `JOB-SOURCES.md`; future approved owner-intake boards also participate through their reviewed sponsor IDs and dates.

Links are evaluated against the active snapshot on each read, disappear when a record is removed or loses the Skilled Worker route, and are hidden after failed/stale register checks. The maximum successful-check age is 48 hours; the maximum publication age is seven days. API catalogue, source and detail responses use `Cache-Control: no-store`. Date-only source values no longer acquire an invented midnight timestamp.

## Acceptance evidence

- Seventy automated tests passed on 7 October. TypeScript and the production build passed; 17 public pages were generated. After adding explicit catalogue cache headers, all 18 opportunity and role-page regression tests passed again. Wrangler compiled and deployed the final Worker successfully.
- Tests cover exact reviewed matches, lookalike/unreviewed companies, removed records, non-Skilled-Worker routes, stale/future/failed register checks, pending/paused/undated owner submissions, private review-note exclusion, combined filters and saved-search compatibility. Server-rendered evidence retains the original advert wording and escapes legal names.
- Local browser checks exercised the licence collection, unknown/conditional sponsorship intersections and the individual employer-evidence panel. At 390px width the collection occupied 390px without horizontal overflow; the mobile filter intersection returned the expected 32 roles. The local fixture catalogue and live catalogue have different job counts and are recorded separately.
- The live licence acceptance scan traversed every filtered page, checked unique job IDs, reconciled each linked entity against the public sponsor endpoint, compared all four sponsorship categories, and verified the detail response and initial HTML. At 06:47–06:48 UTC the live catalogue contained **763 roles from 26 feeds**, **224 roles linked to six licensed companies**, and **50 adverts with stated or conditional sponsorship wording** across the whole catalogue. Within the 224-role collection: **0 stated, 32 conditional, 134 not stated and 58 unavailable**. These are overlapping collections, not counts of guaranteed sponsored jobs.
- Existing live opportunity checks passed. Live role-page checks passed for initial HTML, metadata, HEAD, canonical redirects, missing-role 404s and a sitemap containing 763 roles plus 17 public pages. The official register source date was 5 October, last checked 6 October at 07:15 UTC. A scheduled daily check is not a claim of instant updates.

No new user accounts, emails, AI generations or employer applications were needed for these checks. Existing account and delivery limitations from release 2.7 remain applicable. Hosted CI must be checked separately from local/live acceptance; the previous hosted workflow was blocked by an account billing issue.

## LinkedIn and remaining coverage

LinkedIn is **not connected**. Its Job Posting API is an employer publishing integration, not an open bulk download of every LinkedIn vacancy. Identity sign-in would not grant catalogue rights. No partner application, scraper subscription or data-republication agreement has been submitted or obtained. Official documentation and agreement links are in `JOB-SOURCES.md`.

Expand through reviewed official careers feeds and appropriately licensed data providers. Next: review the other 20 existing boards' legal-entity links, prioritise explicit graduate sponsorship and underrepresented healthcare/university/hospitality/regional employers, then work toward 50 reviewed feeds. Preserve source attribution, duplicate/expiry handling and the licence-versus-advert distinction. The larger 50-advert accuracy audit remains outstanding; automated tests do not establish classification accuracy across the market.

Sponsor Intel and sponsorintel.london remain the selected brand and primary domain.
