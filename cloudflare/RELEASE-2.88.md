# 2.88 — businesses behind sponsor entries

## Change

Sponsor profiles and existing licence-linked job details can show a reviewed business/trading name, website, sourced activity/locations/public identifier, optional careers link and dated primary evidence. The public directory also matches approved business names while retaining its existing filters. Names alone never approve a relationship or alter a vacancy's sponsorship wording.

The new collapsible **Sources → Business identities** desk selects an exact current legal entry and retains append-only decisions, source-rights review, private reasons, attribution and request/concurrency guards. Withdrawal, hold, expiry or unavailable/mismatched current register evidence excludes a relationship from public display/search. There are no automatic approvals, source refreshes, applications, model calls or additional posting privileges.

Migration **0042_business_identities.sql** is additive: five objects, **42 migrations / 177 objects** expected. Keep history on rollback. Prior runtime is **2.87.0, Worker b38a770d-04ea-4918-b130-91456805b6b6**, commit `0caeeef6af658b2972c49981717cd25c224524a1`. Do not restore or drop data for a code rollback.

## Validation before release

- Fresh read-only pre-change recovery check at **20 October 14:53:47.232 UTC**: exact production identity, available recovery reference, **41 migrations / 172 objects** agree. This is not a customer restore or retention-window test.
- **723 tests pass** on pinned Node 24.19.0. Eleven focused tests include actual isolated Worker/auth/D1 access, simultaneous revisions and public search. All eleven focused tests pass after the final query optimization and stale-evidence withdrawal case. The full 723-test run preceded that additional case; it was not represented as a 724-test full run.
- TypeScript/build, 18 public prerenders and existing browser budgets pass. Public pages retain deferred owner/application code; initial JavaScript 388,076 bytes (118,426 gzip), CSS 109,950 bytes (22,776 gzip). Existing styles are reused rather than raising a budget.
- Browser fictional approval and withdrawal each saved exactly one revision; refreshed public view removed the withdrawn relationship. Both revisions remain visible. Owner form at 390 pixels measured document width 390 and form client/scroll width 368; public card fit its 364-pixel content area. A dev preview initially hit dependency-cache/hook errors; the stable bundled fixture was then used successfully.
- The first full suite caught a protected research-source fingerprint change in a proposed hourly-monitor addition. That addition was removed; the protected research/application bytes and fingerprints remain unchanged. Overdue counts currently live in the owner desk, not hourly findings. No hashes were regenerated.
- Current dependency audit: zero high/critical, three existing moderate Mammoth/argparse/sprintf-js entries. No install or downgrade; dependency graph unchanged apart from package version metadata.

Production migration, deployment, real pilot and live acceptance are recorded separately when observed. These tests do not establish semantic accuracy of future owner reviews, comprehensive business coverage, autonomous submissions or more sponsorship jobs. See `docs/BUSINESS_IDENTITIES.md` and `docs/APPLICATION_AND_SPONSOR_GROWTH_PLAN.md`.
