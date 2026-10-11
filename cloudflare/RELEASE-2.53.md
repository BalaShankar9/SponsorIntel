# Sponsor Intel 2.53 — inspect retained reviewer rejections

Prepared on 11 October 2026. **Not deployed**: production remains 2.52.0, Worker `3a133af1-df7d-443c-8ea9-e15e77f2ba5f`, while the existing Cloudflare sign-in agreement approval is pending. This release includes the tested, also-undeployed 2.52.1 source-reservation repair. No migration, new service or budget increase is needed.

## Why this change

Three genuine scheduled application runs completed execution on 9–11 October, but all six replacement-reviewer responses were rejected. The current reviewer retained three outputs and rejected three; all six writer drafts completed. The owner UI previously showed only a generic contract failure. Execution completion did not establish a working replacement reviewer.

The owner case view now adds **Inspect retained rejection**. It rechecks the retained response using the recorded case and matching evaluation configuration. Finite diagnostics distinguish malformed JSON, structure, missing quotations, unsupported numbers and other contract failures. Model text and raw exception messages are not returned. This is read-only: no model call, retry, budget change, receipt alteration or reviewer promotion.

A response that passes this later content check stays rejected. Original provider completion metadata was not retained with the response content; a passing recheck cannot reconstruct that missing cause. Changed configurations, unfinished receipts, missing content and invalid case membership remain unavailable. The customer writer, reviewers, prompts and their evaluation configuration are unchanged.

## Live quality work completed separately

The six repeated candidate rejections were verified in the production owner UI. The development evaluator was paused through its existing control; no active application run was observed and its three completed runs remain intact. Customer generation is unchanged. Keep the evaluator paused until the retained failures are diagnosed and a reviewed next step is established; do not resume simply because diagnostics are deployed.

All nine retained completed outputs were read against their complete fictional inputs and given revision-1 assessments, explicitly marked agent-assisted in every rationale. Six need work and three were assessed acceptable for those specific inputs. Issues range from clarity/contact placeholders to a substantive provenance failure: a fictional training exercise was presented within an employment paragraph as shift-improvement work. The two authored injection cases resisted the supplied attacks in their completed outputs; that is not general injection immunity.

There are zero completed replacement-reviewer outputs and no assessed current/candidate pairs. These judgments do not establish independent human quality, production accuracy, a better model or permission to promote. Five of the six needs-work judgments concern original writer stages; one concerns clarity in a current-reviewer output. Rejected outputs were not rated as if their text had passed validation.

The research failure was also inspected: the 10 October analysis step stopped after one model call and 157.1 seconds with `Model response incomplete.` This identifies the retained failure class, not its provider-side cause. No recovery/retry was triggered. Shared 11 October allowance stayed at two starts/six calls during this work.

## Validation

- All 514 tests pass on pinned Node 24.19.0. New tests cover distinct failures, non-disclosure, profile/case/receipt guards, passing-content ambiguity and an owner API read with unchanged records and zero model calls.
- Actual isolated Worker/auth/D1 with all 34 migrations returns the expected diagnostics to a fictional owner, rejects anonymous/member reads, retains rejected/non-assessable states, and makes zero model or outbound calls. The harness seeds configuration inside the bundled Worker: a Node-generated function fingerprint differs and correctly trips the configuration guard. No production configuration was rewritten.
- Comparing the bundled evaluation profile before and after this code change produced identical configuration and implementation hashes.
- Local authenticated browser inspection shows the malformed-JSON and absent-quotation explanations, preserves the rejection, and prevents assessment of the rejected fixture. This is synthetic runtime/UI evidence, not diagnosis of the six real responses.
- TypeScript, production build, 17 prerenders, asset budgets and Wrangler dry-run pass. Disk had 7.6 GiB available before execution; no dependencies were installed.
- Fresh 11 October dependency audit: zero high/critical and the same three moderate Mammoth/argparse/sprintf-js entries. The [official advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) still lists no patched sprintf-js version. No forced downgrade was made.

Evidence: `tests/evidence/application-quality-2026-10-11.json`. The production screenshot in the parent task's outputs folder records nine assessments and the paused evaluator. The diagnostic screenshot is explicitly local.

## Remaining acceptance

After authorized Cloudflare renewal, obtain a current read-only recovery receipt, deploy and verify this combined release. Inspect the six retained production candidate failures without new model calls. Preserve rejected/failed outcomes, the research hold, the evaluator pause, all original reservations and the PortmanDentex pause. A future model/prompt change requires a separate reviewed evaluation version; never delete or relabel this campaign. Hosted CI at the pushed head remains a separate check and is subject to the account billing lock. Do not merge the PR.
