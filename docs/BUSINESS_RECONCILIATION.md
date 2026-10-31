# Retaining business workflow evidence

Run the read-only operator inspection once in the daily routine, from `cloudflare/`, with the pinned Node runtime and a new dated receipt path:

```sh
node scripts/business-status.mjs --out tests/evidence/business-status-YYYY-MM-DD.json
```

This closes an evidence-retention gap, not the current dispatch outage. Cloudflare documents [three days of completed-instance retention on Free](https://developers.cloudflare.com/workflows/reference/limits/). An application row may outlive the original provider detail. A missing lookup does not distinguish an expired receipt, an uncreated instance, a deleted instance or another provider condition; do not infer its cause or execution outcome. The documented retention period is not a measurement of this account's actual retention behavior.

The command checks the exact production D1 name/ID, selects at most five unfinished runs independently of recent history plus the latest application run, and describes each exact ID in `sponsorintel-business`. It reads application rows again afterwards to detect changes during inspection. At most six provider lookups and three D1 read commands are issued by the script; the installed Wrangler may retry read-only API failures internally. Every command is an identity/read/describe operation. It cannot create, restart, terminate, reconcile, restore or clear a run, lock, budget or hold. It does not call Google, a model, an employer source or a publishing provider.

Receipts contain only selected operational identity, timestamps, state, step count and provider outcome fields. Arbitrary outputs, snapshots, error messages, actors, parameters and customer data are excluded. `10400` stays `not_found / unknown`; transient, malformed or wrong-identity responses stay unknown. A successful provider execution remains separate from its application `attention` result and from business acceptance. Zero stored steps cannot prove zero external actions. An empty history, stale latest receipt or changing/unavailable second read cannot look current.

Exit **1** with a saved `needs_review` receipt is expected when there is unfinished work, missing evidence or another finding. Exit 1 without a new receipt means inspection or file creation failed. Existing files cannot be overwritten. Inspect the saved JSON instead of rerunning simply to get exit 0. Later observations use a different timestamped path and leave earlier receipts intact. Keep reads in the existing routine; this adds no daemon, cron, workflow or external alert.

## Reconciliation boundary

Keep the original D1 record, original workflow ID and all child-action reservations. The existing dispatcher only releases an overdue active reservation after the binding reports a known terminal status. Unknown, paused, waiting, running or missing responses preserve the hold. This script never performs that release, even when it observes a terminal receipt. A later automatic dispatch must still pass the existing controls and daily uniqueness checks. Do not use a new ID, an elapsed date, zero steps or a successful newer run to clear the old record.

If authoritative terminal evidence cannot be recovered, leave the blocker explicit. A provider investigation or separately reviewed recovery procedure must resolve the original reservation and any external-action uncertainty before changing it. Contacting support, account changes and paid capacity are not authorised by this document.

## 30 October acceptance

Seventeen focused tests cover the new script and adjacent dispatch-health/recovery readers: exact database and workflow identity, read-only command allowlist, SQLite selection beyond recent history, missing/transient/malformed responses, concurrent changes, stale/empty history, bounded selection, private-field exclusion and non-overwriting private receipt files. No runtime dependency, protected model-source fingerprint, schema or Worker code changed; no build/deployment is required.

The actual inspection at **14:35:21–14:35:31 UTC** retained [the aggregate receipt](../cloudflare/tests/evidence/business-status-2026-10-30.json). D1 was stable before/after: `business-497989` remains queued with zero recorded steps and a provider `10400` lookup; `business-497990` remains application `attention`, with the original provider success ending **23 October 14:46:55.013 UTC**. This preserves previously ephemeral provider timing. It does not recover missing history, establish the reason for the queued row, clear the supervisor outage or prove an unattended run of this local operator script.
