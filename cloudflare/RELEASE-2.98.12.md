# 2.98.12 — visible advert capture boundaries

3 November 2026. Validated candidate; deployment is recorded below after verification.

Fictional connected-Chrome checks reproduced three gaps in Advert Check 0.1.3: fully transparent ancestor text, collapsed table text and closed details content entered automatic capture. The retained baseline includes their exact fictional results. **0.1.6** uses the browser visibility check with opacity/CSS visibility enabled, excludes hidden regions and requires visible closed advert sections to be expanded before capture. A selection intersecting hidden/application text is refused rather than silently including it. Browsers without the required visibility API receive a paste instruction. The popup preserves the new Expand error so the user sees the required action.

Opening a closed section and reading again retains its real, now-visible refusal alongside the offer, producing an unclear result. Ordinary visible conflicts and inline conditional wording remain intact. These are bounded DOM checks, not pixel visibility, universal site compatibility or a promise that every advert is complete. Selection/paste and user review remain essential. The [CSSOM View working specification](https://drafts.csswg.org/cssom-view/#dom-element-checkvisibility) describes the visibility checks; the recorded browser tests establish observed behavior in this environment only.

## Validation

**20/20 targeted tests** pass in both combined and isolated checkouts on pinned Node 24.19.0. The archive assertion now also checks the README's exact version header. Isolated TypeScript/build, **21 prerenders**, browser budgets and upload dry-run pass. Dependencies are unchanged; the same-day security/recovery evidence remains applicable. No install, database migration or production model call.

The new repeatable `scripts/serve-extension-capture-fixtures.mjs` serves only fictional local fixtures and reviewed files. Connected Chrome verifies **34 capture cases**: automatic and selection paths for opacity, collapsed visibility, hidden/ARIA/display/content-visibility, closed/open details, visible conflicts, forms, inline markup, an opaque root, a closed root, multiple roles, missing browser API, oversized text and node complexity. The exact archived 0.1.5 capture/analyser modules used for those tests are byte-identical to final 0.1.6. Final 0.1.6 popup/capture integration is separately verified with a clearly fictional browser-API bridge: the expansion instruction appears and an expanded contradiction retains both quotes. This is not installed-extension, activeTab permission, real-site or browser-store acceptance.

Two browser-control click timeouts were reconciled against the existing rendered state before continuing. The complexity fixture was shortened to test node count separately from the text-size limit. Before publication, candidate 0.1.4's stale README header was caught and a version assertion added; candidate 0.1.5's generic popup error was caught and corrected. Both unpublished archives remain private and their versions are skipped. No versioned public archive was replaced.

Current ZIP: **28,360 bytes**, SHA-256 **564d8d1b6addf305d15194c4eefd72c3f50ccf969045b15c1444e7a7a18ee97f**. Public 0.1.0/0.1.1/0.1.3 remain exact. The analyser and its historical 50-advert evidence are unchanged; this is not another semantic accuracy claim or new public job. Manifest permissions/CSP and substantive owner-approved privacy policy remain unchanged. Its technical header identifies the tighter local-capture behavior. No storage, upload, AI, licence lookup or background process is added.

## Release boundary

Deploy only the isolated **2.98.11** lineage with this change and 2.98.12 version metadata. Exactly 46 migrations, no prepared Founder saving/0047/activation. The combined branch still contains prepared 2.99.0 and must not be deployed wholesale. Compatible rollback: **2.98.11 Worker 05d33310-4679-440a-a35a-0ac964d9bcbe**. Separate version upload/deploy preserves queues/triggers. All capacity/supervisor/model/source/marketing holds remain. Store artwork, manual publisher declarations/submission, consumer installation and independent compatibility/quality acceptance remain open.

Evidence: `tests/evidence/extension-capture-2026-11-03/`. Temporary local test tabs/servers were closed; no normal-profile extension installation or external-site capture occurred.
