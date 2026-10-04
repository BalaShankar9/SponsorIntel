# Sponsor Intel on Cloudflare

Primary address: https://sponsorintel.london

Cloudflare fallback: https://sponsorintel.balashankarbollineni4.workers.dev

The application combines a React/TypeScript interface, a Cloudflare Worker API, static assets and D1. The legacy Next.js/Python services elsewhere in this repository are independent and are not required to run this beta.

## Development and verification

Requires Node.js 22 or 24 LTS, npm, Python 3 for the initial import, and an authorised Cloudflare account for remote commands.

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

`data/`, `.wrangler/` and local secrets are ignored by Git. Public catalogue queries use bound parameters; private career endpoints require a signed account session. A licence is not a job offer, individual eligibility decision or confirmation that a particular role offers sponsorship.

## Integrated career workspace (2.0)

The `/jobs`, `/career-profile`, `/studio`, `/applications` and `/account` routes form a single Sponsor Intel × Hire Stack journey:

- A focused collection of UK vacancies from explicitly configured public Greenhouse, Lever and Ashby boards.
- Role-specific applications, source quotes, saved searches, stages, private notes and seven-business-day follow-up suggestions.
- Browser-local PDF/DOCX/TXT/JSON Resume extraction; master CV text, editable role-specific CVs, cover letters, evidence reviews and interview preparation.
- Word, text-based PDF, plain-text and calendar exports; workspace JSON backup/merge.
- Optional Better Auth accounts stored in D1, with per-user workspaces, optimistic revision checks, hashed single-use recovery codes and self-service account deletion.
- A browser-local evidence check that quotes matching skill terms and flags dates and role conditions for manual review; it does not infer that a candidate is eligible.
- Explicit consent before CV/profile and advert text are submitted to Cloudflare Workers AI. The model receives candidate data as evidence, must not invent achievements, and does not assign visa or hiring probabilities. Users review and apply on the employer's site themselves.

The legacy Hire Stack deployment remains independent. Useful components were ported under MIT, with attribution in THIRD_PARTY_NOTICES.md. Old authentication secrets and databases are not reused. Existing Sponsor Intel employer shortlists remain in their original browser storage and can be copied into the career tracker.

### Development secrets and tests

Create an ignored `.dev.vars` with independently generated random values for `AUTH_SECRET` and `ADMIN_TOKEN` (at least 32 random bytes each). Do not reuse production secrets. Apply all local migrations before running the preview. The AI binding is remote even during local development; use fictional fixtures and watch the shared allowance.

`node scripts/career-smoke.mjs <base-url>` creates two clearly fictional test accounts, tests isolation, competing saves, recovery, origin enforcement and consent, then removes its accounts. This is a mutation test for the operator's own environment, not a read-only health check. The original `scripts/smoke.mjs` checks the public register and deep links. Run `node scripts/license-notices.mjs` when production dependencies change, then build.

### Vacancy ingestion and limits

The jobs cron runs every six hours at minute 30 UTC. A server-only `ADMIN_TOKEN` also guards `POST /api/admin/refresh-jobs` for initial population and operator recovery. The token must never be put in a frontend file or public command transcript. Only configured public employer hosts are fetched; there is no arbitrary URL fetch endpoint. A failed board retains its previous successful data. Search excludes entries not seen for three days. An advert's presence is not a guarantee that applications remain open.

Sponsorship labels are conservative text rules and always link back to the original advert. Negative immigration wording takes precedence; no licence-to-vacancy inference or eligibility claim is made. Review corrections against representative source text before updating the classifier.

Release 2.1 reads Lever requirement lists and closing sections before classification, supports structured country data and `(GB)` locations, excludes recognisable talent-pool/speculative titles and duplicate canonical links, and fixes the `Internal Audit`/`intern` false match. Adverts over the size bound are skipped rather than partially classified. Pay excerpts are quotes, not estimated salaries or visa salary assessments. The initial expanded collection contains 359 roles from eight configured boards (seven with UK results); Figma, Octopus Energy and Funding Circle are new. This is not a whole-market job index. `/api/jobs?salary=listed` filters adverts with an extracted UK pay statement; the interface displays that evidence in the role detail.

