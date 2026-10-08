# Sponsor Intel 2.38 — scheduled employer application-link checks

## Result

A successful job feed does not prove its application links still reach the right advert. The hourly business workflow now samples up to two approved employers, at most one current role per employer per UTC day. The oldest source sample goes first, then the least previously sampled role. Only current roles from unpaused, approved sources are eligible.

Checks follow at most three redirects on explicit reviewed provider hosts while preserving the employer and advert identity. The reviewed Stripe careers redirect and university reference-based vacancy pages have narrow rules. Each response has a 12-second timeout and a 500,000-byte HTML ceiling. A 200 response plus a matching initial title/heading and no detected closure wording produces a sample receipt. It does not establish that every role is open, an application form works, or sponsorship is offered.

Four request slots are reserved atomically before each check, including unused redirect capacity. Reservations count within the existing 500 source requests per UTC day and a new 160-slot link-check sublimit. No new AI, paid service, permission or spending allowance is used. Workflow replays and unresolved prior attempts never repeat network work. Pauses, source approval, advert identity/freshness and the UTC day are rechecked before subsequent requests and before accepting a match.

HTTP failures, missing titles, closure wording, unsafe redirects and unresolved checks remain visible. They never change a public job, sponsorship label or feed-observation timestamp. The owner desk shows eligible employers, matched samples, outstanding/overdue samples and exact receipts. Checks older than 36 hours remain overdue instead of disappearing. Public evidence metadata is retained with the existing 90-day business history; no page bodies or customer data are stored.

## Validation before deployment

- 391 tests pass, including pause, approval withdrawal, old/closed roles, rotation, concurrent checks, both request limits, unsafe redirects, closure wording, body limits, missing evidence and replay protection.
- The actual BusinessWorkflow runs in isolated Workerd/D1 with all 25 migrations, a fictional job and fixed HTTP responses. A redirect and heading match produce a retained receipt, consume four slots, enter the business snapshot and perform no extra requests on replay. No remote binding, model, mail or real outbound network is used.
- TypeScript/build, 17 public prerenders, browser asset budgets and Worker dry-run pass.
- A separate read-only live diagnostic sampled one role from each of 33 employers. All returned 200 at the final page and corresponding initial titles. Five university titles require the documented trailing-reference normalization. This is a sample, not universal job or application-submission verification.

## Previously pending scheduled acceptance

The original production SourceWorkflow `scheduled-1791462638000` completed at 12:32:38.370 UTC on 8 October. Cloudflare reports `complete`; all 33 source tasks published using 34 requests. Cardiff Metropolitan used both campus feeds: 15 entries, one explicit staff/student-only exclusion, 14 accepted roles, one exact current Skilled Worker licence match. None of those Cardiff adverts states sponsorship. This closes the first genuine scheduled source acceptance for releases 2.35/2.36 without an owner refresh.

## Deployment and remaining limits

Live version 2.38.0 is verified on sponsorintel.london. Worker `f9c4508e-4074-4f8f-bd38-4c4d76e135ce` deployed successfully; migration 0025 was the only pending migration and applied successfully. Public health, jobs and sitemap return 200; anonymous access to the owner business API returns 403. The signed-in owner dashboard shows 33 eligible employers and explicitly awaits its first scheduled samples. Previous Worker: `a2bdc8af-91d9-40dd-9aa7-fc8e5e04816e` (2.37). Migration `0025_job_link_checks.sql` is additive; a Worker code rollback can leave these diagnostic tables intact. A production database restore is not authorised or needed.

Real candidate submissions, independent content/advice quality, reliable inbox delivery, Google reporting, complete customer growth days and premium demand remain separate acceptance gates. The 8 October research allowance remains four starts/six calls consumed; no AI or Google retry is permitted that UTC day. No test email or social send is used by this release.

Workflow step and replay design follows [Cloudflare's Workflows rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/).

Pre-migration D1 bookmark: `000002fd-00000000-000050fe-534b09800cb141068a1f63aa75670268`. This records a recovery reference, not restore authorisation.

## First scheduled production receipt

The original scheduled business run `business-497628` completed at **12:45:57.218 UTC** on 8 October, with Cloudflare status `complete`. Both Allica Bank and ApotheCom initial job-page titles matched. Two real page requests consumed eight conservatively reserved slots; 31 other employers remained awaiting rotation. The snapshot contains measurement version 2 with zero complete UTC days, healthy five-route checks and zero high findings. It reused existing research, editorial, application-evaluation and Google receipts without additional calls. The signed-in owner dashboard shows these exact results and an expanded sample receipt. This closes the first scheduled business acceptance for 2.37/2.38; it does not verify all future runs or every employer page.

The existing daily routine was updated and its saved prompt, schedule, status and target were verified. Aggregate evidence is retained in `tests/evidence/employer-links-2026-10-08.json`.
