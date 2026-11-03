# 2.98.10 — approved Advert Check privacy policy

3 November 2026. Prepared and validated; deployment is recorded separately below when verified.

The owner explicitly approved the exact `EXTENSION_PRIVACY_DRAFT.md` policy for publication. This release serves it at `/extension-privacy.html` and links it from both the extension page and its server-rendered fallback. It covers local page/text handling, the current tab URL, temporary popup state, incidental personal text, separate website/support visits and the Limited Use commitment. All 21 approved headings/paragraphs match the static HTML. The page needs no JavaScript or account and has responsive text and contents links.

The extension remains **0.1.1**, with both download ZIPs and metadata byte-for-byte unchanged. No new extension permission, storage, network access, AI service, account processing or store submission is introduced. The policy approval is not approval of unverified dashboard declarations, publisher identity/contact or a store submission. Icon/screenshot, installed 0.1.1, consumer installation and independent semantic acceptance remain separate.

## Validation and deployment boundary

Pinned Node 24.19.0: **18/18 targeted tests** pass in both the combined checkout and isolated release, covering existing public/private/failure routing, the exact new allowlisted policy route, extension archives/classification and immutable packaging. An initial invocation from the repository root found no test files; the corrected `cloudflare` directory passed. TypeScript/build, **21 prerenders**, browser budgets and version-upload dry run pass. This narrow public-page change did not rerun the full runtime suite or install dependencies. Same-day security/recovery evidence applies; schema unchanged.

Connected Chrome verified the local static policy, all sections, desktop width 1384 and mobile width 390 with no horizontal overflow, and the Limited Use anchor at the expected visible heading. The contents layout was moved after the title/introduction; final public and built HTML match exactly and the page was reloaded/rechecked. Screenshots are local QA, not production browser or store screenshots. No form was submitted. The test tab/server were closed and viewport reset. Receipt: `tests/evidence/extension-privacy-publication-2026-11-03.json`.

The isolated release starts from the verified **2.98.9** staging lineage, adds only the approved policy, its exact asset allowlist, page/fallback links and tests, and includes the verified immutable packaging build tool. Version is set to **2.98.10** only in that isolated package/root lock/Worker configuration. Existing runtime differences are only `worker/pages.js`, `src/extension-page.tsx`, `src/extension-entry.tsx` plus the new static HTML. Exactly **46 migrations** remain; prepared 0047/Founder saving/activation are excluded. **Do not deploy the whole prepared 2.99.0 branch.**

Immediately before preparation, original deployment listing confirms **2.98.9 Worker `3ca5be9e-3c75-4c6e-8d9c-5f96297dcf41`** at 100%, deployment `d1a64e99-fc8d-4c49-9d89-02ade1cfe509`. This is the compatible rollback. Upload/deploy separately, preserve inherited queues/triggers and verify exact policy/page/download bytes after deployment. No recovery check repetition, schema change, production write probe, budget reset or hold release is needed.
