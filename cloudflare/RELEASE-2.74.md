# Sponsor Intel 2.74 — find source controls without a long scroll

The source-agent panel previously opened the complete latest-run table and displayed the whole saved coordinator brief. These now begin collapsed, with the run publication count and saved brief date visible in their summaries. Source controls have employer search and All/Paused/Unpaused filters. Filtering and a status refresh preserve an unsaved control-review draft; they do not change a source or dispatch a check.

A source’s last completed partial-collection receipt now shows its observation date and explicitly says descriptions remain private. The saved control reason and date are available in an expandable owner-only detail and beside a proposed change. This explains a pause without treating old collection progress as current publication. Existing pause/resume/check actions and all source limits are unchanged.

Free-form control reasons are explicitly added only by the authenticated owner GET route. The default operational snapshot and coordinator input exclude them, and actor identities are not returned. No migration, dependency change, source review, model call, source request, publication or resume is part of this release. PortmanDentex remains paused; its historical conflict is still unresolved.

## Validation

643 tests pass on pinned Node 24.19.0 (67.7 seconds), including the owner/default-snapshot/model-input privacy boundary. TypeScript, production build, 17 prerenders, browser budgets and Worker dry run pass. Same-day dependency evidence remains applicable: only package root versions changed in the lockfile; zero high/critical and the three existing moderate Mammoth-chain advisories remain, with no patched upstream version at the recorded check.

The isolated browser preview used 37 fictional sources and no external calls or mutation requests. Paused filtering reduced 37 to 2, search reduced that to 1, and an empty result preserved the selected review draft across status refresh. Saved markup-like text rendered as escaped text. At 390 pixels the document remained 390 pixels wide and the filter area measured 292 pixels. Source controls still require an explicit saved change; no fictional or real control was saved.

Rollback target: 2.73 Worker `048f4316-de47-43e2-a508-cc641324001b`. It retains the discovery allowance server guard and all earlier replay/security controls, but removes this source navigation and reason display. Keep database history and current owner holds; no database restore is involved. Live rollout and exact-head hosted CI are recorded after verification.
