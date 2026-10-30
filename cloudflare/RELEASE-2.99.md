# 2.99.0 — private Founder workbook saving (prepared, not deployed)

30 October 2026. The live Founder workbook holds notes only in tab memory, so reload or close can lose work. This prepared release adds an explicitly opened private account workbook with browser recovery, separate from career applications. Notes go to the account only on Save and never to AI.

Expected revisions prevent concurrent overwrite. Transactional request receipts let an uncertain save reconcile the identical request without creating another revision; newer local edits survive. Conflicting copies require a choice and retain a recoverable displaced copy. Storage failure, damaged data, session expiry, late replies and sign-out cannot silently replace private notes. Existing account deletion cascades to both new tables, with an atomic user-existence guard against a delayed save recreating deleted data. See `docs/FOUNDER_WORKSPACE.md` for the exact privacy, export, recovery and retention boundaries.

## Validation

801 full tests pass on pinned Node 24.19.0. Actual isolated Worker/auth/D1 tests exercise account/origin isolation, strict input, replay, overlapping saves, transactional rollback, deletion and a post-authentication deletion race. Browser validation covers explicit save, lost acknowledgement across reload, newer local edits, conflicts, restoration, offline recovery, account switching and sign-out. The 390-pixel page has no horizontal overflow; copyable backups work without a download. All identities and notes are fictional. No production private save, AI call, external send or application was made.

TypeScript/build, 20 prerenders, browser budgets and version-upload dry run pass. Dependency versions and research/application source identities are unchanged; the same-day zero-known-advisory audit remains applicable. Exact pushed-head hosted CI is checked separately and must not be inferred from local results.

## Not activated

Production remains **2.98.5**, Worker `7307c8e5-3743-4140-ab2f-a33741e5112b`. The original daily D1 write-limit failure remains an activation blocker. Migration `0047_founder_workspaces.sql` has been tested locally but **not applied to production**. `FOUNDER_SAVING_ENABLED` is absent; the new API refuses saving by default without touching the new schema. No deployment or production schema mutation occurred.

The current production recovery receipt remains 46 migrations/204 objects from 30 October 11:42:37 UTC. Prepared local schema is 47/206. Follow the pre/post-migration and capacity gates in `docs/FOUNDER_WORKSPACE.md` before later activation. Retain the current Worker as rollback, all additive data on rollback, every owner hold and all existing operational limits. Structured evidence references/attachments, multiple projects, milestones and remaining Founder stages are still open.
