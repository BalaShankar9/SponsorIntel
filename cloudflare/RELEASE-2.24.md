# Release 2.24 — Instagram editorial preparation

The verified `sponsorintellondon` company profile is now an exact Marketing desk destination and appears in the public footer and Organization `sameAs` links. A connection is separate from delivery: this release does not send a social post or claim a completed autonomous marketing cycle.

## Changed behavior

- Instagram drafts require registered image media and a caption of at most 2,200 characters. Media URLs and checksums come from a reviewed registry, not caller-supplied URLs. The existing square launch card is served through a content-addressed public path; every build verifies its bytes, PNG format and dimensions.
- Images and accessibility text are stored with each content version in additive migration `0020_marketing_media.sql`. Editing either requires a new review. A different reviewer must check media as well as claims, sources, destination and duplication. Existing text-only histories and replay hashes remain compatible.
- Schedule/publication observations require the exact company account and ordered image hashes. Published image posts require a canonical Instagram `/p/…/` URL. The operator still has to inspect the actual account, caption and artwork; a structurally valid receipt is not independent delivery verification.
- The owner can prepare one sourced Instagram welcome. It checks two fixed public guide articles and current vacancy availability, preserves dated excerpts and artwork, and creates a **Needs review** draft. Repeating the action retains that exact version; it does not refresh evidence, bypass a hold or create another post. This is template preparation, not an AI review.
- Instagram schedules and uncertain deliveries now count in the shared company queue used by the editorial planner. No additional posting volume, model allowance, permissions, subscription or direct publisher bridge was introduced.
- `ig-welcome` is an approved finite attribution mapping. A plain `sponsorintel.london` visit has no Instagram attribution; the mobile-only profile link still needs the recognised campaign URL before claiming tracked acquisition from it.

## Runtime issue found and corrected

The initial production welcome attempt failed to read its own public guides and created no draft. The preparer and editorial agents now read the exact prerendered articles through the deployed `ASSETS` binding, with a fixed guide-path policy, bounded reads and exact source checks. They do not call the Worker's own public route, forward cookies or accept arbitrary URLs. Existing failed/no-post receipts and consumed allowance are retained.

## Validation

279 tests pass, including invalid/personal destinations, missing image review, immutable media revisions, exact receipts, source changes, queue blocking and idempotent welcome preparation. Production-style build, all 17 prerendered public pages and Wrangler dry-run pass. Local Workerd/D1 used a synthetic owner and vacancy, with no AI, email, remote database or workflow bindings. The browser verified a 1080×1080 image preview, media-review gating and a 390px layout with no horizontal overflow. The image asset initially returned 404 in the local route check; an exact registered-asset allowlist fixed it before release.

The real production welcome is saved as Needs review with three sources, one 1080×1080 image, zero reviews and zero provider receipts; it persisted after reload. Final Worker version: `2b8c7700-bc0f-4932-8734-c90554c4da6e`. The earlier scheduled marketing run had already read all three guide sources successfully and chose no post; the request-path fix does not rewrite that history.

Production evidence is in `tests/evidence/instagram-production-2026-10-08.json`; local evidence is in `tests/evidence/instagram-runtime-2026-10-08.json`. The production footer/schema and image byte hash were verified, and anonymous access to marketing records remains 403. No campaign-tagged browser visit or Instagram delivery is counted by these checks.

## Rollback and remaining acceptance

Previous Worker: `fa395fd1-141d-4afe-a593-3b487b711617`. Pre-migration D1 bookmark: `000002ae-00000000-000050fe-0532d1e347930196f62c6090a97d24cf`. The new table is additive; no existing record was deleted or rewritten. Once an Instagram brief exists, the previous dashboard does not understand that destination. Prefer a compatible forward fix rather than returning to an older owner UI or deleting the new history. A code rollback cannot restore database state.

The first welcome still needs an independent editorial decision, a legitimate queue slot, provider scheduling and subsequent live delivery evidence. The cloud model pilot still writes Facebook guides, and no genuine model review of this Instagram welcome has run. The existing shared daily allowance is retained; no model call was made for this release. A direct Cloudflare social publisher, actual audience improvement, successful Google reporting and the broader application/research acceptance gates remain separate work.
