# Sponsor Intel marketing agents

Updated 7 October 2026. Release 2.15 implements a bounded editorial planner, writer and different-model reviewer using Cloudflare Workflows. This is a three-topic, Facebook-guide pilot. Model quality and a complete external delivery cycle are not yet verified. The daily Codex routine remains a separate agent run; source ingestion and reviewed report templates are separate automations.

## Current capability

- SourceWorkflow is configured to refresh reviewed employer feeds every six hours, validating batches and holding anomalies. Website ingestion is separate from choosing jobs to promote socially.
- Private research uses an investigator, evidence analysis and a different model reviewer. These stages assess advert evidence; they do not plan marketing or publish posts.
- BusinessWorkflow can publish the reviewed, dated catalogue report at most weekly after freshness and reconciliation checks and prepare social outbox drafts.
- The daily Codex routine can maintain a bounded Facebook queue. Initial Facebook and native LinkedIn posts were selected and scheduled interactively; external delivery and acquisition gains from the new editorial stages are not yet demonstrated.
- Metricool is connected to Facebook only. LinkedIn has a native scheduled company report. Instagram `sponsorintellondon` is created with its logo saved, but its editor errors and professional mode/publisher access are not verified.
- Release 2.13 now records anonymous campaign page/action totals for the seven approved launch links. Raw query strings and personal identifiers are excluded. The live owner dashboard and database were verified, including three known operator page-open checks on 7 October. These are not organic visits or unique visitors; response totals cannot establish individual conversions or causality. See `cloudflare/RELEASE-2.13.md`.

- Release 2.14 adds the private Marketing desk: immutable content versions, decisions, exact destinations and dated schedule/delivery observations. Four launch schedules are reconciled without fabricated reviews. An additional personal report is held for duplicate and campaign-link review. Report briefs are prepared by the hourly business workflow; this is a reviewed-template handoff, not an autonomous planner or writer.

## Editorial agents in 2.15

The hourly business workflow dispatches at most one marketing attempt per UTC day. It reads three fixed guide topics: shortlisting, evidence in applications, and reading advert wording. Every curated quotation must still occur in the current live article. The complete article hash is retained, but only fixed facts are given to models; arbitrary page text cannot add tools, sources or permissions. Input excludes customer records and CVs.

The planner ranks eligible topics against the recorded Facebook queue and aggregate campaign events, or chooses no post. Every written paragraph requires an exact supporting quotation. A different model reviews every paragraph and the overall usefulness. One rejected draft can receive one revision and another review. Source changes, stale evidence, failed validation, incomplete review, an owner edit or pause hold the work. Saved drafts and both versions stay in the Marketing desk; review never sends a post.

Marketing shares the existing four-run/32-call UTC-day research allowance. It uses at most five calls, requires five-call headroom at dispatch and does not reserve extra headroom against a concurrent research run; the atomic shared limit may therefore stop a later step safely. Failed and uncertain calls count and are not retried automatically. No budget, provider subscription or model configuration was expanded. A full queue/no fresh topic ends without any model calls, but the daily attempt reservation is retained. Source evidence expires after seven days and is rechecked against its hash within six hours before approval. Proposed slots are 10:00 Europe/London, DST-aware, within evidence expiry and the three-post rolling weekly ceiling. Overdue or uncertain recorded delivery prevents another proposed slot until reconciled.

The owner can pause, refresh or start the one daily check in `/admin`. `/api/admin/marketing/agents` provides the latest seven runs and latest run steps; `/run` is idempotent by UTC day; `/settings` only changes enabled/paused. A pause stops the next model/mutating stage, not a call already in progress. Resume cannot reset the allowance or rerun a used day. A workflow dispatch with an uncertain outcome retains its reservation and blocks a replacement. Inspect Cloudflare status before operational recovery; no automatic retry or UI recovery is claimed for an unresolved earlier run.

The source policy is versioned as `sourced-guides-v1`. Planner/writer use the existing Cloudflare GLM model and critique uses the existing Llama model. This is structured reasoning over reviewed evidence, not model-weight training or proven self-improvement. The additional `fb-shortlist` campaign mapping is fixed in code; the seven launch mappings are unchanged. The first live model run is still pending because 7 October's four shared attempts were already consumed. See `cloudflare/RELEASE-2.15.md` for synthetic versus live verification.

## Role coverage and remaining work

| Role | Decision | Required output |
| --- | --- | --- |
| Marketing planner | Which useful content, audience, channel and time to choose from fresh evidence and existing queue/results | Ranked brief with purpose, evidence, timing rationale and a no-post option |
| Opportunities editor | Which live employer vacancies merit promotion | Original advert, exact employer identity, deadline when present, observation time and precise sponsorship wording |
| Writer and designer | How to adapt an accepted brief to each channel | Clear copy, accessible artwork/carousel and alt text; no invented offers, private CVs or artificial urgency |
| Independent reviewer | Whether every factual claim is supported and current | Structured acceptance or actionable rejection, exact source support and duplicate check; at most one bounded revision |
| Publisher | Whether an approved version can be delivered to the exact allowlisted account | Idempotent schedule, provider receipt, later live URL or failure; uncertain calls reconciled before retry |
| Performance analyst | What the observed results justify changing | Weekly findings and one bounded experiment, with small samples and missing attribution disclosed |

