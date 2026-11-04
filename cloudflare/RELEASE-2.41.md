# Sponsor Intel 2.41 — review a CV before replacing it

CV import previously replaced the saved profile as soon as extraction finished and silently sliced text at 30,000 characters. A long source could therefore lose its final qualifications or experience without a visible warning. The JSON importer also omitted sections including volunteering, certificates, languages and references.

The importer now presents a browser-only preview before any workspace change. Oversized text is rejected in every format instead of being clipped. Word, PDF and plain text retain their complete extracted text within the existing limits; JSON Resume retains all text-bearing fields, including extensions, with readable section labels. Only explicit `$schema`/`meta` document metadata is omitted, with a visible notice. Complex or malformed JSON and unreadable text fail clearly. The original file is not uploaded or sent to AI.

The user explicitly chooses **Replace my CV with this text** or **Discard preview**. Detected contact/profile details are optional and off by default; blank or oversized detected fields do not erase or silently shorten existing values. Role goals, sponsorship preference, saved applications and other workspace records remain intact. A changed profile disables the old preview and an atomic state guard rejects a late overwrite. Changing account or leaving the page invalidates pending extraction results. Applying uses the existing guest/account persistence and conflict controls; the confirmation asks the user to check the workspace save status instead of claiming an unobserved cloud sync.

PDF extraction examines every permitted page, rejects parsing errors and identifies pages with no selectable text. Scans/images and column reading order remain explicit limitations. Word formatting/images and reader feature warnings are disclosed. The user can discard an incomplete preview and paste the complete CV. There is no OCR, independent extraction-accuracy guarantee or model-quality claim.

## Verification

- All 418 tests pass, including six import tests covering exact 30,000-character retention, rejection above the bound, invalid/binary inputs, full JSON section/extension retention, malformed/deep/large JSON, prototype-named fields, overlong contact data, default detail preservation and stale profile rejection.
- Actual built UI and Worker run in isolated Workerd/D1 with all 27 migrations and no remote database, AI, email or outbound service. Fictional Word, PDF, TXT and JSON Resume files passed browser import. Full PDF source text matched after whitespace normalization; Word retained the final source sentence.
- Browser tests verified discard preserves the saved CV; edits made while previewing disable replacement; applying without the detail option preserves the existing name; explicitly choosing details updates them; a reload retains the applied guest CV and final source fact.
- Oversized TXT and DOCX files and a 16-page PDF were rejected with the saved CV unchanged. A deliberately blank second PDF page produced an explicit missing-text warning. A measured 390-pixel viewport had document width 390 and accessible replacement/discard controls.
- TypeScript, production build, 17 prerenders, browser asset budgets and Worker dry-run pass. No dependency version or database schema changes are included.

## Deployment

Live **2.41.0**, Worker `2fc086a9-54b0-47fa-8625-59a0d49a6855`, is verified on sponsorintel.london. Health, jobs, profile and sitemap return 200; the anonymous business API returns 403. The signed-in owner used a fictional PDF to verify the live preview, then discarded it. The saved owner CV was compared before/after and remained exactly unchanged; no replacement or AI generation occurred. No schema change was required. Code rollback: 2.40 Worker `ce103ed9-157b-468c-b6f8-5b9c37d00531`. No database restore is needed. No customer CV, application output, model prompt, paid allowance or provider schedule is changed by deployment.

The fresh dependency audit still reports the three moderate entries in the existing Mammoth/argparse/sprintf-js chain, with no high/critical findings. The upstream advisory lists no patched sprintf-js version; this release does not claim to fix that advisory. Hosted Linux checks remain separately subject to the GitHub billing lock. See `docs/TOOLCHAIN_SECURITY.md`.

Parser behaviour is checked against the installed versions and primary documentation: [PDF.js input and error options](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) and [Mammoth raw-text extraction](https://github.com/mwilliamson/mammoth.js#raw-text).

The genuine scheduled run `business-497630` completed at 14:45:56.907 UTC on 8 October; Cloudflare independently confirms success. Its snapshot includes the 2.40 assessment summary with zero completed/assessed outputs, no automatic promotion, four normal findings and zero high findings. Two more employer pages were checked using three actual requests. Shared usage remained four starts/six calls. This is unattended empty-assessment-path evidence, not a model-quality result or acceptance of recorded customer outcomes.
