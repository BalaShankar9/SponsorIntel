# Development-tool security and local recovery

Status: 8 October 2026. **The dependency repair and local validation are complete.** This is a development-tool change, not a new production release. Cloudflare remains on 2.35.0. Hosted Linux validation remains unobserved while GitHub jobs are blocked by the account's billing lock.

## Verified fix

The installed Wrangler 4.147.0 uses Miniflare 5.20261001.0-alpha, which pins sharp 0.35.4. The latest inspected Wrangler 4.148.0 also retains that vulnerable sharp pin. A scoped npm override selects sharp 0.35.5 only beneath Miniflare; the lockfile changes sharp and its native binaries/libvips packages, without changing Wrangler, Workerd or production dependencies.

Upstream [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) identifies sharp 0.35.5 / librsvg 2.63.2 as patched. After a successful clean reinstall, the actual Miniflare-resolved library reports sharp 0.35.5, libvips 8.18.7 and librsvg 2.63.2 on macOS arm64. The focused test passes through a real isolated local Images binding: SVG inspection and SVG-to-PNG transformation produce the expected 12 by 8 bitmap. No remote Images binding or external image is used. npm's high-severity findings cleared; the separate three moderate entries under Mammoth/argparse/sprintf-js remain. No forced downgrade was applied.

## Storage recovery

A clean `npm ci --ignore-scripts` initially failed with ENOSPC. Subsequent attempts after clearing named generated bundles also failed as available storage declined. Those incomplete installations were removed; interrupted checks are not counted as passing.

The owner then authorised clearing rubbish. Cleanup removed regenerable uv, npm, pip, Homebrew, node-gyp and Prisma caches and two unused older Puppeteer browser downloads; active application installers and the latest downloaded browser were preserved. Available space rose from about 140 MiB to 3.35 GiB. A fresh preflight measured 3.09 GiB immediately before the successful clean install. After dependencies, the full build and dry-run were restored, 2.44 GiB remained available. These are time-specific observations, not a guaranteed reserve. No personal documents, source, CVs, photos or cloud data were deleted.

Require **2 GiB available** before another clean installation. Do not repeat npm installs while that gate fails. The existing daily automation retains its schedule and limits and checks storage before local installation/build/runtime work; safe read-only production monitoring can continue when local work is held.

## Preserved local development data

The previous `cloudflare/.wrangler/state` is archived at `cloudflare/.wrangler/local-state-before-toolchain-20261008.tar.gz` (41,184,059 bytes, mode 0600), with a neighbouring receipt. All **30 file hashes**, covering 156,124,256 uncompressed bytes, matched the source and archive before the unpacked copy was removed. Empty macOS file-provider placeholders were preserved as empty files without triggering a read timeout. The archive is ignored by Git and must remain private. This is local development state, not a production backup or restore.

Once enough space exists, restore that archive only into an empty `.wrangler/state` location if the prior local database is needed. Check the receipt and archive contents first; do not overwrite a newer local database or mistake a fresh empty local database for recovered data. Never point local recovery at the remote D1 database.

## Acceptance and repeatable checks

1. Clean `npm ci --ignore-scripts` passed: 206 packages installed. The system Node 25 emitted an existing nanoid engine-range warning; final validation therefore also used the available supported Node 24.19.0 runtime, without installing another runtime.
2. `npm ls wrangler miniflare sharp` resolves the intended scoped override; all 27 changed lockfile package versions belong to sharp or its native binaries/libvips packages. Other package versions are unchanged.
3. All **365 tests**, including the native Images test, pass on Node 24.19.0. The full TypeScript/build, 17 public prerenders, browser asset budgets and Worker dry-run pass. Node 25's earlier full run also passed, but is not the supported-runtime acceptance basis.
4. The fresh full dependency audit reports zero high/critical findings and three moderate entries for the single Mammoth/argparse/sprintf-js advisory chain. Linux CI/native compatibility remains unobserved until hosted checks can run.
5. Live health and job-page checks at 11:05:49 UTC confirm 2.35.0, 885 matching roles and 12 visible role links agreeing with the initial snapshot. This repair did not deploy a Worker or change production data. See `cloudflare/tests/evidence/toolchain-security-2026-10-08.json`.

For future reinstalls, recheck actual free space first, preserve the archive, and repeat the install, dependency resolution, tests, build, dry-run and audit. A development-only dependency update needs no Worker deployment.

Genuine scheduled production run `business-497626` completed at 10:45:50.619 UTC on 8 October with all five HTTP/header checks passing, 12 visible cards/885 current roles, empty email queues and no high-priority findings. It confirms the cloud service kept operating during this local failure. It does not prove the next source refresh has executed the 2.35 importer, dependable email Inbox delivery or complete autonomous business acceptance.
