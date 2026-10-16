# 2.35 — preserve employer wording while removing feed markup

The public-data review found stray formatting attributes at the beginning of two current Graphcore descriptions. The employer's Greenhouse feed contains HTML-encoded tags with `>` inside a quoted class attribute. The old regular expression treated that character as the tag's end and exposed the remaining attributes as vacancy text.

Employer-advert extraction now uses the pinned htmlparser2 12.0.0 parser and entities 8.0.0. It handles the Greenhouse transport layer, preserves text entities and paragraph boundaries, excludes scripts/styles/comments and does not parse plain-description fields as HTML. Lever requirements/additional/salary sections and Ashby compensation remain included. Rendering still escapes the extracted text; this helper is not a sanitizer or an authorization mechanism. The separate existing guidance-content extractor is unchanged. Required package licences are distributed in the public notices.

## Validation and live correction

- All 364 local tests pass, including encoded/raw quoted attributes, mathematical comparisons, literal angle-bracket examples, malformed tags, script exclusion, full Lever sections and negative sponsorship/pay preservation. TypeScript/build, public asset budgets, 17 prerenders and the Worker dry-run pass.
- The same 180-record employer response was processed in Node and an isolated local Cloudflare Workerd with no production bindings. All 85 accepted UK records match completely between runtimes. Compared with the old extractor on those same inputs, all 85 sponsorship labels agree; two UK descriptions lose stray wrappers. This is a parser regression comparison, not independent sponsorship-classification accuracy.
- Only the two affected live descriptions were corrected. Each write required the exact old text, source date, last observation, sponsorship/evidence and active source identity. All other detail fields match before/after, including first/last observation dates. The retained words match after removal of the wrapper and whitespace normalization. A separate changed source advert was not manually backfilled.
- Live HTML and the public API return the corrected descriptions. The browser renders the clean employer text. Search HTML/API checks still agree for page one, page two, sponsorship filtering and zero results: 885 current roles, 50 with offered/conditional wording. The sitemap/schema policy continues to avoid invented original posting dates or a Google Jobs eligibility claim.

Live version: **2.35.0**, Worker `ee5df1cb-b60e-49f5-bc1b-1dedbff7a641`. Rollback code: 2.34 Worker `6c610352-adac-4bed-bc16-8c4200c1af60`. No schema migration. A read-only pre-release recovery check found a current recovery reference and all 105 schema objects matching 23 migrations. Do not restore the database to roll back code; a previous importer can reintroduce this formatting defect on a later source refresh.

The first genuine scheduled execution of this importer remains due. No source refresh, model call, Google request, email or social delivery was forced. Frozen historical evaluation records and personal application drafts are unchanged. Evidence: `tests/evidence/advert-import-2026-10-08.json`.

## Dependency findings retained

The full audit reports six entries from two underlying advisories. No finding names the new parser packages. The existing Mammoth/argparse/sprintf-js moderate issue remains; a newly recorded full-development audit also flags Wrangler/Miniflare/sharp for [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). The latter path is development tooling, not a deployed Worker dependency. The upstream advisory identifies sharp 0.35.5 as patched and describes runtime-specific Linux/librsvg conditions. A compatible tooling remediation needs separate validation; npm's proposed Wrangler downgrade was not applied. This is not a clean security audit or evidence of a live exploit.
