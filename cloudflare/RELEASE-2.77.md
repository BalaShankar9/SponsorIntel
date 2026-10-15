# 2.77 — Detect and diagnose sponsor-register refresh failures

The retained register reports a failed automatic refresh even though its check timestamp is recent. The hourly business monitor previously considered only timestamp age and could omit this failure. Its current health reconciliation now opens the existing high-priority `register-freshness` finding when either the error or structured failure is present. A successful, fresh check is required to resolve it; this release does not clear the current error or advance its source date.

The daily register importer now records a bounded stage, fixed error category, attempt times, source date and snapshot-activation acknowledgement. A completed import followed by cleanup failure is distinguished from failure before activation; a lost activation acknowledgement remains uncertain. Raw provider/database messages are excluded. Failure metadata uses a compare-and-set guard and rejects a later recorded attempt, while a diagnostic-write failure still fails the run. These are latest-attempt diagnostics, not a complete immutable run ledger or a general concurrency repair.

The existing download, schema/size/complete-count checks, insert batches, snapshot activation, cleanup queries and daily schedule are retained. There is no retry loop, manual refresh, new source request, permission, migration or paid call. The historical failure remains unresolved until original or future execution evidence establishes its cause.

## Investigation and contract boundary

Read-only production inspection on 15 October retained active snapshot `2026-10-14-85942376`, 128,015 entries, checked 07:15:53.298 UTC, activated 07:16:38.873 UTC and failure recorded 07:18:26.748 UTC. Activation preceding failure is consistent with later cleanup trouble, but does not prove that cause. Two other snapshot groups contain 128,002 and 94,765 rows; their counts alone cannot establish their provenance. Nothing was deleted or restored.

Existing-authority telemetry API access returned 403; no permission was expanded. The authenticated dashboard's sampled 07:15–07:20 UTC window had no retained register-failure event, which does not establish a healthy cron. Issue detection was not enabled. The next genuine daily refresh is 16 October 07:15 UTC; do not force it or promise the importer has been repaired.

The first build/test pass correctly rejected a modification to the version-pinned research source. The final implementation leaves that module and both research/application identities unchanged: operational health is extended in `business-health.js`, called by the existing business workflow, with one atomic reconciliation. No historical comparison hash, outcome, control or prepared profile is rewritten. The earlier rejected build and 662/663 test result are not release validation.

## Validation and rollout

Focused failure-path tests cover official-source and schema rejection, unchanged-source success, two full 100,000-row fictional SQLite imports, post-activation cleanup failure, lost activation acknowledgement, concurrent/newer metadata, unavailable diagnostic storage and actual isolated Worker/D1 failure-to-success behavior. No fixture enters production.

Rollback: **2.76 Worker 7364aecf-2c42-4548-9ba7-2cf64751e1f7**. No schema change; reuse the successful same-UTC-day read-only recovery check at 22:54:48.625 UTC, matching 40 migrations/166 objects and a current recovery point. This is not a customer restore or retention-window test. Dependency graph unchanged except application version; same-day audit remains zero high/critical and three known moderate Mammoth-chain findings. Disk was 8.3 GiB before validation. Runtime validation, deployment and genuine scheduled monitoring evidence are recorded below when observed.

Final local validation: **663/663 tests pass** on pinned Node 24.19.0; TypeScript/build, 18 prerenders, unchanged browser budgets and deployment dry run pass. Both source-identity checks pass without regenerating either manifest. The live scheduled finding and next register attempt remain separate acceptance gates.
