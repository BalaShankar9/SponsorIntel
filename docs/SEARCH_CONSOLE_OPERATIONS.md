# Google search operations

Release 2.18 adds a private, read-only Google Search Console reader to the hourly business workflow. On 8 October the owner authorized the dedicated connection and separately accepted Google API terms. The API is enabled and the restricted credential is installed. The first owner-triggered read failed before a token response; successful Google reporting and unattended reads are not yet verified.

## Exact connection

- Property: `https://sponsorintel.london/` (URL-prefix property observed in the owner's Google account).
- Isolated Google Cloud project created by the owner and verified on 8 October: Sponsor Intel Search, ID `sponsorintel-search`, number `454294655999`. No billing account added. The API is enabled and setup authorization is recorded in the owner conversation.
- Dedicated service account: `sponsorintel-search-reader@sponsorintel-search.iam.gserviceaccount.com`. Verified with no Google Cloud project roles; no impersonation/delegation authority added.
- Enable only the Search Console API needed here. Do not link billing or enable other products as part of this setup.
- Verified the service-account email saved as a **Restricted** user of this single Search Console property.
- Store the JSON service-account credential only in the existing Sponsor Intel Worker's `SEARCH_CONSOLE_SERVICE_ACCOUNT` secret. Never paste a key into chat, source, a test fixture, browser dashboard field or commit. Use protected stdin for the documented Wrangler secret mechanism after authorization. Secret installation deploys a new Worker version; verify it afterwards.
- The implementation requests only `https://www.googleapis.com/auth/webmasters.readonly`, signs a one-hour assertion, fixes the Google token endpoint, and never stores or returns the temporary access token.

The owner confirmed this persistent access and separately confirmed API terms; both actions are completed. One key was created, validated locally and installed through protected stdin. Temporary JSON was removed after installation; no credential was printed or committed. Do not repurpose it for another project or create additional keys to troubleshoot transport failures.

## Schedule, data and limits

The business workflow attempts a read once per UTC day. Its ten-request ceiling includes one token request, property verification, three analytics requests, one sitemap read and four stored URL inspections. Every request consumes an atomic reservation before network access. Failed or unknown outcomes are not retried that day. A stopped run stays reserved, is visibly interrupted after ten minutes and becomes overdue after 36 hours. Invalid/future receipt dates cannot appear connected. Both the business switch and the separate search-reading switch are checked before each request.

Analytics cover 28 Pacific calendar days ending three Pacific calendar days before the current date, with `dataState: final` and web search only. Read aggregate totals, dates and at most 100 top page rows. No raw query dimension, customer data or private route/query-string URLs are collected. Missing rows are `no_data`, not measured zeroes; missing dates are never zero-filled. Top page rows are not exhaustive or a sum for the property totals. Average position describes observed impressions, not a guaranteed rank.

Inspect only `/`, `/jobs`, `/updates` and `/guides/check-uk-sponsor`. These are Google's stored inspection results, not live crawls or site-wide coverage. Read only the existing primary `/sitemap.xml` submission. The reader cannot submit/remove URLs, edit Google access or publish content. Partial failures retain valid sections but are visibly incomplete. Raw provider errors are not retained. Each response is limited to 256 KiB and eight seconds. Use `redirect: manual` and reject every non-success response, including redirects; never forward the assertion or bearer token. The deployed Workerd version rejects `redirect: error` during Request construction even though current online docs list that mode.

The owner desk shows the current report and seven run receipts. D1 retains reports; compact hourly business snapshots exclude duplicated page/date rows and history. Business findings flag missing/stale connections, missing baselines, sampled indexing failures and sitemap errors. They do not claim an experiment succeeded or automatically rewrite pages.

## Acceptance after authorization

1. Confirm the dedicated identity has only the intended Restricted property access and no project role.
2. Install the protected secret and verify the deployed Worker version.
3. Preserve the failed 8 October owner-triggered attempt. The first eligible automatic attempt is 9 October UTC through the hourly workflow (normally 00:45 UTC). Verify its real trigger, at most ten requests, exact property, source period, actual totals/inspections and absence of secret material.
4. Cross-check the same period and search type in Google Search Console. Preserve Google's reporting lag and missing data.
5. Verify the next day's automatic read before describing the integration as sustained unattended operation. Failure handling tests are not real Google permission/delivery proof.

## Activation and transport receipt — 8 October 2026

Secret installation deployed Worker version `4f586fa1-6e2b-4ce2-86d5-4c7a0e129003` at 02:15:56 UTC, still code 2.19.0. The owner-triggered read began at 02:19:02.116 UTC and finished at 02:19:02.426 UTC with `network_unavailable`, one consumed request and no report data. It was not an eight-second timeout and must not be relabelled as a scheduled success.

An isolated Workerd Request-construction probe reproduced `TypeError: Invalid redirect value` for `error`; `manual` accepted the identical synthetic form. Release 2.20 corrects that setting. The actual reader then completed all ten synthetic transport steps in local Workerd and replayed without additional requests. Redirect rejection tests cover 301, 302, 303, 307 and 308. No real Google credential was retried or daily reservation reset. Local fixtures prove runtime compatibility and limits, not Google access or account data. See `cloudflare/tests/evidence/search-support-runtime-2026-10-08.json`.

## Browser baseline observed 8 October 2026

The signed-in Search Console UI showed 0 clicks and 2 impressions in its selected three-month web-search report (last update about 20 hours earlier). Average position was 2 on this tiny sample; this is not evidence of broad ranking or growth. The Pages overview showed 1 indexed and 3 not indexed, with a report header last updated 4 October; example crawl dates were 5 October. Keep this provider date mismatch explicit.

The three examples under “Crawled — currently not indexed” were `/guides/build-a-shortlist`, `/guides/check-uk-sponsor` and `/updates`. The existing sitemap submission showed Success, submitted 5 October, last read 6 October, 779 discovered pages and 0 videos. These are lagged UI observations, not API-run receipts, current catalogue counts or site-wide acceptance proof. Do not seed them into API evidence tables or resubmit a successful sitemap merely to create activity.

## Sources

- [Search Console authorization and read-only scope](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)
- [Analytics dates, aggregation, row limits and data state](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Stored URL inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- [Search Console user permissions](https://support.google.com/webmasters/answer/7687615?hl=en)
- [Service-account assertions](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Worker secret storage and deployment behavior](https://developers.cloudflare.com/workers/configuration/secrets/)
