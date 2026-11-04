# Job notes 0.2.3 — private compatibility candidate

Prepared and locally validated **3 November 2026**. **Not installed, published or submitted to a store.** Public 0.2.1 and site 2.98.13 remain unchanged. This supersedes held candidate 0.2.2. Its earlier installation question is obsolete; it must not be used as approval for this version. The completed 0.2.0 approval also remains separate. A new concrete 0.2.3 installation request is pending.

## Concrete package

[Candidate ZIP](../cloudflare/store/job-notes/0.2.3/sponsor-intel-job-notes-0.2.3.zip) — **54,760 bytes**, SHA-256 **78d9008aa9633faf66f1cb5687241ea75135d0924b149361d1c24ab0db6e13e8**.

Nine entries and CRC match the prepared files. A second in-memory build matches the bundled script; rebuilding the ZIP is byte-identical. Preparing into the existing directory fails and leaves it intact. Only `companion.js`, version and README differ from public 0.2.1. Popup, styling, icons, `activeTab`/`scripting` permissions and security policy are unchanged.

## What changes

The current Wintermute employer advert could not be read automatically by 0.2.0/0.2.1. Its visible Lever page uses different boundaries and links. The candidate recognises an exact Lever employer/role URL, verifies the complete posting and its matching application targets, then reads every visible section together. It recognises heading links on the employer's job cards, without clicking or fetching a description automatically.

Application pages, whole catalogues, mismatched/foreign targets, multiple postings, missing title/body and unexpected layouts are held. Hidden/application fields remain excluded; collapsed conditions must be expanded. A changed application target invalidates previously read text before analysis or export, even when the wording itself did not change.

Lever's [official documentation](https://github.com/lever/postings-api), checked 3 November, identifies global/EU hosted sites and separate advert/application links. The observed global layout informed this adapter; EU and other company layouts are not independently verified. No API connection or programmatic application route is added.

## Correction before installation

A further fictional case found that 0.2.2 excluded a condition next to an Apply link by excluding its whole container. That candidate is preserved and held. 0.2.3 excludes only the link control and retains surrounding conditions. The original failing result and all 17 passing corrected cases are retained; there was no public exposure or installation of the failed candidate.

## Data and authority

The existing approved Job notes policy already describes enabled-page observation, requested local reading and an optional file export. This candidate changes recognition and validation only: no new access permission, upload, saved history, account connection, model call or background fetch. Licence identity, vacancy freshness and personal eligibility remain unverified. No public legal article was changed.

The proposed next action is installation **only in the existing separate signed-out test Chrome profile**, fictional checks first, followed by the already inspected public employer page. Disable it and close the temporary window afterward. Do not log in, submit, contact an employer or bypass a site prompt. This is not store-submission authority or a production profile-save test.

## Evidence and remaining acceptance

- **12 targeted tests and TypeScript pass** on Node 24.19.0.
- **17 real-browser DOM checks pass** using fictional roles and the actual modules. An explicit source-URL parameter tests identity locally; these are not installed-extension or real-site acceptance.
- The exact 0.2.3 bundle rendered four companion elements on a fictional page. An immediate read after the harness second Enable still showed four, so removal was not verified in that check; the tab was closed. Closed-shadow interaction and native installed acceptance remain pending. A prior 0.2.2 native-window attempt was interrupted.
- Actual installed **0.2.0** refused capture after a sign-in prompt obscured the retained public LinkedIn page. It was disabled and the signed-out test window closed. LinkedIn/Indeed compatibility remains unproven.
- Independent wording-quality acceptance, Edge, Chrome Web Store review/consumer installation, live account import and authorised applications remain separate gates.

Receipts: [layout evidence](../cloudflare/tests/evidence/job-notes-layouts-2026-11-03/validation-023.json), [browser cases](../cloudflare/tests/evidence/job-notes-layouts-2026-11-03/browser-layouts-corrected.json), [observed structure](../cloudflare/tests/evidence/job-notes-layouts-2026-11-03/source-structure.json). No Worker deployment or schema change is needed merely to retain this private candidate.
