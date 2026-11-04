# Sponsor Intel 2.22 — screened university opportunity feeds

The catalogue now includes the University of Southampton's Highfield Campus and the University of Nottingham's University Park feeds. The reviewed URLs identify explicit UK campuses; whole-university feeds also cover overseas locations and are not substituted.

The review found 62 entries. Forty-one were published: 27 Southampton and 14 Nottingham roles. Eight Nottingham entries were past their stated closing dates, 12 were explicitly internal-only and one carried unexplained distribution markers. That last item is withheld pending clarification; it is not declared closed or internal. Ordinary secondment wording and internal/external invitations are preserved. The new filtering applies to university RSS feeds, not every provider.

Both employers have exact reviewed Skilled Worker register links, but none of these 41 adverts explicitly offers visa sponsorship. They remain labelled sponsorship not stated. The two Southampton apprenticeships are title-based early-career matches, not immigration/funding eligibility assessments.

## Implementation

The parser checks campus identity, origin, reference, closing dates, publication timestamps and source bounds. It retains a private reference/reason list for skipped entries. Publication and the source-review receipt share the existing transaction; replay cannot fetch or publish twice. Source screening is visible in the owner run table. Nottingham's legacy XML encoding declaration disagrees with its observed UTF-8 bytes; its configured decoder preserves the actual characters.

No new schema, credential, provider subscription or model call is required. Both fixed public feeds use the existing six-hour source workflow, one request each, under unchanged 500-request daily and 150-request per-run ceilings. Source scouting and wider NHS/LinkedIn coverage are not automated by this release.

## Verification

- 265 local tests pass, including restriction/secondment distinction, campus isolation, encoding, retained exclusion receipts and replay. A prior test selected its licence fixture by array position; it now selects the known 6 October Monzo link by identity so newly reviewed 8 October links do not invalidate the historical fixture.
- Production typecheck/build, 17 public prerenders and Worker packaging pass. Worker `2d112601-4d21-4f21-8d79-9d1eab84fcfd` reports 2.22.0.
- Owner-triggered source runs `owner-db79bf6f-2a03-4296-89b8-1668729c3f9d` and `owner-38c7db59-d7fd-402c-b9a6-5f51c538ead6` completed with 27 and 14 published roles respectively. Each used one source request. Daily source requests increased from 30 to 32; the shared AI allowance remains four starts and six calls.
- The public opportunity smoke check passes all 12 checks: 32 source records, 887 current roles, 801 linked to reviewed licence records, 51 title-based early-career roles, 50 with stated/conditional sponsorship wording and 128 with GBP pay markers. These are selected-catalogue counts at observation, not market coverage or candidate outcomes.
- The owner table displays 35 Nottingham entries, 21 exclusions and their separate reasons. Source review inputs/hashes, exact register records and live publication evidence are in `tests/evidence/campus-source-review-2026-10-08.json`.

## Remaining acceptance

Observe the new feeds in a genuine scheduled run, audit future schema/wording changes and validate wider source coverage. Known closing dates are currently enforced at ingestion; an advert can remain visible until the next successful refresh. Persisting explicit deadlines and enforcing them on public reads is the next freshness improvement. This release does not establish universal eligibility or sponsorship accuracy.

For rollback retain jobs and source receipts. Use source pause to hide either feed if necessary; do not delete failed/excluded evidence or reset request reservations. See `docs/SOURCE_COVERAGE.md`.
