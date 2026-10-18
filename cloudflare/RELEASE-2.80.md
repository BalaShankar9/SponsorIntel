# 2.80 — Keep salary headings with their amounts

Lecturer Carpentry's complete stored advert says “Full time equivalent salary” followed by £33,400–£52,100 and qualification conditions. The extractor discarded the heading and failed to recognise the separate amount, leaving the pay panel blank.

A small explicit set of pay headings now stays with its immediately following monetary lines. Adjacent junior/senior/staff bands keep all their labels and currencies; FTE and actual salary headings remain separate. Context stops at other text or a benefit budget. Work fractions and foreign-only amounts cannot supply a UK salary. The detail page explains full-time-equivalent pay without calculating earnings, inventing a pay period, selecting a true range or assessing visa eligibility. Existing limits on excerpt length and number still apply.

The ingestion list marker and shared client/server detail renderer use the same extractor. Detail pages change immediately from their retained complete descriptions. Stored list markers, salary-filter counts and snapshots only change after a later normal successful source refresh; no backfill or forced workflow is part of this release.

## Validation

- **676 tests pass**, zero failures, pinned Node 24.19.0; 29 focused tests cover exact observed wording, full DfE extraction, separate actual/FTE figures, hourly pay, multiple bands, benefit/foreign/fraction exclusions and rendered server HTML.
- TypeScript, production build, 18 prerenders and browser budgets pass. Worker dry-run and deployment/live readback are recorded in `tests/evidence/pay-headings-2026-10-18.json`.
- Read-only replay of **979 current adverts** changes 16 pay excerpts and recovers pay on five: 169 to 174 with detected pay. Every previously detected quote remains represented; none loses pay evidence. Fourteen adverts carry the explicit FTE explanation. No production record, sponsorship label, review or source timestamp was changed by the replay.
- Same-day exact database/recovery-point/schema check remains applicable: 40 migrations/166 objects. Dependency graph is unchanged; the 18 October audit remains zero high/critical and three known moderate Mammoth-chain findings.

Compatible rollback: **2.79 Worker `7989d0f7-9125-4624-9b8f-7c30a6de57eb`**. No migration, data restore, approval, hold, workflow, budget, model or external publishing change. Local checks do not establish hosted Linux execution or independent model quality.

Live **2.80.0**, Worker **7840cbd7-0c53-443e-b116-69082e1567a2**, runtime commit **4aa3cb14608e3dcd4fc3a01984b0dc608d23a208**, excluded health verified **18 October 00:51 UTC**. Owner-authenticated browser checks confirm the Carpentry range/conditions/FTE explanation, separate Maths FTE/actual figures and all three Sampura salary bands. The temporary check tab was closed. All fourteen selected operational groups match immediately before/after deployment, with no foreign-key errors. No source timestamps, reviews, schedules or budgets changed because of the deployment.

Runtime-head Linux checks **117547463767/117547456712** were blocked before execution by account billing; original annotations inspected. GitGuardian **117547458594** passed. Final documentation-head checks remain separately recorded in PR 1. Next genuine source refresh must prove stored list-marker updates; this release does not force it.
