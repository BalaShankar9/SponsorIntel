# Sponsor Intel 2.93 — applicant-confirmed facts and routine answers

A saved application batch can now retain an applicant-reviewed profile and three optional routine answers with immutable versions and explicit revocation. The user sees the complete profile/CV before confirmation. Blank answers remain unanswered. Work permission, eligibility, sensitive disclosures and employer declarations are never inferred from the profile or sponsorship preference.

This is preparation only: no submission authorisation, employer connector, AI call, customer model promotion or spending increase. The pack is stored for review, not automatically inserted into generated documents/forms. Final documents, exact receiving destinations, screening answers and provider dispatch still require the next product stage.

## Integrity and privacy

The server takes profile facts from the authenticated account workspace. Profile/selected-role hashes, batch revision and previous version bind the confirmation. Atomic workspace/parent checks protect concurrent saves, account deletion, pause and competing confirmations. Exact-request replay preserves an uncertain save. Different contents under the same reference are rejected. The two new tables cannot be updated; revocation appends a separate record. A revoked confirmation never falls back to an earlier version. Pausing/reopening changes the parent revision and requires another confirmation.

There are at most 20 confirmations per batch, within the existing 20 batches/account and 60 batch requests/hour. Complete CV/answers stay private, outside public receipts, model calls and analytics. Browser recovery keeps request metadata/hashes only; interrupted unrecorded requests require the same answers to be re-entered. Account deletion cascades records. The private archive includes snapshots but does not implement backup import; existing downloaded files remain on the user's device.

Migration 0044 adds two tables/two immutable-update triggers, **44 migrations / 186 objects**. Prior runtime 2.92 Worker **0d64d45e-5f65-417e-ba08-913b4334ca00**, source **d3967508780b35c4f4a596d1c7270acb1135cb36**, is compatible code rollback: retain additive schema/private history and never restore D1 for a code rollback.

## Validation and publication

All **741 tests pass** on pinned Node 24.19.0 with test concurrency two. The first full run had 739/740 passes and one SmartRecruiters runtime database-response error while free disk fell to 116 MiB. Earlier targeted race coverage initially missed the single-statement write (test harness, corrected to hold the actual insert); a missing TypeScript declaration was fixed. These earlier failures are retained, not reported as passes. Owner-authorised npm/uv cache cleanup removed regenerable downloads; no personal files, dependencies, local-state archive or customer data were removed. Free space recovered to 2.9–3.0 GiB after test completion.

The actual Worker/auth/D1 suite covers two accounts, same-origin protection, forged profile/status rejection, blanks, size/field validation, stale profile, exact replay, concurrent versions, revocation, immutable history, 20-version bounds, account cascade and late writes racing account deletion/workspace edit/batch pause. No outbound action or model call occurs. Browser checks on isolated fictional data cover full profile visibility, unknown answers, lost-save reload reconciliation, revocation and immediate changed-profile status before a server recheck. Phone viewport 390 × 844 has page width 390 with no horizontal overflow. No fictional confirmation is inserted in production.

TypeScript/build, registered media/contracts, **19 prerenders**, browser budgets and Worker dry run pass. Initial JS 390,965 bytes / 119,414 gzip; CSS 109,950 / 22,776 gzip. Same-day dependency audit from 2.92 is reused: dependency versions and resolved integrity values are unchanged (only root package version changes to 2.93).

The 02:38:54.312 UTC pre-change read-only check matches the isolated **43-migration / 182-object** baseline and a current recovery point. Only migration 0044 subsequently applied; the post-change 02:49:19.827 UTC inspection matches all 186 objects across 44 migrations. The private pre-change bookmark is retained outside Git. This is not customer restoration, independent writing-quality acceptance or autonomous employer submission.

## Live publication

Published **23 October 02:49:36.021554 UTC**, runtime commit **16b754577f03481189afdebf19d1e653a813dfb3**, Worker **30114f08-77d2-4d06-8001-924ba101af68**, deployment **7d86d595-e7ea-4fc2-a697-9a8de6884182**, 100%. Excluded health returns 200/2.93.0. The deployed `career-Cu8Glif4.js` exactly matches the build (SHA-256 `08f29710cb1572766746d42b7a575fb0e39d9088595a5bd008801e8053a98e20`) and contains the facts interface. The signed-in owner's live Applications entry loads with zero batches; no production confirmation or QA data was created. Anonymous batch access remains 401. Functional mutations were tested only in isolated fictional Worker/D1/browser sessions.

Twelve of fourteen operational groups match across 02:38:55.669–02:50:57.303 UTC, including controls, source pauses, marketing states/receipts and AI budget (one start/two calls). The genuine original hourly `business-497978` completed before deployment: D1 02:45:58.891 UTC, independently Cloudflare complete/success at 02:45:59.024. It accounts for source reservations 104→112 through two ordinary link samples. Its actual snapshot includes 49/57 assessed outputs, eight unassessed, 28 need work, three overdue discovery reviews and zero new daily leads. Nine findings/two retained high research findings remain; no source hold, model promotion, marketing send or forced workflow was added.

Runtime-head Linux checks **120212322843 / 120212311177** remain billing-blocked before execution; original annotations inspected. GitGuardian **120212314753** is neutral and explicitly skipped due to PR size, not a passed scan. Local tests are separate. See `tests/evidence/application-facts-2026-10-23.json`.
