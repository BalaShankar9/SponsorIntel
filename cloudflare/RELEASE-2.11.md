# 2.11 — private research agents

Released 7 October 2026. See `../docs/ADVANCED_AGENT_SYSTEM.md` for the architecture, model shortlist and next acceptance gates.

## Behaviour

The owner dashboard now contains a Research Lab. Its investigator chooses approved source/job tools over multiple turns, fetches fresh employer evidence, creates quoted assessments, receives independent criticism from another model and can revise once. D1 stores checkpoints, model-call reservations, decisions, reports, usage and elapsed time. A completed report means ready for owner review, not verified truth or public publication.

Reviewed observations can be remembered for seven days. They are only reused after a new source fetch exactly matches their saved content hash. The research process cannot publish job labels, add employers, send messages, inspect accounts/CVs, change permissions or deploy code. Research is owner-triggered; the existing employer source workflow continues on its six-hour schedule.

Cloudflare GLM-4.7-Flash with reasoning enabled is the investigator; Llama 3.3 70B is the reviewer. Configurable OpenAI Responses and Anthropic Messages adapters have offline contract tests and remain disconnected. Premium API access, account/model availability and a monetary ceiling have not been activated or verified. Current operational caps are four investigations and 32 model-call reservations daily, with eight calls per investigation. A failed/uncertain call remains counted and is not silently retried.

## Verification

- 122 automated tests pass, covering quote fabrication, hostile tool selection, invalid authority fields, missing adverts, paused sources, independent-review requirements, failed-call accounting, atomic budget limits, replay, partial-report boundaries, recovery, expiring/versioned memory, owner-only access and the actual start-request path.
- Production build, generated binding types and Wrangler dry run passed. Additive migration 0009 applied locally and remotely; a D1 recovery bookmark was captured before the remote change.
- First live capability attempt found a Workers AI response representation mismatch in the reviewer. The draft remained incomplete and no public content changed. The adapter now accepts both structured objects and JSON strings; schema validation remains mandatory. The failed run is retained.
- Subsequent live capability run `research-53667f9c-3c2e-4f28-9815-16d24e68a657` completed analysis and review with 12/12 synthetic challenges correct and zero false sponsorship positives. It used two model calls. This small authored test does not estimate real-advert accuracy.
- First real-job run `research-27b27f19-b743-4780-a628-1edc1b29b051` fetched evidence but selected an invalid third tool. It failed privately. The investigator now receives an explicit list of available tool/ID pairs, and a known invalid selection receives one recorded repair opportunity under the same eight-call ceiling. Unknown model-call outcomes still are not retried.
- Real investigation `research-b9987341-9e22-479d-9c18-3a268a891822` repaired an invalid first choice, fetched a Deliveroo advert and then encountered `WorkflowInternalError` on a subsequent decision. Owner recovery used the same run, reused persisted evidence, did not repeat the uncertain model call and completed analysis/review at six total calls. The report discloses its early stop and one-advert scope. A completed Workflow status by itself is not success: this app distinguishes failed, running and ready-for-review records.
- That report correctly labelled the advert `not_stated`, but its free-form summary over-inferred unavailability from a right-to-work requirement. This is a recorded quality defect, not evidence of frontier-level reasoning. The summary needs claim-level review and the real-advert evaluation set needs this regression before expanding autonomy. No public label was edited and no narrative is eligible for learning memory. The UI now collapses the narrative behind an explicit unverified-draft label, and leads with the actual assessment count. The original employer feed was checked separately before saving the correct label and exact quote as one expiring observation; the production save was verified.
- Anonymous access to `/api/admin/agents/research` returns 403. Live `/api/health` confirms 2.11.0.
- The research dashboard fits a 390px viewport with no horizontal overflow; the browser viewport was restored afterward.
- The 12:30 UTC scheduled source run completed all 30 sources. This is one observed scheduled run, not a long-term reliability claim.

The local standalone binding probe did not return a result and was stopped. Production Workflow execution, rather than that probe, supplies the live-model acceptance evidence.

## Outstanding

Representative, independently labelled advert benchmarks; premium-provider live tests and monthly cost controls; wider source discovery; LinkedIn provider rights and authenticated sample; immigration and application-specific research roles; long-running reliability and outcome measurement. The agents do not train their own model weights or promote their own code. GitHub hosted CI was previously blocked by account billing; local tests are the validation source unless a new hosted run is confirmed.

Final production Worker: `33d3db34-fa7e-424e-88ed-e0f2bcd1c52d`.

## Rollback and retention

The preceding 2.10 Worker is `d49f5f7d-787f-4d5a-8f15-facaf3e25d01`. Migration 0009 is additive, so reverting Worker code does not require deleting research records. Avoid restoring the entire database over user activity. Completed/failed research records expire after 30 days; approved observations after seven days. In-flight runs are not pruned by retention. Paid-call reservation records cannot be reset by an agent.
