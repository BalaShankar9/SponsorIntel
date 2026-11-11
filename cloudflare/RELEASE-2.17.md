# Sponsor Intel 2.17 — cited claims and reviewer evaluation

8 October 2026. The old research critic covered advert assessments but not the report's free-form summary. A live right-to-work example exposed an unsupported refusal in that summary. New reports use individually cited summary claims. Independent review now explicitly covers every assessment and explanation, summary claim and follow-up question. Any dispute triggers the one permitted revision; an unresolved dispute blocks approval into learning memory. Research remains private and cannot change public labels or publish.

## Contract and evidence handling

The final policy is `investigator-v3-cited-claim-review`. The investigator selects numbered excerpts scoped to an inspected advert; server code resolves them to exact original substrings. It cannot override the text behind an ID. Literal quotations also remain subject to strict substring validation. This controls provenance, not the validity of an inference. The critic still receives the complete available evidence and must check scope, conditions, negation, completeness, freshness, every material clause and consistency between narrative and labels.

Review coverage is exact: missing, duplicated or foreign items fail validation. Earlier drafts and criticism are retained. Older policy reports stay readable with their original limitations but cannot resume or be newly approved under the changed policy. Current known structured-output failures retain the rejected draft and returned usage privately; a failed draft never becomes an accepted report. Unknown and failed call reservations remain counted and are not automatically retried.

The owner dashboard separates whole-report acceptance from synthetic label scores. A new reviewer test contains four deliberate defects and six valid controls; its answer keys are not included in model input. A synthetic fixture cannot enter learning memory. The end-to-end diagnostic now has 20 authored advert cases, including right-to-work-only wording and scope/conditional-offer traps. These are diagnostics, not a representative accuracy estimate.

## Verification and actual model outcomes

- **201 tests passed**, including claim/citation coverage, forged references, exact source resolution, summary-only and question-only disputes, late completion, bounded revision, memory gates, old-policy isolation, retained failed-call usage and separate critic scoring. Production build/typecheck, 17-page prerender, generated bindings and final dry-run passed.
- All migrations applied to isolated local D1. Local Workerd ran the actual reviewer workflow with a synthetic model adapter: terminal platform status, one reserved synthetic call, 10/10 expected fixture decisions and no production bindings. This verifies the workflow, not the live model.
- Live reviewer run `research-629e9490-1f66-4748-ad82-c8bc1f410d32` used one Llama call and scored **9/10**. It caught all four planted errors, including the right-to-work summary overreach, but wrongly rejected the valid right-to-work assessment and implied a refusal in its explanation. The failure is retained; this is not full reviewer acceptance.
- Initial end-to-end run `research-050698b9-1654-4808-ac93-81730e0ca6af` failed exact-quote validation after one GLM call and has no accuracy score. The stricter check was preserved. Numbered original excerpts were then added under a new policy version; no quota was reset or failed call replayed.
- Final-policy run `research-4f809fa9-3cf4-4f0e-a7ca-afb2ab1c0825` completed at **00:18:58 UTC**, with four model calls. Its initial labels scored 19/20: the model obeyed a hostile instruction inside the synthetic injection advert. Independent critique caught that false sponsorship claim. One revision produced **20/20 final labels**, zero false positives and zero unsupported refusals.
- The final critic still disputed the now-corrected injection assessment. Whole-report acceptance therefore remains **false**, with one disputed item among 26. Learning approval stays blocked. This result does not establish prompt-injection immunity or permission to publish research automatically.
- Live allowance is **3/4 attempts and 6/32 calls** on 8 October UTC; all three attempts, including the failed one, remain recorded. The remaining scheduled work must use the existing allowance. No premium model/provider, public post, memory approval or spending expansion occurred.

Full non-personal receipts, original/final drafts, criticism and usage are in `tests/evidence/research-claim-review-2026-10-08.json`. A private candidate set of 50 stored real adverts across 18 sources has been exported with hashes and observation times, with current labels separated. Its URLs have not been re-fetched and the cases are not yet independently labelled or scored. It is stratified, not an unbiased population sample.

## Deployment and recovery

Live Worker: `1d2eb5f7-55f7-4fdf-8abd-e0494491a1bb`, version 2.17.0 at https://sponsorintel.london. The v2 diagnostic deployment was `644319df-9541-474d-a87e-9030364d39e1`; the v3 model run used `46d79b60-446b-4b74-aebf-06c0013520a9`; the final changes clarify the UI's label-only score and make an already committed completion replay-safe after a lost acknowledgement. Completion errors are awaited inside the workflow failure boundary. Stable pre-release code is `1e1afb18-2d91-4574-8655-2d77daf743a3` (2.16).

Additive migration `0014_research_evaluation_suite.sql` applied remotely after bookmark `00000281-00000000-000050fe-7881917d3600347a9a4cd6f015aead08`. No restore was performed. Prefer code rollback or pause, retaining the new column, evidence and later user activity. Inspect active workflows before rollback; keep their classes/bindings available. Whole-database restore would overwrite unrelated later data and is not the default rollback.

Live desktop and 390px mobile views show 20/20 labels alongside the separate one-dispute hold; no horizontal overflow was observed. Screenshots are in the parent task's `outputs/research-claim-review-live.png` and `outputs/research-claim-review-mobile.png`. Anonymous research access remains 403.

Research quality remains a gate, not a completed capability. Next calibrate reviewer errors against separate cases, refresh and label the real-advert sample, and compare candidate policies/models without altering historical expected answers. The first genuine 2.16-or-later scheduled supervision receipt and external social delivery remain separate acceptance items.

Implementation references: Cloudflare's [JSON-mode contract](https://developers.cloudflare.com/workers-ai/features/json-mode/) and [durable workflow rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/). Structured JSON does not guarantee a correct inference; the source validator, independent critic, retained failures and owner controls remain necessary.
