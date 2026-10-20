# 2.90 — skills and learning from sponsorship adverts

The owner requested relevant learning links beside roles and a view of skills recurring in sponsorship adverts. `/skills` now provides an evidence-linked sample, employer-sector filter, **17 topics / 15 primary-provider resources**, prerequisites/access terms, practice projects and an explicitly unsaved copyable plan. Current job pages expose matching topics and exact advert excerpts. Application Studio's existing private learning notes remain separate.

The read-only API includes current offered/conditional adverts with sponsorship evidence from approved, unpaused sources, excluding expired/stale/inactive roles and advert holds. It deduplicates exact URLs per source, counts each skill once per role and shows employer-source diversity, unmatched coverage, concentration and observation time. Counts expire within five minutes or sooner at a deadline/freshness boundary. No AI, private applicant input, source fetch, enrolment, paid plan, new schedule or schema migration is involved. These are skill mentions, not required-skill classifications, UK-wide trends or sponsorship guarantees.

Primary resource pages checked **20 October**, recheck due **20 November**. Overdue resources lose their outbound links and are marked for review. Optional certificate/software/infrastructure costs are separated from free reading. This is curated coverage, not an autonomous course monitor or proof of course effectiveness. Read `docs/SKILLS_AND_LEARNING.md` for limitations and next acceptance.

## Validation

Five new tests cover substring/ordinary-language noise, negation/training contexts, exact bounded quotations, resource expiry, duplicate/count/concentration behaviour and actual isolated D1 queries for holds, release timing, pauses, freshness, sectors and oversize selections. Database-side description suppression prevents fetching oversized text only to reject it later. No partial ranking is returned.

The first broad run exposed a browser-CSS import crossing the server job renderer; learning is now supplied through a client-only view slot, preserving existing server rendering and the deferred asset boundary. Final **734/734 tests** pass on pinned Node 24.19.0. Fictional browser QA verifies topic selection, source excerpts, sector filtering, plan copying, unknown counts on snapshot failure and no React match for an explicit no-experience-required sentence. At **390 pixels**, document width is **390** and a skill card is **358**. Temporary tab/server and viewport override were removed.

TypeScript/build, **19 public prerenders**, unchanged browser budgets and Worker dry-run are required before deployment. Existing same-day dependency review applies to the unchanged dependency graph: zero high/critical, three known moderate entries. No install/downgrade. Storage briefly fell to 280 MiB, then recovered above 2 GiB without deletion; build/runtime checks were made after recovery. Personal files, recovery archive and `outputs/` were preserved.

Same-day production recovery at **16:19:46.010 UTC** already verified the exact D1, current recovery point and **43 migrations / 182 objects**. No schema changes in this release and no repeated restore/drill. Compatible code rollback: **2.89.0 / Worker 4fa5281d-0b39-43e7-b025-a528259a67a8**, runtime `4368dd0c8c5079cd62a62cf37fee8f5dbb436710`; retain all database history.

At **16:37:54 UTC**, the new reader over production public job data returned **54 adverts / nine employer sources / 38 matched / 16 unmatched**, with largest source **31**. Python appears in **21 adverts / six sources**; SQL in **12 / one**. Manual examination of returned excerpts confirms why these must remain labelled mentions: some describe the team's stack or company background. This is a dated limited-sample observation, not independent semantic validation.

The new scope is saved in the standing contract, growth plan and existing daily automation. Automation identity, target, active status, schedule and other controls were preserved and read back; the broad Goal remains active and other projects are not resumed. Deployment, original hosted-check annotations and live acceptance are recorded after completion.

## Publishing handoff, 20 October

Build, 19 prerenders and dry run passed: initial JS **390,965 bytes / 119,418 gzip**, CSS **109,950 / 22,776**, all within existing ceilings. Runtime commit **311ebedc921ca125f54907833ce3827a92a424e1** is pushed. Hosted Linux checks **118757755167 / 118757715696** were billing-blocked before execution; original annotations inspected. GitGuardian **118757772954** passed.

Deployment failed at the Cloudflare asset-upload-session request with authentication code 10000, before any new publication. Latest deployment and excluded health independently remain **2.89 / Worker 4fa5281d-0b39-43e7-b025-a528259a67a8**. A same-scope OAuth renewal reached sign-in; continuing explicitly accepts Cloudflare subscription terms, so required owner confirmation is pending. No expanded scopes were requested. Local implementation, tests and the candidate production-data query are not live-feature acceptance.

Read-only preservation at **16:48:43 UTC** versus **16:43:05 UTC** finds twelve unchanged operational groups, including all controls, social states/receipts and AI allowance. Business history advanced to the genuine hourly **business-497920**, and source reservations rose from 384 to **392/500**. AI remains two starts/eight calls. No forced refresh, model/Google request, email, social post or application was made. The new API has not yet been publicly exercised; complete deployment and owner-excluded live QA after the agreement handoff.
