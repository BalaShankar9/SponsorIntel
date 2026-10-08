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
