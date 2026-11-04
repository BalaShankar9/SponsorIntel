# Sponsor Intel / Job notes

Owner scope, 3 November 2026: move beyond a popup into a useful companion beside job cards on LinkedIn, Indeed and other job sites. Enable it from the extension, keep it useful while browsing/scrolling, and show detailed, informative evidence. The owner also wants a distinctive, personal, professional identity across the extension and platform, without generic AI presentation. This expands the existing product goal; it does not clear capacity, supervisor, source, model, Founder or store-publication holds.

## Product direction

The organising idea is **a closer reading**. Sponsor Intel provides a small research note beside a decision, with the underlying evidence immediately accessible. A marker alone is not the product: the value is an exact role identity, the quoted sponsorship statement, conditions, missing evidence and a practical next check. Do not claim the interaction is a novel invention or universal site coverage.

Three separate questions stay visible: what the **advert says**, whether the **exact legal employer has a current licence**, and whether the **vacancy and applicant circumstances** are eligible/current. The first can run locally. The other two remain explicitly unverified until their own evidence exists. A short card preview, trading name, licence or right-to-work question must never become a sponsorship offer/refusal.

## Design language

Keep Sponsor Intel as the name; **Job notes** names the browsing companion. Warm paper (`#f8f6ed`), deep green (`#203d31`) and restrained copper (`#995738`) form the working palette. Serif headings introduce the reading task; system sans-serif carries controls and evidence metadata. A double editorial margin echoes the existing slash mark. Use thin rules, generous line height, clear evidence quotations and direct verbs. Avoid chat bubbles, sparkle icons, synthetic confidence percentages, loud gradients, fake urgency and claims of intelligence. Technical operation belongs in disclosure/settings, not the main journey.

This direction starts with the extension and should inform later role pages, learning resources, sponsor identity views and Founder workspaces. Those wider screens have **not** been redesigned by this candidate. Preserve useful existing behaviours and validate contrast, keyboard navigation and mobile layouts before each rollout.

Avoiding AI branding does not mean concealing processing. Features that actually send inputs to a model must still explain their data handling and limitations where relevant. Job notes itself uses local phrase rules and makes no model call.

## Working release stages and acceptance

1. **In-tab companion:** toolbar enable/disable, local card markers, compact dock and reading panel; same `activeTab` + `scripting` permissions. No all-site permission, background service, remote code, account save, network/model request or enrolment. Enabling is per tab/page; a reload/new document needs another click. The in-tab observer notices rendered cards while enabled; this changes the 0.1 privacy wording and needs a reviewed disclosure before public release.
2. **Identity before analysis:** recognise exact LinkedIn/Indeed identifiers and conservative employer-original URLs; require the visible full description to match the selected card. Split-view URL changes alone are insufficient. Recycled cards and changing source text invalidate old results. No automatic clicks, fetching hidden descriptions, application interaction, access bypass or cross-frame scanning. Unsupported layouts offer complete-advert paste and an explicit limitation.
3. **Reading and decisions:** full public advert review/confirmation, quotes, conditional/refused/unclear states, actionable next checks, separate licence/freshness status. Preserve hidden/form exclusions, collapsed-section holds, content limits and edit invalidation. Closing clears in-memory text; Off removes markers, panel, observers/listeners and timers. No comparison history is silently persisted.
4. **Measured compatibility:** installed exact-candidate tests, keyboard and 390px checks, repeated/recycled/lazy card scenarios, page changes and off/close cleanup. Test representative current LinkedIn, Indeed and employer-original pages independently. Fictional DOMs do not prove those sites work today. Record layouts not supported. Keep the existing 50-advert independent-quality gate separate.
5. **Delivery:** final immutable ZIP; exact disclosure/permission/store copy; owner-approved legal changes; actual screenshot; manually verified publisher fields; explicit store-submission handoff; review/consumer installation before a one-click website link. Public 0.1.6 and candidate 0.1.7 remain immutable. Do not deploy the prepared 2.99.0 Worker or migration 0047 to publish an extension.
6. **Later evidence additions:** reviewed operating-business/licence matches, source dates and role-linked learning, plus user-controlled comparison/shortlist choices. Implement only when exact source freshness/identity and privacy/storage acceptance exist. Do not populate these with guesses or add spending. A later milestone, not a claim of the initial companion.

