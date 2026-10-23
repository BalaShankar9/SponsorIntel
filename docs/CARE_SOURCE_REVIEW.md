# Care-source review — 8 October 2026

Priory's official careers site exposes a public Pinpoint feed at [postings.json](https://jobs.priorygroup.com/postings.json). The inspected response contains 488 unique postings and URLs, with 43 declared deadlines. This is a candidate source, not an approved feed or 488 verified sponsorship opportunities.

## Advert evidence

Across the four published description sections, 371 records mention sponsorship. Most concern funding professional qualifications, not immigration. Four explicitly refuse sponsorship for their vacancies. The initial classifier missed those refusals because they omit the word visa. Release 2.46 recognizes direct employer refusals tied to the role or its new candidates, while retaining questions and qualification funding as not stated. Replaying this feed gives 484 not stated, four unavailable and no positive claims. This is a scoped diagnostic, not an independent recall study or a claim that nobody employed by Priory can be sponsored.

The [Bristol senior staff nurse advert](https://jobs.priorygroup.com/en/postings/3b42a685-dcc7-436b-b2a5-141d06d29038) was checked in the actual browser. It refuses sponsorship and excludes newly qualified/preceptorship nurses. The private queue retains the rejected sponsorship lead, its original URL, exact refusal and actual observation time. Rejection means it must not be promoted as a sponsorship opportunity; it does not mean the vacancy is closed. The other three refusals concern a housekeeper, Cardiff psychologist and physiotherapist.

Kingsley's [Liverpool registered nurse advert](https://careers.kingsleyhealthcare.co.uk/vacancies/view/registered-nurse-rgnrmn-6100/) is a separate unimported lead. Its application asks whether an applicant needs sponsorship; that question is not an offer. General international-recruitment pages also cannot establish sponsorship for every individual vacancy.

## Before source admission

1. Resolve reuse/linking conditions. [Priory's notice](https://jobs.priorygroup.com/legal) permits reproduction with unchanged material and attribution, but asks sites wishing to link to contact it and reserves withdrawal. No contact, bespoke permission, agreement acceptance or public Priory republication has occurred. Document appropriate clearance and the exact presentation before activating a feed.
2. Preserve all Pinpoint description sections and their headers, visible compensation only, original posting URL and declared closing time. [Pinpoint's official endpoint documentation](https://developers.pinpointhq.com/docs/jobs-json-endpoint) and [third-party listing guide](https://help.pinpoint.support/en/articles/5878344-how-to-list-pinpoint-jobs-on-any-website) describe public postings.json. This does not itself settle an employer's individual reuse conditions. Use a reviewed fixed host, bounded response and no arbitrary owner-supplied fetch URL.
3. Validate the UK location and employing entity per vacancy. Seven records have no postcode; several others contain inconsistent formatting. Do not infer UK eligibility from a generic remote label or a UK group headquarters. The sponsor register contains Priory Group, London (record b76a3e66800d7c2f4fb4d757); the website identifies Priory Group UK 1 Limited and several operating subsidiaries. No blanket employing-entity match has been approved.
4. Preserve original publication dates as unknown unless a source proves them. The inspected fields do not provide that date. Exclude expired, overseas, ambiguous and duplicate adverts; do not manufacture JobPosting dates or marketing eligibility.

No Pinpoint adapter or Priory source approval was added in 2.46. The review and classifier fix protect quality without inflating the public count. Broader care/hospitality coverage remains open. Evidence: `cloudflare/tests/evidence/care-source-review-2026-10-08.json`.
