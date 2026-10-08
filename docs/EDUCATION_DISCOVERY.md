# Education discovery

The existing source refresh keeps known employers current. Release 2.49 adds a separate, bounded producer of **private candidates from new employers**. It runs in the hourly BusinessWorkflow, once per UTC day, and does not publish vacancies or change sponsorship labels.

## Reviewed source

The Department for Education operates [Teaching Vacancies](https://teaching-vacancies.service.gov.uk/). Its current [listing/API terms](https://teaching-vacancies.service.gov.uk/pages/terms-and-conditions#terms-and-conditions-for-api-users), dated 9 July 2026, explicitly permit reuse of listing data under [OGL v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), subject to its exceptions. They prohibit charging for links and charging fees/commission for contacting, interviewing or hiring respondents to reused listings. They do not endorse or vouch for advertisers' content. Keep listings and original links free; do not route these candidates into a paid hiring/referral service without a separate terms review. No applicant/contact details, attachments or logos are collected by this producer.

The public read API `/api/v1/jobs.json?page=1` worked without a key and returned 100 records. Its 8 October sample reported 7,432 records across 75 pages. This is a dated catalogue observation, not a count of sponsorship vacancies. The read API omits the structured visa field and does not implement a visa filter. The separate ATS publisher API is not this read endpoint and has not been connected.

The production scout therefore reads the public sponsorship-filtered search and individual public adverts. The official service source confirms the array parameter `visa_sponsorship_availability[]=true`, newest sort `publish_on`, and the separate visible visa row. References: [search form](https://github.com/DFE-Digital/teaching-vacancies/blob/main/app/form_models/jobseekers/search_form.rb), [job details](https://github.com/DFE-Digital/teaching-vacancies/blob/main/app/views/vacancies/listing/_job_details.html.slim), [public API controller](https://github.com/DFE-Digital/teaching-vacancies/blob/main/app/controllers/api/vacancies_controller.rb). Code licence and listing-data licence are separate; no external executable code was installed.

## Discovery and evidence

- Check up to two newest search pages; select up to two previously unretained advert URLs. The small sample is not whole-market coverage.
- Require the individual advert's exact visa row, matching title/URL, named employer, GB address, valid publication date and future closing timestamp. Reject observed contradictory visa refusals or closure wording. This is a deterministic source check, not a complete independent interpretation of every restriction.
- Read the page's JobPosting metadata and visible visa row together. Never infer visa sponsorship from school funding, an employer licence, a hashtag, or a search result alone.
- Retain a pending discovery revision with `system:teaching-vacancies-scout` attribution. Owner submissions cannot claim this recording method. Later owner/agent reviews append their own method and preserve the original candidate.
- Preserve the observation timestamp, date-only publication wording, exact closing timestamp, quote, named employer, source URL, page hash, terms and attribution. Leave `posted_at` blank when no publication time is supplied. Leave legal-identity verification blank and explicitly unreviewed.
- Candidates stay private. Do not count them as public jobs, confirmed employer licences, applicant eligibility, or evidence that an external application is open.

## Budgets, replay and controls

Maximum two education candidates per UTC day, within the existing five-new-agent-lead allowance. The daily browser routine must count candidates already retained that day and use the remaining slots for LinkedIn job adverts, ordinary recruiting posts, care/hospitality and other employers. It can review existing candidates without treating them as additional new discoveries. Owner-entered records also reduce the producer's remaining capacity.

Reserve up to four source requests before any I/O, inside the existing shared 500/day source allowance. Unused, failed and uncertain reservations remain consumed. Requests are serial, timed, body-limited, and confined to the reviewed host/paths. Redirects are held, not followed. The service receives the honest Sponsor Intel Referer/User-Agent. There is no model, Google API, credential, applicant-data, posting or email call.

The master Business operations switch and the separate Automatic education discovery switch both stop the producer. They are checked around outbound requests and again when saving a lead. A daily run identity, unique source keys, atomic lead/history/audit writes and retained receipts prevent replay from making additional requests. An interrupted running record becomes visibly uncertain; no automatic retry or allowance reset is provided.

## Acceptance and next work

Local parser/DB tests and a real isolated Cloudflare Workflow/D1 test pass. A read-only real advert sample was parsed successfully: King's Lynn Academy, Teacher of English, published 8 October, closes 19 October 2026 at 23:59 BST, with the explicit visa row. Its external school application and legal sponsor identity remain unreviewed. It was **not** inserted into production or published; see `cloudflare/tests/evidence/education-discovery-source-2026-10-08.json`.

First live producer execution and automatic retention of a new-employer candidate need their own scheduled receipts. Today already has five retained leads, so a held allowance receipt is expected; do not reset it or force additional sourcing. After midnight, inspect the genuine scheduled run and its source evidence.

Publication requires a separate employer review. The employer feeds retain one company per source. Do not import a multi-school feed under one company or transfer one school's sponsor-register match to other schools. Review the original external application route and legal hiring entity, then either connect a reviewed employer feed or implement a per-employer publication model with refresh/closure/deduplication tests. Ordinary LinkedIn posts remain in the authorized daily discovery procedure; continuous LinkedIn ingestion is not connected.


## Reviewed school publication (2.50)

The owner employer-feed form now supports one Teaching Vacancies school at a time. Supply the six-digit school URN, organisation slug, exact school display name, official careers page, current sponsor-record ID and evidence linking the school to its legal employer. A school and academy trust remain separate identities. Migration 0033 expands the provider constraint while retaining source records, reviews and owner references; it does not add or approve employers.

Approval reserves a 24-request read-only probe inside the shared 500/day source allowance. An approved school's six-hour refresh reserves the same bound inside the existing 150/run allowance. Collection reads at most two catalogue pages and 20 original adverts, then checks the catalogue again. Any wrong school URN/name, changed list, missing visa row, duplicate, contradictory sponsorship wording, redirect, oversized response or interrupted lease holds the batch. Previously published data and timestamps remain governed by existing source-failure and expiry rules. The complete bounded source receipt is retained in agent task evidence.

The initial HTML parser matches observed public pages, not an assumed undocumented API filter. Future markup changes can hold a feed and need review. A school with more than 20 adverts is held; raising the limit requires a separate budget/runtime review. The search service can ignore an unknown school slug, so every individual advert must also match the configured URN and school name.

Public details name Teaching Vacancies, preserve the supplied publication date without inventing a time, include OGL attribution and a free original link, and explain that attachments/external forms can contain additional conditions. No broader Google Jobs schema eligibility is claimed. The existing narrow publication/address requirements remain.

Research inspects a single original advert for Teaching Vacancies and SmartRecruiters, without a collection lease or cache writes. These reads reserve one request from the shared source allowance. Other existing research feed reads reserve their actual fixed feed cost. Application-page sample checks now recognise both providers' exact reviewed destinations; unknown redirects remain unconfirmed.

A read-only 8 October 2026 school probe inspected all seven King's Lynn Academy adverts and a repeated catalogue in nine requests: two had conditional sponsorship wording and five explicitly refused sponsorship. No production source, lead or job was created by the probe. `cloudflare/tests/evidence/education-publication-source-2026-10-08.json` records these limited results. School-to-trust legal review and external application-route review must finish before admission, within the existing discovery allowance.