## Implementation and verification boundary

### Advert to applicant workspace — owner addition, 3 November

The intended journey is: choose a role beside its original advert → review the source and sponsorship wording → add that role to the applicant's workspace → use their truthful profile to prepare a CV, cover letter and other required documents → review the final pack and proceed through the permitted application route. Retain the full description, original URL, known employer/location, observation time and evidence. Unknown dates, salary and qualifications stay unknown; mentioned details remain in the complete text. Capture time is not the posting date. Attachments and hidden sections are not silently invented or fetched.

The prepared first handoff is explicit file export/import. The companion produces a bounded Job notes file; the actual Applications component previews it, confirms employer and complete-advert review, then opens Application Studio through the existing manual/unverified-advert route. It recomputes wording, checks the body checksum, refuses oversized input without truncation, rejects private URL parameters and finds existing work by source URL before creating another role. Existing documents and the master profile stay unchanged. The file's verdict is not independent verification. Import makes no model call and never changes the stage to Applied.

The website import is **not deployed** and is not a one-click account transfer. Later direct transfer requires an authenticated destination, exact-payload review, replay and cross-account isolation, current storage capacity, durable save receipt and recovery checks. Do not introduce account tokens in job-page URLs, broad all-site access, silent CV collection or extension-to-website messaging merely for convenience. The fictional local save does not release the capacity hold.

Document preparation keeps existing evidence, consent and shared-call controls. Submission still requires the applicant's authorised batch, truthful answers, a permitted route and required handoffs. The broader goal includes that later application tool; this import does not claim it exists.

Source: `cloudflare/extension-companion/`. `prepare-extension-companion.mjs` creates a separate private 0.2.0 candidate and refuses an existing destination. It does not change the website's active download metadata. `serve-companion-preview.mjs` runs the actual bundled companion on a fictional job board; it does not mock extension permissions and does not prove an installed extension. `tests/extension-companion.test.mjs` tests identity and next-action rules; browser receipts must test the actual changing DOM and controls.

Chrome's original [activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) were checked on 3 November. Their temporary, user-invoked access model supports this permission design; it does not guarantee compatibility with any website.

The owner separately authorised temporary **0.2.0** installation and the exact `JOB_NOTES_PRIVACY_DRAFT.md` article. Both approvals are recorded; do not repeat them. Native toolbar tests passed on the fictional board, while one current Lever original required selection/paste. The temporary extension is disabled and its window closed. Public release packaging **0.2.1** changes only the manifest version and README; executable/UI/permission bytes match the tested candidate. Read `cloudflare/RELEASE-2.98.13.md` for actual deployment status. Public policy approval does not authorise store submission. Current LinkedIn/Indeed layouts, Edge installation, store-size screenshots, publisher declarations and independent quality remain open.


## Prepared compatibility follow-up — 3 November, 22:54 UTC

Public 0.2.1 remains unchanged. Actual installed 0.2.0 encountered a LinkedIn sign-in prompt after the retained Sequence advert initially rendered and refused to read the obscured page. It was disabled and the signed-out test window closed; no account sign-in or access bypass. This is an access limitation, not LinkedIn compatibility acceptance.

The Wintermute original and its own catalogue supplied the visible Lever structure missing from the reader: a two-part posting containing the title/categories and all body sections, with matching public application links; card titles live in `a.posting-title > h5`. Prepared **0.2.2** adds exact global/EU Lever URL recognition and this guarded whole-posting reader. Lever's [official documentation](https://github.com/lever/postings-api) confirms the separate hosted advert/application URLs and global/EU hosts; it does not prove arbitrary layout compatibility. No API, hidden JSON, background fetch or application action is added.

