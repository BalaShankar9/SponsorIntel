# Sponsor Intel marketing agents

Verified 7 October 2026. This is the next implementation plan, not a claim that six independent marketing agents are deployed. The daily Codex routine is one agent run; source ingestion and reviewed report templates are automations.

## Current capability

- SourceWorkflow is configured to refresh reviewed employer feeds every six hours, validating batches and holding anomalies. Website ingestion is separate from choosing jobs to promote socially.
- Private research uses an investigator, evidence analysis and a different model reviewer. These stages assess advert evidence; they do not plan marketing or publish posts.
- BusinessWorkflow can publish the reviewed, dated catalogue report at most weekly after freshness and reconciliation checks and prepare social outbox drafts.
- The daily Codex routine can maintain a bounded Facebook queue. Initial Facebook and native LinkedIn posts were selected and scheduled interactively; independent marketing execution and acquisition gains are not yet demonstrated.
- Metricool is connected to Facebook only. LinkedIn has a native scheduled company report. Instagram `sponsorintellondon` is created with its logo saved, but its editor errors and professional mode/publisher access are not verified.
- Release 2.13 now records anonymous campaign page/action totals for the seven approved launch links. Raw query strings and personal identifiers are excluded. The live owner dashboard and database were verified, including three known operator page-open checks on 7 October. These are not organic visits or unique visitors; response totals cannot establish individual conversions or causality. See `cloudflare/RELEASE-2.13.md`.

## Roles to build

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
2. Store versioned briefs and proposed/held/reviewed/scheduled/published/failed decisions with sources, timestamps, review outcome, exact account and provider receipt. Reconcile existing native schedules so outbox drafts cannot duplicate them.
3. Add bounded planner/writer/reviewer stages using approved public evidence. Rejected or exhausted-budget work remains held. Test stale adverts, unsupported sponsorship claims, malicious source text, wrong accounts, repeated schedules and uncertain delivery.
4. Finish the dedicated Instagram professional profile and obtain owner-authorized publisher access. Complete supported channel adapters; a direct Cloudflare publisher is still pending. Do not purchase a plan or bypass a provider gate.
5. Observe one complete scheduled cycle with a traceable brief, independent review, approved content, provider delivery and post-delivery check before calling that path automated. Retain visible pause controls and recovery evidence.
6. Use actual results to revise editorial guidelines and bounded experiments with an audit trail. No self-changing permissions, spending limits, paid campaigns or uncontrolled production-code changes.

Immigration content must remain official-source reporting. Personal legal interpretation and unsupported rule-change summaries are held for qualified review. Routine verified company posts remain within existing owner authorization; unsolicited private outreach and paid promotion are excluded.
