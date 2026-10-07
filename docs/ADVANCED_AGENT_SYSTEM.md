# Sponsor Intel: advanced agent system

Decision record, 7 October 2026. Owner: Bala. Implementation lead: Codex.

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

The Lab has a real-model evaluation mode with 12 separately authored synthetic challenges. Expected answers are held outside model context. Deterministic scoring reports correct labels, missing answers and unsupported positive sponsorship claims. This is an initial diagnostic, not representative real-world accuracy. The rest of the site continues using the existing source checks and immigration service.

Live acceptance found a correct `not_stated` classification paired with an overreaching free-form summary about right-to-work requirements. Assessments are individually reviewed; the narrative summary is not yet independently scored as a separate claim. The UI now separates that narrative into a collapsed, explicitly unverified draft and leads with the actual assessment count. This is a priority regression for the next evaluation, and a reason to keep research private. Typed memory contains only the owner-checked classification and exact quote, never that narrative. Recovery also demonstrated a disclosed partial report after a Cloudflare execution error, without resetting the run or spending reservations.

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
