# XML parser dependency patch — 11 November 2026

The prepared code now pins **fast-xml-parser 5.12.0**, with its required **strnum 2.5.1** and **is-unsafe 2.0.3** updates. These are the only three package-version changes. No Worker deployment, migration, production query, source refresh or model call occurred.

The maintainer's [GHSA-474x-hrwr-fgx4](https://github.com/NaturalIntelligence/fast-xml-parser/security/advisories/GHSA-474x-hrwr-fgx4), published 3 November, describes quadratic scanning of malformed input when the non-default `stopNodes` option is enabled. The inspected application parser in `worker/jobs.js` validates XML first and does not enable that option. This is preventive maintenance; no production exploit or breach was established.

## Validation and exact scope

- A clean, scripts-disabled installation completed on Node **24.19.0 / npm 11.8.0** after a disk preflight above 2 GiB. It installed 206 packages in approximately 574 seconds. The updated lockfile audit reports **zero known advisories**, not absence of unknown vulnerabilities.
- Three new regression tests cover malformed stop-node scanning, valid raw-node content and the actual university reader's complete text, dates, source identity and staff-only exclusion. The malformed-input test fails on 5.11.2 and passes on 5.12.0. Its bounded character-inspection assertion avoids a wall-clock threshold and does not claim Cloudflare CPU performance.
- The new and existing university tests pass **17/17**, including after the validated dependencies were copied back to the worktree. A separate agent-assisted read-only review found no blocking regression-test issues; it is not independent business-evidence acceptance.
- An isolated export of tracked commit **a6973b12fda8f879e6ec997ae44da480432fad6c**, with only the package, lockfile and new security test overlaid, passes **869/869 tests**, TypeScript/build, **21 prerenders**, browser budgets and deployment dry run. No skipped or cancelled tests. Untracked prototypes and unrelated worktree changes were excluded.

The full check qualifies the **prepared 2.99.0 source**, not the deployed 2.98.16 bundle. The documented runtime commit also contains prepared source; the retained earlier isolated-release record supplies an aggregate source hash, but its temporary full source directory is no longer available. Do not reconstruct a live candidate merely by treating that commit as the complete deployed source. Recover and verify the exact release source before a future deployment qualification. The combined branch must not be deployed wholesale.

## Local dependency recovery and preserved evidence

The first incremental installer stalled while reading an existing duplicate dependency directory. Its package and lock files remained unchanged. The exact installer process was terminated and confirmed absent before a fresh isolated installation began. The original failure, termination and clean-install logs remain retained locally; the interrupted installation is not counted as a pass.

After the clean install and full isolated validation, the old whole `node_modules` directory was moved intact into ignored local data and the tested clean dependency set was copied into place. No duplicate folder, personal file or private local-state archive was deleted. All eight unrelated tracked worktree file hashes remain unchanged. Raw installation/build logs stay local; the committed aggregate receipt is `cloudflare/tests/evidence/xml-parser-security-2026-11-11.json`.

Production remains at the last verified **2.98.16** release. Today's D1 allowance failure, incomplete current recovery/schema evidence and unresolved original business-workflow outcomes remain open. No repeated production read was made after the known quota failure. Hosted CI must be inspected at this patch's exact pushed head and remains distinct from these local results.
