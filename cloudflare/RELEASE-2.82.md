# 2.82 — Try Evidence & gaps without a CV

Application Studio previously required a saved role and a CV before a visitor could inspect an evidence-check result. A collapsed fictional example now appears in the empty studio and the Evidence & gaps view of an existing application. It explains the limited shared-term check, shows the two original texts and runs the existing local checker on request. Switching examples clears the previous result.

The project and volunteering examples preserve their provenance, identify a missing skill and leave availability, suitability and sponsorship unresolved. They are not real vacancies or generated AI documents. The component has no workspace, storage, analytics or network integration; the next-step button only navigates to roles. No fictional application is inserted and no customer model, validator, comparison policy, permission or budget changes.

## Validation

- 690 tests pass on Node 24.19.0, including actual-checker example assertions. TypeScript/build, 18 prerenders, existing asset limits and Worker dry run pass. Initial JS is 383,739 bytes / 116,864 gzip; initial CSS 109,950 / 22,776 gzip. Application tools remain deferred.
- The actual Studio/CareerProvider was exercised in an isolated browser with an existing fictional CV. Both examples, result reset, full evidence notes and the role-navigation action worked. Workspace content remained identical with zero additional storage writes or external requests after the baseline.
- A separate guest session with no CV or applications also rendered the example result, with unchanged workspace content, zero additional storage writes and zero external attempts.
- A real 390-pixel iframe viewport rendered the same Studio and stylesheet at 390 pixels with no horizontal overflow; the saved-work/network counters remained unchanged. This is browser layout evidence, not a real-device or customer test.
- Initial development checks caught a state-type error and a test expecting a full source paragraph where the checker deliberately returns a matched sentence. Both were corrected before the full passing run. The test/build shell wrappers reported a read-only variable error after their commands completed; the original complete logs independently retain all 690 passing tests and successful build/budget output. No failing test was relabelled or ignored.

No schema or dependency-graph change. The successful same-day exact database/recovery-point/schema inspection and dependency audit remain applicable. Compatible rollback is **2.81 Worker `c308c706-ec9a-40ce-ba45-26a8c721d0ac`**, retaining all data, holds and schedule history. This is a first-use usability experiment, not proof of customer adoption or improved application quality. Demo use is intentionally excluded from real evidence-check counts.

Live **2.82.0**, Worker **`3b8e7099-3ffd-45b9-b58e-70093065567a`**, runtime **`8f900e3de64479d06494a2a6aebc55933782a85c`**, verified by excluded health and authenticated owner browser on 18 October. Both examples and result reset work in the deployed Studio. All fourteen selected operational groups match across the 02:31:46–02:35:25 UTC deployment interval; workspace revision/time/size metadata also match. This is not an export or full-content comparison of production CVs. No foreign-key errors; AI remains two starts/eight calls and sources 104/500.

Runtime Linux checks 117566025967/117566019160 were blocked before execution by the existing billing lock; original annotations were inspected. GitGuardian 117566030901 passed. Exact final documentation-head checks are recorded in PR 1. Receipt: `tests/evidence/evidence-example-2026-10-18.json`. Existing pending Facebook delivery, model evaluations and source holds remain separate and unchanged.
