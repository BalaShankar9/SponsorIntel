# 2.79 — Refresh review data without closing drafts

After configuring an employer source, the owner dashboard's Refresh button updated only its main response. A previously visited Advert reviews desk kept its old source choices until a full page reload. That reload discarded unfinished review forms. A temporary dashboard read failure also unmounted every visited desk.

Successful dashboard reads now notify both Jobs & reviews lists, including after employer-source actions. The lists reload their own read-only data while retaining the selected review, original revision, form values, search draft, dates and history. Advert reviews also has an explicit refresh button and a visible error when its own read fails. No refresh approves a source, saves a review, clears a hold or triggers a source/model workflow.

Transient dashboard failures retain the last loaded data and open desks with a clear warning. HTTP 401/403 responses still remove the private dashboard, including non-JSON access errors. Per-request generation guards prevent late list/dashboard responses replacing newer data. Existing optimistic save guards, request replay and immutable review history remain unchanged; refreshing does not silently rebase an open decision onto a newer saved revision. Unsaved drafts are still in memory, not a recovery copy across page reloads or sign-out.

## Validation

- **671 tests pass**, zero failures, on pinned Node 24.19.0. TypeScript, production build, 18 prerenders, browser budgets and Worker dry run pass. No dependency graph, schema, research contract or model configuration change.
- Actual owner components were exercised in a loopback-only fictional fixture. Dashboard refresh exposed the newly configured source and refreshed discovery totals while preserving both unfinished forms, the search draft, selection and observation timestamp. Refresh from Sources updated the already visited Jobs desk without remounting it.
- Separate dashboard/list failures retained drafts and last loaded data with errors; subsequent successful reads recovered. JSON 403 and HTML 401 responses removed the private desks. An intentionally delayed older advert-list response did not replace a newer result. The fixture rejects writes; no fictional record entered production.
- The 18 October dependency audit remains zero high/critical and three known moderate Mammoth-chain entries; package-lock changes only the app version. The same-day 00:05:57 UTC recovery receipt confirms the exact production database, current recovery point and 40 migrations/166 objects. No restore, export or retention-window claim.

Compatible rollback: **2.78.0 Worker `6e78a4ae-f61a-4299-a86b-97fcefdb8ce9`**. Existing data, holds, schedules and reservations remain. Deployment and live readback must be recorded separately; the next genuine college collection is an independent sourcing gate, not a result of this UI repair.
