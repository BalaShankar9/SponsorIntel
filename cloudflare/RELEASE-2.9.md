# Release 2.9 — broader employer evidence and university opportunities

Published 7 October 2026 at https://sponsorintel.london. Worker `504c8624-ee0d-4056-a933-eb748e4390ae` serves app version 2.9.0. Previous Worker: `0c5cd7b7-d483-4dd9-94cc-ab866bff32fd`. No migration, new credential, paid feed or account change was required.

## What changed

Reviewed all 20 previously unlinked employer boards. Twelve gained a public identity-backed connection to an exact Skilled Worker register record; eight remain explicitly unverified. New feeds for Numan and the two universities add three further connections, bringing the configured total to 21. Eucalyptus remains unlinked because a similar register name is not sufficient identity evidence. All 21 exact IDs were checked against the official 6 October CSV; live reads still require a current successful register check and an active Skilled Worker entry.

Four new sources add current UK roles from Numan (European Lever), Eucalyptus (Greenhouse), the University of Bath's Bath-campus RSS and the University of Greater Manchester's Bolton-campus RSS. The university adapter uses fixed reviewed URLs/channel titles, bounded XML, source-specific character encoding and exact allowed vacancy links. Expired closing dates are excluded at successful refresh using the UK calendar, including clock changes. Invalid feeds preserve the prior complete source data.

University feeds are partial collections of recent campus jobs. A missing item is no longer in this collection, not necessarily closed; the original employer page remains the authority. Role pages now name the university source and warn that summaries can omit attachments/eligibility details. The university's current name and the sponsor register's legal name appear separately where different.

The opportunity page also offers direct links to Ennismore hospitality careers and BakerHicks graduate schemes. These links do not establish a copied hospitality feed. NHS integration, hospitality reuse permission and unresolved identities remain in the source ledger.

## Live acceptance on 7 October

All 30 sources completed the production refresh successfully at approximately 09:22 UTC. At 09:23 UTC the catalogue had:

| Collection | Roles |
|---|---:|
| All current UK opportunities | 839 |
| At 21 companies with reviewed licence links | 755 |
| Advert states or conditionally mentions sponsorship | 51 |
| Early-career titles | 49 |
| Early-career titles with stated/conditional sponsorship wording | 2 |
| GBP pay wording present | 102 |

These are overlapping collections. Among the 755 licence-linked roles, sponsorship was stated in 0, conditional in 35, not stated in 629 and unavailable in 91. A licence does not mean a vacancy offers sponsorship or an applicant qualifies.

The four new sources contributed **75 roles**: Numan 7, Eucalyptus 34, Bath 28 and Greater Manchester 6. All 75 had **sponsorship not stated** in the fetched text. The change from the preceding 763-role snapshot is 76 because an existing source's count also changed; do not attribute that whole difference to the four new feeds.

The active official register was dated 6 October, with 127,934 employer/location records and a successful scheduled check at 07:15:14 UTC on 7 October. This is evidence of that completed scheduled run, not a claim of instant register updates. Job feeds continue every six hours.

## Validation

- All 77 automated tests passed under Node 24.19.0, including seven university/EU-provider cases. The final per-feed encoding change passed the seven affected tests again. TypeScript, the production build and Wrangler compilation passed; 17 public pages were pre-rendered.
- The production licence scan traversed all 755 filtered roles, checked uniqueness, reconciled 21 entities against the sponsor endpoint, compared sponsorship intersections and verified role initial HTML. Opportunity checks passed for all 30 fresh sources, pay/sector/early-career filters and unauthorised refresh denial.
- Live role-page checks passed for initial HTML, public metadata, HEAD, canonical redirects, missing-role 404s and a sitemap with 839 roles plus 17 public pages. Additional acceptance traversed all four new sources, reconciled each source count, checked university source/pay/deadline text and verified Eucalyptus did not gain a licence link.
- Browser checks confirmed the education/licence intersection returns 55 roles (34 university roles plus 21 Multiverse roles), and exercised a new university role page. Both catalogue and detail pages measured 390px scroll width at a 390px viewport. The new hospitality/graduate discovery links wrapped correctly on mobile.
- Greater Manchester's source fetch failed with an internal connection error in local workerd. An isolated authenticated hosted Cloudflare preview returned six roles, and the deployed production refresh then succeeded with six. No access controls were bypassed and no static snapshot was substituted for a live feed.

Public acceptance snapshots are saved in `tests/evidence/source-expansion-2026-10-07.json`; employer identity decisions are in `tests/evidence/employer-link-review-2026-10-07.json`. The provider API references and all identity sources are in `JOB-SOURCES.md`. The XML parser is MIT-licensed and included in the generated open-source notices.

## Remaining work

Resolve the eight original unlinked boards and Eucalyptus through actual legal-entity evidence. Broaden explicit graduate sponsorship, permitted clinical/NHS and hospitality feeds; current selected sources are not market-wide coverage. Complete the 50-advert accuracy audit and 20 CV/advert benchmark before making measured-quality claims.

Hosted CI is separate from local and production acceptance: the preceding commit's workflows were blocked before starting by the GitHub account billing lock. Dependency maintenance also remains: npm reported six existing dependency/advisory entries (three moderate, three high), none in the added RSS-parser dependency tree. No blanket dependency upgrade or billing change was made. Existing account-email inbox placement, ratings/data licences and wider product gaps remain in the roadmap.

Sponsor Intel and sponsorintel.london remain the selected brand and primary domain.