### Immigration updates (2.1)

`/updates` explains selected Student, Graduate, Skilled Worker and Health & Care guidance and links recent Immigration Rules publications. `/api/updates` returns source health, source-reported edit/publication timestamps, explanations and a change log. The scheduled check is `*/15 * * * *`; the initial population/recovery endpoint is `POST /api/admin/refresh-updates`, protected by the same server-only admin token. Never put that token in a browser or committed script.

The source list is explicit. The GOV.UK Content API returns entire multipart guides, so the importer selects the requested chapter. Rule collection bodies can be empty, so their linked publication list is tracked instead. At most the four most recently updated linked statements are watched; older records remain in history and are omitted from current source-health counts. Attachment URLs are retained as evidence, but attachment text is not parsed automatically.

Five initial explanations are pinned to SHA-256 hashes of the official title, normalised chapter text and withdrawal state. Source changes, withdrawals, fetch errors or more than one hour without a successful check hide an explanation. To revise one, read the new official text and applicable implementation provisions, update the explanation and its hash together, then test and deploy. Do not blindly refresh hashes to make a stale explanation visible. Explanations are general information, not personalised immigration advice or a substitute for the full conditions.

An initial import is a baseline, not breaking news. Only later text changes or newly tracked publications enter the change log. Detection time is distinct from GOV.UK's reported source date and from a confirmed effective date. Metadata alone is not trusted for change detection. Empty `withdrawn_notice` objects from GOV.UK mean the document is not withdrawn. A lease prevents overlapping runs; failed sources retain their last content, and the latest 20 snapshots per source are kept.

`node scripts/quality-smoke.mjs <base-url>` verifies the new sources, freshness, pinned summaries, protected refresh endpoint, pay evidence, early-career labels, route headers and sitemap. It needs initial ingestion to have succeeded. `npm run preview` supplies an explicit local upstream so custom-domain routes do not rewrite development auth requests to an HTTP production origin. On a synced macOS folder, use a hydrated `.nosync` persistence location consistently for local D1 commands and preview if the default local SQLite files show I/O failures.

AI defaults to eight preparations per account (or guest IP) per UTC day, twelve per IP and forty for the whole app. These are abuse/cost limits, not a guarantee of free model capacity. Cloudflare's account-wide quota also applies. If unavailable, existing drafts remain editable and exportable. No outside API key, paid provider subscription, email marketing or application automation is enabled.

### Account operations

Deploy a unique `AUTH_SECRET` and a separate random `ADMIN_TOKEN` as Worker secrets before exposing account routes. Migrations 0002 and 0003 add isolated job and account tables without changing sponsor snapshots. D1 Time Travel and deployment history provide operator recovery. Never restore an old user database without considering newer account deletions. Cloud workspaces use the authenticated user ID on the server, never a client-supplied ID.

There is no email delivery integration in this release. Email is an unverified sign-in identifier; users save a one-use recovery code during signup and can rotate it after a fresh login. Do not enable organisations, invites, employer access, email-based recovery or identity claims until verified email ownership is in place. Legacy Hire Stack accounts are not silently migrated. Account cookies are isolated by hostname; changing from the workers.dev address to the branded domain requires signing in again, but D1 account data remains shared. Guest data stays in the original hostname's browser storage: export a backup there and import it on the new domain.

## Employer shortlist and feedback

Saved employers, notes, stages, dates and preferences stay in browser local storage. They do not sync between devices. Clearing site data removes them unless the visitor has a backup. Workspace JSON exports can be imported into another browser; existing entries are preserved by ID. CSV is available for the shortlist/tracker.

Release 2.3 adds a fixed Feedback button on every page (above the mobile navigation), accessible category choices, contextual reporting from employer/job/immigration information, and a copyable confirmation reference. No account is required. `https://sponsorintel.london/?feedback=1` opens the form directly; `?feedback=bug` or `?feedback=data` selects a category. The form retains its message on a failed submission and has a 20-second request timeout.

