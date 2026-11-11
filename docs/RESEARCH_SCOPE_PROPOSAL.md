# Subject-aware research proposal — 23 October 2026

**Offline prototype, not a live policy, prepared campaign, scheduled run or demonstrated accuracy improvement.** Sponsor Intel remains on 2.95.0. The implementation is `cloudflare/experiments/research-scope-v3/contract.mjs`; no Worker, browser or workflow imports it. Its functions construct and validate request descriptions; they have no network, model, database or scheduling capability.

## Original failure evidence

Read-only production inspection found the compact-v2 campaign at eight of 50 adverts, with batch four failed and one unsupported refusal relative to the frozen provisional annotations. No attempt was retried or relabelled.

- Original 17 October run `research-d6cd13ed-bec0-43f1-9011-4414381fcbaf`: the stored analyst step records `finish_reason=length`, missing answer, 4,989 prompt tokens, 8,192 completion tokens, and 184,467 ms duration. The original Cloudflare instance was freshly read on 23 October: `analyse-1` timed out after 180,000 ms, with zero retries; the workflow subsequently completed its failure handler at **17 October 00:49:10.976 UTC**, returning `{state:failed}`. Platform success here describes the failure handler, not a usable analysis. These are two retained observations; exact response-arrival/persistence ordering is not recoverable from this schema. No missing response text or reasoning is reconstructed.
- Original 15 October run `research-2adae554-05a0-4f38-88be-9421d1130901`: the analyst treated export-licence authorisation wording as a visa-sponsorship refusal, and the different-model critic accepted it. Complete archived source for `01a7eebe6044426d5eb4ff5e` confirms that the quoted restriction concerns export access, not an explicit work-visa refusal. This is an agent-assisted source assessment, not independent adjudication. The live deterministic job row is still active and `not_stated`; this private research error did not change its public label.

All 50 frozen reference records and all three inspected model-step rows were re-read byte-exact. Original reference summary fields, the selected compact-v2 revision-2 control and daily shared AI counters stayed unchanged. One start/two calls were already consumed on 23 October by existing work; this prototype adds zero. The genuine hourly business receipt remains `business-497980`; social delivery still includes the original company report due 09:00 UTC, not a new schedule.

## What the prototype changes

Each analyst request contains one complete archived advert, once, as ordered source blocks. No annotations, expected labels, existing public verdicts or earlier model outputs enter the request. Full identity/hash validation happens in the frozen-cohort preflight, and no source is trimmed to fit.

The analyst separates each material statement into:

- **Subject:** work visa, export authorisation, professional training, commercial sponsorship or unspecified.
- **Stance:** offered, conditional, refused or merely mentioned.
- **Scope:** this vacancy, another role/group or unspecified.
- One or two exact source-block IDs and a short explanation.

There are at most four material facts. If that is insufficient, the model must declare incomplete coverage rather than silently drop statements. A pure function derives the provisional visa label only from asserted work-visa facts concerning this role; explicit refusal takes precedence, then conditional, then offered. Incomplete coverage has no label. This avoids a free-text final verdict contradicting an honestly classified export/training fact, but cannot establish that the model's classification is honest or correct.

The different-model critic receives the complete original source, resolved facts and derived label. It must separately cover every fact, omissions and the final label. Any rejected item leaves the proposed result unaccepted. No automatic rewrite is included. Old prose summaries and speculative follow-up questions are absent from this experiment, reducing the immediate output task; they are not silently removed from the live research product.

**Known counterexample retained in a test:** a model can still falsely mark an export-only quotation as a work-visa refusal, and a critic can still agree. That passes structural validation. Therefore every result remains `publishable=false` and `independently_adjudicated=false`, including synthetic all-accepted reviews. This contract is a testable hypothesis, not a correctness guard or permission to promote a model.

## Provider and budget boundaries

The proposed request descriptions retain the existing GLM investigator and different Llama reviewer, 8,192 maximum output tokens, temperature 0.1 and current GLM thinking setting. No new provider or higher limit is requested. GLM uses the existing JSON-object request; the Llama reviewer uses its existing JSON-schema interface. The analyst schema is available for local contract inspection, not sent as unsupported GLM schema enforcement.

