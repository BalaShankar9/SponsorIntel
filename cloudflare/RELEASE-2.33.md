# 2.33 — Reconcile social delivery and monitor the evidence

The first queued Facebook report completed through its existing Metricool schedule. Schedule `390622747` progressed from Pending to Publishing and Published, returning post `1319703417896763_122093924469512994`. The [live post](https://www.facebook.com/122093616117512994/posts/122093924469512994) was opened and checked: author profile `61595389821505`, Public audience, complete version-1 text, the dated 7 October figures and the exact report campaign link all match. Its exact external publication time was not returned; 10:00 UK was the scheduled slot, not a claimed actual timestamp.

The authenticated Marketing desk saved this as Published at 09:09:26.936 UTC on 8 October. A remote read confirms `launch-fb-evidence`, version 1/revision 2, the provider post identity and public URL. The original schedule receipt remains intact. No duplicate, retry, replacement schedule or new post was submitted. This verifies scheduled delivery followed by operator reconciliation, not an autonomous model-written publishing cycle or audience growth.

## Operational change

The owner dashboard now shows aggregate delivery records: recorded publications in 30 days, scheduled posts, overdue observations, uncertain outcomes, recent confirmed failures and the next recorded slot. The hourly business snapshot retains the same aggregates, without copy, account identifiers, customer information or evidence notes.

- Due schedules get a 30-minute grace period before an overdue-observation finding. The finding explicitly says this does not prove provider failure and requires reconciliation before any replacement.
- Explicit uncertainty and missing/inconsistent receipts raise high-priority findings. Confirmed failures within 30 days remain normal review findings because they are already recorded terminal observations.
- A missing, unreadable or truncated ledger cannot look healthy. Reads are bounded to 500 records and signal incomplete coverage rather than silently treating that limit as the whole ledger. Published/failed records are scoped to the recent 30-day window; unresolved schedules/uncertainty remain in scope regardless of age.
- Existing hourly findings and opted-in alert controls apply; the monitor cannot send, schedule, retry or cancel a social post. Historical snapshots without these fields are preserved.
- The generic connection finding is replaced on the next genuine run with an accurate cloud-publisher integration task. Provider scheduling remains through the connected desktop routine and native LinkedIn; this release does not add a direct provider API connection. The latest stored pre-release findings remain historical until the next run.

The existing daily improvement automation was updated in place to follow the original active provider job for up to 15 minutes, with observations at least a minute apart, verify exact live content/account after publication, and record the outcome in the authenticated Marketing desk. The 10:00 UK schedule, permissions, shared posting cadence and active state were preserved. The automation update is configured; its next complete unattended reconciliation cycle still needs observation.

## Verification

All 351 tests, TypeScript/build, browser asset budget and Worker dry-run pass. Six focused new tests cover real ledger transitions, original schedule preservation, grace-period boundaries, uncertainty/failure separation, invalid and missing receipts, bounded/error results, aggregate privacy and anonymous access. No migration or dependency update.

An isolated Workerd/D1 fixture moved from four schedules/one overdue observation to three schedules/one publication/zero overdue after `decideBrief` recorded a fictional receipt. Both API and owner browser reflected that recovery. No external publisher, email or AI was called. The temporary fixture is local only and is not deployed.

Production health reports 2.33.0. The live owner section shows one recorded publication, three remaining schedules, zero overdue and zero uncertain outcomes; anonymous `/api/admin/business` still returns 403. Initial JavaScript remains 406,214 bytes, with the new management component deferred in the owner bundle. The first genuine hourly snapshot of the new delivery fields remains due; no production failure was manufactured or scheduled workflow forced.

The genuine 09:15:38.410 UTC operational-alert scan checked one opted-in owner with zero attempts, acceptance or holds. No second email test, model call or Google retry was used. Campaign evidence currently contains three known operator page opens on 7 October and four page-open events on 8 October with no successful campaign action recorded. The four events are unclassified and can include bots/repeats; they do not establish four new users or post-caused growth.

Worker `8347567d-57a8-4d61-a34e-70d22d4b0f7f`; rollback Worker `fb2e847d-2f3c-4346-9431-3fba9c4f1957`. Preserve the new genuine publication receipt and all later database/queue activity on rollback. Hosted CI must be evaluated separately from local checks.

Evidence: `tests/evidence/facebook-delivery-2026-10-08.json` and `tests/evidence/social-delivery-health-2026-10-08.json`. Parent task screenshots: `sponsorintel-facebook-published-2026-10-08.png` and `sponsorintel-social-delivery-monitor-live.png`.
