# Sponsor Intel × Hire Stack 2.0 — 4 October 2026

Sponsor Intel now offers one journey from sponsor research and a real vacancy to CV preparation and an application tracker. The useful Hire Stack features were adapted into the Cloudflare application, with MIT attribution, rather than depending on the legacy deployment.

Primary: https://sponsorintel.london

Fallback: https://sponsorintel.balashankarbollineni4.workers.dev

Worker version: `47562aa9-5568-4c56-b8dd-5f41a9888655`. Application version: `2.0.0`. Branch: `codex/sponsorintel-cloudflare-launch`. Pull request: https://github.com/BalaShankar9/SponsorIntel/pull/1. The final deployment only normalised whitespace and a source-file reference in the distributed licence notices; application code matches the domain acceptance build.

## Delivered

- Responsive employer research and current UK vacancies with original advert links, check dates and quoted sponsorship evidence.
- Role-specific saved applications, status, notes, seven-business-day follow-up suggestions and calendar export.
- Master CV import from PDF, DOCX, TXT or JSON Resume; browser-local evidence review that separates candidate facts from advert requirements.
- Consent-based Cloudflare AI drafts for tailored CVs, cover letters and STAR interview preparation. No applications or emails are sent automatically.
- Editable documents with Word, searchable PDF and text exports. Unsupported PDF glyphs produce an explicit Word/text fallback rather than damaged output.
- Optional private accounts, D1 workspace sync, conflict protection, backup import/export, single-use recovery codes and account deletion.
- Free public employer feed connections, Cloudflare AI binding, pinned open-source dependencies and distributed licence notices. No third-party API keys or new paid subscriptions were purchased.

## Evidence

| Check | Observed result |
| --- | --- |
| Unit tests | 13 passed |
| TypeScript, production build and deployment dry run | Passed |
| Public register/API/deep-link checks | 19 passed on both the production Worker address and the branded domain |
| Account, isolation, recovery, concurrent saves and consent checks | 19 passed locally, on workers.dev and on the branded domain; fictional accounts removed |
| Dependency security audit | No reported vulnerabilities at release verification |
| Sponsor snapshot | 127,902 employer/location records, including 122,495 Skilled Worker records, from 143,138 source rows dated 2 October 2026 |
| Live vacancy ingestion | 243 UK vacancies: Monzo 56, GoCardless 8, Deliveroo 125, Stripe 54; Cloudflare feed returned 0 qualifying UK roles |
| Live AI | CV draft exercised in local preview using the remote Cloudflare binding; production cover-letter and interview requests returned successful reviewed drafts |
| Document round trip | Real Word/PDF downloads inspected; PDF and DOCX re-import retained fictional name, dates and project evidence |
| Browser | Desktop search, save, preparation and application stages exercised; 390px profile/studio/live jobs layouts had no horizontal overflow; final live browser console reported no errors |
| Domain delegation | Namecheap values saved, public NS responses show the assigned Cloudflare servers, Cloudflare reports active |
| Domain HTTPS | Validated HTTPS 200 on both apex and www; HTTP redirects to HTTPS; TLS minimum 1.2 |
| Scheduled refreshes | Register daily at 07:15 UTC; vacancies at 00:30/06:30/12:30/18:30 UTC; future production executions not yet witnessed |
| GitHub-hosted checks | Release runs 37201702608 and 37201700416 could not start because GitHub reported an account billing lock; both have no executed steps. Local checks passed; GitGuardian passed on the release code commit |

Tests found and corrected an advert-negation classification issue, signup recovery-code modal state loss, save conflicts and a mobile navigation label. The evidence review uses quoted deterministic matches; it does not convert role requirements into invented candidate experience or a visa eligibility score.

Branded-domain checks at 12:15 UTC used fresh public DNS answers because the local system/browser resolver still cached the old NXDOMAIN response. TLS certificate verification remained enabled. DNS delegation and HTTPS are configured correctly, but some visitors may need the workers.dev fallback until their resolver cache expires. The final browser proof uses that working fallback, not a simulated domain.

## Operations and limits

Migrations `0002_career.sql` and `0003_auth.sql` were applied before release. A D1 Time Travel bookmark was captured before migration. Production secrets remain outside the repository and are installed as Cloudflare Worker secrets. Prior sponsor snapshots and deployment history are retained.

CV AI has daily app/user/IP allowances. It may run out of capacity; manual editing and exports continue to work. The vacancy feed covers selected employers, not the whole UK market. Employer licence records are distinct from a role's sponsorship offer. A matching term is evidence to review, not a hiring or immigration decision.

Email verification, email alerts, paid plans and migration of legacy Hire Stack accounts are not enabled. Email is a sign-in identifier; recovery uses the code shown at signup. Do not enable employer access or invitations until email ownership verification exists. Accounts share the same D1 data across hostnames, but users must sign in again after switching hostname. Guests must export/import to move browser-local work.

Next release priorities: verified email/recovery delivery, broader permissioned vacancy sources, a witnessed refresh cycle, and usability feedback from international students and migrants. The first release's historical evidence is preserved in `docs/CLOUDFLARE_LAUNCH.md` at the repository root.
