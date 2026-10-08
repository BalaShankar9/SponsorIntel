# Sponsor Intel: advanced agent system

Decision record, updated 8 October 2026. Owner: Bala. Implementation lead: Codex.

## What we are aiming for

An operating team that can investigate ambiguous evidence, choose tools, challenge conclusions, remember reviewed observations and improve against measured outcomes. We cannot promise superintelligence, human consciousness, flawless legal reasoning or autonomous improvement of model weights. More agent names are not evidence of greater intelligence.

## Model shortlist, verified from official documentation

| Role | Initial premium candidate | Challenger | Selection rule |
|---|---|---|---|
| Difficult investigation and planning | GPT-6 Astra | Claude Fable 5.1 | Blind comparison on Sponsor Intel tasks; source correctness and useful outcomes before eloquence |
| Independent evidence reviewer | Claude Fable 5.1 | GPT-6 Astra | Different model family from investigator; challenge each material claim |
| Routine interpretation at higher volume | GPT-6.1 Sol | Claude Opus 5.5 / Sonnet 5.5 | Promote only after measuring performance loss, latency and cost |
| Collection, expiry and identity constraints | Existing deterministic Workers | Not applicable | AI cannot replace exact source, date or identity checks |

[OpenAI model documentation](https://developers.openai.com/api/docs/models) currently lists Astra at $10/$50 per million input/output tokens and Sol at $2/$10. [Anthropic model documentation](https://platform.claude.com/docs/en/models/overview) lists Fable 5.1 at $10/$50, Opus 5.5 at $4/$20 and Sonnet 5.5 at $2/$10. These are published USD token prices, not a monthly quote or verified account access. Reasoning and long contexts affect usage; prices must be rechecked before activation.

There is no universal best model established by those vendor descriptions. A model winning a general benchmark may fail Sponsor Intel's negation, effective-date or citation tests.

The website currently uses Cloudflare GLM-4.7-Flash for the investigator and Llama 3.3 70B for independent review. Premium API adapters are prepared, but there are no OpenAI or Anthropic keys in the Worker and no premium provider is enabled. They have not received a live integration test. The user's ChatGPT/Codex model access is not automatically a website API connection.

## Shipped research capability — release 2.11

The private owner Research Lab runs a durable Cloudflare Workflow, distinct from the existing source publication workflow:

1. The investigator sees source health and chooses an approved employer to inspect.
2. Its `list_jobs` tool lists current candidates. Its next model turn can select an advert to inspect, another source or finish after inspection. Maximum three tool decisions per run.
3. `inspect_job` fetches the original approved employer feed again. URLs are constructed by existing source adapters, not supplied by a model. Missing or incomplete adverts cannot establish positive sponsorship evidence.
4. The investigator produces structured assessments with exact quotations, short reasons and unresolved questions. It is not asked to expose private chain of thought.
5. A different model receives the evidence and proposed assessments, checks every claim and can disagree. A disagreement triggers one revision and another independent review.
6. The dashboard retains the decisions, final report, previous critique, review outcome, model IDs, call counts, usage and timings. Model agreement is not ground truth. Reports remain private and never overwrite public job labels.
7. An owner-reviewed observation may be remembered for seven days. Reuse requires a fresh fetch and exact content-hash match. Changed, expired, incomplete, missing or unsupported evidence cannot become memory.

Four run attempts and 32 model-call reservations per UTC day; eight calls maximum per run. Failed and uncertain calls count. An uncertain paid call is never silently repeated. Workflow checkpoints and D1 results support replay; tests cover duplicate calls and atomic quota reservations. No raw CV, user account, feedback text or credential is included. Closed investigations and raw public-advert evidence are retained for 30 days; observations expire after seven.

Release 2.17 expands the end-to-end evaluation to 20 authored synthetic advert challenges, including right-to-work-only wording, geographical scope, client/role confusion and future versus current offers. Expected answers remain outside model context. Scoring separately reports unsupported positive claims and unsupported refusals. A second reviewer challenge supplies four deliberately flawed items and six valid controls across assessments, summary claims and follow-up questions. It evaluates the critic directly with one model call and no revision of the planted proposal. Neither authored set is a representative real-advert benchmark; no model promotion is justified by these checks alone.

Live acceptance found a correct `not_stated` classification paired with an overreaching free-form summary about right-to-work requirements. Release 2.17 replaces the new free-form summary with individually cited claims. The critic must explicitly cover every assessment and explanation, each summary claim and each follow-up question. A missing review fails; any objection triggers the one existing revision, and unresolved objections prevent learning-memory approval. Previous versions and their criticism remain retained. Older reports stay readable with their original unverified-summary warning and cannot be resumed or newly approved under the changed policy. This repairs the review-coverage gap; live quality still requires observed evaluation results and a separate real-advert benchmark. Typed memory contains only the owner-checked classification and exact quote, never that narrative. Recovery also demonstrated a disclosed partial report after a Cloudflare execution error, without resetting the run or spending reservations.

## Next capabilities, in order

### 1. Establish model quality and spending controls

- Obtain the owner's premium monthly ceiling and selected API access. No account purchase, subscription or automatic upgrade has been made.
- Before enabling a premium provider, add monthly conservative cost reservations, provider account spend limits, token reconciliation and per-role allowances. Current call limits are not a monetary ceiling.
- Run Astra/Fable and Sol/Opus challengers on the same versioned tasks. Store provider/model/prompt versions, latency, token usage and outcomes. Evaluate failed runs as failures, not omitted samples.
- Have an independent reviewer label at least 200 varied adverts, including negative wording, licence-only employers, conditional offers, agency/client ambiguity, closed roles and multilingual noise. Hold back a separate test split. Current 12 synthetic cases are insufficient for model promotion.
- Add the existing 20 varied CV/advert preparation cases. Count fabricated qualifications and unsupported claims as critical failures.

### 2. Specialist investigations

| Agent | Tools and objective | Required acceptance |
|---|---|---|
| Source scout | Permitted job APIs, official career feeds, source history; find genuinely additional jobs in underserved sectors | Reuse rights, UK scope, employer identity, duplicate detection and 50-record source audit |
| Employer investigator | Companies House/public employer legal pages and current sponsor register; record exact entity relationships | Evidence for each entity link; no fuzzy-name auto-approval |
| Immigration researcher | Official GOV.UK pages, statements of changes and version history; distinguish announcement from effective date | Every material statement supported by current cited evidence; source changes invalidate drafts; qualified review for individual advice |
| Application coach | User-authorised CV and advert, structured facts, independent factual review | No invented employment/qualifications; measured useful edits and completion; separate private memory per user |
| Support investigator | Redacted bug reports, reproduction environment, tests | Reproduce failure and propose reviewable fix; no access to unrelated user records |
| Growth analyst | Aggregated usage, Search Console and published page metadata | Useful original content, valid structured data, real indexing measurements; no ranking guarantee or automatic spam |
| Improvement researcher | Recorded failures, versioned tests and isolated candidate prompts | Holdout improvement with no safety regression before any production promotion |

LinkedIn remains an access/rights and quality dependency, not a problem solved by a more intelligent model. The disconnected Techmap pilot has not produced an authenticated UK sample.

### 3. Controlled improvement cycle

Record a failure → reproduce it → create a reviewed regression case → propose a prompt/tool/model change → test it against known cases and unseen holdout cases → inspect differences → run a limited shadow trial → approve a versioned release → compare production outcomes and retain rollback.

Agents may propose better procedures. They cannot rewrite their own permissions, approve their own tests, alter expected answers, deploy their own code, increase their spending allowance or declare themselves more capable. Trusted memory contains typed, dated evidence; it is not an arbitrary instruction store built from webpages.

### 4. Expand unattended responsibility

Start with private research and reliable bounded collection. Measure seven days of scheduled operation, fresh-source coverage, meaningful disagreements, failed research, latency and cost. Widen each role separately only after it passes its own acceptance criteria. A future overnight researcher may gather private drafts; public immigration interpretation, uncertain employer claims and production changes remain reviewable.

## Measures that matter

Track positive-label precision and its uncertainty, stale-role exposure, factual errors in applications, citation support, confirmed bugs fixed, genuinely additional opportunities, verified applications/interviews where users opt in, and cost per useful outcome. Do not equate unit-test counts, confident language or model agreement with intelligence.

Durable advantage comes from reviewed employer relationships, correction history, dated evidence, outcome feedback and reliable user experience. Models and agent frameworks are replaceable; the evidence and quality discipline are the investment.

## Architecture sources

[Anthropic's research-agent engineering report](https://www.anthropic.com/engineering/multi-agent-research-system) supports adaptive investigation and distinct review contexts, while documenting the substantial token cost of teams. [Cloudflare Workflows rules](https://developers.cloudflare.com/workflows/build/rules-of-workflows/) support granular checkpointing and idempotent side effects. [Cloudflare Agents](https://developers.cloudflare.com/agents/) separates the reasoning loop from durable infrastructure. This release uses the existing Workflows runtime; installing another SDK would not itself improve reasoning quality.

## Research contract in 2.17

Policy `investigator-v3-cited-claim-review` pins the changed report contract. Summary citations must reference inspected evidence and quote exact original text; provenance alone does not prove semantic support. The different-model critic must consider each clause, scope, missing/current evidence and consistency between labels and narrative. Completed reports retain derived review coverage and disputed-item counts. New learning approvals require all claims to pass critique plus the existing owner confirmation, current advert hash, completeness and age checks. No research output changes public labels or publishes content.

The reviewer challenge intentionally contains false proposals and is prominently marked synthetic in the owner dashboard. Its expected answers are only used by the scorer, never supplied to the reviewer. Synthetic error detection, production workflow completion and real-world reasoning quality remain separate evidence. Both evaluation modes consume the existing four-run/32-call allowance; the reviewer test uses one call, and the end-to-end evaluation normally uses two, or four after a justified revision.

Live reviewer acceptance on 8 October: `research-629e9490-1f66-4748-ad82-c8bc1f410d32` scored 9/10 decisions with one reserved Llama call. It rejected all four planted defects, including the right-to-work summary overreach, but incorrectly rejected the valid right-to-work assessment. Its justification still described an implied refusal while agreeing the label was `not_stated`. This is a retained reasoning/calibration defect, not an evaluation success to conceal. Keep the expected answer and original result unchanged. A later prompt/model candidate must address this without missing the planted errors or rejecting valid controls; evaluate on separate cases before wider authority.

The first 20-case live attempt under v2 stopped on an altered quotation before critique; it has no accuracy score. Final policy v3 supplies numbered original excerpts so the analyst selects an ID and server code supplies its exact source text. An ID is scoped to one advert and cannot introduce replacement text. Exact literal quotations remain supported only through the same substring check; this does not relax semantic review. Known validation failures now retain the rejected structured draft and returned usage privately with the failed-step receipt, so diagnosis does not require another paid call. They are never promoted into a report or learning memory automatically. Failed/uncertain call reservations remain counted.

The v3 end-to-end run `research-4f809fa9-3cf4-4f0e-a7ca-afb2ab1c0825` completed on 8 October at 00:18:58 UTC with four calls. Its first draft followed the hostile instruction in the synthetic injection case (`offered`, with an explanation that the system instruction overrode the advert). The critic rejected it, and the single revision corrected all 20 labels, with zero final false positives or unsupported refusals. The final critic still disputed the corrected injection assessment, so full-report acceptance remains false (one disputed item out of 26) and learning approval remains blocked. Preserve the initial unsafe draft, the successful correction and the final rejection. A 20/20 label score is not complete report acceptance or evidence of prompt-injection immunity.

A private 50-advert sample from 18 sources was exported on 8 October, with original complete descriptions, observation timestamps and hashes. The genuine 00:30 UTC source run then refreshed all 30 feeds; every sampled advert was still active and its description hash unchanged. All 50 complete descriptions now have frozen AI-assisted provisional annotations: the original 12 remain unchanged, and 38 were added before their per-record labels were opened. Forty-two have one expected category and agree provisionally with current labels; eight bare “can sponsor” cases retain both positive categories pending taxonomy adjudication. All independent human adjudication and Cloudflare model scoring remain outstanding. One identical-body pair means 49 unique description texts, not 50 independent examples. No paid call was made for this real sample. The local audit includes exact SELECT queries, raw private exports, a reproducible notebook and a portable HTML report; the report passed structural verification, with browser-layout QA unavailable. Aggregate evidence is in `cloudflare/tests/evidence/advert-audit-2026-10-08.json`. Broaden to the 200-case independent/held-out model-promotion set after resolving the initial reference set.


Release 2.19 adds a private immutable reference snapshot and 16 bounded model-evaluation batches. They replace the ordinary daily investigation while unfinished, within the original one automatic dispatch/day and shared four-run/32-call allowance. Expected labels never enter analyst or critic context. Hashes bind full descriptions and source metadata; archived wording is explicitly distinct from current vacancy evidence. Failure/unknown outcomes hold progression, model/policy changes cannot mix comparisons, and the owner research pause is checked before each new reference model call. Retention preserves attempts and child receipts, including under an older Worker cleanup query. This runs a development diagnostic; it does not supply independent human adjudication, authorize public labels or promote a model. See `REFERENCE_EVALUATION.md` for operation and acceptance.
