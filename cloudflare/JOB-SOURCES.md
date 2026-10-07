# Reviewed opportunity sources

Reviewed on 4 October 2026. These are public employer job boards, not a claim of sponsor-licence status. The collector uses the public Greenhouse Job Board API, Lever Postings API and Ashby public posting API. Employer sectors describe the company, not every job. No API key is needed for these reads. Each listing links to its source; applicants confirm the current terms with the employer.

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

`worker/employer-licences.js` records the exact register IDs and review dates. It checks only the active official snapshot on each API/detail request, requires the Skilled Worker route, and hides links if the last successful register check is at least 48 hours old, the publication is at least seven days old, or a refresh failed. A changed name/location produces a different ID and requires review; no fuzzy-name fallback is allowed. Unmatched means unverified here, not unlicensed. Remaining boards need identity review before their records receive links.

Approved boards from the owner intake also participate using their reviewed sponsor ID/date. Pending, paused and undated submissions never receive a public licence link. Internal evidence notes and reviewer identities are not exposed. No database migration is required.

## LinkedIn access and further coverage

Checked 6 October 2026: LinkedIn's [Job Posting API](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/sync-job-postings?view=li-lts-2026-04) publishes/manages employer vacancies on LinkedIn and requires partner access. It is not a general vacancy-download API. Signing in with LinkedIn would provide identity access, not a job-catalogue licence. No LinkedIn feed, partnership, credential or all-jobs import is connected.

LinkedIn's [User Agreement](https://www.linkedin.com/legal/user-agreement) restricts automated copying and redistribution without consent. A scraping vendor or publicly reachable guest endpoint is not evidence of reuse permission. Do not add login-cookie collection, a misleading Connect LinkedIn button or an unapproved mirror. A future feed requires explicit retrieval and republication rights, attribution, deletion/expiry rules and deduplication against employer originals. No partner application or paid subscription has been submitted.

The practical expansion path is to review more employers from the sponsor register, find their official careers/ATS feeds, confirm legal-entity evidence and feed reuse terms, and use the existing owner review queue. Prioritise healthcare, engineering, hospitality and regional employers to address the current finance/technology concentration. Add permitted aggregator feeds only under suitable terms; do not claim whole-market coverage. Existing six-hour job refreshes, daily register checks, failed-source retention, stale-job exclusion and source links remain in place.
