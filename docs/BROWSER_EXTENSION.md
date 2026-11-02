# Sponsor Intel browser companion

Owner addition, 2 November 2026: provide an extension downloadable from Sponsor Intel that helps a visitor determine sponsorship wording for jobs they encounter on other websites. This is part of the existing product goal. It does not clear source, capacity, supervisor, model or private-saving holds.

## Required outcome

Support a site-independent workflow: open a job, read or select its complete advert, inspect the evidence and get a useful next step. Do not promise a binary answer when a site supplies no reliable answer. Separate offered wording, conditional wording, explicit refusal, conflicting evidence and unclear/not-stated wording. A sponsor licence is not a job offer, and advert wording is not personal eligibility or proof the vacancy remains open.

Provide a visible website download, accessible instructions, transparent permissions/privacy, versioned packages and an upgrade/removal path. One-click browser-store distribution remains a separate delivery requirement; an unsigned developer ZIP is not store approval or a consumer install link. Broader browser/site/language compatibility needs its own evidence, not a universal-coverage claim.

## Initial implementation

Version 0.1.0 is a Manifest V3 developer preview for desktop Chrome/Edge-compatible browsers. It requests only `activeTab` and `scripting`; a click reads the chosen tab. It has no all-site host permissions, background task, network request, storage, analytics, AI call or account integration. Application controls, forms, editable areas, hidden regions and navigation are excluded from automatic capture. Selection/paste is the fallback when a complete single advert cannot be isolated. Review and confirmation of one complete advert precede analysis. Large/incomplete inputs fail without a partial verdict.

The separate browser phrase checker does not modify production job classifications or reviewed research fingerprints. It uses conservative English-language patterns, exact supporting sentences, conditional/conflict handling and explicit uncertainty. It does not infer licence identity. Unknown interpretation remains unknown; these checks are not independent model/semantic acceptance. No individual legal decision or application is made.

The website `/browser-extension` supplies the ZIP and the same local paste checker. Text is React/DOM text, never HTML. It stays in memory; no new text telemetry, model call or database write. Existing aggregate website page measurement is distinct from the extension, which has none. Help links are ordinary user navigation.

## Packaging and distribution

Sources: `cloudflare/extension/`. Build command: `npm run package:extension` in `cloudflare/`; the normal build also runs it. The deterministic archive contains ten allowlisted files only. `public/downloads/sponsor-intel-extension.json` records the version, size and SHA-256 of the ZIP and each file. Do not package credentials, real page contents, QA profiles or personal data.

Install the preview by extracting the ZIP and using Load unpacked in the browser's extensions page. Keep the folder. Updates are manual: replace files from the official download, then Reload. Removal uses the browser's extension manager. Do not tell users to bypass managed policies or disable browser security. Chrome's [distribution rules](https://developer.chrome.com/docs/extensions/how-to/distribute), [activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [unpacked instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) and [Edge instructions](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading) were reviewed on 2 November.

Store publication needs an authorised publisher connection, the exact reviewed package, required privacy declarations and platform review. Do not buy a publisher registration, accept new agreements or imply a pending submission exists. Safari, Firefox and mobile installation are unverified; the paste checker remains available where supported. No per-site login, restricted-page access or CAPTCHA bypass is introduced.

## Acceptance and remaining gates

- Meaningful wording cases cover positive/conditional/refusal, mixed support/refusal, questions, licences alone, right-to-work alone, funding, unrelated sponsorship, historical wording and non-UK references. Results must retain supporting text and avoid interpreting missing text as refusal.
- Test real unpacked-extension loading, the browser action and active-tab injection on fictional pages; extraction boundaries, selected text, multiple roles, hidden/form content and oversized inputs; popup clearing and edited-input invalidation. No user's browser profile or customer advert data in test receipts.
- Test the local website checker, accessibility/keyboard flow, 390-pixel layout, package download/hash and missing-route behavior. Confirm no text leaves the browser, including error paths.
- Run the relevant suite/build/budgets, verify a live download byte-for-byte and retain the compatible Worker rollback. Publish only from the live runtime base; prepared 2.99.0 Founder saving and migration 0047 remain excluded.
- Browser-store listing, representative live-site compatibility, independent semantic accuracy, international/language coverage, licence-identity integration and measured usefulness remain explicit future gates. Site-agnostic selection/paste is a fallback, not proof of automatic extraction on every site.

Status and original validation/deployment receipts belong in `cloudflare/RELEASE-2.98.8.md` and the operator checkpoint. This document is a durable requirement record, not deployment proof.