Feedback is stored privately in D1 with an ID, kind, message, timestamp, app version and optional context. Migration `0005_feedback_context.sql` adds the two fields without changing existing reports. Context is limited to known page paths and the selected public item; queries, fragments and unknown fields are discarded. Visitors can opt out of this context. No account details, CV, form contents, screenshots or raw IP are attached automatically. The endpoint enforces the current origin, bounded input and five submissions per hourly IP-derived bucket. There is no public admin endpoint or email notification pipeline. Operators review feedback using authenticated D1 access, for example:

```sh
npx wrangler d1 execute sponsorintel-db --remote --command "SELECT id,kind,message,context,app_version,created_at FROM feedback ORDER BY created_at DESC LIMIT 30"
```

Treat those messages as private. Do not commit feedback exports or put them in public tickets without consent. The public privacy panel describes browser storage, feedback, infrastructure processing, external links and Google Fonts.

## Domain cutover

On 4 October 2026, the existing Namecheap domain was moved to Cloudflare's Free zone plan. The prior Netlify DNS zone contained no records; its record list was saved privately before the change. No existing mail or verification records were removed. DNSSEC was already off, with no DS record. Namecheap now uses `ada.ns.cloudflare.com` and `matteo.ns.cloudflare.com`; Cloudflare reports the zone active.

The apex and `www` names are native Worker custom domains declared in `wrangler.jsonc`. Always Use HTTPS is enabled and the minimum TLS version is 1.2. `sponsorintel.london` is the canonical origin and sitemap hostname; the workers.dev address remains available. Both domains passed HTTPS checks with certificate verification. The earlier local resolver cache delay cleared during 2.1 acceptance: ordinary system DNS, HTTPS, API tests and the browser all reached the branded domain. Cloudflare manages the DNS records and certificate renewal; do not replace them with guessed A records. Domain registration remains at Namecheap.

## Recovery and limitations

Use Wrangler's deployment history and rollback command to restore a previously verified Worker version. A code rollback does not undo a database update. Sponsor data uses versioned snapshots; inspect the current metadata and retained snapshot counts before changing the active metadata. Retain/restore a D1 backup for schema or data recovery. Guest career work and older employer shortlists are browser data and cannot be reconstructed from D1. Signed-in career workspaces are stored in D1 and included in database recovery; users can export their own backup.

The beta does not yet migrate legacy accounts, send email alerts, verify email ownership, or offer paid plans. It does not claim complete UK vacancy coverage, legal eligibility or sponsorship likelihood. The old Python/PostgreSQL/Redis services are not deployed as part of this migration.

See `RELEASE-2.3.md` for current deployment and acceptance evidence and `../docs/PRODUCT_ROADMAP.md` for the remaining work, quality gates and launch priorities. The earlier domain and career-workspace acceptance is retained in `RELEASE-2.0.md`.


## Public pages and search visibility (2.2)

Run the full `npm run build`: Vite creates the fresh template, then `scripts/prerender.mjs` renders eight public pages using the actual React components. It also generates the sitemap, private shell and 404 page. The script deliberately refuses to reprocess an already-rendered template. Public routes and metadata share `shared/pages.json`; keep client navigation and page content consistent with it.

The Worker serves these documents with explicit canonical redirects, real 404 status codes and noindex/private caching for workspace pages. Public feed content remains live in the browser and is not copied into the build. The workers.dev HTML is noindex; www redirects to sponsorintel.london. Preserve the Google site-verification tag in `index.html`. No JobPosting rich-result markup is included yet.

After preview or deployment, run `node scripts/seo-smoke.mjs <base-url>` to check raw HTML, metadata, JSON-LD, sitemap, robots, private routes, unknown routes, the share image and HEAD responses. The 1200×630 share card source is in `design/share-card.html`, with the published JPEG under `public/`.

See `RELEASE-2.2.md` for observed Google verification/crawl outcomes and `../docs/GROWTH_PLAN.md` for the community pilot and search priorities.
