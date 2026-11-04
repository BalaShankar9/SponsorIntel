# Techmap LinkedIn pilot (not active)

This is a review-only, unconnected provider adapter. Nothing in the live Worker imports it. No API key, subscription, scheduled task, candidate database, publication endpoint or production migration has been enabled.

See `docs/LINKEDIN_AND_AGENT_OPERATIONS.md` at repository root for provider comparison, current prices, rights review, acceptance and the agent-team plan.

`readTechmapPilotPage` fetches one explicitly requested page. `parseTechmapPage` can validate a supplied JSON sample offline. `pilot-schema.sql` defines a singleton budget table for a future private pilot runner. Provision only after approval of the subscription and a check of actual remaining requests and billing dates; begin with 10 calls. It cannot account for unrelated API calls using the same subscription. The integration ceiling is 80 calls per configured period, failures count, and the code never resets the allowance itself.

All returned candidates are unverified and private. In particular, provider `dateActive` may be inferred, employer names are not automatic licence links, and sponsorship labels describe text rather than eligibility. The runner and public promotion/review workflow remain to be implemented after access is available. Do not pass these records to `storeBoardJobs`: that routine expects a complete employer board, whereas provider search is a partial query and contains multiple employers.

Run offline checks from `cloudflare` using Node 22/24 LTS:

```sh
node --test tests/techmap-pilot.test.mjs
```

Tests use fictional records and in-memory SQLite; they do not call LinkedIn, Techmap or any paid API. No integration success, UK supplier coverage or republication agreement is implied by passing tests.
