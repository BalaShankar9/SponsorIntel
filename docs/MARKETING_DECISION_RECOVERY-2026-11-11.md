# Marketing decision recovery — 11 November 2026

Prepared locally; **not deployed**. The existing owner desk could commit a hold, review or delivery observation and then lose its response. A retry generated a new request key and observation time. The server correctly rejected the stale revision, but the form could not confirm its original saved decision. This was reproduced with the real ledger functions and fictional records; no production failure or lost customer record is asserted.

## Behavior

The form now retains one exact serialized request until acknowledgement. Repeated clicks cannot create parallel requests. An unknown result freezes the original brief, destination, notes, checks, provider reference and observation time in the open page. A desk refresh, revision change or omission from the latest 50 rows cannot discard that pending card. The retry repeats only the original ledger request; it never calls a social provider.

A subsequent authentication or rate-limit rejection cannot establish the earlier save's outcome, so the original request stays held. A first definitive rejection allows correction and clears the prior review attestations. Acknowledgement is distinct from refresh: a failed read after success offers only a refresh action. Once refreshed, the form resets from the latest receipt, preserving a newer concurrent observation. Existing schedule forms retain their prior revision-reset behavior and schedule-to-delivery controls remain usable.

Pending requests remain in tab memory, not durable storage. Leaving/reloading the page still requires ledger/provider reconciliation before a new decision. This repair does not extend the separate schedule form's pending-request lifetime, claim automatic provider verification, or change authentication, server transitions, schema, review authority, limits or publishing permissions.

## Validation

- Seven focused tests reproduce the old new-key failure and the corrected exact replay using actual ledger functions and isolated SQLite. They preserve one event/receipt/revision and original timestamps, cover all six decision kinds, and distinguish malformed/foreign acknowledgements, storage/network uncertainty and definite input rejection.
- Fifteen browser checks across fourteen fictional scenarios exercise the actual Marketing desk and real local ledger. They cover committed lost acknowledgements, global refresh, omitted cards, later 403/429 rejections, read-after-write failure, self-review rejection, rapid clicks, newer concurrent evidence, schedule transitions, revision resets and a 390-pixel keyboard flow. No external page/server requests or browser exceptions.
- All **876 tracked-source tests** pass, with zero skips/cancellations; TypeScript/build, **21 prerenders**, browser budgets and deployment dry run pass on pinned Node **24.19.0**. The isolated export uses tracked head `e83019a7f4388b11fa12adc341a7bf7a761398c3` plus this bounded change. Existing unrelated worktree edits are excluded.
- The same-day dependency/advisory result remains applicable: package and lockfile hashes are unchanged from the tested XML patch. No install or dependency change was made.

The first three browser harness attempts are retained: an overly broad selector, Chromium transparently retrying a socket-reset POST, and an incorrect fieldset-disability assertion. The final fault uses an unreadable post-commit gateway response so uncertainty is exercised reliably. These harness corrections are not hidden production failures or passing runs.

Receipt: `../cloudflare/tests/evidence/marketing-decision-recovery-2026-11-11.json`. Raw fictional request histories, test logs and failed harness receipts remain in ignored local data. The browser/server are closed. Agent-assisted code review identified the retry-rejection, stale-attestation and schedule-reset cases; they were corrected before final validation.

## Release boundary

This validates prepared **2.99.0** only. Production remains at the last verified **2.98.16**, with today's D1 capacity failure, incomplete current recovery/schema evidence and unresolved original business-workflow outcomes. The exact prior isolated runtime source is still unavailable. No Worker deployment, migration, production ledger write, source collection, model call, Google request, provider schedule/send, email or application was performed by this repair. Do not deploy the combined branch wholesale.

The 17:14 UTC provider-only source listing still returns only the overnight original run; no afternoon instance appears. Its absence cause remains unknown, and no workflow or budget was reset. The new local repair is concrete progress toward reliable operations; it does not clear the company-enrichment or live-integration gates.
