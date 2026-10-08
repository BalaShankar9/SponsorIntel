# Sponsor Intel 2.23 — source deadlines enforced between refreshes

Known vacancy deadlines are retained and checked whenever the current collection is read. Passing a deadline removes a role from search results/counts, sitemap, current business snapshot and live agent candidate selection without needing a feed refresh. A direct link retains the advert with a deadline-passed notice and noindex; save/preparation controls pause. Personal application notes and documents remain unchanged. Employer briefs no longer present expired adverts as current evidence.

A date-only source deadline expires at the following midnight in Europe/London, including the spring/autumn clock changes. The interface displays the source date and explains that no time was supplied and the employer may close earlier. Explicit zoned timestamps retain their precision and convert to UTC. Invalid/ambiguous dates, impossible calendar dates and timestamps without a timezone fail ingestion; no deadline is inferred from publication dates or advert age. Unknown remains unknown. A genuine source extension can restore current status. The existing 72-hour observation limit still applies.

## Data and deployment

Additive D1 migration 0019 adds source `application_deadline` and canonical `closes_at`. Publication retains them in the existing atomic source transaction. The reviewed backfill derives deadlines only from known university-source text and guards the exact original description before updating; it changes neither observation timestamps nor active flags. It cannot overwrite a concurrently changed advert or a populated deadline. The source pipeline continues under existing schedules/limits, with no additional source or model call needed for expiry.

Pre-migration Time Travel bookmark: `000002a7-00000000-000050fe-a7a6c85def13ea64be5d810feba3aabb`. For code rollback, retain the additive columns and observations. A rollback to 2.22 removes read-time deadline protection; do not silently claim that protection is still active. Never restore the whole database merely to undo this release, because that could replace newer customer work and execution receipts.

## Verification

271 local tests pass, covering clock changes, leap years, explicit offsets, invalid dates, exact cutoff boundaries, unchanged source observations/workspaces, employer extensions, list/detail/sitemap/business/research consistency and guarded backfill replays. Server-rendered expired pages retain readable evidence and use noindex. Typecheck, production build, 17 public prerenders and Worker packaging pass.

Production and local runtime acceptance are recorded after deployment below. Historical insight versions and frozen research reference snapshots are not retroactively rewritten; their counts remain dated observations. This release does not prove that an advert stays open until its stated deadline, guarantee employer responsiveness or broaden sponsorship claims. JobPosting structured data remains withheld because other required source fields are incomplete.

Live 2.23.0 Worker: `fa395fd1-141d-4afe-a593-3b487b711617`. Migration 0019 applied successfully. All 75 stored university adverts received reviewed deadlines (72 active, three already inactive); readback verified every deadline and unchanged first/last observation timestamp. The current collection remains 887 roles across 32 sources. All 12 public opportunity smoke checks pass. A Nottingham role visibly shows 8 October as its supplied closing date; an expired Bath role has the deadline-passed notice, noindex and no sitemap entry.

Isolated local Workerd/D1 acceptance used one fictional advert with a two-minute deadline: before expiry it was listed/indexable; after expiry counts became zero, the sitemap excluded it and its retained detail page became noindex. The same open browser tab disabled both save and prepare, displayed the notice and changed its robots metadata without reload. No source refresh, remote AI/service binding or observation mutation was involved. Runtime evidence is in `tests/evidence/deadline-runtime-2026-10-08.json`; production readback is in `tests/evidence/deadline-production-2026-10-08.json`.

Scheduled business run `business-497619` completed at 03:45:39.549 UTC during the initial 2.23 deployment. The shared AI budget still records four starts and six calls for 8 October; this release made no model call or allowance change. New campus scheduled ingestion at 06:30 UTC, successful Google reporting on the next eligible day, and actual application-model comparisons remain unobserved.
