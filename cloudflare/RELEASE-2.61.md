# Sponsor Intel 2.61 — keep school evidence stable across navigation-count changes

The 11 October 18:30 school refresh changed the English advert's retained description only because DfE's site-wide ECT navigation count fell from 812 to 809. The exact discovery comparison correctly flagged the changed description; the source extractor had included unrelated navigation text. The original was reviewed and its history preserved in release 2.60.

The extractor now recognises only the exact official `/ect-suitable-jobs` link inside a single `Job role` summary row, with the known navigation wording. It retains **Suitable for early career teachers**, removing only `View all`, the site-wide count and `jobs`. Removing the whole link would lose the suitability label. Different destinations, queries/fragments, summary keys, wording, added conditions and unfamiliar structures remain verbatim. Other text, including numbers in salary/requirements, is untouched. Visa validation still examines the complete original visa row. The discovery proof comparison, source identity checks, catalogue validation, holds, budgets and research contracts are unchanged.

## Validation

All 595 tests pass on pinned Node 24.19.0 in 54.90 seconds. An actual isolated SourceWorkflow/D1 test performs five complete fictional school collections: initial publication, count-only change, qualification/application-instruction change, deadline change, then a sponsorship refusal. The count-only change keeps the linked proof current; each substantive change marks it historical. A separate held advert stays inactive across all five collections. Three immutable discovery revisions and original proof are preserved; 20 fixture requests remain inside 120 reserved slots. No external request or production workflow is used by these tests.

Focused tests retain the suitability label and salary/qualification/application text, preserve unfamiliar links and negative wording, and confirm that closure/visa conflicts still reject the batch. An initial assertion incorrectly expected a diagnostic code in the deliberately generic exception message; it now inspects the retained structured diagnostic and passes. The provider's exact public Job role DOM was inspected and saved as a small attributed fixture; its temporary browser tab was closed.

Offline replay compares the prior and new extractor on the retained 8 October original English page. Only the description changes: the exact navigation phrase containing the historical count 843 becomes the same suitability label. Every remaining description character and other source field is identical; job identity, conditional sponsorship, quote and deadline remain unchanged. This archived replay is not a fresh employer observation or proof of a new production refresh.

TypeScript, build, 17 prerenders, unchanged browser budgets and deployment dry-run pass. Research and application source identities remain unchanged. No dependency or schema change is required. The same-day 18:45:15 UTC recovery check matched 38 migrations / 162 objects with a current recovery point; it was not a restore or retention-window test. Rollback is 2.60 Worker `0dda75ee-b323-494d-be95-02bde39c200f`.

## Production boundary

Existing source data and discovery history are not rewritten at deployment. At the next genuine scheduled collection, the removal of the old navigation phrase can create one expected description/proof change; review that exact transition without silently rebasing earlier evidence. A subsequent genuine count change/refresh is needed to prove live stability. Do not force an owner refresh, release an advert hold, reclassify sponsorship or reset any allowance to manufacture acceptance. Unattended model quality, marketing acquisition and end-to-end autonomous business outcomes remain separate open gates. Live verification follows.

## Live verification — 11 October 19:02 UTC

Worker `bd079c7f-3a02-44b5-850b-a0918d3b994f` serves 2.61.0 on sponsorintel.london from code `b21419bada3ef3ca1c0d7d5921ed1b52551838b3`. Excluded HTTP QA confirms health, 928 current roles / 36 employers / 55 sponsorship-worded / 887 licence-linked, and 403 for the anonymous owner dashboard. Compared school jobs, English discovery revisions, model controls/history, owner pauses and the two-start/six-call budget are unchanged; foreign-key inspection has zero rows. Both prepared model source identities are unchanged. No migration or dependency update was needed.

Exact code-head checks 114549339942 and 114549329255 did not start because the account is locked by GitHub billing; both annotations were read. Secret scan 114549380590 passed. This limitation remains separate from the complete local checks. Aggregate receipt: `tests/evidence/teaching-navigation-2026-10-11.json`.
