# Application quality evaluation

Updated 11 October 2026. This is an authored development comparison, not a held-out accuracy benchmark or a claim that documents are safe to submit without review.

## Verified 11 October checkpoint

Three scheduled batches retained six writer drafts, three completed current-reviewer outputs, three rejected current-reviewer outputs and six rejected candidate-reviewer outputs. All nine completed outputs now have revision-1 evidence assessments, explicitly agent-assisted through the owner account: six need work, three acceptable for those inputs. Every criterion was covered; none is stale. There are zero completed candidate outputs and no paired current/candidate quality comparison. These are development judgments, not independent human adjudication or customer accuracy.

The evaluator is **paused** through the existing owner control after the repeated candidate rejections. Keep it paused until the retained failure causes and a reviewed next step are established. No additional model call was made; the shared 11 October allowance remained two starts/six calls. Customer generation and automatic promotion remain unchanged. The substantive writer issue is a fictional training exercise presented as workplace activity; other findings concern unsupported status/title inferences, relevant omissions, placeholders and clarity. See `cloudflare/tests/evidence/application-quality-2026-10-11.json`.

Prepared release 2.53 adds read-only diagnostics for rejected reviews under a matching recorded configuration. It is not deployed. It preserves the historical rejection even if content now passes, because original provider completion metadata may be unavailable. No raw response is returned, no model is called and no retry or promotion is authorized. See `cloudflare/RELEASE-2.53.md`.

## Purpose and customer boundary

A retained counterexample shows that the current reviewer can return three valid spot checks while leaving an invented paragraph elsewhere. The private candidate format requires every rendered paragraph to carry one to three exact candidate-source quotations. It rejects absent sources, unsupported linked numbers, extra text fields and malformed structure. A matching quotation does not establish semantic entailment: a stronger or unrelated paraphrase can still pass. Tests explicitly retain that limitation.

Customer applications keep the existing reviewer. The writer is shared with the evaluator, with unchanged model options and customer validation/consent/rate limits. No customer CV is read by this campaign, no application is submitted, and no reviewer is promoted automatically.

## Paired protocol

The immutable `application-development-20-v1` fixture contains 20 fictional candidate/advert pairs: 10 CVs and 10 letters. It covers dates, planned work, project provenance, individual/team scope, metrics conflicts, sparse sources, qualifications, unknown visa status, availability and hostile instructions in input documents. Emails use example.test. The fixture hash is `5b8654502327fbff77608a48c42fc61d3acf786ea3ee43f42d90b97b5efd81c3`.

For each case: generate one draft using the customer writer, send that same draft separately to the current and candidate reviewers, validate each contract and retain response, output, usage and failure receipts. Expected anchors and forbidden patterns stay out of model inputs. Literal screening helps locate potential errors but is not a correctness score. The case page shows original sources and retained validated drafts for review.

Review each output for invented facts, incorrect implications, important omissions, chronology/provenance, instruction resistance, useful role relevance and writing clarity. A known rejected output is evidence of a contract failure; workflow completion is not a passing document. Use a separate human or otherwise independent adjudication process, then test any proposed improvement on a separately held-out set before changing customer generation. The lab does not yet store independent adjudication decisions or offer a promotion button.

## Execution and limits

BusinessWorkflow dispatches this private workflow after marketing and reference research. It attempts at most once per UTC day, with two cases and at most six model calls per run, under the existing shared four-start/32-call allowance. Budget holds have no case IDs and consume no extra calls. At least ten successful eligible daily batches are needed to cover the set. Other authorized agent work can postpone it; there is no higher allowance.

D1 records the true scheduled/owner trigger, source/policy/model fingerprint, every charged step and outcomes. A stable date ID and atomic reservations prevent duplicate starts/calls. Model steps have zero automatic retries. A known malformed response is retained as rejected, allowing the distinct comparison stage; an unknown provider/storage outcome stops progression. Replayed retained steps do not call a model again. New paid work expires after one hour and respects both business and evaluator pause controls.

Any attempted failed/held run or mixed fingerprint holds further cases. The supervisor closes stale application records only after confirmed terminal Cloudflare status, preserving evidence and reservations. Unknown, paused or live instances cannot be retried. Business findings expose a held campaign. No quota reset, history deletion or campaign restart endpoint exists. A changed version needs separate reviewed campaign implementation; preserve the existing records rather than reusing their IDs.

## Access and recovery

Only the signed-in owner can inspect results or change evaluation settings. Mutations use same-origin checks, rate limits and an audit trail. Raw model responses remain in private D1 and are not returned by the case endpoint. Public browser assets do not contain fixtures or expected answers. Routine business receipt cleanup leaves evaluation records intact.

Migration 0018 is additive. Record a D1 recovery bookmark before applying it. For code rollback, pause the evaluator, inspect any running workflow and preserve all additive tables and reservations. Do not restore an older whole database over new customer activity.

## Evidence and acceptance

The isolated local Workerd/D1 run uses a synthetic adapter, no remote AI binding or credentials. It verifies actual workflow execution, six reserved synthetic calls, paired outputs, no-call replay and the owner UI controls. Local evidence cannot establish model reasoning quality.

At initial preparation, 8 October's live allowance is exhausted at four starts and six reserved calls. No real application-evaluation calls were made. Observe the first eligible scheduled run, inspect each original input/output, retain rejected/uncertain outcomes, complete all cases and independent review before claiming improvement.

## Live rejection-diagnostic boundary, 11 October after 2.53

Owner inspection of graduate-year (9 October) and project-provenance (11 October) returns `configuration_changed`. All three completed production runs retain implementation fingerprint `60d52fb00cdff87c0f24a98f0559f99f4b526d53fc106980541e31c4e9912962`. An isolated runtime inspection of the actual full 2.53 Wrangler bundle returns `db4e4498d8748b28e6f1bbc165be38f2dd760de1d89981da9a382524f32dca38`; fixture, suite, policies, models and review options match. No model/outbound call was made. The earlier narrow bundled-module comparison (`caa518...`) does not establish production compatibility. Source-module execution also differs and cannot substitute for full deployed-bundle evidence.

The implementation hashes runtime function strings, which may depend on bundling. Exact causality and historical compatibility remain unresolved. Next work: reproduce both complete historical/current bundles, compare the actual contract, then design a stable versioned identity and explicit historical inspection path. Do not replace stored hashes, disable the guard, merge campaigns, approve historical responses or resume paid evaluation to make diagnostics pass. Nine agent-assisted assessments remain historical; three baseline and six candidate rejections remain unchanged. Evaluation stays paused and promotion stays off.
