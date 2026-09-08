# SponsorIntel · project guide

A UK sponsor intelligence application with data ingestion, search, scoring and background processing.

**For:** People researching sponsor organisations and related job information.<br>
**Current stage:** Application code · source freshness validation pending<br>
**Reviewed:** 8 September 2026, from repository files and available GitHub workflow records. This is a source review, not a fresh application test or production certification.

## Start with the evidence

- [backend](../backend)
- [frontend](../frontend)
- [Makefile](../Makefile)
- [docs/plans/2026-03-05-sponsorintel-platform-design.md](../docs/plans/2026-03-05-sponsorintel-platform-design.md)

## A useful first demo

Import a dated public dataset, search for an organisation and trace a result back to its original source. Show the distinction between sponsor status and an actual open job.

## Next release checklist

These are proposed acceptance gates. An unchecked item does not imply its implementation is absent; it means fresh release evidence is still needed.

- [ ] Fix the recorded backend-test and frontend-lint failures; document why the feature branch is currently the default.
- [ ] Display source dates, refresh status and provenance; measure coverage instead of relying on undated company or job totals.
- [ ] Validate a search-to-source workflow and label inferred sponsorship likelihood separately from confirmed facts.

## What to measure

Source-backed records passing freshness and deduplication checks / records presented, plus search task completion.

Publish the dataset or evaluation method, date range, sample size and limitations with each result. Code size, feature counts and agent counts do not measure product usefulness.

## What a finished showcase contains

Dated data sample, provenance trail, refresh report and a short research walkthrough.

Keep one dated release record containing the commit, setup steps, required services, checks run, known limitations and rollback instructions. Add screenshots from that version using fictional or consented data; identify demo fixtures clearly.

## Three ways to evaluate this project

| Visitor | Start here | Evidence to look for |
| --- | --- | --- |
| Potential client | The demo scenario above | A repeatable workflow and a measurable outcome |
| Engineering team | Linked source and tests | Design decisions, failure handling and reproducibility |
| Product user or collaborator | README setup and release notes | A supported journey, current limitations and feedback route |

[Repository overview](../README.md) · [Issues](https://github.com/BalaShankar9/SponsorIntel/issues) · [More projects](https://github.com/BalaShankar9)
