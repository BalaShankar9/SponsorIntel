# Reviewed opportunity sources

Reviewed through 7 October 2026. These are public employer job boards, not a claim of sponsor-licence status. The collector uses the public Greenhouse Job Board API, Lever Postings API (global and European regions), Ashby public posting API and explicitly reviewed university RSS feeds. Employer sectors describe the company, not every job. No API key is needed for these reads. Each listing links to its source; applicants confirm the current terms with the employer.

| Employer | Sector | Public board | Provider |
|---|---|---|---|
| Monzo | Finance & fintech | [Employer board](https://monzo.com/careers/) | greenhouse |
| Cloudflare | Technology | [Employer board](https://www.cloudflare.com/careers/jobs/) | greenhouse |
| GoCardless | Finance & fintech | [Employer board](https://gocardless.com/about/careers/) | greenhouse |
| Deliveroo | Commerce & delivery | [Employer board](https://careers.deliveroo.co.uk/) | greenhouse |
| Stripe | Finance & fintech | [Employer board](https://stripe.com/jobs) | greenhouse |
| Figma | Technology | [Employer board](https://www.figma.com/careers/) | greenhouse |
| Octopus Energy | Energy & climate | [Employer board](https://octopus.energy/careers/) | lever |
| Funding Circle | Finance & fintech | [Employer board](https://www.fundingcircle.com/uk/careers/) | ashby |
| Zopa | Finance & fintech | [Employer board](https://jobs.lever.co/zopa/) | lever |
| Zeeco | Engineering | [Employer board](https://jobs.lever.co/zeeco/) | lever |
| Invinity Energy Systems | Energy & climate | [Employer board](https://jobs.lever.co/invinity/) | lever |
| WEP Clinical | Healthcare & life sciences | [Employer board](https://jobs.lever.co/wepclinical/) | lever |
| Nucleus Global | Healthcare & life sciences | [Employer board](https://job-boards.greenhouse.io/nucleus) | greenhouse |
| ApotheCom | Healthcare & life sciences | [Employer board](https://job-boards.greenhouse.io/apothecom) | greenhouse |
| Precision AQ | Healthcare & life sciences | [Employer board](https://job-boards.greenhouse.io/precisionaq) | greenhouse |
| AXON | Healthcare & life sciences | [Employer board](https://job-boards.greenhouse.io/axonag) | greenhouse |
| Graphcore | Technology | [Employer board](https://job-boards.greenhouse.io/graphcore) | greenhouse |
| BakerHicks | Engineering | [Employer board](https://job-boards.greenhouse.io/bakerhicks) | greenhouse |
| HR Wallingford | Engineering | [Employer board](https://job-boards.greenhouse.io/hrwallingford) | greenhouse |
| Allica Bank | Finance & fintech | [Employer board](https://jobs.ashbyhq.com/allica-bank) | ashby |
| The Voleon Group | Finance & fintech | [Employer board](https://jobs.ashbyhq.com/voleon) | ashby |
| Multiverse | Education | [Employer board](https://jobs.ashbyhq.com/multiverse) | ashby |
| Callosum | Technology | [Employer board](https://jobs.ashbyhq.com/callosum) | ashby |
| Sampura Research | Technology | [Employer board](https://jobs.ashbyhq.com/sampura) | ashby |
| Seamflow | Technology | [Employer board](https://jobs.ashbyhq.com/seamflow) | ashby |
| Maven Securities | Finance & fintech | [Employer board](https://job-boards.greenhouse.io/mavensecuritiesholdingltd) | greenhouse |
| Numan | Healthcare & life sciences | [Employer board](https://careers.numan.com/) | lever (EU) |
| Eucalyptus | Healthcare & life sciences | [Employer board](https://www.eucalyptus.health/careers) | greenhouse |
| University of Bath | Education | [Bath campus RSS](https://www.bath.ac.uk/jobs/rss/rss.aspx?cat=418&type=9) | university-rss |
| University of Greater Manchester | Education | [Bolton campus RSS](https://jobs.greatermanchester.ac.uk/RSS/rss.aspx?cat=927&type=9) | university-rss |

API references: [Greenhouse](https://developers.greenhouse.io/job-board.html), [Lever](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api).

Coverage limits: selected employers only; technology and finance remain overrepresented. Healthcare includes life-science services and is not an NHS-wide feed. Student and graduate job titles do not establish visa compatibility. Sponsorship labels come from the fetched advert body and published supplementary text, not private application forms. A public board can remain open after the practical recruitment deadline. Add additional sources only after checking an actual official board, its API, locations and representative eligibility wording.

## Employer licence links — reviewed 6 October 2026

The separate `licence=matched` filter includes every current UK vacancy on a reviewed company board, even if sponsorship is unstated or explicitly unavailable. The advert classification is never upgraded by licence ownership. These are reviewed brand/group connections to named register records, not confirmation of the employing entity for every vacancy. The detail page explains that distinction and links to the register and public identity evidence.

| Board | Exact register name | Location | Public employer identity evidence |
|---|---|---|---|
| Monzo | Monzo Bank Ltd | London | [Careers page legal footer](https://monzo.com/careers/) identifies Monzo Bank Limited, company 09446231. |
| GoCardless | GoCardless Limited | London | [Legal footer](https://gocardless.com/legal/) identifies GoCardless Ltd, company 07495895. |
| Funding Circle | FUNDING CIRCLE LTD | LONDON | [Company information](https://www.fundingcircle.com/uk/about-us/) identifies Funding Circle Limited. |
| Zopa | Zopa Bank Limited | London | [Official contact/legal footer](https://www.zopa.com/contact) identifies the bank, company 10627575. |
| Graphcore | Graphcore Limited | Bristol | [Official licence agreement, definition on page 1](https://www.graphcore.ai/hubfs/assets/pdf/Click%20wrap%20license%20agreement.pdf) names Graphcore, Limited and its Bristol address. |
| Allica Bank | Allica Bank | London | [Careers page legal footer](https://www.allica.bank/careers) identifies Allica Bank Limited, company 07706156; related finance entities are separate, so the group/entity limitation remains visible. |

`worker/employer-licences.js` records the exact register IDs and review dates. It checks only the active official snapshot on each API/detail request, requires the Skilled Worker route, and hides links if the last successful register check is at least 48 hours old, the publication is at least seven days old, or a refresh failed. A changed name/location produces a different ID and requires review; no fuzzy-name fallback is allowed. Unmatched means unverified here, not unlicensed. Further boards need identity review before their records receive links; the 7 October review outcomes follow below.

Approved boards from the owner intake also participate using their reviewed sponsor ID/date. Pending, paused and undated submissions never receive a public licence link. Internal evidence notes and reviewer identities are not exposed. No database migration is required.

## Expansion and employer review — 7 October 2026

Reviewed all 20 previously unlinked boards. Twelve now have an evidenced legal-entity connection; eight remain unresolved. Three of the four new boards also have a reviewed connection, bringing the built-in total to **21 reviewed links across 30 feeds**. All 21 exact name/city/county IDs were checked against the official [6 October register CSV](https://assets.publishing.service.gov.uk/media/6ac4b79911ed58342ad8e4c5/SP_-_Worker_and_Temporary_Worker_Web_Register_-_2026-10-06.csv). These counts describe configured sources and reviewed connections, not companies guaranteed to sponsor every job.

| Board | Exact register name | Location | Public identity evidence |
|---|---|---|---|
| cloudflare | Cloudflare Limited | London | [Identity source](https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/) |
| deliveroo | Roofoods Ltd t/a Deliveroo | London | [Identity source](https://deliveroo.co.uk/legal/) |
| stripe | Stripe Payments UK Ltd | London | [Identity source](https://stripe.com/gb/legal/spukl) |
| figma | Figma UK Limited | London | [Identity source](https://www.figma.com/uk-tax-strategy/) |
| octopus-energy | Octopus Energy Limited | London | [Identity source](https://octopus.energy/quote/terms-and-conditions/) |
| zeeco | Zeeco Europe Limited | Rutland | [Identity source](https://www.zeeco.com/privacy-policy) |
| invinity | Invinity Energy (UK) Limited | London | [Identity source](https://invinity.com/wp-content/uploads/2024/10/2022.05.12-Invinity-Energy-UK-Ltd-Terms-and-Conditions-for-the-Supply-of-Goods-FINAL-1.pdf) |
| axon | Axon Communications Inc. | London | [Identity source](https://axon-com.com/legal-and-privacy/) |
| bakerhicks | Baker Hicks Limited | Warwickshire | [Identity source](https://bakerhicks.com/en/privacy) |
| hr-wallingford | HR Wallingford Group Limited | Wallingford | [Identity source](https://www.hrwallingford.com/sites/default/files/2024-10/bc048_sustainability-report-2024-r02-00_0.pdf) |
| multiverse | Multiverse Group Limited | London | [Identity source](https://community.multiverse.io/privacy_policy) |
| maven | Maven Securities Holding Limited. | London | [Identity source](https://downloads.modern-slavery-statement-registry.service.gov.uk/pdf-published/Z4ESldnl/2023/2023%20-%20Slavery%20and%20Human%20Trafficking%20Statement.pdf) |
| numan | Vir Health Limited trading as Numan | London | [Identity source](https://www.numan.com/legal/terms-and-conditions) |
| university-bath | University of Bath | Bath | [Identity source](https://www.bath.ac.uk/jobs/rss/) |
| university-greater-manchester | University of Bolton | Bolton | [Identity source](https://greatermanchester.ac.uk/assets/Uploads/Instrument-of-Government.pdf) |

The University of Greater Manchester's official instrument identifies its former University of Bolton name, which is still used by the current register record. Maven's government-hosted 2023 statement establishes the group identity; current licence status comes from the current register, not the older statement. Full exact IDs, evidence URLs, dates and unresolved decisions are in `tests/evidence/employer-link-review-2026-10-07.json`.

- **wep-clinical**: No exact WEP Clinical entry; public privacy page does not establish the registered sponsor identity. Similar WEP names are not evidence. [Reviewed source](https://www.wepclinical.com/privacy-policy/).
- **nucleus**: No Nucleus Global entry. Nucleus financial-services records are unrelated; possible medical-group relationship needs a documented employing entity. [Reviewed source](https://job-boards.greenhouse.io/nucleus).
- **apothecom**: No exact brand entry. ApotheCom is part of Inizio Medical, but a group connection alone does not resolve which sponsor record to show. [Reviewed source](https://www.apothecom.com/).
- **precision-aq**: Precision AQ Intl, Ltd is a plausible record; the reviewed privacy page and careers site do not establish the UK legal entity connection sufficiently. [Reviewed source](https://www.precisionmedicinegrp.com/privacy-policy/).
- **voleon**: No Voleon-name Skilled Worker record in this snapshot; legal-entity evidence still needed. [Reviewed source](https://jobs.ashbyhq.com/voleon).
- **callosum**: Callosum Ltd is on the register, while the website names Callosum Technologies Ltd. Do not equate them without evidence. [Reviewed source](https://www.callosum.com/privacy-policy).
- **sampura**: No exact Sampura entry; no reviewed UK sponsor identity. [Reviewed source](https://jobs.ashbyhq.com/sampura).
- **seamflow**: Seamflow Ltd in Cheshire is a candidate, but the reviewed public terms name Seamflow Inc. The Ashby board has not been tied to that UK legal entity. [Reviewed source](https://www.seamflow.com/terms).

The new Eucalyptus board is also unlinked: the reviewed careers page confirms the healthcare brand and board, but does not establish a connection to the similarly named Eucalyptus Holdco Limited register entry. Do not add that alias without evidence.

### New source scope and access

- **Numan**: the official careers URL redirects to its European Lever board. The documented public EU API provided 11 vacancies; seven were UK roles at the local 7 October check. The other four were excluded. This uses published job postings, not copied consumer health articles.
- **Eucalyptus**: the careers site points to its public Greenhouse board. The local check found 34 UK roles among 114 global postings. Global vacancies are not imported as UK jobs.
- **Bath**: its official RSS directory exposes a Bath-campus filter. The checked feed contained 28 current roles, spanning research and campus services.
- **Greater Manchester**: its official RSS directory exposes the Bolton-campus filter, including Queens and Greater Manchester Business School. The checked feed contained six current roles.

Those four snapshots added 75 UK roles, all with sponsorship **not stated** in the fetched text. Production counts and refresh results are recorded in `RELEASE-2.9.md`. Do not turn university benefits pages, register membership or a conditional policy into an offer for each vacancy.

University RSS is a partial collection of recent vacancies, not a complete university-wide feed. The importer pins the campus channel title, source host and vacancy-link path, excludes expired closing dates using the UK calendar, and caps response size/item count. Missing or malformed deadlines, unexpected campus channels, unsafe links or broken XML fail the whole read and preserve the prior data. A vacancy disappearing from a feed means it is no longer in this collection; that does not prove it has closed. RSS summaries can omit attachments or eligibility conditions, so the detail page asks visitors to read the full employer advert. No job applications are submitted by these feeds.

### Sources assessed but not connected

- **Soho House**: a public board exists, but the site's [terms](https://www.sohohouse.com/terms-and-policies/terms-and-conditions) restrict commercial reproduction/distribution. Obtain appropriate permission before mirroring it; no permission request was sent.
- **Ennismore**: the [official careers portal](https://ennismore.com/careers/) is now a direct discovery link. Its vacancies are not copied into Sponsor Intel; a permitted feed and legal-entity mapping still need review.
- **BakerHicks graduates**: the existing feed already contains graduate vacancies. An [official early-careers link](https://bakerhicks.com/en/careers/early-careers) improves discovery without inventing additional openings.
- **Quell Therapeutics**: a confirmed official board returned no vacancies at review; not added as active coverage.
- **Lindus**: access was unavailable; no controls were bypassed and no feed was added.
- **NHS Jobs**: [official integration guidance](https://www.nhsbsa.nhs.uk/about-nhs-jobs/nhs-jobs-integration-and-benefits) describes external job-board feeds. The appropriate documented feed/channel and access requirements still need verification. The current NHS Jobs link is outbound discovery, not an integrated NHS-wide feed.

## LinkedIn access and further coverage

Checked 6 October 2026: LinkedIn's [Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/sync-job-postings?view=li-lts-2026-04) publishes/manages employer vacancies on LinkedIn and requires partner access. It is not a general vacancy-download API. Signing in with LinkedIn would provide identity access, not a job-catalogue licence. No LinkedIn feed, partnership, credential or all-jobs import is connected.

LinkedIn's [User Agreement](https://www.linkedin.com/legal/user-agreement) restricts automated copying and redistribution without consent. A scraping vendor or publicly reachable guest endpoint is not evidence of reuse permission. Do not add login-cookie collection, a misleading Connect LinkedIn button or an unapproved mirror. A future feed requires explicit retrieval and republication rights, attribution, deletion/expiry rules and deduplication against employer originals. No partner application or paid subscription has been submitted.

The practical expansion path is to review more employers from the sponsor register, find their official careers/ATS feeds, confirm legal-entity evidence and feed reuse terms, and use the existing owner review queue. Prioritise healthcare, engineering, hospitality and regional employers to address the current finance/technology concentration. Add permitted aggregator feeds only under suitable terms; do not claim whole-market coverage. Existing six-hour job refreshes, daily register checks, failed-source retention, stale-job exclusion and source links remain in place.
