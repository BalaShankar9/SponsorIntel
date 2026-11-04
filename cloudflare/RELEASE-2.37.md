# Sponsor Intel 2.37 — trustworthy usage measurement

Deployed 8 October 2026. Worker `a2bdc8af-91d9-40dd-9aa7-fc8e5e04816e` is verified at sponsorintel.london. Additive migration `0024_public_measurement.sql` establishes a separate baseline at **11:57:33.807 UTC**; it does not rewrite older counts. Previous production Worker: `153aa785-d64f-495d-9c8a-edea0d27805a` (2.36).

## Result

Previously, owner QA contributed to page/campaign totals and every successful preparation response counted as an application generation. A clarification from the immigration assistant also counted as an answer. Those mixed totals could hide a lack of real customer activation and mislead growth planning.

New aggregate collection excludes authenticated owners and declared QA. Owner identity is checked against the existing role table and never stored in analytics. A fresh owner sign-in is excluded using the bounded successful authentication result, even before its new cookie arrives. Uncertain identity lookups fail closed for measurement; they do not turn a successful customer feature response into an error. Anonymous operators and bots cannot be reliably identified without additional tracking and may remain.

Only successful CV and cover-letter results count as `document_prepared`. Evidence reviews, company research, interviews and learning/portfolio plans count separately as `preparation_completed`. Validated `answered` guidance is separate from `clarify`/`insufficient`; this does not establish independent legal accuracy. Server-created metadata supplies these classifications, is stripped from the public response, and requires no reading of CVs, adverts, questions or generated documents by analytics. Only the bounded authentication result is inspected for an exclusion identity. A request cannot declare its own conversion event. Public totals and campaign totals are written atomically.

The owner dashboard shows the dated new baseline, distinguishes non-owner account counts, retains the earlier mixed totals in a historical section, and labels the limits of preparation and guidance events. Registered-account administration still includes owners. No analytics cookies, visitor IDs, private search dimensions or browsing histories are added. Both aggregate tables retain the existing 90-day policy.

Business and new marketing snapshots read only the new table and complete UTC days after the partial starting day. The first full day is **9 October**, available after **00:00 UTC on 10 October**. Until then, the business desk shows a waiting state rather than interpreting zero as failed activation. Old immutable run/context receipts remain historical. This is an event baseline, not customer conversion, saved-file, application-submission, employment or revenue evidence.

## Verification

- **380 tests pass** on Node 24.19.0, including the real Worker/auth/D1 path in isolated local Workerd with fictional owner/member accounts, zero remote bindings and no outbound calls. First owner sign-in, existing owner session, anonymous preparation, member signup, declared QA, failed generation and private-content exclusion are exercised. Additional tests cover atomic failure, old/partial-day exclusion in both agent inputs and separate guidance outcomes.
- TypeScript/build, all 17 public prerenders, browser asset budgets and Worker dry-run pass.
- The migration was the only pending production migration and applied successfully. Live health reports 2.37.0; anonymous owner access returns 403 and GET metrics returns 405.
- One explicitly declared HTTP QA event and browsing jobs in the existing signed-in owner browser added **no new public counts**. The legacy totals remained exactly unchanged. The live campaign dashboard, preparation labels and waiting state were verified. No fictional user, model output or customer event was inserted into production.
- The existing daily routine was updated and its saved content read back, preserving its schedule, target, limits and previous instructions. The app removes the final trailing newline only. It now requires authenticated/declared QA, separate baselines and genuine scheduled evidence.

Aggregate receipts are in `tests/evidence/measurement-2026-10-08.json`. No production AI call, Google retry, email test or social publication was used. No permission, subscription or spending allowance changed.

## Remaining evidence and rollback

The next genuine business run at 12:45 UTC and next eligible marketing context must confirm unattended use of the new baseline. These are still pending; a browser check or local runtime test does not establish them. The 12:30 UTC scheduled source collection for 2.35/2.36 remains separately pending. Actual users, reliable external delivery, independent application/advice quality, Google reporting and business outcomes remain open.

GitHub hosted checks remain subject to the account billing lock; current-commit results must be checked separately. The three moderate Mammoth/argparse/sprintf-js findings remain.

Code can roll back to 2.36 without dropping either analytics table or restoring production data. Keep the boundary and later customer/operational state. A rollback would resume old mixed collection and create a gap in the new baseline; flag affected days as incomplete and do not treat them as zero usage. Do not delete counters or modify immutable receipts to make a trend look better.

Follow-up acceptance: original source run `scheduled-1791462638000` completed at 12:32:38.370 UTC, and original business run `business-497628` at 12:45:57.218 UTC with measurement version 2. Both platform statuses are complete. See RELEASE-2.38.md; the next eligible new marketing context remains unverified.
