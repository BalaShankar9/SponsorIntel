# Sponsor Intel 2.16 — safe agent supervision

8 October 2026 (Europe/London). Interrupted research/editorial executions could leave an application record active and block later work. The hourly business workflow now checks unfinished records older than one hour and closes them only when Cloudflare confirms `complete`, `errored` or `terminated`.

## Behaviour

The supervisor preserves evidence, call reservations, draft versions and owner decisions. An unfinished proposal still authored by that marketing run is held. Owner-reviewed or owner-revised copy is preserved. Paused, waiting, still-running, missing and unknown platform outcomes remain retained and appear as actionable business findings. Terminal application records cannot be resurrected by a late research completion or marketing draft write.

Recovery and its receipt commit together; replay reuses the receipt, including after a lost acknowledgement. Platform reads have a ten-second deadline. Global and editorial pauses remain effective. The supervisor does not call a model, restart a workflow, reset allowance or publish socially.

Each new business run records its actual dispatcher: scheduled or owner-triggered. Old records remain unknown. Replaying the same hourly ID preserves its original dispatcher, so a manual acceptance run cannot establish cron execution. The owner dashboard shows the origin and separate research/editorial supervision outcomes.

## Verification and production boundary

- **185 tests passed**, including 14 new recovery/origin tests. Cases cover all terminal/active/unknown states, concurrent changes, owner overrides, pauses, retained reservations, lost acknowledgements and duplicate recovery. The 65 targeted tests also passed.
- Production build/typecheck, 17-page prerender, generated binding types and final deployment dry-run passed. All migrations applied to isolated local D1.
- Isolated local Workerd ran a real synthetic workflow to `complete`. The production supervisor queried that binding and closed the deliberately unfinished synthetic research record with an atomic receipt, preserved zero call reservations and sent no model/social request. No production binding was present in this harness.
- Worker version `1e1afb18-2d91-4574-8655-2d77daf743a3` is deployed at https://sponsorintel.london. Live health reports 2.16.0 and anonymous business access returns 403. Desktop and 390px mobile layouts were checked; document width remains 390px. Screenshots are in the parent task's `outputs/agent-supervision-live.png` and `outputs/agent-supervision-mobile.png`.
- At verification, the latest production business run was `business-497615`, completed at `2026-10-07T23:45:39.477Z`, before this deployment. Its origin correctly remains unknown and it has no supervision receipt. **The first naturally scheduled 2.16 supervision run remains pending.** No owner run was started to substitute for this evidence.
- Existing shared allowance remains four runs/13 calls for 7 October UTC; marketing remains held with zero calls, and no research run is active. No model call, social post, permission or budget increase occurred in this release.

Receipts: `tests/evidence/agent-supervision-2026-10-08.json`. The full autonomy acceptance sequence and next external evidence checks are in `docs/AUTONOMY_ACCEPTANCE.md`.

## Recovery

Additive migration `0013_business_run_origin.sql` was applied remotely after obtaining bookmark `0000027f-00000000-000050fd-9ad1d54fd27310d54cfc25f83f840dcf`. No restore was performed. Previous code is `aeed4d3c-83bc-4438-9f8d-50d80b67d3e0`. Prefer pause or code rollback while preserving the new column, receipts and later user data. Inspect active workflows before any rollback; keep their classes/bindings available. Never restore the entire database over later customer activity to undo this additive change.

Implementation follows Cloudflare's [Workflow status contract](https://developers.cloudflare.com/workflows/build/workers-api/) and [durable workflow rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/). The terminal-status recovery test is operational evidence, not model-quality or end-to-end business evidence.
