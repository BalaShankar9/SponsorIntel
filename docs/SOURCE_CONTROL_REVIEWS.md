# Reviewed source controls

Release 2.86 adds immutable owner decision history and version checks to the existing source pause/resume form. A pause hides that source's vacancies; a resume only permits a later complete successful collection to make them current again. It never clears advert holds, source approval, identity, catalogue, rights or allowance checks.

Before changing a source, inspect its current reason, decision history, original source failures and relevant employer review. Follow `DAILY_OPERATOR.md`; a new date or elapsed follow-up does not clear a hold. Include agent assistance in a reason when the review was performed through the owner account by an agent.

- Save uses the decision version visible when the form was opened and a unique request identifier. A newer decision rejects the stale request. The form retains the typed reason; explicitly review the latest saved decision before a new submission.
- An interrupted response preserves the exact request. Use **Retry same change** to retrieve its receipt before making another decision. Replaying an old resume after a later pause reports the current paused state and cannot repeat the resume.
- History, current control, affected job visibility and audit commit together under the existing source-operation lease. Concurrent edits or loss of that lease cannot partially record a decision. Collector failure/cooldown metadata has a separate role and does not create a reviewed owner decision.
- The owner desk shows the five latest decisions and total count. Private reasons and actor identities are excluded from coordinator inputs; actor IDs are also excluded from displayed history responses.
- Migration 0041 preserves earlier pauses, reasons, actors, timestamps, cooldowns and failures. They begin at revision zero with no fabricated history. The first new decision retains the prior saved reason/state/record timestamp; it does not claim that record timestamp was the original review time.
- Recorded decisions cannot be edited/deleted. Database guards prevent a legacy Worker from overwriting a control after its first recorded decision. Revision-zero inherited controls are not retroactively protected as recorded decisions.

PortmanDentex remains paused under its 9 October decision. This control repair does not resolve the missing historical mismatch evidence, validate its expired private cache or approve a resume. No real source change is needed to test these controls; use the isolated fictional fixture and actual Worker/D1 tests.

Worker rollback retains migration 0041 and its history. The compatible prior runtime is 2.85.0 (`bd4a4df5-e501-47ed-9900-9dba2d1f952e`), but its older source-control form/API lacks versioned requests. Database guards reject changes to recorded controls; inherited revision-zero controls retain the limitation above. Prefer a forward repair and never remove review history to make an older form work.
