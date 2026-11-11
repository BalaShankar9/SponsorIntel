# Sponsor atlas register-history acceptance — 11 November 2026

The complete offline company atlas now compares two retained official register snapshots. Every latest entry still has its register dossier and research plan; the optional history shows exact before/after records and keeps earlier-only entries separate. This advances the owner's complete company-directory requirement in `SPONSOR_COMPANY_ATLAS_PLAN.md`. It adds no newly verified business profiles and does not publish to the live website.

## Sources and reconciliation

| | Earlier supplied snapshot | Latest supplied snapshot |
| --- | --- | --- |
| Home Office file date | 2 October 2026 | 11 November 2026 |
| Actual observation | 4 October 07:58:43.247144 UTC | 11 November 15:46:45.099861 UTC |
| Source rows | 143,138 | 143,009 |
| Grouped register entries | 127,902 | 127,873 |
| Distinct normalized name strings | 127,309 | 127,310 |
| SHA-256 | `67a7bcb01f31570fa906584ee429ed4d5a5fabf17e5b914b9bc42656c8743ac1` | `b47added0ad52e51af64b32319b7b8b463dddd0f04ce101eeb3ab427c0571682` |

Both original CSVs were already retained. No file was fetched again, and the original observation dates were preserved. The later October import time is not substituted for the earlier download observation. Exact source URLs, byte counts and receipt hashes are retained in the aggregate acceptance receipt and pack.

Matching uses only the existing whitespace-normalized/casefolded name, town and county tuple. **125,951** keys occur in both files; **1,922** occur only in the latest and **1,951** only in the earlier file, giving **129,824** union keys. Among matched keys, **160** have a recorded route/rating-pair or spelling-variant difference: 97 pair-set differences and 67 spelling differences, with overlap. Another 124 have count-only differences. Every source row reference and pair is retained.

These are snapshot differences, not grants, revocations, closures or relocations. A changed name/location stays unmatched: the London and Ilford records named 18 NOVEMBER LTD are not automatically linked. Duplicate counts and reordered rows do not become primary content changes. No legal-company identity is inferred from a register key.

## User experience and exports

The latest snapshot is the default, with its original 127,873-entry denominator. Additional views show changed exact matches, latest-only entries and explicitly historical earlier-only entries. Search, town and route filters use the selected view. Dossiers show both dates, records, route/rating pairs, recorded variants, source references and count differences. Earlier-only dossiers require a new current baseline before further business research.

The six-file local edition includes self-contained `index.html`, `data.json`, latest `register-entries.csv`, new `register-comparison.csv`, README and receipt. The HTML works offline with no background requests. Individual downloads contain the selected full records, comparison and compact provenance, without unrelated location catalogues. Spreadsheet exports neutralize formulas and use noncausal difference headings.

The latest snapshot's entries, metadata, evidence and register CSV remain identical to the previous evidence edition. The **13 historical claims / six observations for two entries** retain their October dates and overdue follow-ups. Earlier-only entries cannot inherit that packet. **Zero newly verified businesses**; websites, operating names, legal relationships, sectors, careers and current vacancies still require fresh field-level review. The live identity desk's 500-record ceiling remains unchanged.

## Validation and delivery

- **35 Python tests pass**, covering complete union, exact identity boundaries, paired values, variants, duplicate/row-order cases, collision rejection, invalid dates/partial arguments, evidence isolation, formula safety and output replacement refusal.
- An independent raw-CSV implementation verifies every current row, every earlier row and all **129,824 comparison/CSV rows**, including source references, variants, pairs and counts. It checks all output hashes and byte-identical latest register export against the prior delivered edition.
- **13 grouped comparison browser checks pass** using the real complete pack and fictional edge cases; **21 existing complete-register browser checks pass**, including both historical dossiers and exact downloads. No browser errors or external requests. Mobile overflow, keyboard/focus, hostile text, optional-comparison compatibility and no inferred relocation pass. Desktop and mobile screenshots were visually inspected.
- The final source hashes match the build manifest. No dependency change; the unchanged package/lock retain the same-day official-advisory review. The earlier 906-test application validation is dated prior evidence, not a rerun for this standalone Python/HTML feature. No application runtime or migration changed.

Delivered in the Sponsor Intel project folder as **Sponsor company atlas 2026-11-11 history**, plus ZIP. All six copied files match the verified pack; every ZIP member hash and CRC was verified. Prior `final` and `evidence` editions remain intact.

ZIP: **65,559,500 bytes**, SHA-256 `6cc8a51ff0d99744f7375c1449ed90a7d7cbbdbaae216e800db622755f3a700d`. HTML: **69,736,757 bytes**, SHA-256 `76ecfb4bdb6f780637a4939c01f33408c5e56ecd51685cd234afe042574981e1`. The aggregate receipt is `cloudflare/tests/evidence/sponsor-atlas-history-2026-11-11.json`; raw logs, independent oracle/verifier, screenshots and delivery evidence are retained under ignored `cloudflare/data/atlas-comparison-2026-11-11/`.

## Remaining gates

Fresh business enrichment, reviewed legal/operating identities, broad careers/vacancy coverage and live integration remain incomplete. Current production controls and remaining capacity cannot be read under today's D1 quota failure, so no enrichment batch was attempted. No new source request, D1 query, model/Google call, lead, application, email/social send, deployment or private-saving activation occurred during this history increment.

A separate provider-only evening source observation returned only the original completed overnight run; missing 18:30 evidence remains unknown. It clears no source, capacity or supervisor hold. See `source-evening-2026-11-11.json`. The goal remains active for authorised bounded work. Code and aggregate evidence are committed to the existing draft PR; exact pushed-head CI is recorded separately after push without rerunning billing-blocked jobs or merging.
