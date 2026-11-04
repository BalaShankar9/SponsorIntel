# Sponsor Intel 2.3 — visible feedback and bug reports

Released 4 October 2026 at https://sponsorintel.london. Application version `2.3.0`, Worker version `f23efe18-90eb-431f-bfcd-c101b962d268`.

## Delivered

Every page now has a fixed, labelled Feedback control. It sits above the phone navigation and remains available as the visitor scrolls. The form separates ideas, bugs and incorrect information, requires no account, preserves the message when delivery fails, and displays a copyable reference only after storage succeeds. A 20-second timeout prevents indefinite sending. Keyboard users can select categories, close with Escape and return focus to the launcher.

Employer details, job details and immigration guidance/publications have contextual report actions. They select the information category and show the public item being attached. Visitors can opt out. The backend accepts only known route names and bounded public-item fields; query strings, fragments and unrecognised fields are discarded. CVs, account details, other form contents, screenshots and raw IPs are not attached automatically. Reports include the server's app version for diagnosis. Origin validation, bounded input, the honeypot and five submissions per hourly IP-derived bucket remain enforced. Public reads are rejected.

The direct sharing link is https://sponsorintel.london/?feedback=1. Use `?feedback=bug` or `?feedback=data` for a preselected category. These parameters do not activate sponsor search; closing the form removes its parameter.

## Acceptance

- 29 unit/persistence tests passed, including all report types, actual receipt/storage matching, context filtering and opt-out, origin/content/body validation, throttling, public-read rejection and failed-storage behavior.
- TypeScript, the production build with eight public pages and Wrangler packaging passed.
- 19 public API/route checks and 15 SEO checks passed locally and on the primary production domain; live checks completed at 15:00 UTC.
- Local browser tests submitted a bug and a contextual job report successfully; update reports opened with the correct source selected. The phone viewport was 390×844 with no horizontal overflow; the form and submit action fit. Normal 775×702 layout, direct category links, Escape and focus restoration were checked.
- The production browser sent one clearly labelled synthetic bug report at 15:00:43 UTC. Authenticated D1 inspection confirmed its exact reference, kind, `/updates` context and version `2.3.0`. That one synthetic record was then removed with an exact ID/message/version predicate; the follow-up count was zero. Existing reports were not changed.
- Live health returned `2.3.0`; public GET of `/api/feedback` returned 405; the final browser console contained no warning/error entries.

Hosted GitHub CI was blocked by the account billing lock in the preceding release and is not substituted for the local/live checks above. Current run outcomes belong in the PR checks.

## Operations and recovery

Migration `0005_feedback_context.sql` adds `context` and `app_version` columns plus a creation-date index. Existing reports receive empty defaults. The pre-migration D1 bookmark was `0000001d-00000000-000050fa-3fcbd514e9b321ff2a2de01f1c764078`. A normal application rollback to Worker `18560b99-e92e-440d-8e02-eb6cccf46957` remains compatible with these additive columns; do not restore the database over newer user submissions for a routine code rollback.

Reports are reviewed using authenticated D1 access, as documented in README. There is no public report listing, email notification pipeline, owner inbox UI or automatic triage. No contact information is requested, so this is a product-feedback channel rather than a two-way support conversation. Do not publish raw feedback or private exports. No new paid service, outreach, browser monitoring or scheduled automation was introduced.
