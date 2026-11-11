# Marketing schedule-record recovery — 11 November 2026

Prepared locally; **not deployed**. The owner desk's separate schedule form could lose an uncertain request when a desk refresh changed the brief's state/revision or omitted its card. A later definitive rejection of a retry could also clear the earlier unknown outcome. This repair closes those client recovery gaps using the existing authenticated immutable ledger. No production data-loss incident or provider delivery is asserted.

## Behavior

The parent card retains the reviewed brief, destination, artwork and exact serialized schedule request through a desk refresh and latest-50 omission. Original request identity, provider reference, observation/schedule times, evidence and ordered media hashes remain unchanged. A synchronous card lock prevents an editorial decision and schedule observation from both starting before React renders the disabled controls.

A later access, rate-limit or stale-revision rejection preserves the earlier uncertain request. A definitive first rejection releases the form but clears both the content/account and artwork attestations, requiring renewed checks before a new request. Unsent forms still reset when the reviewed revision changes. Replaying a committed schedule after a newer delivery observation confirms the original event without replacing the newer state or receipt.

Acknowledgement and refresh are separate. A failed read after an acknowledged write retains the saved state and offers **Refresh saved schedule**; that action reads the desk without another save. Pending state remains in tab memory, not durable storage. Leaving/reloading still requires inspection of the original ledger and provider job before another decision.

This is record recovery only. It never schedules, sends, cancels or independently verifies a provider post, and changes no authentication, server transition, schema, review authority, allowance or publishing permission.

## Validation

The isolated export starts at `ebf035776875fb58e455683eb12b3f6174223fd5` plus the owned repair. Two new tests use actual ledger functions and isolated SQLite to preserve exact request/history through lost acknowledgement, later rejection, newer publication and expiry; changed actor/content cannot reuse the original key. All **906 tracked-source tests** pass with zero skips/cancellations. TypeScript/build, **21 prerenders**, browser budgets and deployment dry run pass on pinned Node **24.19.0**.

The actual Marketing desk and real isolated ledger pass **13 browser checks / 12 fictional scenarios**: committed lost acknowledgement, refresh, omitted cards, later 403/429, newer publication, renewed attestations, preserved original artwork after a later media-free revision, failed-read refresh only, unsent revision reset, same-turn cross-form actions in both orders and a 390-pixel keyboard retry. Access/rate-limit failures are injected fixture responses, not real authenticated account tests. The existing non-schedule regression harness also passes **15 checks / 14 fictional scenarios**. No external page/server request, real provider call or browser exception occurred; owned browsers and fixture servers closed.

The first schedule harness run used an exact label-text selector that also matched React's textarea contents; diagnostic inspection confirmed the original note remained present through refresh. The replacement uses the exact accessible textbox name. The first regression run hit Chromium's normalization of zero seconds (`18:09:00` to `18:09`); both harnesses now omit only trailing zero seconds without changing the intended time. Original failed logs/receipts and the diagnostic are retained, alongside final runs. No product change was needed for either harness issue.

The same-day dependency/advisory result is reused only because package and lockfile hashes remain unchanged from the tested XML parser patch. No install or dependency change was needed. Unrelated worktree edits and the private local-state archive are preserved.

Aggregate receipt: `../cloudflare/tests/evidence/marketing-schedule-recovery-2026-11-11.json`. Raw fictional histories, screenshots and logs remain in ignored `cloudflare/data/marketing-schedule-recovery-2026-11-11/`. Agent-assisted source/test review found no further blocking issue; this is not independent real-world delivery acceptance.

## Release boundary

This validates prepared **2.99.0** only. The last verified production release remains **2.98.16**, with today's D1 capacity failure, incomplete current recovery/schema and unresolved original business-workflow evidence. The prior isolated live-source directory is unavailable; this combined branch is not an exact 2.98.16 deployment candidate. Do not deploy it wholesale.

No production database/read probe, migration, deployment, new source collection, model/Google call, social/email send, application or private-saving activation occurred in this repair. The company-directory enrichment and live-integration gates remain open. The broad resumed goal remains active.
