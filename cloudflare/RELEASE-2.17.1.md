# Sponsor Intel 2.17.1 — source freshness and unattended evidence

8 October 2026. Invalid immigration-source timestamps could avoid the overdue alert because comparisons against an invalid date are false. Register, job-source and immigration health checks now consistently reject missing, invalid, over-age and excessively future timestamps. A five-minute clock tolerance is retained. Evidence is never rewritten to make a source appear current.

## Validation and deployment

- 203 tests passed, including freshness boundaries and a database-backed issue opening/resolution regression. Production typecheck/build, 17-page prerender and Worker packaging passed.
- Live version 2.17.1, Worker `b8ed9300-f7c6-4263-82a4-8dd13458e2ef`. Public health, jobs and immigration routes returned 200; anonymous business/research admin routes returned 403. Checked responses retained their browser protection headers.
- No migration, new model call, quota reset, source expansion or external post was needed. Previous 2.17 Worker: `1d2eb5f7-55f7-4fdf-8abd-e0494491a1bb`; recheck deployment history before a rollback. Retain database records and workflow bindings when rolling back.

## Job evidence audit

The real source workflow `scheduled-1791419434000` began at 00:30:34 UTC and completed at 00:31:07 UTC. Its origin is recorded as scheduled; all 30 connected feeds reported publication and the subsequent feed records had no error.

The private 50-advert sample covers 18 sources. All 50 IDs and exact URLs were unique, all required fields populated, all original description hashes valid, and all adverts active with unchanged descriptions after the new refresh. Observation times span 00:30:38–00:31:04 UTC. One source-provided update timestamp is absent; this is kept distinct from the feed observation time. A feed listing is not an independent application-form availability check.

Twelve complete adverts received provisional AI-assisted annotations before opening per-record site labels. Eleven have a single expected category, while one bare “can sponsor” statement retains both positive categories pending taxonomy adjudication. No contradiction with current labels was found. This is not independent human ground truth or a model accuracy result: 38 semantic reviews, independent adjudication of all cases and a real-advert model evaluation remain pending. The sample is stratified and cannot estimate population accuracy.

Local supporting artifacts include raw exports, frozen annotations, exact SELECT queries, an executed companion notebook and a self-contained HTML report. The report passed canonical validation and payload/structural verification. Installed headless Chromium was unavailable, so interactive layout/source-dialog QA did not run. Aggregate evidence is committed in `tests/evidence/advert-audit-2026-10-08.json`; complete source descriptions remain outside the repository.

The model weaknesses observed in 2.17 remain unresolved. No research approval or autonomous publication authority is granted by this audit.

## Genuine scheduled supervisor receipt

`business-497616` began at 00:45:34 UTC on 8 October with `trigger_kind=scheduled` and completed at 00:45:40 UTC. The supervisor recorded research and marketing as idle, no recovery actions, no model calls and no external posts. Health findings included zero high-priority issues. Housekeeping had no stale roles to retire; the next evidence report was not due. These are ordinary production checks, not an injected incident; recovery branches retain their isolated runtime evidence.

The business cycle dispatched `marketing-2026-10-08`, which completed at 00:45:42 UTC as `no_post`: no eligible slot in the current queue. It consumed one existing attempt reservation and zero model calls, created no brief and sent no post. The research dispatch correctly held after the shared allowance reached 4/4 attempts and 6/32 calls. No reservations were cleared to force output. This proves the unattended no-post path, not the quality of live planner/writer/critic output or social delivery.
