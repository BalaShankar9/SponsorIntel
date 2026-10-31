# 2.86 — retain source pause decisions

An owner who opened Resume before a newer pause could previously overwrite that newer decision. The actual API regression reproduced a 200 response where the stale request must receive 409.

Source controls now require the displayed decision revision and an exact-request identifier. Immutable history, the new control, job hiding and audit commit together under the source lease. Exact replay retrieves the original receipt and reports current state without repeating a change. The dashboard preserves typed reasons on conflict, requires an explicit review of the latest decision and freezes interrupted requests for exact retry. It shows the latest five private decision records.

Migration 0041 adds the decision revision/table and append-only/legacy-write guards without manufacturing old reviews or changing inherited states. Source failure metadata remains separately writable. Read `../docs/SOURCE_CONTROL_REVIEWS.md` for review and rollback limits. PortmanDentex remains paused; this is not feed recovery or public job expansion.

## Validation

- 708 tests pass on pinned Node 24.19.0, including actual authenticated Worker/D1 access, stale/overlapping requests, lost acknowledgements, rollback on audit failure, lease loss, immutable history, legacy writer rejection and private-context exclusion.
- TypeScript/build, 18 prerenders, browser budgets and Worker deployment dry run pass. No dependency graph or research/application configuration change.
- Actual owner-component/API browser fixture: stale revision 1 rejected after a newer pause; typed reason retained; explicit latest-state review; interrupted revision-2 resume recovered with an identical request; three reviews/three audits and no external calls. Phone frame and document are both 390 pixels wide, with three retained decisions visible.
- Production recovery before schema change: 18 October 14:46:59.419 UTC, exact database identity and current recovery point, 40 migrations/166 matching objects. This is not a customer restore or retention-window proof.

Deployment and preservation observations are recorded in `tests/evidence/source-control-reviews-2026-10-18.json` after verification. The prior Worker is 2.85.0 `bd4a4df5-e501-47ed-9900-9dba2d1f952e`; keep additive schema/history during any separately reviewed rollback. No model promotion, source resume, forced refresh, extra social/email/Google action or new access is part of this release.


## Verified deployment

Live 18 October 15:03:47.911 UTC: Worker `587948e1-3b0e-4a3a-bb64-ee6fe5a9ac0a`, runtime `52aff50d447742b8a037b64cd945b39103d3ff20`. Health reports 2.86.0; anonymous owner access is 403. Owner browser displays the unchanged inherited PortmanDentex pause/reason/date and accurately says earlier history was not recorded. Served owner JS/CSS bytes match the tested build. No production control POST was used for QA.

Migration 0041 is applied. Post-change recovery at 15:02:34.376 UTC matches all 172 schema objects across 41 migrations. All fourteen operational, eight protected metadata and three source-control/cache groups match their pre-deployment values. AI remains two starts/eight calls, sources 376/500, catalogue 978 active roles. One inherited control stays revision zero, with zero new review records and clean foreign keys. Linux checks 117708376397 and 117708367758 did not start because of GitHub's billing lock; original annotations inspected. GitGuardian 117708462683 passed. Local tests are separate from hosted Linux validation.
