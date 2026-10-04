# Release 2.4 — useful opportunity data

Released 4 October 2026 at https://sponsorintel.london/jobs. Application version `2.4.0`; final Worker version `c87a0193-d3aa-4157-ad91-ed6f1ab7cb43`.

## What changed

The selected collection grew from 359 UK vacancies on eight configured boards to 765 vacancies on 26 boards. The checked catalogue has 48 graduate/junior/internship titles, 51 adverts with positive or conditional sponsorship wording, and 67 containing extracted GBP pay wording. These are overlapping counts. Two early-career adverts also have positive/conditional sponsorship wording. None of these labels establishes an applicant's eligibility or guarantees that applications remain open.

Four one-click collections, employer-sector and pay filters help visitors find a useful starting point. All filters combine with role, location, sponsorship wording and career stage. Saved searches and workspace backups retain the full filter set. The mobile hero is more compact. Failed requests do not display old results as the new search.

The public-source allowlist is in `worker/job-sources.js`, with provenance and limitations in `JOB-SOURCES.md`. All feeds use the existing public Greenhouse, Lever and Ashby endpoints; no paid feed or additional API credential was introduced.

## Quality controls

- Resolve ambiguous Greenhouse location labels such as “Hybrid” using that post's offices. Do not override a specifically overseas location with a shared UK office.
- Support explicit secondary job locations, respect structured country codes, and avoid treating New South Wales as Wales.
- Exclude prospect posts, recognised talent pools/templates, structured past deadlines and titles requiring overseas relocation. An initial live check exposed a London-labelled Chicago relocation advert; it is excluded by the final release and covered by a regression test.
- Include Lever salary sections and Ashby published compensation summaries. Preserve exact sponsorship/pay evidence rather than estimating eligibility or compensation. “Selected roles” remains conditional.
- Bound input size and reject incomplete Greenhouse responses. Use an ownership lease and atomic per-employer D1 transactions, including removals and source timestamps. Failed fetches/writes retain the last complete employer snapshot.
- Keep six-hour refresh configuration and the existing three-day freshness cutoff. No database migration was required.

## Verification

- 39 unit/persistence tests passed, including rollback, overlap, missing/overseas locations, incomplete responses, relocation, literal search, combined filters and backup compatibility.
- TypeScript and the production build with eight public pages passed. Wrangler packaging and deployment completed.
- A real local refresh and a protected production refresh both read all 26 employer boards successfully.
- 12 opportunity API checks passed locally and live; the published catalogue and combined sponsorship/early-career filter were verified.
- 19 public register/route checks and 15 SEO checks passed locally and on the branded domain. 11 live immigration/job-quality checks passed, including current official sources and five pinned explanations.
- Browser checks exercised one-click collections, combined filters, exact employer evidence, saved search round trips, a 390px mobile layout without horizontal overflow, and the public HTTPS deployment. The preview and production consoles had no warnings/errors. The final live query confirmed the overseas relocation was excluded and the two early-career/conditional-sponsorship roles remained available.
- No applications, outreach messages, private CVs or paid AI requests were submitted. Local saved-search testing used an anonymous localhost workspace.

The configured jobs schedule was preserved; a future scheduled run of this exact release was not witnessed during the turn. Hosted GitHub CI has an existing account billing block from the previous release; local and live checks are separate evidence, not a claim that hosted CI passed.

## Remaining work

Prioritise graduate schemes with explicit sponsorship, permitted NHS/clinical feeds, university research, hospitality and regional employers. Current healthcare coverage consists of selected life-science services. An independent 50-advert accuracy audit, reviewed register aliases, source-run history, displayed structured closing dates and individual job pages remain outstanding. Saved searches are revisit links, not email alerts.
