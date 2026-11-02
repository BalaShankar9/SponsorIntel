# 2.98.8 — browser advert companion

2 November 2026. The owner requested a downloadable extension for checking sponsorship on job websites. This release provides the Sponsor Intel Advert Check 0.1.0 developer preview, a public `/browser-extension` download/instructions page and an equivalent local paste checker. Store installation, international/language coverage and universal site compatibility are not claimed.

The Manifest V3 package reads the chosen tab after the user's click, using only `activeTab` and `scripting`. Selection/paste handles layouts where a single complete advert cannot be isolated. Forms/editable content, hidden text and navigation are excluded from automatic capture. Users review the text and confirm one complete advert before analysis. Checks distinguish direct offered, conditional, refused and unclear wording with supporting sentences. Conflicts, questions, ambiguous context, excessive input and absent evidence stay unclear. No background reading, networking, storage, telemetry, AI call or licence lookup is introduced by the extension.

The website provides the same local checker without an account. Its page/style/checker load on demand, preserving existing public browser budgets. A reproducible ten-file ZIP and per-file SHA-256 manifest are generated from reviewed sources. Only the exact ZIP/metadata paths are served. Live job classifications, reviewed model fingerprints, source requests, schedules, holds, database schema and prepared Founder saving are unchanged.

Validation is complete; deployment is pending until its receipt below. The initial phrase test correctly failed an invitation-to-apply case classified as offered; the classifier was corrected to conditional. The first build exceeded the existing initial CSS budget; the new page/styles were moved behind an on-demand entry rather than raising the budget. These failures remain part of the validation history.

The compatible rollback is live 2.98.7 Worker `5718ecde-d683-43dc-b5ef-91936abbb5d2`. A release build must use runtime base `9bf8a1ebcf612c47380c0809d3ba765587f99d50` plus only this extension change, excluding prepared 2.99.0 saving/migration 0047. Upload/deploy separately to preserve the email queue consumer and existing triggers. Same-day recovery evidence remains 46 applied migrations/204 schema objects; no schema change or repeated recovery inspection is required. Existing capacity and original-supervisor gates are not resolved by a static download or successful local check.

## Local acceptance

Pinned Node 24.19.0: the combined development branch passes **828/828 tests**; the isolated live-runtime base plus this feature passes **809/809 tests**. Both TypeScript/builds pass with **21 prerenders** and unchanged browser budgets. The initial CSS is 109,950 bytes (22,776 gzip); the extension page/checker are loaded on demand. Worker upload dry-run passes. No dependency or lockfile change; the same-day zero-known-advisory audit remains applicable.

The actual unpacked extension loaded in isolated Chromium 156.0.8078.4 with a fresh temporary profile. The browser action granted active-tab access and read a fictional advert. Visible inline text, hidden/form/navigation exclusions, multiple-section and oversize holds, selection scope, edit invalidation, popup close/clear, local web checking and a 390-pixel layout pass. No pasted advert text appeared in observed network requests. The browser profile was closed/removed. Chrome/Edge store review, branded-browser and representative live-site compatibility remain unverified.

Receipt and screenshots: `tests/evidence/extension-2026-11-02/`. Repeat with `PLAYWRIGHT_MODULE=<existing-playwright-index.mjs> node scripts/check-extension-browser.mjs` after build; evidence defaults to the system temporary directory. The harness installs no dependencies and uses only fictional local pages.

The 23,871-byte ten-file ZIP has SHA-256 `db6c36d9612fe14fab7eef0b8d9d2487e11e78977bbccad0f977e4542e0acacb`. Tests independently unpack/check CRC and exact source bytes. Final popup scrolling and removal of unused captured page title were followed by targeted package tests and actual browser acceptance.
