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
