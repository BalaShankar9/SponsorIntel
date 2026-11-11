# Release 2.5 — shareable opportunities

Released 5 October 2026 at https://sponsorintel.london/jobs. Application version `2.5.0`; Worker version `1a973814-9163-41cf-b488-8bdbc912904b`. Prior Worker version for rollback: `c87a0193-d3aa-4157-ad91-ed6f1ab7cb43`.

## What changed

Vacancies now open on individual `/jobs/<id>` pages instead of a temporary modal. Each page provides the employer's advert, sponsorship quotation and limits, pay wording where supplied, source/check dates, source links, a public sharing link and a contextual correction form. Desktop and phone layouts keep the next action, evidence and source details accessible. Search filters and pagination remain in the URL for return visits.

Save and preparation actions read the current advert again before updating the existing Hire Stack workspace. A newly removed or stale advert blocks preparation. Refreshing an existing saved role preserves private notes and documents; sharing includes only the public role URL.

The Worker renders readable role HTML with canonical, search/social metadata and WebPage/BreadcrumbList structured data. Current roles join the dynamic sitemap. Missing records return 404, removed records return 410/noindex, and stale records remain readable with a warning/noindex. Failed reads return a retryable 503 instead of pretending a record is missing. No JobPosting markup, inferred salary, original posting date or closing date is invented. Search visibility/ranking gains have not been measured.

No schema, new credentials, paid feed or changed ingestion schedule is required.

## Verification before deployment

- 44 unit/persistence/rendering tests passed, including three-day freshness boundaries, source context, sitemap removal, 404/410/503 handling, canonical redirects and escaped employer text in HTML/JSON.
- TypeScript, Vite/pre-rendering and Wrangler dry-run packaging passed.
- A local refresh successfully read all 26 employer boards and produced 763 current roles. The changed count reflects today's employer feeds; local data and production snapshots are distinct.
- Local role-page acceptance, 15 SEO checks and 12 opportunity API checks passed.
- Browser checks covered saving, opening the correct role in Hire Stack, preserving a local test note, no duplicate application, link-copy feedback and the contextual report dialog.
- A local record was temporarily marked removed while its page stayed open. The next preparation attempt refreshed the record, showed the removed warning and disabled preparation. Its HTML returned 410. The local record was restored after this check.
- A 390px phone layout showed all source facts and the report action without horizontal overflow. No AI requests, real applications or third-party outreach were sent.

## Production acceptance

- Deployed to the existing branded and fallback domains, with the three refresh schedules preserved. Health reports `2.5.0`.
- The live check at 09:37 UTC found 765 current roles from 26 healthy sources; the sitemap contained 773 URLs (765 roles plus eight public pages). The production snapshot was last refreshed by the existing schedule, separately from the newer local test refresh. Counts can change at the next employer-board check.
- Role HTML/source/bootstrap/schema, HEAD, canonical redirects and missing-role 404 checks passed live. The fallback hostname remains noindex and www redirects to the branded canonical role URL.
- 15 SEO checks, 12 opportunity checks, 19 public register/route checks and 11 immigration/job-quality checks passed on the public domain. Five current pinned explanations were available; no immigration content was rewritten in this release.
- The live graduate role rendered the exact conditional sponsorship quotation. Desktop and 390px mobile checks found usable preparation controls, visible source facts/reporting, no horizontal overflow and no browser warnings/errors. No production account, saved application or private CV was modified.
- Search indexing and ranking gains have not been observed. A scheduled ingestion run of this exact Worker version was not separately witnessed; the configured intervals are unchanged.

## Remaining work

Expand permitted graduate/healthcare/university/hospitality sources and complete the independent 50-advert accuracy audit. Add reviewed source-change explanations, effective-date checks and source-run history for immigration updates. Email verification, notifications and the existing hosted GitHub billing block are separate outstanding work. This release uses the same existing accounts and browser-local guest workspace.
