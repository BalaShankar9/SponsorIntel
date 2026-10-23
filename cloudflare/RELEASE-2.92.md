# Sponsor Intel 2.92 — dependency security maintenance

## Reason and scope

The 23 October dependency audit newly reported DOMPurify 3.4.16 and Vite 6.4.3. The retained 20 October audit is historical, not current security evidence. Upgrade only DOMPurify to **3.4.17** in the jsPDF dependency tree and the pinned development dependency Vite to **6.4.5**. The lockfile comparison confirms no other package version changed. No migration, model, source, customer-record or permission change.

Primary evidence: [DOMPurify 3.4.17 release](https://github.com/cure53/DOMPurify/releases/tag/3.4.17), [shadow-root advisory](https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7), [in-place advisory](https://github.com/cure53/DOMPurify/security/advisories/GHSA-mrv2-3pqr-j5jr), [Vite filesystem advisory](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22) and [Vite 6.4.5 release](https://github.com/vitejs/vite/releases/tag/v6.4.5). npm's severity labels differ from the DOMPurify maintainer advisories; neither is evidence that this application was exploited.

Sponsor Intel's PDF exporter calls jsPDF text/font APIs, not its HTML converter or DOMPurify's affected non-default modes. DOMPurify still exists in a generated optional PDF chunk, so it is patched and rebuilt. Vite is the local build/development server; production serves compiled assets through the Worker. The local dev command remains bound to 127.0.0.1. This is preventive maintenance, not a claimed production breach or incident response.

## Validation

Incremental installation completed after a **2.2 GiB** disk check, without a clean reinstall or deleting files. On pinned Node 24.19.0, all **737 tests pass**, including actual multi-page PDF text/order/bounds, Unicode Word export, unsupported-character/font failures and discovery precision/history. TypeScript/build, **19 prerenders**, registered-media checks, browser budgets and Worker dry run pass. Initial JS 390,965 bytes / 119,416 gzip; CSS 109,950 / 22,776 gzip. Fresh npm audit reports **zero known vulnerabilities**. This is an audit result at inspection time, not a guarantee against unknown issues.

Application/research source identities are unchanged. The successful 23 October **01:11:11.652 UTC** read-only recovery check verifies the exact D1 identity, a current recovery point and all **43 migrations / 182 schema objects**. An earlier access denial and first OAuth callback timeout are preserved in the operations receipt. Same-scope renewal restored access; no extra permissions, billing or service was added.

## Publication and rollback

Prepared and locally validated; do not call 2.92 live until deployment and its actual asset are verified. Prior live release is **2.91.0**, Worker **2ef44b92-944f-4a78-8316-23be998100c3**, runtime commit `b7f3639dff3788347c73fef3bc3dc2f671cf46a1`. It is the compatible emergency code rollback, but contains the older dependencies; prefer a forward repair. Keep additive schema and all later customer, review, allowance and delivery history. Never restore the database for a dependency rollback.

Scheduled sources, active business workflows and all owner holds remain separate from this release. No production AI/Google attempt, social schedule, email test, source refresh or application is needed for publication. The full autonomous-operation goal remains open.