The reader rejects an application/catalogue URL, wrong or foreign target, missing/duplicate title/root, invisible body and changed layout. It re-resolves the description before later analysis/export, so a changed application URL invalidates an unchanged text snapshot. Cards use the job heading, not an Apply label or location text. Existing generic guards remain. The actual target’s markup is observed; the new compiled extension has not yet been installed on it.

Twelve targeted tests, TypeScript, sixteen fictional browser DOM cases, deterministic ZIP/source checks and existing-destination refusal pass. Same permissions/CSP, popup/artwork and disclosed handling. Read `JOB_NOTES_0.2.2_REVIEW.md` for immutable bytes, limitations and the single pending installation request. No new public package, policy or Worker deployment. Current full installed-candidate/real-site acceptance remains required; wider styling, profile transfer and application delivery stay separate.


At 22:56 UTC an added fictional counterexample failed: 0.2.2 dropped a condition adjacent to Apply because it excluded the whole control wrapper. **0.2.2 is held**, and its installation question is obsolete. Corrected **0.2.3** excludes only the link; all **17** browser DOM cases pass at 22:57:21 UTC. Twelve targeted tests, exact bundle/ZIP rebuilding and immutability checks pass again. This is the current private candidate, 54,760 bytes / SHA-256 `78d9008aa9633faf66f1cb5687241ea75135d0924b149361d1c24ab0db6e13e8`. It is not installed/published; see `JOB_NOTES_0.2.3_REVIEW.md`. No earlier approval transfers automatically to this changed candidate. Both the failure and initial results remain evidence.


## Prepared import correction — 3 November, 23:26 UTC

Actual fictional account testing found that an existing role saved with a tracking link was imported again from the clean link, opening a second workspace with empty documents. The original work was not deleted, but the duplicate interrupted the intended journey. The import now checks the provider’s current snapshot and normalises both links using the same narrow public-URL rule. Unknown role query parameters remain significant; this is not universal cross-site deduplication. Multiple matching workspaces are held for the applicant to choose, never merged or removed automatically.

An existing match offers **Open existing workspace** and leaves its source, description, notes, CV, letter and stage unchanged. A new import creates its role and provenance notes synchronously; a repeated action sees that role before adding another. File previews carry their account/reload scope, and the current 100-role ceiling is checked at the write boundary. No source-version approval, verified sponsorship label, preparation request or application submission is inferred from the file.

Twenty targeted import/extension tests, 22 related preparation/recovery/account tests and TypeScript pass. The real local React/Worker/auth/D1 form retains one tracked-link role and all prior fictional work, with one seed save and zero preparation calls. The actual provider fixture also passes repeat-action, retained-note, stale-scope and 99-to-100-limit checks. A 390-pixel result view has no horizontal overflow. Evidence is `cloudflare/tests/evidence/job-note-import-guard-2026-11-03/`; this is not an installed-extension transfer, production capacity test or full-suite result.

This remains prepared in the combined branch. No Worker, schema, public policy, extension executable or ZIP changed. Public 0.2.1 and pending private 0.2.3 are byte-identical to their prior receipts; the 0.2.3 permission question is still pending and is not repeated.


## First platform identity slice — live 4 November, 00:00 UTC

Application Studio now uses Job notes' warm paper, green/copper editorial treatment and serif heading. Empty and populated views share the Sponsor Intel signature; the discovery invitation, Studio navigation and About copy no longer carry Hire Stack branding. Writing/progress controls use relevant icons. All AI processing, consent, evidence and model-attribution disclosures remain intact. No generation or storage behaviour changed.

Seven existing guard tests pass in both combined and isolated builds; final TypeScript/build/21 prerenders/budgets/dry-run, fictional desktop/mobile rendering, keyboard consent/reset and retained-draft checks pass. The initial CSS budget failure was corrected by loading the new styles with private application tools, without increasing budgets. Public release **2.98.14** is independently deployed; ten excluded live HTTP checks match its assets. Live browser QA is limited by signed-out owner access; the screenshot is a fictional local workspace. Read `../cloudflare/RELEASE-2.98.14.md` and its receipts. This is an initial identity slice, not a completed platform redesign, private import deployment, model-quality improvement or application sender.
