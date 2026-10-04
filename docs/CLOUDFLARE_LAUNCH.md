# Cloudflare beta release — 4 October 2026

## Outcome

[Sponsor Intel beta](https://sponsorintel.balashankarbollineni4.workers.dev) is live on the owner's Cloudflare account. The interface was redesigned for international students and migrants researching UK careers: warm cream, forest green and lime, readable cards, mobile navigation and an employer-to-shortlist-to-application journey.

The owned address `sponsorintel.london` still requires Namecheap and Cloudflare dashboard sign-in before DNS cutover. This is a beta release, not a completed branded-domain launch or migration of every legacy service.

## What was found

- Canonical repository: `BalaShankar9/SponsorIntel`, default branch `feat/intel-immigration-intelligence`, original base `0f200992346d490c8619e190051ad41b954d9f4f`.
- Older implementation: Next.js frontend, Python/FastAPI backend, PostgreSQL, Redis/Celery, scraper/agent designs, scoring, account and billing scaffolding, plus an older standalone server.
- A repository archive existed in a local ChatGPT project workspace. No dedicated Sponsor Intel project was identified among the accessible project listing and focused chat search.
- No existing deployed account database, paid customer state or production backend credentials were verified. The older services remain intact.

## Working beta

- Employer search, town/city, licence route and rating filters, sorting and pagination.
- Employer details with current snapshot provenance; A, A Premium and A SME+ ratings handled.
- Device-local saved employers, comparison, application stage/role/notes/follow-up, JSON backup/restore and CSV export.
- Small progress checklist, useful empty states, mobile navigation and responsive layout.
- Official career/visa guidance links; current Work Hub and NHS job searches and curated employer careers links.
- Private feedback with validation, origin checks and a bounded submission rate.
- Worker/static assets, D1 schema and snapshot import, daily refresh registration, source/error visibility and security headers.

## Release evidence

Published Worker version: `73eda82c-9e8c-414f-8402-2d0232b62073`. Release code is on `codex/sponsorintel-cloudflare-launch`; the pull request records its exact commits. The deployment was checked through the public HTTPS URL after publishing.

Initial source: [GOV.UK sponsor register](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers), published **2 October 2026**. Source SHA-256: `67a7bcb01f31570fa906584ee429ed4d5a5fabf17e5b914b9bc42656c8743ac1`.

| Check | Observed result |
| --- | --- |
| Source row count | 143,138 |
| Normalised employer/location records | 127,902 |
| Skilled Worker records | 122,495 |
| Data/parser/security unit tests | 7 passed |
| TypeScript and production build | Passed |
| GitHub-hosted checks | Did not start: account locked due to a billing issue |
| Public API/route acceptance checks | 19 passed |
| Local feedback origin, storage and rate limit | Passed |
| Full scheduled-import path in local Worker | 127,902 records, snapshot activated |
| Desktop and 390px mobile UI | Rendered; navigation and no horizontal overflow checked |
| Shortlist/compare/application persistence | Checked through browser interactions and reload |
| Workspace backup | Downloaded file verified; two test records, stage and notes restored into empty local workspace |
| Government job link | Current Work Hub search verified with role and city |
| Future production scheduled refresh | Registered, first future run not yet observed |
| Custom domain HTTPS | Pending dashboard/registrar access |

The CI workflow validates the new Cloudflare package separately from the historical backend/frontend jobs. Legacy failures are not resolved or concealed by the beta checks. [Run 37190313241](https://github.com/BalaShankar9/SponsorIntel/actions/runs/37190313241) had no executed steps: GitHub reported that the account is locked due to a billing issue. Local and public deployment checks passed, but GitHub-hosted CI must be rerun after the owner resolves that account restriction.

## Launch completion and next work

1. Complete the domain cutover using the [operator guide](../cloudflare/README.md#domain-cutover), preserving existing DNS records.
2. Witness a real production scheduled refresh and review feedback through authenticated D1 access.
3. Invite a small group of students/migrants to complete three tasks: find a named sponsor, make a shortlist and track an application. Use their feedback to prioritise changes.
4. If needed, add account sync and a vacancy feed as separate, verified migrations. Do not present old scoring or scraper output as current evidence.

The release has no fabricated vacancy totals, testimonials, success rates or sponsorship predictions. A register entry is a research starting point and never a guarantee of a sponsored job.
