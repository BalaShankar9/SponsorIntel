# Sponsor Intel discovery and sponsorship-count audit

Observed 8 October 2026, 15:13–15:18 UTC. The owner specifically asked why the sponsorship count remains 50 and requested both LinkedIn job listings and ordinary recruiting posts in the discovery work.

## Initial audit at 15:13–15:18 UTC

The public API reports 904 current vacancies from 33 employers; all approved sources refreshed successfully on 8 October. 851 roles have a reviewed employer licence link, a separate fact from vacancy-level sponsorship. There are 16 offered-wording and 34 conditional-wording roles, totaling 50. The distribution is Monzo 31, Callosum 10, Seamflow 5, Maven 2, Sampura 1 and Nottingham 1. This concentration shows limited source diversity, not broad UK-market coverage.

Stored business snapshots on 7 October show 846–848 roles; those on 8 October show 846–904. The stated/conditional total remains 50 in all 23 inspected snapshots. Current records include 99 first observed on 7 October and 63 on 8 October; each day includes one still-current conditional role. First observed does not mean newly advertised. The recent examples are Monzo Data Director EU and Nottingham Research Assistant SCI2300026. Thus membership can change while the total stays flat. Existing snapshots do not identify every removal/reclassification, so an exact net-change explanation is not yet available.

A bounded keyword audit inspected all 84 active unknown-wording records containing sponsor/certificate-of wording. Many uses refer to export licences, commercial sponsors or research funders, and five university records explicitly caution that their role may not qualify. No broad positive relabeling follows. Two Precision AQ adverts contain a clear applicant work-authorisation exclusion missed by the current rule; 2.42.1 addresses that narrow case. A replay changes exactly those two of the 84 audited records, and both corrected live warnings were verified after the existing source workflow refreshed Precision AQ. This keyword review is not an independently labeled recall/accuracy study.

## LinkedIn discovery evidence

LinkedIn's separate job feed pilot is disconnected. Neither the company posting connection nor personal sign-in provides a working market-wide jobs/posts collector. Keep access/terms/cost gates in `LINKEDIN_AND_AGENT_OPERATIONS.md` explicit.

Public search does reveal ordinary recruiting posts, but recency in a search result often means recent crawling. For example:

