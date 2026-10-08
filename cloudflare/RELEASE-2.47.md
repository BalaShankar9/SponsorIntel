# Sponsor Intel 2.47.1 — paged employer-source collection

Adds the reviewed PortmanDentex public UK source and an incremental SmartRecruiters collector. This expands healthcare coverage once its full catalogue passes collection and quality gates. A source inventory is not a count of sponsorship offers.

## Behavior

- Fixed employer identifier and public API destinations; complete paginated catalogue before and after each bounded description pass. At most 500 summaries, 40 detail requests, 50 reserved requests per attempt and 75 seconds; requests spaced at least 200 ms apart. Existing 150/run, 500/day, retries, source pauses and lease guards remain.
- Private description cache survives interruption. A matching complete catalogue is required before atomic publication and missing-role retirement. Cached text keeps its retrieval time, is rechecked when its source version changes and expires after seven days. No applicant/creator/custom administrative fields are retained; non-advertised pay is not copied.
- All four public sections are checked and preserved, including adverts whose role text appears under Company Description. Refusals can override positive wording in another section. Outside-UK/Crown Dependency locations and inactive/internal/changed/unknown destination records are excluded or held.
- Owner task/source views show private gathered/total progress. Recent initial progress has a normal coordination/business finding; error, stalled, future-dated or prolonged collections still require attention. A valid resumed partial collection clears its fetch error without creating a success receipt or changing last successful publication.
- Public advert details distinguish catalogue observation, text retrieval and source-supplied release dates. A release date is not fabricated as original publication for job structured data. The group/register licence link remains separate from vacancy sponsorship or employing-entity proof.

## Deployment and validation

Migration `0031_paged_sources.sql` adds two derivative-data tables and a nullable job retrieval timestamp. The pre-change schema exactly matched the prior 30-migration release; the only anticipated differences were these additions. The applied 31-migration schema matches all 129 objects and a current recovery point was checked. No customer data was exported or restored.

Initial 2.47.0 Worker: `3187dc9f-5ac9-4434-8cc0-60268479daad`. Corrected 2.47.1 Worker: `f6193a11-3be4-4870-8e60-195bfbe6d00c`. Rollback baseline: 2.46.0 `19b5c628-5713-47f2-b6f1-b9e028a2111f`; the new schema is additive. Existing integrations, secrets, schedules and customer workflows remain on the authorized deployment configuration.

461 local tests pass on pinned Node 24.19.0. Production build, TypeScript, 17 prerenders and browser asset budgets pass; Worker deployment bundles successfully. The actual isolated SourceWorkflow/D1 test stages 40 of 41 fictional descriptions, publishes only after the last one, and replays without another request. Additional tests cover pagination, mismatched records, stale/corrupt cache, lease loss, budget limits, owner pause, alternate section placement, pacing and source-health interpretation. The actual BusinessWorkflow also runs with all 31 migrations in isolated Workerd, preserving job movement/replay behavior without external requests. These are development tests, not independent model-quality acceptance.

## Honest first-run result

Owner run `owner-4cf6d466-fc88-4aca-a32e-277184cf9288` finished at 18:23:09.656 UTC in attention, with three failed attempts, 150 retained request reservations, 11 privately cached descriptions and zero published PortmanDentex jobs. A specific original advert used the alternate section layout described above. The parser repair is covered by its captured original and regression test. No counters were reset and no partial jobs were published. Completed Cloudflare execution by itself does not mean source publication succeeded.

The genuine 18:30 UTC run `scheduled-1791484247000` finished at 18:33:14.595 UTC: 35 sources published and PortmanDentex skipped during cooldown. Cloudflare independently confirms execution completed; the application state is attention, not universal source success. Sequence (four roles) and Wintermute (sixteen) each passed their first unattended refresh.

After the parser repair, an audit-noted pause/resume used the existing owner controls to permit one recovery check. No daily request reservations or historical receipts were reset. Owner run `owner-66b517c5-e3df-4aac-840f-42abc1849eb5` completed at 18:36:51.709 UTC, independently confirmed by Cloudflare, with 51/249 descriptions ready, 40 gathered in this pass, 46 actual requests within 50 reservations, and zero public PortmanDentex jobs. Its old fetch error cleared, last successful publication remains null, and the owner panel visibly says gathering descriptions. The daily request reservation total is 388/500. Continue with the normal 00:30 UTC 9 October schedule.

The public browser now shows 926 jobs, 35 employers, 55 sponsorship-mentioned adverts (21 offered, 34 conditional) and 873 licence-linked jobs. The extra explicit offer came from the scheduled Callosum Applied AI advert, whose original London location and sponsorship sentence were verified in the browser. Its licence link is unconfirmed; the label is an advert statement, not individual eligibility. Full PortmanDentex publication, unattended continuation and representative advert-quality acceptance remain open. LinkedIn job adverts and ordinary posts still enter discovery as leads; automated LinkedIn ingestion remains disconnected.

Evidence: `tests/evidence/portmandentex-source-2026-10-08.json`; [source review](../docs/PORTMANDENTEX_SOURCE_REVIEW.md).