Primary references inspected on 23 October: [Cloudflare GLM model interface](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/) and [Cloudflare JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/). The latter names the existing Llama model and warns that schema requests can still fail; its list does not establish GLM schema support. An accepted parameter shape or local fixture does not prove actual provider behaviour.

The hypothetical grouping is **25 batches of two cases**, with two calls per case and at most four calls per batch. This differs from the old 16 batches and requires a distinct campaign identity. It fits the existing eight-call investigation ceiling and shared four-start/32-call daily ceiling; those are not permissions to dispatch. One eligible attempt per UTC day and cross-version daily uniqueness must remain. There is no automatic revision, no retry of an unknown outcome, no extra schedule and no date-based release of a hold.

The original token exhaustion and timeout can recur. Smaller per-call input and fewer requested output fields are a hypothesis to test, not observed latency or cost savings. At the existing one-attempt-per-day cadence, complete 25-batch coverage would require at least 25 successful eligible days after a separately reviewed integration/resume; no start or completion date is promised.

## Verified offline acceptance

Seven new tests cover source fidelity/answer-key exclusion, category/scope separation, mixed facts and refusal precedence, exact quotation identity, incomplete/duplicate reviews, the retained semantic false-acceptance counterexample and frozen-cohort admission. Together with unchanged research-comparison and public opportunity tests, **30/30 targeted tests pass** on pinned Node 24.19.0. The first test command used the wrong working directory and found no test; corrected execution passes. No build or Worker deployment is required for these unimported experiment files.

Read-only preflight against all 50 actual frozen records verifies each record/description hash and exact full-text reconstruction. Largest proposed analyst request is **15,125 characters**; largest conservative critic shape is **22,317 characters**. The critic size shape is synthetic, not an assessment of those adverts. These counts are serialized request characters, not measured tokens, provider usage or cost. The old compact-v2 preflight still verifies all 50 records in its unchanged 16 batches. Existing research/application source identities are unchanged. Dependency resolution matches the same-day audited graph except release metadata; no install or schema change, so the successful same-day D1 recovery inspection remains applicable.

Reproduce locally with an existing private reference export, never customer data:

```sh
node --test tests/research-scope-proposal.test.mjs tests/research-comparison.test.mjs tests/opportunities.test.mjs
node experiments/research-scope-v3/preflight.mjs PRIVATE_REFERENCE_EXPORT.json AGGREGATE_RECEIPT.json
```

Run from `cloudflare/` on the pinned Node version. The preflight writes only aggregate hashes/identifiers/counts to its output; raw adverts remain in the private input. Evidence: `cloudflare/tests/evidence/research-scope-proposal-2026-10-23.json`.

## Next integration and acceptance

1. Add a distinct campaign/manifest and immutable prepare/resume/pause history that retains all v1/v2 attempts and their exact profiles. Keep the new campaign unselected/paused by default, and preserve reporting for the old failed campaign. Do not replace saved source hashes, reuse batch IDs or reset daily reservations.
2. Integrate per-case original-input/analyst/critic receipts into the existing Workflow and allowance machinery. Bind a start to the exact reviewed proposal/source/model/options identity. Preserve zero automatic retries, original-call reconciliation, pauses before each charge, timeout/late-response handling and terminal failure holds. Test actual Worker/D1 with fictional adapters, changed controls, concurrent admissions, lost acknowledgements and account access.
3. Only after those controls and the complete-source preflight pass, perform the reasoned owner preparation/resume within existing authorisation. Observe a genuine eligible scheduled attempt and its original provider/usage receipts. A date change or this document never resumes compact-v2 or authorises a forced run.
4. Review every completed result against full source, preserve rejected/unknown cases, complete the cohort, obtain independent adjudication and a separately held-out comparison. Measure completion, false refusals, false positives, omissions, elapsed time and actual token usage separately. No live job-label change, learning-memory approval or customer-policy promotion follows from passing this prototype.
