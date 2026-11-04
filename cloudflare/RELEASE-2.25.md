# Release 2.25 — Independent Instagram welcome review

The existing once-daily MarketingWorkflow can now review the unchanged Instagram welcome when the shared company queue has a legitimate slot. It refreshes source evidence in an immutable version, then makes one independent reviewer call covering six caption paragraphs, seven registered artwork text items and the accessibility description. The model receives public excerpts only. It reviews a manually verified transcript tied to fixed image bytes; it does not see pixels or assess visual layout.

Every factual unit needs an exact supporting quotation, every unit needs a verdict, and the whole post and accessibility description must pass. The final decision requires the exact completed model receipt, unchanged source hashes and image bytes, current vacancy availability, unexpired evidence and a still-valid queue slot. Rejections and uncertain calls are held. Owner edits, reviews and holds win over automatic refresh, completion and stopped-workflow recovery.

The shared four-start/32-call daily limits, one marketing attempt per UTC day, five-call headroom, account permissions and posting cadence are unchanged. Failed calls remain consumed and are not repeated. This extends the existing workflow; it adds no new service, model, cron, subscription, direct publisher or database migration. The owner desk displays the review scope, individual text labels and source quotations.

## Validation

289 tests pass, including the original welcome expiring before a legal queue slot, semantic rejection, changed evidence/media, missing review receipts, full/overdue/uncertain queues, owner edits during execution, uncertain call retention and terminal-workflow supervision. Build, 17 public prerenders and deployment dry-run pass.

An isolated Workerd/D1 environment executed the real durable workflow steps with a deterministic synthetic model adapter: version 2, reviewed state, 14 checks, one counted synthetic call, zero provider receipts, and unchanged replay. No AI, email or remote database binding was present. See `tests/fixtures/marketing-existing-runtime.js` and `tests/evidence/instagram-review-runtime-2026-10-08.json`. This establishes execution and controls, not actual model judgement.

## Production acceptance

The real welcome remains version 1 / Needs review until a genuine eligible daily execution. No model call or social post is triggered by this release. The shared 8 October allowance is already four starts/six calls and is retained. The next daily opportunity is 9 October UTC, subject to queue reconciliation and available allowance; it is not a promise that a review or post will succeed.

The 8 October 04:45 UTC scheduled business run `business-497620` completed at 04:45:39.472 with its true scheduled origin. A transient authenticated D1 read initially returned error 7403; after checking the existing OAuth identity, the same read succeeded without changing scopes or permissions.

Previous Worker: `2b8c7700-bc0f-4932-8734-c90554c4da6e` (2.24). It understands the same Instagram/media schema but lacks this review route. Code rollback does not revert stored versions or decisions. Preserve all evidence; do not delete histories or reset daily limits. Deployed Worker: `c646d909-a5ed-4079-a5e3-29dcec8fd261`. Health reports 2.25.0; the authenticated browser shows the new review scope and disabled daily check, anonymous access remains 403, and production readback confirms the original welcome and allowance are unchanged. Live deployment/readback evidence is recorded separately in `tests/evidence/instagram-review-production-2026-10-08.json`.

Actual model review, provider scheduling, live post delivery and audience outcomes remain unverified. The connector-managed publishing routine remains separate from Cloudflare. No completed autonomous marketing cycle is claimed.
