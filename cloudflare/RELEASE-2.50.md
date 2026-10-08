# Release 2.50 — reviewed school feeds

Education discovery can now lead to an owner-reviewed, regularly refreshed feed for one named school. The source collector verifies the school's URN and display name on every original Teaching Vacancies advert, preserves its exact visa wording and full visible role text, rejects contradictory claims, and rechecks the complete bounded catalogue before publication. A sponsor licence held by an academy trust remains a separate reviewed legal identity.

The owner form supports a school URN and organisation slug. Each approval probe or regular collection reserves at most 24 requests for two catalogue passes of up to two pages and 20 individual adverts, within the existing shared 500/day source allowance and refresh 150/run allowance. Failed reservations remain counted. This does not activate a source automatically or increase the five-new-lead daily discovery limit.

Job details include the DfE source, OGL attribution, free original link and date-only publication wording. Attachments/external forms still require separate review; Google Jobs eligibility remains under the existing narrow publication and address checks. Single-advert research can now inspect Teaching Vacancies and SmartRecruiters originals without trying to start a full paged collection or changing its cache. Research fetches share the source request allowance. Rotating application-page samples recognise both exact provider destinations.

## Validation

- 491 complete-suite tests plus one additional server-rendered education detail test passed (492 total), including the actual Cloudflare SourceWorkflow with isolated D1 and fictional school/trust records.
- Tests cover two-page/20-advert boundaries, full restriction wording, wrong school/URN/country/title, invalid dates, duplicates, changed catalogues, redirects, expiry, source pause/lease, atomic publication/replay, owner probe budget failures, research budget exhaustion and retained migration records/foreign keys.
- Production build, browser bundle budget and Wrangler deployment dry run passed with the installed runtime/dependency versions.
- Read-only live probe: seven King's Lynn Academy adverts, two conditional visa statements and five explicit refusals, nine requests including the repeated catalogue. No source/lead/job was inserted. Evidence: `tests/evidence/education-publication-source-2026-10-08.json`.
- Migration 0033 applied alone. Both existing employer-board records retained the exact pre-migration digest; foreign-key checks returned zero errors. Recovery inspection matched all 131 objects across 33 migrations and found a current recovery point. This was not a customer restore test.

## Remaining acceptance

No school is activated by this release. Complete the legal school-to-trust review and external application-route review before admitting a source within the discovery allowance. First unattended school publication, repeat refresh and removal outcomes remain unproven. The daily scout's first scheduled receipt is also pending as of the pre-release check; today already has five retained leads, so an allowance hold is expected. Do not reset it or force new sourcing.

LinkedIn job adverts and ordinary recruiting posts remain in the authorized daily discovery/review procedure. Continuous LinkedIn ingestion is not connected. PortmanDentex is still collecting its private catalogue for a later normal six-hour run; no extra bootstrap refresh is part of this release. No additional production AI/Google attempts, social posts or owner emails were triggered.

Hosted GitHub CI requires a separate exact-head check; the previous head was blocked by the GitHub account billing lock. Local runtime tests do not represent a successful hosted run. The broad autonomous business goal remains active.


## Deployment receipt

Deployed 8 October 2026 as Worker `7b710bae-a027-4199-bd1e-0c0df07f6d28`. Previous Worker `7a5da86f-2251-4378-a83c-407646e1a793` remains the code rollback reference; rolling back code does not undo migration 0033. The live owner form shows the DfE provider, school identifiers, education sector and separate legal-employer review. Selecting the provider did not submit a source. Public collection remained 926 roles / 35 employers / 55 sponsorship mentions (21 offered, 34 conditional); the unchanged count is expected because this release activates no new employer.
