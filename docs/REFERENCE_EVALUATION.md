# Real-advert evaluation

The first set is `real-adverts-2026-10-08-v1`: 50 complete employer adverts from 18 sources, captured on 8 October at 00:16 UTC. There are 49 distinct description bodies; two separate source records share their wording. The expected interpretations are provisional AI-assisted annotations, frozen at 01:16 UTC before opening the remaining label comparison. The original 12 annotations remain unchanged. This is a source-balanced development sample, not independent human validation or an estimate of UK-market accuracy.

## Data and authority

`worker/reference-manifest.js` is server-only. It pins the case IDs, SHA256 hashes of complete descriptions and canonical source records, expected label sets and batch membership. The frozen annotation file SHA256 is `4276e3753a2840ea9abb38ddcca109f70de7aa7e11043438320e9e213584bb7e`. The import-preparation script verifies both annotations and source records before emitting idempotent SQL. Full text is stored only in the private D1 reference table, separate from live jobs. No source text or answer key is included in browser assets.

Every batch rechecks its record and description hashes before reserving work. Model context contains an explicit projection of original advert text, source identity, URL, observation time and historical snapshot time. It contains no expected labels, annotation reasons, existing public labels or approved learning observations. The analyst and different-model critic receive the historical evaluation instructions and the same complete source text. A snapshot cannot establish that a vacancy is open now. Production research still rejects stale or incomplete positive claims; historical evaluation does not weaken that rule.

Results cannot publish, edit public job labels or enter learning memory. Forty-two single-label cases are scored separately from eight ambiguous positive boundaries. Agreement, unsupported positive claims, unsupported refusals, coverage and reviewer disputes remain separate counts. A critic rejection is retained even when a label agrees with its expected value. Missing/failed cases are not silently removed from the cohort.

## Scheduling and limits

The set has 16 batches, each at most five adverts and 24,000 description characters. The largest initial model input in the frozen preflight was 49,955 characters, leaving room inside the existing 90,000-character cap for one revision and criticism. The existing per-investigation eight-call, shared daily four-start/32-call limits remain unchanged. A normal completed batch uses two calls, or four with its one revision; failed/unknown calls remain reserved.

While the snapshot is loaded and unfinished, one batch replaces the ordinary once-daily private investigation. This preserves the existing automated rate, so full coverage requires at least 16 successful daily dispatches unless the owner starts extra batches within the shared allowance. A held day does not retry automatically. There is no promised completion date. Research/business pause prevents new scheduled dispatches and is checked before every new reference model call; an already completed call can be replayed from its receipt without another charge.

The owner Research lab shows coverage, batch states and provisional results and offers only the next pending batch. Model/policy configuration must match earlier campaign attempts. A failed, incomplete, unknown or mixed-version attempt holds the campaign and appears in the operations findings. No attempt can be replaced by another run with the same batch ID. Existing recovery can restart only the same confirmed-terminal run within its recovery window, preserving reservations and model-step receipts. An expired failure needs an explicit diagnosed follow-up/version; do not delete the failed row to make a batch eligible again.

Reference attempts and their child step receipts are excluded from ordinary 30-day research cleanup. A database guard also preserves them if older Worker cleanup code runs after rollback. This is a finite public-advert reference set, not customer/CV retention. Future versions require an explicit engineering change and distinct dataset identity; do not mix their scores.

## Validation and acceptance

- Local tests cover byte pins, answer-key separation, historical/live boundaries, ambiguous scoring, paid-call protection, pause, failure holds, version mismatch, retention and owner findings.
- All 50 original stored records pass the local hash preflight. Isolated Workerd completed the actual research workflow using a synthetic model adapter and local D1. That proves the workflow path, not model quality.
- Required live evidence: unchanged existing budgets; loaded and verified production records; the private owner UI; a genuine scheduled batch with its platform receipt; complete coverage or explicit retained failures; independent human adjudication; a separate held-out set before model promotion.

Do not equate loading the snapshot, passing tests or configuring the schedule with successful real-model evaluation. See the 2.19 release receipt for the current observed state.

