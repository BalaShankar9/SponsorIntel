# Browser evidence-check measurement

“Evidence & gaps” runs locally in Application Studio. Its use was not collected by the server's preparation-response counters. Do not infer past local adoption from those counters or backfill it with invented values.

Release 2.60 adds a fixed `local_evidence_check` report after the local result is prepared. It records one daily total and, when available, one recognised campaign subtotal. The action is browser-reported: it does not verify a cloud save, file download, application submission, unique person, AI quality or conversion. Reporting may be blocked or lost while the feature itself works. Repeated deliberate clicks may count again. No retry mechanism or visitor identity is used.

Only the fixed action, `/studio` and an optional finite campaign ID enter the request. CVs, vacancies, outputs, account IDs and arbitrary query values are excluded from storage. Existing owner/QA exclusions, origin checks, body bounds, 120-request shared page-event ceiling and 90-day retention apply. Total and campaign rows are written together or neither is written.

Migration 0038 creates `analytics_evidence_daily` and the separate `analytics_browser_evidence_v1` metadata boundary. Before a full post-activation UTC day has ended, the count is **null/waiting**, not zero. Missing, malformed or future metadata is unavailable. The owner panel uses the selected period excluding today; business and marketing retain their respective 14-day and seven-day complete-day windows. Campaign counts are included in the overall total and must not be added to it. Existing version-2 page/server metrics keep their original boundary.

New immutable marketing contexts carry the separate measurement under `measurement.browser_evidence`, governed by policy `sourced-guides-and-browser-evidence-v5`. This adds no model call and does not change topic eligibility, publishing cadence, source expiry, permissions, pause controls or daily allowance. Prior contexts stay unchanged. A future context containing the new field, a model decision using it, and a real business improvement require separate evidence.

Verify regressions through `browser-measurement.test.mjs` and the actual Worker/auth/D1 measurement test. Browser acceptance uses only fictional local workspaces. Production QA must be owner-authenticated or declared excluded, and must not manufacture customer events or reset counters. A code rollback preserves the additive aggregate table and its dated records. Follow the recovery runbook before any migration or restore.
