# Capacity and supervisor recovery handoff

Prepared **30 October 2026**. This is a decision record and an **unsent** provider-investigation draft. No purchase, message, account change, production write, workflow restart or hold release is authorised by it. The broad product goal remains incomplete.

## Decision 1: sustainable execution capacity

The refreshed account UI still identifies **Workers Free** as the current plan. The read-only observation is retained in [the capacity receipt](../cloudflare/tests/evidence/capacity-handoff-2026-10-30.json); no billing information is included.

The original 30 October invocation `ea1d3d6f05148840893c133eb616aa0b` reports daily D1 write exhaustion. The retained worker register contains **128,008 rows**. Even one insert per record for a complete changed snapshot exceeds Free's **100,000 writes/day**, before index writes, cleanup, jobs, receipts or private saves. The new identical-snapshot check reduces repeat work but cannot make a changed full replacement fit that limit. A daily reset is a recovery opportunity, not a sustainable capacity solution. [D1 pricing and counting rules](https://developers.cloudflare.com/d1/platform/pricing/)

The original source run `scheduled-1793341855003` also retains **22 CPU-limit errors**. Free allows **10 ms active CPU per Workflow step**; Paid defaults to **30 seconds**, configurable up to five minutes. Release 2.98.7 repairs waiting around existing leases; it does not raise this CPU limit. [Workflow limits](https://developers.cloudflare.com/workflows/reference/limits/)

**Recommended decision:** the owner reviews Workers Paid for the existing account. The current published minimum is **US$5/month plus metered usage**, not a fixed total or spending cap. D1 includes 25 billion reads and 50 million writes/month before usage charges; Workers, Workflows and other products also have their own included usage and metering. This is an account subscription, so other services in the account matter. No reliable total monthly forecast has been established from the incomplete incident-period data. The owner must review the checkout, applicable taxes and terms, and complete any purchase. Existing application request/model/send limits remain unchanged. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)

If the owner keeps Free, the alternative is a separately designed and measured storage/import/CPU architecture that fits the account's shared ceilings while preserving complete validation, atomic snapshots and useful freshness. Merely spreading today's failed import across days or loosening freshness cannot establish that. Such a redesign is not implemented, and its cost and operating adequacy are unknown. No reduced service level, new service or altered schedule has been selected.

An upgrade would address capacity constraints; it would **not** establish recovery of the missing business instance, prove that all sources publish, clear evidence holds, or authorise deploying the prepared Founder migration without its own gates.

## Decision 2: recover the original supervisor's execution evidence

The [14:35 UTC original-receipt inspection](../cloudflare/tests/evidence/business-status-2026-10-30.json) is stable before/after:

| Original instance | Application evidence | Provider evidence |
| --- | --- | --- |
| `business-497989` | Queued since 23 October 13:45:30.093 UTC; no finish time; zero recorded steps | Exact lookup returns 10400 / instance not found; execution remains unknown |
| `business-497990` | Attention; finished 23 October 14:46:54.646 UTC; five recorded steps | Original execution succeeded at 14:46:55.013 UTC; version `53176112-4726-4bdf-93f2-1e7ab3453bd9` |

Missing is not terminal. Zero stored steps is not proof that no external action occurred. Documented completed-instance retention does not establish why this particular instance is missing. The later successful instance does not resolve the older one. See [BUSINESS_RECONCILIATION.md](BUSINESS_RECONCILIATION.md).

### Unsent provider-investigation draft

**Recipient:** Cloudflare support, through the owner's authenticated account and an available support channel. Current plan UI advertises community support on Free and standard ticket support on Paid; availability of a particular ticket route has not been tested. Do not post this record to a public community automatically.

**Subject:** Recover original execution evidence for missing Workflow instance `business-497989`

Our Worker `sponsorintel` uses Workflow `sponsorintel-business`. Our application retained instance `business-497989` as queued at 2026-10-23T13:45:30.093Z. Read-only checks on 30 October still find that row with no finish timestamp and zero stored application steps. An exact Workflow describe at 2026-10-30T14:35:28.760Z returns error 10400, instance not found. We have not restarted, recreated, terminated or deleted the instance, or cleared its application reservation during this investigation.

The adjacent instance `business-497990` is still describable. It queued at 2026-10-23T14:45:43.326Z, started at 14:45:46.469Z and ended successfully at 14:46:55.013Z, version `53176112-4726-4bdf-93f2-1e7ab3453bd9`. Its application result was attention. This does not determine the outcome of the missing original.

Please investigate whether `business-497989` was created and, if so, its original execution state, start/end times and any available step/attempt evidence. Please distinguish an uncreated instance from expired/deleted history or another provider condition, and state explicitly if the original outcome cannot be established. We need evidence of whether any old execution can still run before reviewing our application reservation. Please do not recreate, restart, delete or otherwise change execution as part of the investigation without a separate agreement.

We can provide the attached sanitized aggregate receipt, containing instance identity, timestamps, status and step counts. It contains no customer records, outputs, credentials or arbitrary application snapshots. Account identity can be supplied by the owner within the authenticated support case; no private billing details or logs are included here.

**End of unsent draft.** No support case exists on account of this document. Sending requires the owner's explicit instruction or the owner sending it themselves. Any reply remains evidence to review, not automatic authority for destructive recovery.

## Acceptance after an owner/provider decision

1. Recheck current account capacity and original production receipts. Do not assume a plan change has propagated, that the reset recovered writes, or that historical failed work completed. Retain all consumed reservations and prior failures.
2. Obtain authoritative original-instance evidence, or prepare a separately reviewed recovery procedure that addresses missing evidence and all external-action uncertainty. Preserve the original application record and child identities. The current code has no permission to clear unknown state.
3. Observe the next genuine scheduled register/source/business executions at their exact provider and application IDs. Require a complete current register, successful source outcomes or explicit remaining failures, and current supervisor findings; distinguish execution from quality and delivery. Do not manufacture a scheduled run.
4. Only after write capacity is established, perform the documented pre/post-migration recovery checks and fictional save/replay/conflict/recovery acceptance for prepared Founder saving. Migration 0047, its feature flag and release 2.99.0 remain unapplied/inactive.
5. Recheck exact-head hosted CI after any new code push. GitHub's existing billing lock is a separate owner issue; a Cloudflare plan change does not fix it. Resume overdue authenticated evidence reviews and retain new performance observations only after their own freshness, identity and save gates pass.

No code, package, schema or production change accompanies this handoff. The existing 2.98.7 Worker and compatible rollback remain unchanged. Continuing automatic implementation cannot resolve the unresolved commercial decision or invent the missing provider evidence.
