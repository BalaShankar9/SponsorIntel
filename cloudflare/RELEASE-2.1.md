# Sponsor Intel 2.1 — job evidence and immigration clarity

Released 4 October 2026 on https://sponsorintel.london. Updates: https://sponsorintel.london/updates. Worker version `d27b347a-c0e8-41c8-962f-31a518e7c7ab`; application version `2.1.0`. Existing launch branch and PR #1 remain the review surface.

## Delivered

- Expanded the collection from 243 to 359 UK vacancies at initial refresh: Monzo 56, Cloudflare 0, GoCardless 8, Deliveroo 125, Stripe 54, Figma 19, Octopus Energy 79 and Funding Circle 18. Eight configured boards, seven contributing UK results. Counts change with source adverts.
- Fixed missing Lever requirement/final sections and the incorrect early-career match for “Internal Audit”. Structured country/GB locations, duplicate-link exclusion, talent-pool exclusion, source pay excerpts and employment/workplace metadata improve evidence quality. The five current early-career labels are title-based, not confirmed eligibility. Thirty-three adverts state conditional sponsorship; no unrestricted positive label was found in this initial collection.
- Added a responsive immigration briefing with five explanations and ten watched GOV.UK resources: five guidance chapters, the Statements of Changes collection, and four recent linked publications.
- Added a 15-minute production schedule, protected manual refresh, source-health reporting, first-import baselines, bounded change history and a concurrency lease. Initial import at 13:31 UTC produced zero change-log events, correctly treating existing content as a baseline.
- Explanations are pinned to the source text and disappear after changes, withdrawal, a failed check or an hour without a successful check. Confirmed effective dates are displayed separately from source and detection timestamps. Actual text hashes detect updates even when GOV.UK metadata dates do not advance.
- Added the remaining-work roadmap in `docs/PRODUCT_ROADMAP.md`. Hire Stack remains the integrated application workspace.

## Acceptance

| Check | Result |
| --- | --- |
| Unit and persistence tests | 19 passed, including full Lever evidence, country/duplicate filtering, chapter selection, metadata-independent hashes, withdrawal state, stale-summary suppression, baseline/change deduplication and failed-source retention |
| TypeScript and production build | Passed |
| Local public API checks | 19 passed |
| Local quality checks | 11 passed |
| Local account regression | 19 passed; fictional accounts removed |
| Branded-domain public API checks | 19 passed at 13:32 UTC using ordinary system DNS and verified HTTPS |
| Branded-domain quality checks | 11 passed; all ten official sources healthy, all five pinned explanations available, all three new employer feeds populated |
| Branded-domain account regression | 19 passed; account isolation, save conflicts, recovery, origin enforcement and consent rechecked; fictional accounts removed |
| Browser acceptance | sponsorintel.london loaded over normal HTTPS; topic filtering and Graduate effective-date text verified; 390px and 1366px widths had no horizontal overflow; desktop used two card columns |
| Deployment | Migration 0004 applied; new Worker and all three schedules deployed |

Scheduled-execution evidence and the final PR check status are recorded below after observation. Configuration alone is not execution evidence.

## Recovery

Pre-migration D1 bookmark: `00000014-00000000-000050fa-8bef6fed08400a44bab08758aede5e56`. Migration 0004 adds three job metadata columns and isolated immigration/lease tables. A code rollback to the previously verified 2.0 Worker can leave these additive schema changes in place. Do not restore the database blindly: a full restore would also revert newer account updates or deletions, which require reconciliation.

## Remaining limits

Coverage is a selected employer collection, not all UK jobs. Sponsorship and pay labels are automated evidence extraction and have not passed a large independent accuracy audit. A sponsor licence is not proof that a vacancy offers sponsorship. News monitoring covers selected official sources near real time, not every announcement instantly. Full statement PDFs are linked but not yet simplified; changed explanations require a checked revision. There is no verified-email delivery, subscription digest or personalised immigration decision service. GitHub-hosted checks were previously blocked by account billing and must be distinguished from local and live acceptance.

During local testing, the default synced SQLite folder produced an I/O failure; a hydrated `.nosync` test copy was used. The custom domain also caused Wrangler to rewrite local requests to an HTTP production origin; the preview command now fixes the local upstream explicitly. Production authentication was unaffected and was checked before and after deployment.
