# Sponsor Intel 2.13 — campaign measurement

7 October 2026. The private owner dashboard now groups recorded activity by the seven recognised Facebook/LinkedIn launch links. It shows page opens and successful sign-up, application-generation and guidance responses. Existing aggregate site totals remain separate, and unknown campaigns cannot create arbitrary analytics dimensions.

The shared campaign vocabulary checks the complete approved source/medium/campaign/content combination. Browser requests send only its short fixed ID; raw URL queries, referrers, CVs, chat text, account IDs and visitor IDs are not included in campaign counters. Campaign context lives only in the current document's memory for up to 30 minutes. Selected first-party links from reports carry the public labels forward; external, in-page, reset, API and owner links are preserved. React's repeated initial effect cannot count the same page open twice.

Campaign action counters are written from successful known server responses, not client-declared conversion events. They are counts of responses, not proof of a new verified account, application quality, an individual conversion path or a causal effect. Repeat visits, operator checks and bots can contribute. Reloads, new tabs, unrecognised tags and expired context can lose attribution. No analytics cookie, persistent browser identifier or fingerprint was added. Existing 90-day aggregate retention applies. The public privacy explanation and dashboard limitations were updated.

## Verification

- All 141 project tests passed. After the final in-page-link correction, all eight campaign tests passed again, including the anchor-link regression. Production typecheck/build, 17-page prerender and final Wrangler dry-run packaging passed.
- The isolated local Worker served both campaign scripts, accepted a valid tagged page event, discarded an unknown private tag and omitted raw query text from stored counts. Anonymous owner access returned 403 with the correct local upstream configuration.
- A browser visit followed by a synthetic local feedback submission produced one `campaign_feedback_sent` row for the expected campaign alongside the independent general total. No live customer account, CV or AI model was used for this action test.
- The deployed evidence report kept `#main` intact and carried the expected campaign labels into its Find jobs link. The live owner dashboard and a remote database read both showed three `fb-evidence` page opens. These are **known operator verification events**, not organic audience acquisition. No live sign-up, application or feedback was submitted for this check.
- The live dashboard panel was visually verified; proof is in the parent task's `outputs/campaign-dashboard-live.png`. The first empty-state layout was also reviewed. Mobile layout was not separately tested in a narrow viewport.

## Deployment and recovery

Final Cloudflare Worker version: `a2514058-0d68-47d3-ae15-83cfe2b3d537` at https://sponsorintel.london. Pre-feature rollback reference: `7b2a9ced-3baf-4f35-b6b5-448b366428b7`. No schema migration was needed; campaign counters use the existing aggregate table. Preserve those counts if rolling back code. Existing routes, scheduled workflows, model configuration and spending limits were retained.

This release supplies measurement for the marketing layer. It does not implement autonomous post selection, independent editorial approval, provider delivery reconciliation or the learning agent. See `docs/MARKETING_AGENTS.md` for those remaining stages. Instagram's profile editor still failed on retry; the verified account/logo remains, with bio, professional setup and publisher access pending. GitHub hosted checks were previously blocked by the account billing lock; local checks are separate evidence.

Implementation references: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/d1-database/) and [Worker background task lifetime](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).
