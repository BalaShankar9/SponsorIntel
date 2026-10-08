# Sponsor Intel 2.36 — complete campus collections

Deployed 8 October 2026. Worker `153aa785-d64f-495d-9c8a-edea0d27805a` is verified at sponsorintel.london. No database migration or new dependency. Previous production Worker: `ee5df1cb-b60e-49f5-bc1b-1dedbff7a641` (2.35).

## Result

Cardiff Metropolitan's official Cyncoed and Llandaff feeds are collected as one employer and published together. The first real owner-triggered run `owner-4721cfa2-8e38-4ed8-aa44-2418f85645ae` completed at 11:27:21.471 UTC with one successful attempt, two reserved requests, fifteen input entries and fourteen public vacancies. One explicitly staff/student-only research opportunity is excluded. The collection now has 899 roles across 33 employers. All fourteen new adverts say sponsorship is not stated; the current exact Skilled Worker register connection is displayed separately.

Campus collection reserves both requests before network activity, preserving the existing 500 daily/150 run limits. All feeds must pass identity, deadline, restriction and record checks before publication. Shared identical references combine locations under one stable job ID. Conflicting text/deadlines or included-versus-excluded references fail the collection; a partial fetch cannot replace a complete prior snapshot. Failed/uncertain attempts retain reservations, and completed replays make no new calls. The source refresh remains every six hours.

The restriction parser now recognises the observed “only available to current employees and students” word order. Negative controls preserve ordinary external-applicant, student and negated wording. This is a bounded eligibility-screening rule, not a judgement about an individual's immigration permission. Coaching adverts preserve their own specific right-to-work warning. No supplied personal information is used to classify eligibility.

## Verification

- 372 tests pass on Node 24.19.0, including grouped deduplication/conflicts, second-feed failure, preserved previous publication, pre-fetch reservations, replay and insufficient remaining allowance.
- TypeScript/build, 17 public prerenders, browser asset budgets and Worker dry-run pass.
- The actual durable SourceWorkflow ran in isolated local Workerd/D1 against the downloaded source bytes, with zero remote bindings or outbound requests. All fourteen normalised records match Node; the exclusion persists with the publication and a completed replay reuses the run without another request.
- The live owner dashboard initiated the same deployed workflow. Its retained receipt shows two requests and one attempt. Every field of all fourteen public detail responses matches the reviewed source output. Public search HTML/API parity and all twelve opportunity checks pass. Browser results show fourteen roles, separate licence evidence, original deadlines and “Sponsorship not stated”.
- The 72 earlier current university records were reviewed against the extra restriction wording; no additional match was found in that observed set. Raw new feed byte hashes, exact source URLs, register identity and aggregate runtime/production receipts are in `tests/evidence/cardiff-campus-2026-10-08.json`.

## Remaining acceptance and rollback

This real production run was owner-triggered. The first unattended grouped refresh remains due at 12:30 UTC on 8 October. The same scheduled run must establish the 2.35 importer execution. Independent classification accuracy, useful applications, complete marketing cycles, Google reporting and business outcomes remain open. No AI allowance, Google attempt, email test or social send was forced for this release. No access permission or spending limit was expanded.

GitHub hosted checks remain separately subject to the account billing lock; local checks do not establish hosted Linux acceptance. The three moderate Mammoth/argparse/sprintf-js audit entries remain; the earlier sharp repair stays in place.

If a source problem appears, use its existing owner pause/quality-review controls and retain the evidence. A code rollback to the previous Worker does not undo published data, subsequent reservations or source observations. Preserve all later account, workflow and delivery state; do not restore production data to roll back this release.
