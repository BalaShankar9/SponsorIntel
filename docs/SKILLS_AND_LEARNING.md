# Skills and learning from sponsorship adverts

Owner-requested scope, 20 October 2026: turn current sponsorship adverts into practical learning directions, with relevant courses/resources on each role and a view of recurring skills across the selected catalogue. Build on Application Studio's existing learning-plan notes. This is a preparation tool, not an eligibility assessment or course marketplace.

## First slice (2.90)

`/skills` reads current offered/conditional adverts with a nonempty sponsorship excerpt. It excludes expired/stale/inactive roles, held or released-before-refresh reviews, unapproved sources and paused sources. Filters describe employer sectors, not occupation or immigration eligibility. A single read-time snapshot uses the common job freshness rule and a defensive review guard. It is bounded to 1,000 rows and four million description characters, with database-side suppression of oversized descriptions. Oversized selections return unavailable, never a partial ranking. No source fetch, AI call, CV read, new schedule or database migration is added.

The initial catalogue covers **17 skill topics and 15 provider resources**. Whole-term matching and conservative negation/training exclusions produce exact excerpts of at most 24 words. We deliberately call these *mentions*, not required skills: team tools, optional abilities and boilerplate can match. The matcher cannot interpret every advert, qualification or synonym. No match is unknown coverage, not absence of a skill. Source text is rendered as text, never HTML/instructions. Links are curated HTTPS provider URLs, never model-generated or taken from an advert instruction.

Counts deduplicate exact vacancy URL within each board and each skill within a vacancy. Employer boards are not independently resolved unique legal employers. Show total sample, matching/unmatched adverts, board count, largest-board contribution and generated time. Sort by distinct boards, then adverts; retain examples from different boards where possible. This describes an instant selected-catalogue sample, not a longitudinal trend, market prevalence, causality or probability of sponsorship. The client invalidates counts at expiry/deadline/freshness boundary (at most five minutes), refreshes on return, and shows unknown on failure.

Each current role shows matching topics, original excerpts, provider, course/tutorial/book type, starting knowledge, access/cost limitations and a Sponsor Intel practice-project suggestion. If a role is held/stale/expired, the current-role learning section is omitted. Training does not replace professional registration, a required degree, experience or visa conditions. Nothing is recorded as completed work. Regulated-role-specific learning and accredited qualification pathways remain open work.

Resource pages were checked against primary provider pages on **20 October 2026**, with review due **20 November**. Resources link directly to Harvard CS50, Microsoft, MDN, React, TypeScript, Go, Git, Docker, Kubernetes, AWS, Google and Open University OpenLearn. No course content is republished, purchase/enrolment is made, affiliate link used or certificate value claimed. Free reading is distinguished from optional certificates, software licensing, infrastructure, instructor training and exams. Review expiry pauses outbound learning links, including copied plans; update dates only after checking content/access again. This is a dated curated review, not a continuous link monitor or independent educational-quality evaluation.

Users choose topics and copy a plain-text plan containing prerequisites, links, access terms, practice tasks and empty fields for their own next step/completed evidence. Selection stays in page memory and is clearly labelled unsaved; copying is separate from account storage. It neither modifies CVs nor silently adds claimed qualifications. Saved cloud learning plans, CV-evidenced gaps and progress history are later slices and need the existing account isolation/backup/delete/replay controls.

## Continuing acceptance

- Review a stratified sample of live matches for technical, business and regulated occupations before expanding the vocabulary. Retain exact positive/negative cases and report misses rather than quietly relabelling them.
- Broaden employer/source coverage before making market-wide conclusions. Show concentration even when a skill's job count rises.
- Add verified healthcare, education, hospitality and engineering pathways, with clear prerequisites and official regulator links where needed. No short-course substitute for mandatory licensing.
- Add applicant-chosen saved goals and evidence of completed practice; keep inferred skill gaps separate from applicant facts. Existing AI learning plans remain a separate consented tool.
- Measure resource usefulness and applicant-reported outcomes separately from page views, course clicks, plan copies or course completion. No invented outcome/ranking/placement claim.

Validation and live acceptance belong in `cloudflare/RELEASE-2.90.md` and its dated receipt. Respect existing budgets, source approval and owner holds. The initial resource-review deadline is a documented operator action; an automatic course-review agent is not connected.
