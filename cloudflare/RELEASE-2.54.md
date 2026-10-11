# Sponsor Intel 2.54 — inspect historical application failures

Prepared 11 October 2026; deployment and live owner verification are pending. Production rollback reference: 2.53 Worker `389877c3-9b6e-43b3-a117-245c3a176f09`. No migration, new service, dependency, permission or allowance is introduced.

## Problem and change

The three retained application evaluations use a function-string fingerprint from 2.52. Building the complete historical Worker from commit `d8861939886a71b693920bc09150396bf4d4aed5` reproduces that fingerprint exactly. The complete 2.53 bundle changes five validator/helper function strings solely through esbuild local-variable renaming; the writer function and source validator/helper files are identical. A narrow module bundle was insufficient evidence and is superseded by this full-Worker comparison.

The owner case view can now inspect that exact historical profile through an immutable archive of the original validators and their complete local helper graph. It shows the archive ID and original source commit beside the finite rejection reason. The build verifies every archived file and dependency hash. Unknown profiles and changed fictional fixtures stay unavailable. Historical matching does not admit a campaign to execution and does not replace its stored fingerprint.

Rechecks of all nine retained rejected responses agree with the original full Worker: five candidate responses violate the required structure, one candidate response is invalid JSON, two current-reviewer responses fail numeric checks and one fails an evidence check. These are content-contract diagnoses, not recovered provider completion metadata or independent assessments of writing quality. Raw responses remain private. No response is reclassified or made assessable; passing a later recheck would still preserve the original rejection.

The evaluator remains paused. Customer generation, prompts, models, execution configuration, recorded assessments and all reservations remain unchanged. A stable execution identity and a separately reviewed future campaign remain open work; this release does not resume or restart the old one.

## Validation and operations

All **555 tests pass** on Node 24.19.0, including actual isolated Worker/auth/D1 reads in ordinary and minified bundles, anonymous denial, repeated read consistency and unchanged evaluation/history/budget/assessment records with zero outbound calls. TypeScript/build, 17 prerenders, unchanged browser budgets and Wrangler dry run pass. Initial JavaScript: 367,164 bytes / 112,327 gzip; CSS: 105,467 / 22,020 gzip. The actual owner component was checked locally at 1,280 and 390 pixels with no horizontal overflow, writes or model calls; the temporary tab/server were closed.

Read-only production recovery inspection at 15:40:02.859 UTC matched all 146 objects across 35 migrations and found a current recovery point. No restore, customer export or retention-window test occurred. No schema change is required. The current dependency audit has zero high/critical findings and the existing three moderate Mammoth/argparse/sprintf-js entries; the [official advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) still lists no patched sprintf-js release. No forced downgrade or install was made.

The genuine pre-deployment `business-497703` run completed in Cloudflare at 15:46:11.144 UTC, with an attention application receipt at 15:46:10.940. It preserved the research hold and application pause, retained zero opportunity candidates, and reused the existing daily search/discovery/editorial receipts. This verifies the first hourly run after 2.53; it is not a 2.54 scheduled-run receipt or a successful autonomous business outcome.

Evidence: [application history receipt](tests/evidence/application-history-2026-10-11.json). Hosted checks must be inspected at the exact pushed head; prior GitHub billing failure is not repaired by local tests. Preserve all model/Google/source/email/social limits and unresolved holds. Deployment verification must read the real owner diagnostics and compare the preserved application records and budget before claiming this live.
