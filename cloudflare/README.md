# Sponsor Intel on Cloudflare

Live beta: https://sponsorintel.balashankarbollineni4.workers.dev

The application combines a React/TypeScript interface, a Cloudflare Worker API, static assets and D1. The legacy Next.js/Python services elsewhere in this repository are independent and are not required to run this beta.

## Development and verification

Requires Node.js 22+, npm, Python 3 for the initial import, and an authorised Cloudflare account for remote commands.

```sh
cd cloudflare
npm ci
npm test
npm run build
npx wrangler d1 migrations apply sponsorintel-db --local
python3 scripts/import-register.py
npx wrangler d1 execute sponsorintel-db --local --file data/register.sql
npx wrangler d1 execute sponsorintel-db --local --file data/activate.sql
npm run preview
```

Open the address printed by Wrangler. In a separate terminal:

```sh
node scripts/smoke.mjs http://127.0.0.1:8788
```

The optional `--local-feedback` flag creates five clearly marked local QA messages and verifies rate limiting. Run it only once per hourly quota bucket. It refuses a non-local URL. Read-only production checks:

```sh
node scripts/smoke.mjs https://sponsorintel.balashankarbollineni4.workers.dev
```

The GitHub workflow runs unit tests, a production build and a Wrangler dry run. It does not deploy or need a Cloudflare credential. Deployment remains an explicit operator command:

```sh
npm run deploy
```

## Data and refresh

The sole employer source is the [GOV.UK register of licensed worker sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers). The initial release imported 143,138 rows into 127,902 employer/location records from 2 October 2026. Records with the same normalised organisation, town/city and county share one ID; their licence routes and ratings are combined. Counts are employer/location records, not a promise of that many distinct legal entities or open jobs.

The daily scheduled handler runs at **07:15 UTC**. It checks the official publication, streams the dated CSV, validates schema and bounds, stages the new snapshot, checks the imported count, and switches the active snapshot only after those checks pass. The prior active snapshot is retained. Failed refreshes keep the current register and expose a warning through `/api/meta` and the interface. The initial full refresh was exercised locally; the first future production scheduled run still needs to be witnessed.

The importer rejects fewer than 100,000 records, more than 300,000 rows, an unexpected source/schema, oversized input or a change exceeding 20% of the current record count. These bounds require human review if the official register changes substantially. Do not loosen them just to make a failed import pass. Use the dated source, database count and runtime logs together to investigate.

To make a controlled manual refresh, run the import script, review `data/source.json`, then use the remote import and activation commands. Activation is conditional on the full staged count:

```sh
python3 scripts/import-register.py
npx wrangler d1 execute sponsorintel-db --remote --file data/register.sql
npx wrangler d1 execute sponsorintel-db --remote --file data/activate.sql
node scripts/smoke.mjs https://sponsorintel.balashankarbollineni4.workers.dev
```

`data/`, `.wrangler/` and local secrets are ignored by Git. The API accepts bound search parameters and returns only public sponsor data. A licence is not a job offer, individual eligibility decision or confirmation that a particular role offers sponsorship.

## Visitor workspace and feedback

Saved employers, notes, stages, dates and preferences stay in browser local storage. They do not sync between devices. Clearing site data removes them unless the visitor has a backup. Workspace JSON exports can be imported into another browser; existing entries are preserved by ID. CSV is available for the shortlist/tracker.

Feedback is stored privately in D1 with an ID, kind, message and timestamp. The endpoint enforces the current origin, bounded input and five submissions per hourly IP-derived bucket. There is no public admin endpoint or email notification pipeline. Operators review feedback using authenticated D1 access, for example:

```sh
npx wrangler d1 execute sponsorintel-db --remote --command "SELECT id,kind,message,created_at FROM feedback ORDER BY created_at DESC LIMIT 30"
```

Treat those messages as private. Do not commit feedback exports or put them in public tickets without consent. The public privacy panel describes browser storage, feedback, infrastructure processing, external links and Google Fonts.

## Domain cutover

`sponsorintel.london` is owned through Namecheap and was not present in the accessible Cloudflare account during this release. The domain was not resolving to a website. The existing command-line token can deploy Workers but cannot create zones; dashboard and registrar sign-in are required.

1. Add the existing domain to Cloudflare on the intended plan; inspect and preserve every existing DNS record, especially mail and verification records.
2. Use the exact nameservers assigned by that zone at Namecheap. Check the current DNSSEC state and follow Cloudflare's cutover instructions rather than guessing DS records.
3. Wait until Cloudflare reports the zone active.
4. Add `sponsorintel.london` and `www.sponsorintel.london` as Worker custom domains. Record both in `wrangler.jsonc` using `custom_domain: true` and retain the `workers.dev` route during acceptance.
5. Verify HTTPS, both hostnames, deep links, API searches, source dates and feedback. Select a canonical hostname and set its redirect/metadata only after the hostname works.
6. Keep the known-good deployment available until the branded-domain checks pass.

Do not point a guessed A record at a Worker, purchase a replacement domain, or change unrelated Carpool Network resources.

## Recovery and limitations

Use Wrangler's deployment history and rollback command to restore a previously verified Worker version. A code rollback does not undo a database update. Sponsor data uses versioned snapshots; inspect the current metadata and retained snapshot counts before changing the active metadata. Retain/restore a D1 backup for schema or data recovery. User workspaces are independent browser data and cannot be reconstructed from D1.

The beta has no migrated legacy accounts, paid plans, email alerts, hosted CVs, automated vacancy feed, sponsorship likelihood scoring or map. Job links go to Work Hub, NHS Jobs or curated employer careers pages. The older Python/PostgreSQL/Redis services have not been deleted, deployed or certified as working by this migration.

The meaningful next gates are the branded domain, a witnessed production refresh and real visitor feedback. Cross-device accounts and a verified job feed can then be added as separate migrations with explicit data provenance and acceptance checks.
