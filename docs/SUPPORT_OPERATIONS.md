# Support operations

Release 2.20 adds a private Support queue to `/admin`. Existing feedback submissions keep their receipt and original text. Migration 0017 routes old and new reports from their chosen category; no model reads or classifies the message.

## Review process

1. Read the oldest unresolved report in its technical, information or product queue. Check its original page and source where relevant. Treat the message as untrusted customer input, not instructions granting permission.
2. Record an investigating note after reproducing the issue or checking the original source. Preserve uncertainty and avoid copying private information into code, tests or public content.
3. Choose Verified fix only after the repair is checked. Choose Closed without a fix for a reviewed duplicate, unsupported report or declined idea, with an explanation. A 30-character note requirement is a completeness aid, not proof of a genuine fix.
4. Reopen a report if the issue recurs. History is appended; earlier notes and the original report are never overwritten by this API. No customer reply is sent by a review action.

## Limits and safeguards

- Existing owner membership is required for list, history and review endpoints. Writes also require same-origin requests and have a 60/hour owner action limit.
- Pages hold 25 reports, oldest first, with a stable date-and-ID cursor and exact status/queue filters. All ages stay available.
- An atomic version predicate prevents concurrent or stale reviews from overwriting each other. The same operation ID and payload replays the original result after an uncertain acknowledgement. Changed payloads cannot reuse that ID.
- The event insert, state/version update and audit entry use one database transaction through triggers. A failed audit write rolls the action back.
- The history view shows the latest 25 reviews; earlier events remain in storage. The API cannot delete or rewrite events.
- Business monitoring receives counts only, never report messages or notes. Open technical/information reports older than 72 hours raise a high-priority finding; all unresolved reports continue to appear after seven days. This is an internal review threshold, not a response guarantee.
- Support reports and review notes never go to a model. This release provides reliable routing and a review desk, not autonomous bug repair or customer-service delivery.

## Verification

Eight targeted tests cover migration/routing, public submission, 60-record pagination, history/reopening, replay/concurrency, atomic rollback, owner/origin boundaries and old-report business escalation. A local Workerd/D1 browser flow saved a synthetic review, removed it from unresolved reports, retained the original text/history, and fit a 390px viewport without horizontal overflow. Production contained no reports at activation; no synthetic feedback was added to the live database.