## Content and timing rules

Preserve the initial queue and limits in SOCIAL_PUBLISHING.md: at most three Facebook posts in a rolling seven days after launch, and at most one new schedule per daily run. Prefer a mix of current opportunities, sponsorship evidence explanations and tested application guidance. Do not fill a quota with weak content or silently multiply the limit across channels. Instagram and LinkedIn need their own verified destination and queue checks before expansion.

Recheck each advertised vacancy before scheduling and before delivery when a cancellation window is supported. Include role, employer, location, original link and the exact sponsorship signal. A licensed employer's general vacancy must not be headlined as a sponsorship offer. Hold/cancel closed or contradictory opportunities; correct already-published errors. If fresh pre-delivery checks cannot be made, prefer durable guides or explicitly dated research to expiring jobs.

Keep the existing launch queue at 10:00 UK time. It is a starting hypothesis, not a proven optimum. Preserve the recorded Metricool editor discrepancy without repeated time shifts. Compare one timing or format change at a time against a recorded baseline, reviewing weekly.

## Implementation order and acceptance

1. **Completed in 2.13:** privacy-preserving campaign counts using fixed allowed campaign identifiers, with browser/server/live-database verification and an owner dashboard. Do not store arbitrary query strings, private data or cross-site fingerprints. Preserve the known 7 October operator baseline when interpreting results; aggregate action counts do not establish individual conversion paths.
2. **Completed in 2.14:** versioned briefs and proposed/held/reviewed/scheduled/published/failed/uncertain/cancelled decisions, source observations, timestamps, account allowlist and receipt history. Imported schedules retain their original observation date and do not imply independent review or delivery. The same report and destination cannot become a second brief; matching legacy drafts are suppressed. Decision requests are replay-safe and concurrent edits cannot both win. See `cloudflare/RELEASE-2.14.md`.
3. **Guide pilot implemented in 2.15:** bounded planner/writer/reviewer, paragraph evidence, one revision and a no-post path feed the versioned ledger. Validate real model output after the existing allowance resets, then add a separately tested live-opportunity adapter. No new job promotion or legal-change generation is enabled. Synthetic safety cases are not model-accuracy evidence.
4. Finish the dedicated Instagram professional profile and obtain owner-authorized publisher access. Complete supported channel adapters; a direct Cloudflare publisher is still pending. Do not purchase a plan or bypass a provider gate.
5. Observe one complete scheduled cycle with a traceable brief, independent review, approved content, provider delivery and post-delivery check before calling that path automated. Retain visible pause controls and recovery evidence.
6. Use actual results to revise editorial guidelines and bounded experiments with an audit trail. No self-changing permissions, spending limits, paid campaigns or uncontrolled production-code changes.

Immigration content must remain official-source reporting. Personal legal interpretation and unsupported rule-change summaries are held for qualified review. Routine verified company posts remain within existing owner authorization; unsolicited private outreach and paid promotion are excluded.

## Ledger contract and remaining integration

The owner-only `/api/admin/marketing` API exposes current briefs with bounded event and receipt history. `/sync` imports the fixed historical launch records and prepares fresh report drafts; `/create` stores a sourced proposal; `/decide` appends a version-specific decision. The UI can hold or review drafts and record an observed delivery outcome. Revision through the internal/API contract preserves prior copy and revokes approval; the 2.15 model writer uses that revision contract, while a general owner copy editor remains pending.

The authenticated owner identity is assigned server-side. A request cannot impersonate another reviewer, and an author cannot approve their own version. Manual decisions record operator attestations. The 2.15 critic additionally records paragraph-level model findings; neither proves claim truth. Sources currently accept clean first-party and GOV.UK links only. Employer-advert promotion still needs a separately designed evidence adapter and freshness checks.

Scheduling records require a current review, unexpired evidence, the exact allowed account/provider and a provider reference. Published records require a matching-network post URL and an observation note. External account ownership and the content at a supplied URL still need checking at the provider; a saved manual observation is not an API-verified receipt. This API never sends, retries or cancels a social post. Uncertain delivery blocks another schedule; record confirmed failure/cancellation only after inspecting the provider. Imported native LinkedIn references are explicitly observation references, not invented platform IDs.

Reconcile before scheduling, and do not use the generic personal `evidence-report` campaign link until its measurement mapping is reviewed. The current personal report is held for this and possible overlap. Preserve the three operator campaign page opens recorded on 7 October. The next acceptance gate is a real model draft and independent review, followed by publisher adapters and verified delivery. No provider permissions, model budgets or spending limits were expanded by 2.14 or 2.15.
