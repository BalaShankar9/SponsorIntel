# Release 2.51 — identify new schools, not just new advert URLs

The daily education scout could retain multiple adverts from the same school as separate new-employer leads. It now requires a six-digit school identifier from the original advert, retains that identifier in private evidence, and checks previously retained school leads and all existing school-feed configurations before adding a candidate. The insertion repeats these checks atomically, so a concurrently configured school cannot create another lead. Pending and paused reviews stay in force. A name change does not create a new school; two distinct identifiers with the same display name remain distinct.

No cap is raised. At most two original adverts and two search pages can consume the same four-request reservation inside existing daily budgets. Duplicates/rejections do not trigger extra requests. Older/manual leads without structured school identity remain a review limitation. No school or new public job is activated by this release.

## Validation

All 498 tests pass with pinned Node 24.19.0, including actual isolated Cloudflare Workflow/D1 tests for two distinct schools and two adverts belonging to one school, plus replay without network calls. New cases cover same-school duplication, rename/new URL on a later day, configured pending/approved/paused states, unknown/invalid identifiers, equal display names with distinct identities, and a concurrent source configuration before the atomic insert. Production build, TypeScript, 17 prerenders, asset budgets and deployment dry run pass. Schema remains 33 migrations / 131 objects; no migration applies.

## Live operational evidence

Release 2.51.0 is deployed at sponsorintel.london as Worker `86062f83-ce93-4f38-a4b8-3377960af3e0`. The reloaded owner dashboard shows the school-identity policy and actual zero-request allowance hold; the public browser verifies 926 current roles, 35 employers, 55 sponsorship-mentioned adverts and 873 licence-linked roles. This release adds no public vacancies. Rollback reference is Worker `7b710bae-a027-4199-bd1e-0c0df07f6d28` (2.50.0); schema is unchanged.

The 20:45 UTC scheduled business run `business-497636` completed at 20:46:40.594 UTC. Cloudflare independently reports success ending at 20:46:40.793 UTC. Its discovery invocation held at today's five-existing-lead limit with zero started/reserved requests and zero new leads. This verifies scheduled invocation and limits; it does not establish automatic candidate discovery. Receipt: `tests/evidence/education-scout-scheduled-2026-10-08.json`.

The first school review found a real deadline conflict before activation: DfE's Drama advert says 21 October but its linked employer portal says 16 October. The legal school/trust relationship, exact licence record and original portal were reviewed; the source remains unconfigured. The English application's screening was viewed without answers, credentials, CV or submission. See `../docs/KINGS_LYNN_SOURCE_REVIEW.md` and its aggregate evidence.

The next eligible scout must still demonstrate automatic new-school retention. Reviewed school publication, repeat refresh and removals remain separate gates. PortmanDentex's normal 00:30 UTC continuation remains pending; no extra bootstrap pass occurred. LinkedIn job adverts and ordinary posts stay in daily browser discovery, not continuous ingestion. Existing AI/Google, owner-alert, social and request limits remain. GitHub hosted CI has an account billing lock; inspect the exact pushed head rather than interpreting local tests as hosted checks.
