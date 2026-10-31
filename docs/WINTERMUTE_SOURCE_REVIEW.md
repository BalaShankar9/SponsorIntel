# Wintermute source review — 8 October 2026

Wintermute is an approved Lever source. Its 18-record public board contains 16 UK-inclusive vacancies and two New York-only vacancies, both excluded. Exactly one London advert explicitly offers UK visa sponsorship; 15 remain not stated. The live collection is **924 jobs, 35 employers and 54 offered/conditional claims**, compared with 908/34/53 before this addition. These are observation-time totals, not a promise of current vacancies or individual eligibility.

## Identity and original evidence

The employer's [opportunities page](https://www.wintermute.com/company/opportunities) lists the same 18 vacancy IDs/titles as its [public Lever feed](https://api.lever.co/v0/postings/wintermute-trading?mode=json). The [original team-lead page](https://www.wintermute.com/company/opportunities/66a6c9f0-b504-4942-af22-b555969564e5) and [Lever advert](https://jobs.lever.co/wintermute-trading/66a6c9f0-b504-4942-af22-b555969564e5) agree on sponsorship support. The employer's empty application form is accessible; no personal information was entered or application submitted.

The official site's footer names Wintermute Trading Ltd, company 10882520. [Companies House](https://find-and-update.company-information.service.gov.uk/company/10882520) reports it active. Its [filing history](https://find-and-update.company-information.service.gov.uk/company/10882520/filing-history) records the 29 January 2025 move from Altrincham, Cheshire to London. That supports the legal-entity match to Wintermute Trading Limited, Cheshire, Skilled Worker / Worker (A rating), ID `bfdf4216a82c578531f2bead`, in the current 7 October register snapshot. The register and Companies House locations are not asserted to be equal today.

[Lever documents public published postings](https://github.com/lever/postings-api). The existing fixed-provider adapter is used; no arbitrary destination, credential, subscription, personal information or application API is involved. Public access does not establish a bespoke employer agreement or partnership.

## Classification correction and exclusions

The original advert explicitly commits to arranging UK visa sponsorship. Version 2.44.1 missed this verb and returned not stated. Version 2.45.0 recognizes a narrow direct-employer statement; conditional wording stays conditional, and refusal and question cases are covered. A full replay of the 908 existing active adverts produces zero label/excerpt changes. The 16-record Wintermute replay changes only Product Engineering - Team Lead to offered.

The [published role](https://sponsorintel.london/jobs/fca0bd0481d33af61b30598c) requires eight or more years of engineering and three or more years of technical leadership. It is not an early-career opportunity. The board's Graduate Algorithmic Trader 2027 is New York only and excluded. A past UK assessment-day social post is not treated as a fresh vacancy. Original posting dates and deadlines for accepted roles remain unknown; collection time is not publication time. Multi-location adverts retain the employer's location wording.

## Publication and retained review

The owner UI approved source `reviewed-lever-wintermute-trading` at 17:19:25.560 UTC after the existing fixed-endpoint probe. Owner-triggered run `owner-8c14dccd-83ef-4416-b2cd-693911c71cb5` completed at 17:20:18.514 UTC; Cloudflare independently reports success at 17:20:18.556 UTC. Sixteen jobs published on the first attempt with no duplicate IDs or application links. All 18 normalized fields match the reviewed feed for every stored role, including complete descriptions. The raw 228,116-byte feed SHA-256 is `97c244f03997e4a92c1e1c74b6e467f69406f20d76630ee17efc6b3edb49bddf`. Full third-party text is omitted from committed evidence.

The employer-original discovery lead `1e992bbb-f821-4646-aa96-4ce3ce7cb19a` is linked to the current team-lead job with exact source wording and legal-identity evidence. Its actual observation time is 17:22 UTC and revision 1 was recorded at 17:22:59.049 UTC. Posting and deadline fields remain blank. The record is explicitly agent-assisted, not an independent human assessment. It links an already-published job and does not count a second role.

The public browser verifies 924 roles / 35 employers / 54 positive-or-conditional claims / 871 licence-linked roles, and the team-lead detail's exact evidence and original link. The daily routine was updated and read back exactly with its schedule and limits preserved. The source participates in the existing six-hour schedule; its first unattended refresh at 18:30 UTC is still to be observed. The next hourly movement capture also needs its own receipt. See `cloudflare/tests/evidence/wintermute-source-2026-10-08.json`.
