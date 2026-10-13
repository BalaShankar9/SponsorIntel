# Sponsor Intel 2.72 — recover a feedback receipt after a lost response

A report could be saved while its acknowledgement was lost. The previous form then invited a retry that inserted another report and consumed another hourly slot. The isolated actual Worker/D1 regression reproduced this before the repair.

New forms give each submission an opaque random request identity. The server binds it to the validated message, category and privacy-filtered context. An identical retry returns the original receipt, including after a network or hourly-bucket change; changed content cannot overwrite that report. New report admission and its quota slot commit in one D1 batch. Concurrent duplicates consume one slot, competing distinct reports cannot exceed the existing five-per-hour ceiling, and a failed quota write rolls back the report. Replays return only the existing receipt, never messages or review notes.

After an uncertain result, the form retains the exact request in memory, freezes edits and offers **Check saved report**. It does not automatically retry. A confirmed validation/rate refusal allows editing; a confirmed save permits a fresh report. No account, CV, search term, raw IP, screenshot or new model input is attached. Closing/reloading the form does not retain its in-memory retry identity; the UI asks the user to keep it open. Older cached forms remain supported but cannot recover a receipt without a request identity.

Migration 0040 adds nullable request-key/hash fields and a unique partial index. Existing report text, support routing, review history and privacy remain unchanged. No model, source, social, email, Google or customer-workspace action is added. The support queue still requires evidence-backed review; this is reliable intake, not autonomous bug repair or customer reply delivery.

## Validation

- All **640 tests pass**, including actual isolated Worker/D1 lost-acknowledgement, same-key concurrency, last-slot competition, changed-content refusal, cross-network replay, replay after quota exhaustion and transactional rollback checks. Provider egress is prohibited; records are fictional.
- The actual FeedbackForm was browser-tested against the isolated Worker: the first response failed after persistence, fields stayed intact/locked, and Check saved report returned the same reference with exactly one report/one quota slot. Receipt focus worked, and the 390-pixel layout had no horizontal overflow. The error wording was subsequently clarified; the final build includes it.
- TypeScript/build, 17 prerenders, browser budgets and deployment dry-run pass. The dependency graph is unchanged; the successful same-day audit remains applicable. No new customer document or synthetic production report was used.
- Before migration the exact recovery-point inspection found only the intended table alteration and missing index relative to the 40-file working schema. The applied 39-migration schema is separately checked against that receipt before proceeding. Recovery/schema agreement is not a customer restore or retention-window test.

## Deployment and rollback

Pending live verification. Stage the new API with the previous UI assets first, creating a rollback version that retains retry handling. Only then deploy the new form. A plain 2.71 rollback would ignore a new client's request key and could duplicate a pending report; it is not the preferred rollback. Preserve additive migration 0040 and all later records and reservations. Do not restore the database.
