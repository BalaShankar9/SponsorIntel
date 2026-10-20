# 2.89 — selected application preparation batches

Signed-in applicants can explicitly select saved roles, prepare private evidence notes together, see missing information and availability concerns, pause/reopen/end a batch and inspect retained history. Material CV/document/advert changes flag earlier notes; unsynced client data cannot present them as a current check. Original workspace documents remain unchanged. Downloads are private archives, separate from workspace backups.

There are **no employer submissions, background preparation, new AI calls, generated final documents or automatic screening answers** in this slice. It supports up to 100 selected saved roles and 20 retained batches per account. Full applicant approval and a permitted provider integration remain required. Read `docs/APPLICATION_BATCHES.md` and the active growth/application plan.

Migration **0043_application_batches.sql** is additive: **43 migrations / 182 objects**. Two private tables cascade on account deletion; immutable snapshots/history, transaction-level account/workspace guards and optimistic revision/replay checks prevent cross-account writes, duplicate batches and lost updates. Retain additive data on code rollback.

Compatible rollback: **2.88.0 / Worker 4014c52f-ecdb-420d-9ab3-418e4386db43**, runtime commit `c2393cb4c72fc5cb63fd3a68b757623ff5272fe6`. The previous UI cannot show batches but its workspace normalisation cannot erase the separate tables. Do not restore production or remove history for a code rollback.

## Validation

The read-only pre-change inspection at **20 October 16:15:19.325 UTC** matched the exact database, current recovery point and all **177 objects / 42 migrations** from the isolated prior baseline. No restore/export or retention-window acceptance.

The first full run was 727/728: an existing campaign-preparation race sometimes rejected an identical request committed between its initial replay lookup and its proposal check. The bounded fix rechecks that exact retained request before returning a conflict; it does not prepare another version, resume comparisons or consume model allowance. A deterministic interleaving regression and all ten focused campaign tests pass. Protected research/application source identities remain unchanged.

New actual Worker/auth/D1 tests cover private access, request replay, concurrent edits, account-deletion/workspace-write races, immutable history, the 20-record ceiling and a full 100-role fictional batch. All original source/model/social controls remain independent. Fictional browser QA verified select-all, exclusion, lost-response replay with one retained batch, pause/reload, unavailable/changed inputs and terminal end. At a **390-pixel** viewport, document width was **390**, component width **366**. No horizontal overflow. The temporary tab and viewport override were removed.

Final **729/729 tests** pass on pinned Node 24.19.0, including the deterministic campaign race. TypeScript/build, 18 public prerenders, existing browser budgets and Worker deployment dry run pass. Initial public JavaScript/CSS remain within the unchanged ceilings; application tools stay deferred. The dependency graph is unchanged apart from package version metadata; the same-day audit retains zero high/critical and three known moderate Mammoth/argparse/sprintf-js entries, with no applicable patch found in the reviewed official advisory.

Production deployment and live acceptance are recorded below after completion. Local tests are not hosted Linux CI, independent writing-quality evidence or actual employer submission.
