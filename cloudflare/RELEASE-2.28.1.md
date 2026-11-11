# 2.28.1 — Eucalyptus employer identity and scheduled acceptance

Eucalyptus vacancies now display a reviewed connection to Fill Function UK Ltd in the current imported Skilled Worker register. The employer's own privacy notice explicitly identifies Fill Function UK Limited as a UK group employer. This replaces an unknown company connection with source-backed evidence; it does not change any advert's sponsorship wording or establish the employing entity for a particular job.

At verification, all 32 current Eucalyptus adverts still say sponsorship is not stated. Similar-name register entries for Eucalyptus Holdco Limited and Juniper Tech Limited were not accepted as evidence. No job, source observation, account, schema, credential, permission or budget data was rewritten for this release.

## Validation and production

- All 311 existing tests, typecheck/build, 17 public prerenders and Worker dry-run pass.
- Full public licence acceptance covers 833 current roles across 24 linked employers, up from 801 before this addition. All 885 current roles remain available overall. Register lookups and advert-wording filters agree across every result page.
- All 32 Eucalyptus detail responses show the exact reviewed legal entity, official register date and employer identity source. A 12-role before/after sample has identical IDs, titles, sponsorship labels, evidence, description hashes and first/last observation timestamps.
- The live role page visibly separates unknown vacancy sponsorship from the company register connection and asks the applicant to confirm the employing/sponsoring entity. Initial HTML contains the same evidence.
- Production reports 2.28.1, Worker `7bbdc1c9-5a15-4de7-99d9-2ccb214a1417`. No migration is required. Previous Worker `c60219cb-a52b-4e10-80ce-894f22fa52d1` is the code rollback point.

Evidence: `tests/evidence/eucalyptus-identity-2026-10-08.json`, `eucalyptus-production-2026-10-08.json` and `eucalyptus-licence-acceptance-2026-10-08.json`. The browser screenshot is retained in the task outputs as `sponsorintel-eucalyptus-licence-live.png`.

## Genuine unattended receipts

Before this deployment, source workflow `scheduled-1791441034000` completed at 06:31:06.749 UTC on 8 October. All 32 sources published on the first attempt, including the new Southampton and Nottingham feeds. Nottingham's 21 exclusions remained enforced. Two absent Eucalyptus roles became inactive while preserving their true last observation; 885 roles remained current.

The 06:30:35.741 UTC saved-search receipt reports zero checked/zero failed: this verifies the idle production path, not delivery to a real subscriber. The public opportunity checks and 19/3/6 all/Student/Business guidance HTML checks passed after the source run. See `tests/evidence/scheduled-operations-2026-10-08-0630.json`.

Metricool's brand settings also confirm the company Instagram `sponsorintellondon` is connected. Its prepared welcome remains separate from independent review, scheduling and confirmed delivery. Shared 8 October model usage remains four starts/six calls; no production AI call, email, Google retry or social send was made. Google reporting, real model evaluation, opted-in match delivery, external incident alerts and business outcomes remain open. Hosted CI status is recorded against the pushed head in the draft PR; local tests do not resolve the account's billing lock.