Cloudflare operational references: [D1 command reference](https://developers.cloudflare.com/d1/wrangler-commands/), [Time Travel recovery](https://developers.cloudflare.com/d1/reference/time-travel/) and [Workflow limits](https://developers.cloudflare.com/workflows/reference/limits/).

## Separate compact comparison — 2.57

The original 10 October batch-two failure is retained; its provider Workflow completed the failure handler, not the analysis. Its historical `Model response incomplete.` message is consistent with the old output-limit branch, but no raw finish reason or usage counters survived. Do not assign a fabricated stop reason or reset that run.

The candidate `real-adverts-2026-10-08-compact-v2` uses policy `investigator-v4-compact-reference`. All 50 original pinned records and 16 batch memberships remain unchanged. Complete ordered quotation blocks replace the duplicate description in analyst input; their concatenation must reproduce every original character and preserve quotation IDs. The reviewer still sees complete original text. Llama review uses the [official JSON-schema interface](https://developers.cloudflare.com/workers-ai/features/json-mode/); GLM retains the existing JSON-object interface and reasoning setting. Schema validity cannot prove interpretation quality.

`node scripts/research-source.mjs` verifies explicit checked-in contract files against the generated manifest. Changing those files requires a reviewed explicit `--write`, a new preflight and comparison review; deployed bundles use the same source identity. The 50-record read-only preflight is `node scripts/research-comparison-preflight.mjs PRIVATE_RECORDS.json AGGREGATE_RECEIPT.json`. Never commit complete source exports or customer data. Character savings do not establish token/cost savings or better reasoning.

After reviewed migration 0037, the existing owner desk offers prepare, resume and pause. Preparation revalidates every original record and selects the candidate **paused**. Resume needs the exact prepared source/model profile and can only enable the next eligible existing daily dispatch. Neither action starts a workflow or resets the current day's receipt. Keep failed/unknown attempts, consumed reservations and the original high-priority finding. An uncertain save must reconcile/replay the exact request. A pause blocks subsequent call reservations but cannot undo an already-started provider call.

Candidate and original scores stay separate. All sixteen candidate batches must reach reviewed output before independent adjudication; provisional annotations and agent assistance remain disclosed. A complete comparison stays `awaiting_independent_review`, with no automatic live-policy promotion, learning, publication or ordinary-research fallback. Any failure/configuration change holds it without an automatic second attempt.

## Reviewed schedule resume — 13 October 2026

At **15:27:34.338 UTC**, the authenticated owner desk saved agent-assisted revision 2, enabling the already prepared compact-v2 comparison. The recorded reason explicitly reviews the original failure, current controls, unchanged exact profile and fresh preflight; this is not an automatic release of a date-bound hold. There was no intervening owner decision after the 11 October preparation.

Fresh read-only checks verified all 50 production reference records and full source reconstruction in the same 16 batches against source identity `6c9715f2b0479435c528f77fc44613a0147caeb7558af716447db0fd5d8ab49a`. Exact investigator/reviewer/options match the prepared profile. No investigation or model step is active/uncertain. Both original reference instances were freshly confirmed complete at Cloudflare; the second ended at `record-failure-1`, retaining its analysis failure and unknown historical completion metadata. Neither original run was retried or reclassified.

Independent D1 readback at **15:27:48.038 UTC** confirms enabled revision 2 and the two immutable prepare/resume decisions. Eleven protected groups have identical hashes, including all frozen records, investigation/step history, every daily receipt and budget, business/application/source/marketing controls and social brief states. Today remains held, with one shared start and zero calls; the resume made no model call. Application evaluation remains paused.

The candidate shows **ready, 0/50**, and the original remains **needs attention, 3/50**. These are control/progress states, not interpretation quality. The next genuine hourly snapshot must separately observe the ready candidate while retaining the original finding. The earliest new daily opportunity is **14 October UTC**, subject to current controls, versions and shared headroom; no future instance or execution time is fabricated. Observe that original scheduled run and its provider/step receipts. Complete all 16 batches, independent adjudication and a separate held-out validation before any promotion. Existing no-retry, pause, reservation, privacy and no-publication boundaries remain.

Aggregate receipt: `cloudflare/tests/evidence/research-resume-2026-10-13.json`. No runtime deployment, migration, source refresh, Google read, email/social send or new permission.

## 23 October diagnosed failure and offline proposal

Fresh original receipts confirm compact-v2 batch four's provider output limit and the Workflow's separate 180-second timeout, and identify the retained export-licence/visa-refusal conflation in batch two. The active public job remains `not_stated`. Read `RESEARCH_SCOPE_PROPOSAL.md` for exact evidence and the executable offline subject/stance/scope contract. All 50 frozen records pass its byte-checked preflight; 30 targeted tests pass. This proposal is not connected, selected, resumed or scheduled and has made no model call. Compact-v2, original results, controls, shared counters and live source identities remain unchanged. Campaign/control integration, real execution, independent adjudication and held-out acceptance remain required.