- [Argo's company posts](https://gt.linkedin.com/company/argoaviation) lead to [B1 engineer J1493](https://www.argo-aviation.co.uk/job/b1-licensed-engineer-8/). The recruiter page explicitly welcomes sponsorship applicants, but shows a December 2025 posting and an unnamed client. It is a research lead; current opening, employing sponsor and publication rights require verification before listing.
- [A fabrication recruiting post](https://www.linkedin.com/posts/selvakumarangamuthu_hiringnow-fabricatorjobs-welderjobs-activity-7399740184361336832-DmiV) appeared in a recently crawled result but the opened post says 10 months. Hold as stale/unverified; do not turn it into a fresh vacancy.
- [UK Visa Sponsorship Jobs](https://uk.linkedin.com/company/lavhi) shares October healthcare leads. These are aggregator assertions and need original employer text, live deadline and eligibility checks; no NHS redistribution access has been activated.
- [Cancer Research UK's LinkedIn vacancy](https://uk.linkedin.com/jobs/view/senior-software-engineer-at-cancer-research-uk-cruk-4470243590) matched a sponsorship search but explicitly denies sponsorship and gives a 4 October closing date. Reject from current sponsorship opportunities.

No third-party post was republished, no recruiter was contacted and no paywall, login restriction or contract was bypassed. Search snippets and repeated posts are leads, never counts of verified new roles.

## Priority implementation work

1. Add a private discovery ledger with distinct LinkedIn job/post, employer-original and recruiter sources; capture original URL/ID, observed versus posted time, quoted claim, employer identity, destination, deadline, duplicate group and decision reason. Promote only source-backed, current evidence. Preserve source changes and withdrawals.
2. Run bounded scouting across engineering, care/health, education, hospitality and early-career employers using available public search, approved feeds and user-submitted links. Ordinary company/recruiter posts belong in the same lead queue; an anonymous-client post stays a lead. Review a maximum of five new leads per daily Codex routine, within existing budgets, without promising five publishable roles.
3. Review employer-original adapters for accepted leads. Complete the existing LinkedIn-origin supplier pilot only after its access and actual subscribed rights/cost conditions are known. Do not buy or enable a subscription automatically.
4. Add daily movement evidence: verified new roles, closures, changed sponsorship wording, duplicate/rejected leads, new employers, source age, review backlog and source concentration. Show offered and conditional counts separately. Alert on failed discovery output/overdue reviews, not merely a flat headline count. Old first-seen timestamps cannot reconstruct a missing historical transition ledger.
5. Expand the independent phrase-quality evaluation with these actual exclusions and social-post edge cases: recruiter claims, sponsorship requested by a jobseeker, questions, overseas-only roles, visa switching restrictions and expired reposts. No automatic model promotion from these examples.

The next meaningful success is a new employer and a genuinely checked additional opportunity discovered from a documented lead, plus a repeatable scheduled receipt. The Sequence addition below establishes the first two parts; its scheduled refresh remains to be observed. Maintenance checks, model calls, more agent titles and a larger unverified count are not that outcome.

The existing 10:00 UK daily Codex routine now includes the bounded public-lead review above; its full saved prompt was read back exactly. This schedules scouting work, not a connected LinkedIn feed or a guarantee of daily publishable vacancies.

## 2.43 implementation progress

Prospective hourly movement is implemented and live in the owner operating desk. The first capture is a baseline; later captures show offered/conditional totals, gains/losses, entered/returned/left roles, exact before/after sponsorship excerpts and source concentration. Daily totals reconcile all observed events; the most recent 50 changes are individually inspectable. No historic change is inferred and events between observations may be missed. This partially addresses priority 4; a private lead-decision ledger/backlog and automated new-employer discovery remain unimplemented. The first genuine scheduled observation is verified: business-497631 at 15:45:50.632 UTC, completed in D1 and independently by Cloudflare. The owner panel matches all 904/16/34/33 totals. A later observation with an actual transition remains a separate gate.

## Verified source expansion at 15:58 UTC

A LinkedIn lead was followed to Sequence's own careers page and current public Ashby board. The employer's legal notice identifies Sequence HQ Ltd in Canterbury, matching its exact current Skilled Worker register entry. The existing owner review flow approved this specific source and licence relationship; no broad company-name inference or new adapter was used.

The first owner-triggered collection published four London roles, including three whose adverts explicitly say visa sponsorship is available. The fourth, Senior Product Designer, stays `not_stated`. Seven US vacancies and an older London sales lead absent from the current feed were not published. All 18 normalized fields, including complete descriptions and application links, match the four saved records.

The public browser now shows **908 roles, 34 employers, 53 offered/conditional sponsorship claims and 855 licence-linked jobs**. This is a reviewed configuration addition on release 2.43.0, not a new code deployment or a connected LinkedIn collector. Ordinary recruiting posts continue to enter the bounded discovery review as leads; they require the same employer-original, date and identity checks.

Cloudflare independently confirms that `owner-a7d161dd-44c8-45ca-9d44-6b938d801daa` completed at 15:58:22.325 UTC. The new board participates in the existing six-hour collection schedule; its first unattended refresh is due at 18:30 UTC and is not yet verified. The next hourly movement observation is also pending; the earlier 904-job baseline is preserved. See [Sequence source review](SEQUENCE_SOURCE_REVIEW.md) and `cloudflare/tests/evidence/sequence-source-2026-10-08.json`.

## 2.44.1 discovery queue and real movement receipt

The private lead ledger in priority 1 is now live, with ordinary LinkedIn posts distinguished from job adverts, canonical source deduplication, append-only evidence/decisions, explicit follow-up, bounded history pagination, distinct linked-job counts and changed-evidence checks. Three actual earlier reviews establish linked, held and rejected records. A linked lead must match an already-published current approved job and does not create another vacancy. The daily routine was updated to use the queue; future unattended scouting remains to be observed. See [Discovery queue procedure](DISCOVERY_QUEUE.md).

The genuine 16:45 UTC business run `business-497632` completed at 16:46:00.554 UTC, independently confirmed by Cloudflare. It records the queue's 3 leads / 1 unresolved / 1 current linked job and captures the four actual Sequence additions with three sponsorship claims gained and none lost. The public totals reconcile **50 → 53**, **904 → 908**, **33 → 34 employers**. This closes the first real movement-transition gate from 2.43. Broader automatic new-employer discovery, LinkedIn ingestion, the next six-hour Sequence collection and independent quality acceptance remain separate work.

## 2.45 verified Wintermute expansion

A public employer-original lead now adds Wintermute through the existing Lever adapter. Its exact legal identity and old Cheshire address are supported by the employer site and Companies House filing history. Of 18 feed records, 16 UK-inclusive roles are published and two US-only roles excluded. A narrow classification fix recognizes its direct commitment to arrange UK visa sponsorship; it changes only the new team-lead advert and leaves all 908 earlier job labels unchanged. The other 15 Wintermute adverts remain not stated. The live collection is 924 jobs, 35 employers, 54 offered/conditional claims and 871 licence-linked roles.

The owner-triggered source run completed at 17:20 UTC, independently confirmed by Cloudflare; all 18 normalized fields match every new record. The employer-original team-lead lead is retained in the private queue, making four historical leads with two linked distinct jobs. Its first unattended collection and the next movement capture remain open. This addition is senior finance/technology coverage; it does not resolve hospitality, care or early-career source gaps or connect automatic LinkedIn ingestion. See [Wintermute review](WINTERMUTE_SOURCE_REVIEW.md).

## 2.46 care-source review

Priory's official public Pinpoint feed provides 488 candidate adverts, but no explicit sponsorship offer was identified by the scoped review. Qualification-funding benefits account for most sponsorship keywords. Four role-specific refusals omit the word visa; the 2.46 correction recognizes them while changing no existing active label or excerpt. The browser-confirmed Bristol nurse refusal is retained as the fifth private lead and is rejected as a sponsorship opportunity. No Priory adverts were published and no employer-wide sponsorship promise was inferred. Source reuse/linking, adapter/location validation and employing-entity review remain prerequisites for admission. See [Care-source review](CARE_SOURCE_REVIEW.md). Broader sector discovery and a working LinkedIn collector remain open.


The next genuine scheduled business run, `business-497633`, completed at 17:45:59.797 UTC, independently confirmed successful by Cloudflare. Its 17:45:50.511 UTC movement capture records 16 Wintermute entries and one sponsorship claim gained, none lost: **53 → 54**, **908 → 924 jobs**, **34 → 35 employers**. The actual owner browser matches. The same run sees all five retained leads, one unresolved and two distinct current linked jobs, with no overdue reviews or changed links. The daily routine was updated in place and its full prompt, schedule and target read back exactly. The Sequence/Wintermute 18:30 UTC source refresh and next unattended discovery pass remain unobserved; this receipt proves movement monitoring, not autonomous source discovery.
