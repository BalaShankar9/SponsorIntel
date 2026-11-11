# Sponsor Intel 2.18 — measured Google search visibility

The private owner dashboard now includes Search performance. A once-daily read joins the hourly business workflow, with aggregate Google metrics, source periods, sitemap observations and four stored URL inspections. It cannot change Google access, submit pages or publish content. New migration `0015_search_console.sql` stores controls and bounded daily receipts.

## Verified release

- 221 tests passed, including 18 new search checks: actual signed test assertions, exact-property/readonly scope, concurrent reservation, ten-request ceiling, sanitized failures, bounded streaming, interruption/pause, lost completion acknowledgement, empty-versus-zero metrics, dates and URL privacy, owner authentication and compact business evidence.
- Production typecheck/build and 17-page prerender passed; Wrangler packaging passed.
- Additive migration 0015 applied to the existing production D1 database after recovery bookmark `0000028a-00000000-000050fe-4548c0d88c689480ee536417f144a52a`. Previous tables and quotas remain intact.
- Deployed Worker `6543bb5c-8643-4134-a413-aa48386da436`, version 2.18.0. Live health, jobs and updates returned 200; unauthenticated search/business owner APIs returned 403, with expected browser protection headers.
- The authenticated live dashboard displays “Google connection needed” and no API receipt. Refresh works. The owner pause/resume control was checked and restored. At 390px the search card measured 350px with 348px content width, without horizontal overflow. The viewport was restored afterwards.

## Boundaries and remaining acceptance

No persistent Google key or property access has been created/granted. The dedicated project form is prepared and approval requested; no billing connection or paid service was added. The real Google API path, first scheduled read, data comparison and second-day read remain unverified. The unit fixtures use synthetic Google responses and ephemeral test RSA keys, not real credentials. No browser observations were inserted as API receipts.

The already signed-in Google UI shows a successful sitemap with 779 discovered URLs in its last processed copy and a tiny web-search baseline of two impressions, zero clicks. Its page report lists one indexed/three non-indexed pages and lagging/inconsistent provider dates. This is not evidence of ranking dominance, traffic growth, current full-catalogue indexing or a persistent API connection. See `docs/SEARCH_CONSOLE_OPERATIONS.md` for exact observations, proposed access and acceptance.

No additional AI call, public post, subscription, spending-limit increase or CI-billing change was made. The previously observed genuine business/source runs and held editorial/research states remain separate from this search integration. The business is not yet fully autonomous; search credentials, external publishing/delivery, model quality, incident delivery and commercial validation still need work.

## Recovery

Pause search reading in the owner desk to stop subsequent Google requests; pausing business operations also pauses it. Existing completed receipts remain. Interrupted/failed reads retain consumed reservations until the next UTC day. Revoke the dedicated Google identity/key if access must be withdrawn, with required owner authorization. Roll back Worker code to 2.17.1 only after checking active workflows; retain additive D1 tables and their evidence. A Worker rollback does not roll back D1 or external permissions.
