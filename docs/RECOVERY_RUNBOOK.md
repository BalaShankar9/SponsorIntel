# Sponsor Intel recovery

The live database is `sponsorintel-db` (`f51fb6a9-1278-4643-a49f-30c2e52c6313`). Check that identity before any database operation. A Worker rollback and a database restore are separate operations. Prefer a tested code rollback when the defect is in code; preserve later database, queue and external-provider activity.

## Read-only daily check

From `cloudflare/`, run:

```sh
node scripts/recovery-status.mjs --out /tmp/sponsorintel-recovery-status.json
```

The script pins the live database identity, reads its current Time Travel bookmark and compares every non-system schema object against an in-memory database built from the repository migrations. Its aggregate receipt includes hashes and differences, but no raw bookmark, source SQL, customer rows or credentials. A failed read, wrong identity, invalid bookmark or schema difference cannot report healthy. The check has no restore, export or deletion command. For a planned migration or an actual incident, separately retain the raw bookmark returned by `wrangler d1 time-travel info sponsorintel-db --json` in the private incident/change record. The aggregate daily receipt deliberately stores only its hash. Preserve a dated receipt for changes that require investigation; a bookmark is a recovery reference, not a separate copy of the data.

The existing 10:00 UK daily Codex routine runs this check and remains quiet for unchanged healthy evidence. It also runs before a schema change. This is connected-desktop execution, not an independent cloud monitor. The newly configured future daily execution is not yet observed. A missed check must not be described as a successful backup.

## Verified exercise: 8 October 2026

A temporary unbound cloud database, `sponsorintel-recovery-drill-20261008`, was created for the exercise. All 23 migrations applied, and all 105 schema objects matched production exactly. Only fictional data was seeded; no customer records, secrets, real provider tokens or AI calls entered the exercise. It had no Worker, public route, cron, model or publishing connection, and business/marketing controls were disabled.

The initial checkpoint contained two fictional users and their account/session/workspace records, one followed search, a usage reservation and a scheduled-post receipt. Later changes updated a workspace, deleted one account through the same table deletion sequence used by the application, consumed more fictional allowance and recorded a fictional publication. No model, email or social provider was called.

An actual Cloudflare Time Travel restore reproduced all 15 checked result sets from the checkpoint, including schema, foreign-key checks and database integrity. It also brought back the deleted account and removed the later usage/publication evidence. The provider's returned undo bookmark then restored all 15 later result sets, including the deletion and newer receipts. Both restore results were queried and compared; CLI acknowledgement alone was not acceptance. The temporary database was deleted after verification, and the account inventory confirms it is absent while production remains present.

Evidence is in `cloudflare/tests/evidence/recovery-drill-2026-10-08.json`. Fictional SQL inputs are retained in `cloudflare/tests/fixtures/recovery/`. They must never be executed against production. This exercise proves the provider mechanism on the current schema. It does not establish successful customer-data recovery, a full retention window, an independent backup or production recovery time.

## Production incident procedure

1. Identify the actual incident and record the affected Worker version, exact database identity, symptoms and current origin receipts. Stop conflicting changes. A slow or unknown workflow outcome does not authorize a restart.
2. For a code defect, use the recorded compatible Worker rollback. Database history must not be rewound to fix frontend or Worker code.
3. Before considering a database restore, preserve the present recovery reference and secure evidence of everything after the proposed point: account deletions and authentication changes; customer edits; shared model reservations and uncertain calls; social schedules and delivery identities; email sends, complaints and suppression; active workflows and queued events. Keep private material out of Git, public logs and model prompts.
4. Suspend writers and external effects independently of the database being restored. Restored database controls may themselves be old. Keep account access and external sending unavailable until reconciliation is complete. Do not improvise a live restore if the present deployment cannot enforce that isolation.
5. Use an exact provider-accepted bookmark and retain the returned undo reference. Production overwrite is a separate consequential incident decision, never an automatic response to a failed status check. The 8 October exercise did not perform or authorize a production restore.
6. Query the restored state, validate schema/integrity and relationships, and reconcile later data before reopening. Reapply confirmed deletions; address rolled-back credentials and invalidate old sessions/recovery material as appropriate. Preserve consumed model reservations and reconcile existing provider posts/emails against their external identities before another send. A lost receipt must not become permission to repeat its effect.
7. Reopen capabilities in stages only after their actual state is verified. Retain the incident timeline, restored/undo references, unresolved loss window, checks and operator decisions. Keep the original undo option until recovery is accepted.

There is currently no independently durable, deletion-aware recovery journal covering every account/authentication change and external effect. That remains a prerequisite for automatic production recovery. Whole-database restore must therefore stay outside the autonomous routine; do not infer it is safe from the isolated exercise.

## Provider boundaries

Cloudflare documents Time Travel as an in-place operation that cancels in-flight queries and returns an undo reference. History is enabled automatically; its available window depends on the account plan and database age. Validate the requested point rather than assuming a fixed number of days. Time Travel does not currently provide a production clone/fork for this workflow. See [Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/) and the [D1 command reference](https://developers.cloudflare.com/d1/wrangler-commands/). The actual account retention window was not measured in this exercise.

Future independent backup work needs a protected destination, retention and deletion reconciliation, a verified restore test and an explicit cost/access decision. Never place a raw production export in this repository or create extra customer-data copies merely to make a check pass.
