# 2.98.9 — preserve adjacent sponsorship caveats

3 November 2026. Locally validated; deployment is recorded separately below when verified.

Advert Check 0.1.0 could label “We offer visa sponsorship. This does not apply to this role.” as offered, and a stale-refusal statement as unavailable. The checker ignored the adjacent sentence because it did not repeat the word sponsorship. It also omitted unmatched sponsorship sentences that made a result unclear, and its first-six display could hide a late refusal.

Advert Check **0.1.1** holds recognized immediately adjacent withdrawal, applicability and stale-statement caveats as unclear, keeping both exact sentences. Unmatched sponsorship wording and questions are now quoted when bounded; the six-quote display preserves at least one of each evidence kind before filling remaining slots in source order. It does not infer refusal from right-to-work requirements. Distant/other phrasing can still be missed; this is a bounded regression correction, not independent semantic or universal job-site acceptance. The website paste checker shares the same function.

Only the extension classifier/package/versioned download links and exact download allowlist change. Active-tab capture, popup handlers, permissions, networking, storage, models, job classifications, reviewed source fingerprints, controls, database and schedules remain unchanged. The old 0.1.0 ZIP remains byte-for-byte available. Current 0.1.1 is **25,407 bytes**, SHA-256 `42fec9e8d1b3cc0935dd14f1954cc0a1bbde84cd6e38b3b30ce3473d66cd44b7`. Manual updates remain required; this does not provide store or one-click installation.

## Validation and release boundary

Pinned Node 24.19.0: combined branch **831/831** tests, isolated release **812/812** tests; all nine targeted extension tests pass. The isolated release TypeScript/build, **21 prerenders**, unchanged browser budgets and Worker upload dry-run pass. Existing same-day dependency evidence applies to the unchanged dependencies/lockfile. No reinstall or new model call.

Connected Chrome UI exercised the exact ZIP's popup HTML/scripts served locally: adjacent caveat returns unclear with both quotes, a late refusal/ambiguous caveat remains in six displayed quotes, and Clear removes text/result/confirmation. The isolated release website retains a stale-refusal caveat and both quotes at 390 pixels with no horizontal overflow. This popup-script test is not an installed-extension or active-tab test; the earlier 0.1.0 installed-package evidence remains distinct. No installation occurred in the normal profile. Temporary viewport was reset. Fictional data only. Receipt/screenshots: `tests/evidence/extension-2026-11-03/`.

The isolated release reconstructs live base `9bf8a1ebcf612c47380c0809d3ba765587f99d50`, applies only the original extension feature diff from `e47b379396a6ef84d0104b3f2df526d989a7df74`, then this correction. It sets package/root-lock/Worker version **2.98.9**. Across existing Worker/shared/migration/source files, only `worker/pages.js`, `shared/pages.json` and `src/main.tsx` differ from that base; all other existing runtime files match. Exactly 46 migrations are present; prepared 2.99.0 saving/0047/flag remain excluded. **Do not deploy the combined branch.**

The confirmed current compatible rollback is **2.98.8 / d2ab60fa-fc96-4e54-8048-89ad6e01c83f**, deployment `4e0b50d5-360d-4050-86fe-2675a98b64b0`. Upload/deploy separately to preserve queues/triggers. Today's recovery receipt is reused; no schema change or repeat inspection is needed. Capacity and unknown business execution remain held.
