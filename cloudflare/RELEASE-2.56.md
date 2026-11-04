# Sponsor Intel 2.56 — stop repeated invalid source collections

Live on 11 October 2026 as Worker `d6bd42a8-0b15-42e3-99ab-219c547a9c8a`, code `ad56cb78ac2f658922a821157aabeeb970220da2`. No migration or dependency change. Rollback: 2.55 Worker `24d7ac43-84e6-4d81-8263-6f568a0b244a`.

PortmanDentex's historical identity failure used repeated 50-request reservations while returning to the same inconsistent advert. A known identity, destination, catalogue or parser rejection now ends that source task as Needs review after its first such failure in a run. The safe diagnostic, review record, failed-source receipt and terminal task state commit together. Replaying a committed result makes no source request, including after a lost acknowledgement. The rejected batch never publishes; existing public jobs, last successful observation, private cache and owner pause/reason remain intact.

Transport, HTTP, storage, lock, work-limit and unclassified failures retain the existing bounded retry behavior. No request ceiling is raised or refunded. A later ordinary scheduled collection may recover only under the existing source approval, pause, cooldown, whole-catalogue and publication checks. This is a stop for the current run, not a new permanent owner pause; existing successful-publication behavior resolves its operational review. Historical failure receipts are not rewritten.

The current original PortmanDentex catalogue and detail agree for the previously failing advert. Its historical mismatch remains unknown because the differing values were not retained. The source stays paused with zero public jobs. Four new manual diagnostic requests (six for the UTC day including the earlier recheck) are recorded separately from production reservations. A 251-summary catalogue and 68 private cached descriptions do not prove complete collection or sponsorship. See `docs/PORTMANDENTEX_SOURCE_REVIEW.md` and the dated receipt.

The genuine scheduled `business-497704` run finished at 16:46:13.619 UTC under 2.55. Cloudflare independently reports successful completion. It retained seven findings including the existing high-priority reference-evaluation hold, checked two employer links, reused the daily Google/discovery receipts, kept application evaluation paused and research held, and made no new social post. This closes the first observed 2.55 business-run gate; it does not establish writing quality, source recovery or a 2.56 source execution.

Validation includes an actual isolated SourceWorkflow/D1 execution: a temporary HTTP error retries, a subsequent identity conflict ends that run, replay does not fetch, and later complete fictional collections stage then publish atomically. Other cases preserve a prior publication and partial cache, existing owner controls, earlier failure history and exact consumed reservations. No production failure or model call is manufactured for acceptance.

## Pre-deployment validation

All **568 tests pass** on Node 24.19.0 in 65.9 seconds. TypeScript, production build, all 17 prerenders, browser budgets and deployment dry-run pass. Initial JavaScript/CSS budgets are unchanged. The first added prior-publication test needed an explicit fictional owner-control seed; after correcting that fixture, the focused and full suites pass. The actual isolated SourceWorkflow test completes with the new stop/replay/recovery behavior and no production requests.

The dependency audit has zero high/critical findings and the existing three moderate Mammoth/argparse/sprintf-js entries. The [reviewed upstream advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), rechecked 11 October, still lists no patched sprintf-js version; no dependency or spending change is made.

Before deployment, read-only production inspection at 16:53:20 UTC retained hashes of PortmanDentex's pause/control, 68 cache rows, completed progress, 14 task receipts and zero public jobs, plus source reservations, application pause, selected comparison and shared AI budget. Source reservations are 296/500; the separate manual diagnostic traffic is documented above. Foreign-key checks are clear. The earlier 16:33 schema/recovery check remains the daily recovery evidence; this release changes no schema. Verify the hashes after release and retain the rollback reference.


## Live verification, 16:57 UTC

The deployed health route reports 2.56.0. Public catalogue remains 928 current roles, 36 employers, 55 sponsorship-worded adverts and 887 licence-linked roles. Read-only before/after hashes match for the paused source, all 68 private cache rows, last complete progress, all 14 source task receipts, zero public PortmanDentex jobs, source budget, application pause, selected comparison and shared AI budget. Source reservations remain 296/500 and foreign-key checks are clear. See `tests/evidence/source-validation-stop-2026-10-11.json`.

The first genuine 2.56 source run and any real validation-stop receipt remain unobserved. Never force a bad source or a refresh to manufacture proof. Current catalogue/detail agreement does not explain the historical discrepancy or itself release the existing PortmanDentex pause. No new production model/Google request, discovery lead, social post, alert test, migration or forced source run occurred.

Exact code-head GitHub checks `114523211693` and `114523204640` did not start because the account is locked for billing; both annotations were inspected. GitGuardian passed. This is an existing hosted-CI limitation, not a failed local test or evidence of Linux success.
