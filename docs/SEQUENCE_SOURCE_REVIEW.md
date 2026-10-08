# Sequence source review — 8 October 2026

Sequence is now an approved employer source using the existing Ashby adapter. Four current London vacancies are published, with three explicit sponsorship offers. The public collection increased from 904 to 908 jobs and from 50 to 53 offered/conditional sponsorship claims, across 34 employers. This is a configuration change on production 2.43.0, with no code release.

## Evidence chain and source identity

- Discovery lead: [LinkedIn Senior Product Engineer (Backend), London](https://uk.linkedin.com/jobs/view/senior-product-engineer-backend-london-at-sequence-4372208758). LinkedIn is the discovery reference, not the imported advert source.
- Employer original: [Sequence careers](https://www.sequencehq.com/about), which links the current roles directly to the employer's Ashby board.
- Legal identity: the employer's [privacy policy](https://docs.sequencehq.com/compliance/privacy-policy), updated February 2026, identifies Sequence HQ Ltd, company 13585168, at 27 New Dover Road, Canterbury CT1 3DN.
- The 7 October 2026 sponsor-register snapshot contains Sequence HQ Ltd, Canterbury, Skilled Worker, Worker (A rating), ID `76496ae7f3f326456b3703de`. The similarly named Sequence International Limited in London was not selected.
- Current source: [public Ashby board](https://api.ashbyhq.com/posting-api/job-board/sequence?includeCompensation=true). Its public access and fields are described in [Ashby's posting API documentation](https://developers.ashbyhq.com/docs/public-job-posting-api). No credentials or subscription were added.
- [Sequence's terms](https://docs.sequencehq.com/compliance/terms-of-service) concern its financial software services. No paid product account or financial API was used and no agreement was accepted. Public posting access is not evidence of a bespoke redistribution agreement or employer partnership.

The owner review flow saved, linked and probed source `reviewed-ashby-sequence`, provider `ashby`, board `sequence`, sector `finance`. Approval is recorded at 15:56:33.223 UTC. The reviewed employer licence link remains distinct from vacancy sponsorship and individual visa eligibility.

## Accepted and excluded records

| Accepted role | Advert evidence | Published job |
| --- | --- | --- |
| AI Engineer - London | Explicit sponsorship offer; £115,000–£130,000 | [View role](https://sponsorintel.london/jobs/3b19d70febf062dcd9110013) |
| Product Engineer - London | Explicit sponsorship offer; £90,000–£100,000 | [View role](https://sponsorintel.london/jobs/536242bffe0bdef9f8319c08) |
| Senior Product Engineer (Backend) - London | Explicit sponsorship offer; £115,000–£130,000 | [View role](https://sponsorintel.london/jobs/1cbc004ee3191d8ee1189088) |
| Senior Product Designer - London | Sponsorship not stated; £80,000–£95,000 | [View role](https://sponsorintel.london/jobs/e9d29fbcc11ce1f853c94429) |

The feed contains 11 listed vacancies. Seven US roles are excluded by the existing UK filter. An older London Account Executive lead, Ashby ID `e95e4179-8e24-493a-877f-8a826cd53701`, is absent from the current board and was not imported. Ashby `publishedAt` represents last publication; original publication dates remain unknown. First observed on Sponsor Intel is not described as first advertised.

## Publication and verification

Owner-triggered run `owner-a7d161dd-44c8-45ca-9d44-6b938d801daa` completed in D1 at 15:58:22.284 UTC. Cloudflare independently reports success and completion at 15:58:22.325 UTC with three workflow steps. Its single source task published four jobs on its first attempt, with zero duplicate IDs or application links.

All 18 normalized fields match for all four saved jobs, including complete descriptions, exact links, salaries, sponsorship evidence and date fields. The reviewed raw feed is 220,408 bytes, SHA-256 `b5574242ab3d4b408881f8d75819beb86b0eac1d85559e554c574b9b5e2e7bd5`. Full third-party text is omitted from repository evidence.

The normal Chrome browser confirms all four cards and aggregate totals of 908 jobs, 34 employers, 53 sponsorship claims and 855 licence-linked jobs. The AI Engineer detail contains its exact evidence and original link, with application preparation enabled. The employer's matching original advert and empty application form are accessible; no CV was uploaded and no application was submitted. A command-line public API diagnostic returned Cloudflare HTTP 403 / error 1010, so it is not reported as a passing API check. No security setting or user agent was changed to bypass that response.

Machine-readable aggregate evidence: `cloudflare/tests/evidence/sequence-source-2026-10-08.json`. The four-record source receipt is owner-triggered. This board is included in the existing six-hour collection schedule, but its first unattended run at 18:30 UTC remains to be observed. The next hourly movement capture is likewise pending; the earlier baseline is preserved. Automated LinkedIn ingestion, the private discovery ledger and independent classification-quality acceptance remain open.
