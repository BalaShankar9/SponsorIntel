# Sponsor Intel discovery and sponsorship-count audit

Observed 8 October 2026, 15:13–15:18 UTC. The owner specifically asked why the sponsorship count remains 50 and requested both LinkedIn job listings and ordinary recruiting posts in the discovery work.

## What is established

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

The next meaningful success is a new employer and a genuinely checked additional opportunity discovered from a documented lead, plus a repeatable scheduled receipt. Maintenance checks, model calls, more agent titles and a larger unverified count are not that outcome.

The existing 10:00 UK daily Codex routine now includes the bounded public-lead review above; its full saved prompt was read back exactly. This schedules scouting work, not a connected LinkedIn feed or a guarantee of daily publishable vacancies.
