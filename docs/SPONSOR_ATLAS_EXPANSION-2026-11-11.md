# Sponsor atlas retained-research expansion — 11 November 2026

The complete local atlas now includes **39 historical field claims for 10 register entries**, up from 13 claims for two entries. The additional material comes from already-retained public-source review records. All **127,873 latest register entries** retain their dossier, source trail, register history and individual research plan. This advances the owner's complete company-directory requirement without presenting old research as current business verification or activating production saving.

## What was added

| Exact register organisation | Retained business context | Added claims | Review record dated | Important boundary |
| --- | --- | ---: | --- | --- |
| Fill Function UK Ltd | Eucalyptus brand and group relationship | 2 | 8 October | Group membership, not an assumed trading name, website operator or licence for other group entities. |
| Sequence HQ Ltd | Sequence operating organisation, company 13585168, careers route | 4 | 8 October | Distinct from Sequence International. No inferred sector or current vacancies. |
| Wintermute Trading Limited | Wintermute operating organisation, company 10882520, website and careers | 5 | 8 October | Retain Cheshire exactly as supplied in the register; later office evidence does not rewrite the register location. |
| Callosum Ltd | Callosum group relationship, company 16076949, careers route | 4 | 11 October | Parent/website operator Callosum Technologies 16646869 is a different entity. No licence transfer or exact vacancy-employer inference. |
| Neudata Limited | Neudata operating organisation, company 09942593, careers route | 4 | 18 October | Reuse/feed and availability reviews remain separate. No advert observation clock is borrowed for legal pages. |
| Eastern Multi-Academy Trust | Company 07338780 | 1 | 8 October | Identifier only. School links requiring query URLs were excluded under the unchanged packet URL contract; no school or advert authority imported. |
| New City College Corporation | New City College operating organisation and careers route | 3 | 17 October | No invented Companies House number, complete campus list or release of the Plumbing advert hold. |
| Danu Insights Limited | Danu Insights name, company SC788592, careers route | 3 | 11 October | No private decision paragraph or later availability/reuse clearance is imported. |

These eight dossiers add **26 claims and 19 retained review records**. The original Numan and Animal Trust subjects, 13 claims, six exact source observations and overdue follow-ups remain unchanged. Across the expanded packet, there are nine business-name, eight relationship, eight official-identifier, seven careers, three website, two activity and two location claims. These are claim counts, not independently verified companies or field-coverage approvals.

The new immutable packet is `docs/data/sponsor-atlas-expanded-evidence-2026-11-11.json`, SHA-256 `44be39f7d6a32204263a6f66d44fe7f021e93050503928df41f0d24c7ede05a2`. Every subject is bound to the exact 11 November CSV digest, normalized key, name/town/county tuple and source-row set. All 25 evidence records refer to 13 distinct retained files whose hashes were checked against actual bytes. A separate agent-assisted semantic review found no material issue; it is not independent human or fresh primary-source verification.

## Dates and unknowns

The existing schema required an actual source-observation timestamp. Many useful retained reviews record only a calendar review date. Schema 2 now supports `retained_operator_review` with **`observed_at: null`** and an explicit `reviewed_on` date. It does not substitute a workflow, source-approval, report-generation or unrelated advert timestamp. No midnight or timezone is invented. Schema 1 and its exact timestamped evidence remain supported.

The interface explicitly says **Retained review dated [date]; original source observation time not recorded**. Mixed evidence retains separate date and timestamp labels. Actual saved dossier files preserve the kind, null, calendar date, original timestamps and old follow-ups. The general field label is **Business / brand name**, so a group brand is not silently described as a trading name.

For the eight additions, no dedicated business-profile follow-up was established, so that field stays unknown. Discovery follow-ups are not repurposed. Current business fields, vacancies and role-specific sponsorship remain uncollected. **Zero businesses are newly verified.** URL-only mappings without a supporting factual review, query-bearing links, customer data, private decisions and old job counts were not populated as company facts. A newer register snapshot does not renew older research or clear any source, advert or publishing hold.

## Validation

- **43 Python tests pass**, including strict schema versions/kinds/dates, future/impossible dates, null observation time, exact bindings, rejection without mutation, limits and all existing register/history behavior. A same-template old/new-builder comparison produces byte-identical schema-1 outputs across four evidence/history combinations; this is builder compatibility, not a claim that the new interface copy is byte-identical to the old interface.
- **21 full-register browser checks pass** on the final real pack. All 10 historical dossiers display their claims and save exact source/date/follow-up evidence. Search, filters, paging, unknown states, mobile layout and keyboard focus pass. There are no external requests or browser errors.
- **Eight additional grouped browser checks pass** with fictional mixed-date evidence, schema-1 compatibility, no-evidence fallback, hostile literal text and unsafe links. Pacific/Honolulu testing verifies that calendar dates do not shift. Exact downloads and 390px layout pass. Desktop/mobile screenshots were inspected.
- An independent full-data verifier confirms every one of the 127,873 latest entries and the entire 129,824-key comparison exactly matches the prior independently raw-CSV-verified edition. The comparison CSV is byte-identical. All latest CSV register columns remain exact: eight new rows gain evidence columns; the two original pilot rows change only their packet digest. All 39 claims, 25 receipt hashes, six original observations, 19 null-time reviews and generated file/code hashes match.
- Initial test failures are retained. A browser assertion assumed a bare-origin link would not gain the browser's trailing slash; the corrected assertion compares parsed link URLs while saved evidence is still compared exactly. An independent verifier initially assumed evidence-bearing CSV bytes would stay identical after adding evidence; it now checks every unchanged register column and precisely the ten expected evidence-row changes. A fictional screenshot selector was made unambiguous after a separate harness failure. These corrections did not relax evidence or identity checks.

No dependency or application runtime changed. The unchanged package/lock retain today's official-advisory review; the earlier 906-test app build is dated prior evidence, not a rerun for this standalone Python/HTML increment. The eight unrelated tracked edits and private local-state archive remain preserved.

## Delivery and remaining work

The six-file edition is delivered in the Sponsor Intel project as **Sponsor company atlas 2026-11-11 expanded**, with a ZIP. All copied files and every ZIP member hash/CRC match the verified final pack. Prior final, evidence and history editions are preserved.

ZIP: **65,568,551 bytes**, SHA-256 `13bbd4c6c9956e66e37aec0e81f9276e26fa226ce044e22fcf91715e887603d7`. HTML: **69,756,269 bytes**, SHA-256 `71650caea8099ca2c283d28180ce78560b0efe97eae00778950b2d11cb3d2149`. Aggregate receipt: `cloudflare/tests/evidence/sponsor-atlas-expansion-2026-11-11.json`. Raw source-selection records, failed/final logs, independent verifier and browser artifacts remain under ignored `cloudflare/data/atlas-expanded-2026-11-11/`.

Full register coverage is implemented locally; broad current business research, evidence-backed sector/location/contact coverage, independently accepted entity matching, careers/vacancy refresh and live integration remain incomplete. The active goal and `SPONSOR_COMPANY_ATLAS_PLAN.md` preserve those requirements. The live identity desk's 500-record ceiling is unchanged.

No new network enrichment, D1/data-backed HTTP check, source/model/Google request, lead, application, send, migration, deployment or hold release occurred in this increment. Current controls and allowance remain unavailable following today's explicit quota failure. Capacity, current recovery/schema and original business-workflow evidence retain their gates. Commit/push and exact-head CI are recorded separately on the existing draft PR without merging or rerunning billing-blocked checks.
