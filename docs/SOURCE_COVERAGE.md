# Source coverage and review

Updated 8 October 2026. Expand coverage through employer originals, preserve source restrictions and observation times, and keep a sponsor licence separate from an advert's wording.

## Added campus feeds

| Employer | Explicit feed scope | Observed feed entries | Accepted by parser | Excluded |
| --- | --- | --- | --- | --- |
| University of Southampton | Highfield Campus only | 27 | 27 | 0 |
| University of Nottingham | University Park only | 35 | 14 | 8 past closing dates, 12 titles explicitly marked Internal Only, 1 unreviewed distribution marker |

Discovery: [Southampton's official RSS directory](https://jobs.soton.ac.uk/RSS/) and [Nottingham's official RSS directory](https://jobs.nottingham.ac.uk/RSS/). Both list overseas campuses, so neither whole-university nor department-wide feeds are accepted as UK-only. Exact channel title, origin, path and vacancy reference validation remain required. Each source uses one fixed feed request in the existing six-hour workflow and existing request ceilings. There are now 32 configured sources; no new API key or subscription is needed.

The 41 accepted adverts have no explicit visa-sponsorship offer. Both universities were matched to their exact current Skilled Worker register records, with official employer careers-page identity evidence. A licence match does not prove this vacancy sponsors or that an applicant qualifies. Southampton includes two apprenticeships; the early-career label is a title signal, not a finding that international applicants meet funding, residence or immigration requirements.

The Nottingham feed declares ISO-8859-1 but its observed bytes validate as UTF-8; its adapter explicitly decodes UTF-8. Southampton declares and uses UTF-8. Original source dates, closing text, pay wording, and stable application links are retained. No feed observation date is substituted for the original publication date.

## Source restriction checks

University RSS entries with explicit internal-only titles or restricted-application wording are excluded. Ordinary mentions of internal colleagues, optional secondments or welcoming internal and external applicants are preserved. Nottingham's unexplained #INT / #LI-DNI distribution markers are withheld pending clarification; the system does not interpret them as proof of closure or internal eligibility. That decision is separate from the explicit internal-only rule.

A bounded private receipt records every excluded reference and reason alongside the atomic publication. The owner can inspect Source screening in the latest source run. Exclusion receipts contain reference IDs/reasons, not candidate data. Malformed channels, unsafe links, missing closing dates and excessive batch sizes still fail the source read and preserve the last successful snapshot.

These deterministic rules are narrow and can miss new wording. They are not a claim of universal external-applicant eligibility. Release 2.23 persists verified source deadlines and excludes passed roles at read time, even between successful feed refreshes. Date-only deadlines use the end of the UK calendar day and explicitly disclose that the exact time was not supplied. Expired links retain a reference page with noindex and paused preparation. Unknown deadlines remain unknown. The guarded backfill covered 75 stored university adverts without changing observation timestamps. Do not silently backdate or manufacture a new successful observation.

## Further coverage

### Cardiff Metropolitan campus collection, 8 October

The [university's own RSS directory](https://jobs.cardiffmet.ac.uk/RSS/) exposes fixed Cyncoed and Llandaff feeds. Both have exact pinned channel names, origins, vacancy-link paths and reviewed UK locations. The unscoped and “Other” feeds are not configured. Live bytes are UTF-8 despite a legacy ISO-8859-1 declaration. Two feeds now belong to one source/employer so campus expansion cannot inflate employer counts or duplicate identical cross-campus references.

The reviewed sample contains four Cyncoed and eleven Llandaff entries. Llandaff reference `2627038` explicitly restricts applications to current university employees and students; the corrected word-order check excludes it and preserves a private reason. The other fourteen records were published by a real owner-triggered source workflow at 11:27:20 UTC, with both HTTP requests reserved before collection. There are now 33 employer sources and 34 configured feed requests per complete attempt, within unchanged ceilings. The first unattended refresh remains due at 12:30 UTC. No general market-coverage claim follows.

All fourteen adverts lack an explicit sponsorship offer. Coaching adverts retain their original warning about visa restrictions on professional sports work; student-related titles do not establish eligibility. The exact current Skilled Worker register record is `0303f81c635c02e7229152c2`, Cardiff Metropolitan University, CARDIFF, source date 7 October. A second same-name record has only International Sportsperson and was not used for the Skilled Worker connection. A current company licence is not a vacancy offer or an applicant assessment.

Grouped feeds must all succeed before publication. Identical references merge locations; differing text, dates or restriction decisions stop the collection and preserve the last complete snapshot. Uncertain/failing requests retain their reservations; replayed completed work makes no new request. Existing single-campus collection behavior is unchanged. Tests include partial failure, conflict, duplicate and near-budget-boundary cases. All 72 previously stored current university adverts were also screened against the added word order, with no newly matched restriction. See `cloudflare/RELEASE-2.36.md` and the campus evidence receipt.

### Employer-advert extraction, 8 October

Release 2.35 fixes a reproduced Greenhouse encoded-HTML defect found in two current Graphcore adverts. The parser removes formatting attributes without treating a quoted `>` as a tag boundary, preserves text/paragraphs and keeps plain-description fields separate. A same-input review of 85 UK records has unchanged sponsorship labels; local Workerd matches Node exactly. Two guarded production text corrections preserve their original observations, labels and other public fields. The next scheduled source execution remains an acceptance gate. No historical reference annotation or customer draft was rewritten. See the release and `cloudflare/tests/evidence/advert-import-2026-10-08.json`.

### Eucalyptus identity review, 8 October

The [employer's own privacy notice](https://www.eucalyptus.health/privacy-policy), Annex B / United Kingdom, names **Fill Function UK Limited** for employer, consumer-services and service-provider contracts. The current imported official register (source date 6 October, checked 7 October) contains **Fill Function UK Ltd**, London, Skilled Worker, record `d6a811754495f7de7da70032`. The reviewed company link uses this evidence and the register's normal freshness checks. No link is inferred from Eucalyptus Holdco Limited or the Coventry Juniper Tech Limited name matches.

This is a company/brand connection, not proof of the employing entity or sponsorship for every vacancy. The 32 current Eucalyptus adverts observed after the 06:30 run still contain no explicit sponsorship offer; their wording classifications and source timestamps are unchanged. Each applicant must confirm the employing/sponsoring entity with the employer.

### Next coverage reviews

- Review other explicitly UK campuses rather than treating one campus as a whole university. Count unique institutions separately from feed count.
- The [NHSBSA integration page](https://www.nhsbsa.nhs.uk/about-nhs-jobs/nhs-jobs-integration-and-benefits) documents a self-serve XML/RSS feed and external job-board integrations. On 8 October, the [published NHS Jobs terms](https://www.jobs.nhs.uk/candidate/acceptable-use) were checked: commercial use requires prior written agreement, and the stated default extraction permission is personal/non-commercial. The employer self-serve guidance does not establish Sponsor Intel's redistribution rights. Obtain written agreement for the external job-board integration, including retention, attribution, closure handling and costs, before activation. `NHS_JOBS_ACCESS_REQUEST.md` contains an unsent request. No NHS account, authenticated feed request, subscription or outreach was created.
- Leeds' current site was inspected but an enabled public campus feed was not established in this review. It remains unconfigured.
- The LinkedIn-origin supplier pilot retains its separate terms, access and UK-sample gates in LINKEDIN_AND_AGENT_OPERATIONS.md.

Record raw-byte hashes and source review receipts; do not treat the 41-role sample as a market coverage or classification-accuracy estimate. The live publication result belongs in RELEASE-2.22.md and the corresponding evidence JSON.
