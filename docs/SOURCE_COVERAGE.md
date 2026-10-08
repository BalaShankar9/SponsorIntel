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

These deterministic rules are narrow and can miss new wording. They are not a claim of universal external-applicant eligibility. Closing dates are currently applied on ingestion, so an advert may remain visible between its deadline and the next successful feed refresh. Persisting explicit deadlines and enforcing them on every public read is the next freshness improvement. Do not silently backdate or manufacture a new successful observation.

## Further coverage

- Review other explicitly UK campuses rather than treating one campus as a whole university. Count unique institutions separately from feed count.
- The [NHSBSA integration page](https://www.nhsbsa.nhs.uk/about-nhs-jobs/nhs-jobs-integration-and-benefits) documents a self-serve XML/RSS feed and external job-board integrations. Its employer-focused guidance is not proof that Sponsor Intel has a blanket redistribution licence. Confirm the applicable outbound-use conditions and employer scope before connecting a feed. No NHS account, authenticated API request or subscription was created, and no outreach was sent.
- Leeds' current site was inspected but an enabled public campus feed was not established in this review. It remains unconfigured.
- The LinkedIn-origin supplier pilot retains its separate terms, access and UK-sample gates in LINKEDIN_AND_AGENT_OPERATIONS.md.

Record raw-byte hashes and source review receipts; do not treat the 41-role sample as a market coverage or classification-accuracy estimate. The live publication result belongs in RELEASE-2.22.md and the corresponding evidence JSON.
