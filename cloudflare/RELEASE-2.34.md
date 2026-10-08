# 2.34 — Make application exports visible and recoverable

Application Studio now prepares a named Word, PDF or plain-text file and shows a persistent explicit download link. It announces preparation, readiness and errors without claiming a file was saved. Editing the document, changing its name or switching application/document invalidates the old link; a generation finishing after an edit or unmount cannot publish an outdated result. Object URLs are released after replacement/unmount instead of disappearing after a three-second download attempt.

The old Word button returned silently. A normal browser download observation timed out without a UI or console error. The new explicit link was confirmed visible and still available after another observation timeout. These timeouts do not establish that Chrome failed to save a file; browser-to-filesystem delivery remains unverified. No internal browser downloads page was opened and no blocked inspection was retried. The release addresses visible preparation and recovery, not an asserted root cause for the tool timeout.

## Verification

All 355 tests pass, including four new checks against actual generated document bytes: Word paragraph/Unicode preservation; multi-page PDF exact text order and page bounds; explicit refusal when the PDF font cannot cover a name; and failed-font handling. Word preserves the Telugu test name. No AI generation, personal CV, customer record or external service was used in these new checks.

The release build was served in the isolated local Workerd/D1 runtime. A fictional application exercised Word and PDF readiness, invalidation on edit, the unsupported-character warning and a successful plain-text fallback. A 390px viewport showed scrollWidth=390 and readable controls; the override was reset. Existing production account/workspace data was not altered for these checks.

The real application generator also produced a two-page PDF and Word document from the same fictional 16-item fixture. Both PDF pages and both pages of the bundled LibreOffice Word rendering were visually inspected. All paragraphs, accented characters, the pound sign, section labels and final marker remain readable without clipping or overlap. This is export fidelity, not an evaluation of AI application quality or employer response.

TypeScript/build, 17 prerenders, browser asset budgets and Worker dry-run pass for this deployment. No migration, dependency change, AI-budget reset, production model call, Google retry, social send or extra owner email is part of this release. The exported files stay in the user's browser; no new document service is added.

## Live and scheduled verification

Worker `6c610352-adac-4bed-bc16-8c4200c1af60` is live at the custom domain and `/api/health` reports 2.34.0. Rollback Worker `8347567d-57a8-4d61-a34e-70d22d4b0f7f` retains all operational integrations; preserve later database/queue activity. Initial public JavaScript is 407,751 bytes (124,463 gzip); owner code remains deferred. In the authenticated live browser, the owner's existing saved draft produced a named Word file and visible download link. Its content was not edited or copied into evidence, no AI call occurred and no new cloud record was fabricated. The browser save receipt remains unverified.

Genuine scheduled run `business-497625` started at 09:45:38 UTC on 8 October and completed at 09:45:54.033 UTC. All five HTTP/header checks passed. The jobs content check found 12 visible cards against 885 current roles and a fresh snapshot. The social-delivery snapshot recorded four checked receipts, one publication, three schedules, zero overdue/uncertain/invalid records and no truncation. This closes the first genuine hourly-collection gates for 2.32 and 2.33. Both email queues were empty; actual provider lifecycle events remain zero. Findings had no high-priority issues.

The real 09:45:38.509 UTC alert scan checked one owner without sending mail. Shared research usage remains four starts/six calls. This business run reused existing held/no-post/failed-day receipts, without another Google request, model call or external post. Full editorial publishing, model quality, email Inbox placement, export save receipts and business outcomes remain open. Hosted CI is separate from local validation.

Evidence: `tests/evidence/document-exports-2026-10-08.json`, `tests/fixtures/export-document.txt`, and `tests/evidence/scheduled-operations-2026-10-08-0945.json`.
