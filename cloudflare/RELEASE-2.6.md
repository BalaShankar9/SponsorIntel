# Release 2.6 — accounts, owner operations and sourced guidance

Released 5 October 2026 on https://sponsorintel.london. Version 2.6.0. Final Worker version: `487aebad-14ab-4f37-baa1-c43d5279e2cc`. Previous verified 2.5 Worker: `1a973814-9163-41cf-b488-8bdbc912904b`. Migration 0006 was applied to production after capturing a D1 Time Travel bookmark. Prefer a Worker rollback for code recovery; a database restore would discard newer accounts and saved work.

## Delivered

- Visible `/signin` and `/signup`, private account storage, existing recovery-code flow and an account password-change form. Email ownership verification and reset emails are still unavailable.
- A private `/admin` dashboard showing account totals, recent session activity, paginated users, page-open counts, document generations, guidance replies, feedback and source health. Owner access is explicitly provisioned against an immutable user ID, never inferred from an unverified email. An ordinary account and an anonymous request cannot access it. The owner was provisioned and sign-in verified; credentials remain outside Git.
- Analytics retain anonymous daily aggregates for 90 days. Routes are allowlisted, role IDs collapse to `/jobs/:id`, and queries/fragments are discarded. These counts include repeat visits, operator tests and possible bots; they are not unique visitors, conversion rates or historic traffic. Private CVs and application notes do not appear in the dashboard.
- Reviewed employer intake for Greenhouse, Lever and Ashby. Candidates must match a current Skilled Worker register record, include the official careers URL and evidence, pass a fixed-host feed probe, and receive explicit owner approval. Approved sources join the six-hour job refresh. Pause and refresh share a lock so paused sources cannot be republished by an in-flight refresh. Successful/failed job runs are retained for 30 days. Existing feeds and three-day stale-job hiding are preserved.
- `/advisers` includes 2,274 IAA organisations from the official 9 July 2026 snapshot, published 25 September. It provides literal search, registration levels, listed websites and official registration/review links. Solicitor and other regulator finders are separate. Registration levels are not quality scores, and this is not a complete UK solicitor directory. A daily publication/attachment check flags withdrawn or changed datasets; new spreadsheets require review before import.
- `/ask` retrieves available GOV.UK text when a question is asked and gives short explanations with linked source passages, retrieval times and partial-coverage notices. Failed retrieval or invalid evidence references fail closed. Conversations are kept only in page memory; questions are not saved in D1. This is general UK immigration information, not a personal eligibility decision or comprehensive rule review.
- CV contact extraction, unfinished-date/planned-work warnings and better advert-condition matching. CV/cover generation now has a second factual editing pass using a separate Cloudflare-hosted model, with structural/source-reference, numeric and availability checks. This reduces unsupported output but does not establish factual correctness. Human review remains required. Unsupported dates are never invented.
- PDF exports measure paragraphs before page breaks; Word exports use explicit A4 margins, heading styles and paragraph keep rules. Source names and supported Unicode characters remain intact.

## Sources and constraints

The IAA source is https://www.gov.uk/government/publications/register-of-currently-registered-immigration-advice-organisations. Its spreadsheet SHA-256 is `2f05291601b653fd312091dc9a2aa7cfc12f9e6489b331f1194aeae38884c45f`. The actual dataset has names, registration numbers, levels, websites and approval dates; it does not supply addresses, prices or customer star ratings. OGL attribution is retained.

Numeric customer ratings are not fabricated or scraped. A suitable licensed provider is not connected; users can follow independent-review and regulator links. Trustpilot's third-party display requirements are documented at https://corporate.trustpilot.com/legal/for-businesses/legal-brand-guidelines/sept-2026. A fuller solicitor integration needs the product's own permitted regulator/API access, such as https://sra-prod-apim.developer.azure-api.net/.

Application drafting and guidance use Cloudflare-hosted GLM-4.7-Flash; CV/letter review uses Cloudflare-hosted Llama 3.3 70B. Model documentation: https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/ and https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/. Model attribution is in the studio and third-party notices. No model weights, CVs, credentials or test documents are committed. CV/letter preparation makes two inference calls within one preparation allowance; account-wide Cloudflare quotas and charges still apply. The existing 8-per-user, 12-per-IP and 40-app-wide daily preparation limits remain; chat shares the app-wide allowance.

## Verification

- 54 unit/persistence/rendering tests passed, along with TypeScript and the full production build.
- Production checks passed: 19 auth/workspace/recovery checks (fictional accounts removed), 17 SEO checks, 12 opportunity checks, 11 source/quality checks, and three role-page acceptance groups. The checked collection had 765 roles, 26 healthy employer boards and 10 monitored immigration sources. Counts are observations, not fixed promises.
- Local owner/member checks covered denied ordinary-user access, CSRF, pending source intake, confirmation/probe rejection and pause. The real production owner login/dashboard worked; anonymous dashboard requests returned 403.
- The adviser name search returned one expected match. A 390-pixel browser viewport had no horizontal overflow. Public pages have readable initial HTML; private routes remain noindex/no-store.
- Cloudflare AI was tested with an explicitly authorised private CV and a current real employer advert. Import, contact extraction, cloud sync, evidence review, CV, cover-letter and interview preparation were exercised. Early drafts omitted projects and invented features; this prompted model/prompt changes and the independent review pass. Test copies were manually checked. This limited evaluation is not a measured hallucination rate or full HireStack parity.
- Guidance tests covered Student self-employment, date-sensitive Graduate guidance and an attempt to force an invented visa guarantee/citation. The live UI showed an official source and supporting passage. Failed/partial sources remain visible as limitations.

## Remaining work

Verified email delivery; licensed customer ratings and fuller solicitor coverage; broader permitted healthcare, university, graduate and hospitality feeds; a documented 50-advert label audit; a multi-CV generation quality benchmark; reviewed immigration-change explanations, multilingual review and notification consent/unsubscribe flows. The separate HireStack company-research, portfolio and learning-plan agents are not fully ported. No employer application was submitted and no search-ranking improvement is claimed.

GitHub-hosted checks previously could not start because of the account billing block. Reproducible local/live checks are separate evidence; do not report hosted CI as passed without checking its latest run.

## Final application acceptance

The deployed two-stage CV and cover-letter flows both returned successful reviewed drafts to the browser. The CV preserved three actual projects, source education/employment years and AI-assisted-learning qualifications, and omitted the unresolved start-date placeholder. The final CV exported as one readable A4 PDF page. Its Word file was checked for the project text, A4 geometry and absence of that placeholder. The letter returned a short draft with an explicit length warning; a manually reviewed 236-word version was saved in the private workspace and exported to PDF and Word. The interview result provided five questions with answer structures and three questions for the employer; suggested stories still require the candidate's actual evidence.

This test confirms the workflow, not consistently polished autonomous writing. The letter still needed editorial work and the new AI review is not a semantic proof. Keep preparation in beta and evaluate broader cases before quality claims. Private test artefacts and the owner guide are stored outside Git.
