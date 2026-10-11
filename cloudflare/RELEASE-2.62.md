# Sponsor Intel 2.62 — preserve work before switching to the cloud copy

The account action previously requested a backup download, immediately replaced local work with the cloud copy and claimed the file was downloaded. In an actual fictional browser account, deliberately blocking downloads caused unsynced CV text to disappear. This release keeps a verified, account-scoped device recovery copy before switching, leaves it available afterward and describes downloads as requested rather than completed.

The recovery panel supports text fallback, explicit restore and separate removal. Existing recovery copies cannot be silently overwritten; they survive page reload. Sign-out asks the user to deal with the retained copy, and successful explicit account deletion removes this browser's recovery copy. Storage/network failure keeps current work. Late responses are checked against account, current edits and the exact saved cache/recovery record. Browser copies can still be cleared by site-data removal; this is not a remote or disaster-recovery backup. See `docs/WORKSPACE_RECOVERY.md`.

Workspace GET now returns its authenticated account ID; the client checks it and sends an expected ID with saves. The server rejects a mismatched expected ID without using it to choose an account. Legacy clients without the optional field retain existing session-based behavior. Normal optimistic revisions, account deletion guards and all production workflow/model limits remain unchanged.

No migration, dependency update, customer-data rewrite, production CV, model call, forced source refresh or external send is required. Prepared research/application source identities must stay unchanged. Rollback is 2.61 Worker `bd079c7f-3a02-44b5-850b-a0918d3b994f`; a rollback stops exposing new device recovery copies but must not remove them. Retain/export them before an intentional downgrade of this interface.

## Validation

All 603 tests pass on pinned Node 24.19.0 (53.16 seconds on the final release tree). Focused recovery plus actual Worker/auth/D1 checks pass 12/12. TypeScript, build, 17 prerenders, public browser budgets and deployment dry-run pass. Both prepared model source identities are unchanged. The status-copy check also makes a loaded dirty cache say Changes saved on this device instead of claiming cloud synchronization.

Actual local React/provider/account-screen QA reproduced the original blocked-download loss. The repair preserves text on quota/network failure, retains recovery through page reload, prevents silent sign-out disposal, restores the fictional CV and removes only the explicitly selected recovery copy. The recovered CV's subsequent fictional save conflict remains visible. Chrome restarted during inspection; the same recovery copy was present after reconnecting. At an actual 390-pixel viewport, the full fixture body is 390 pixels and the recovery region 302 pixels, with no horizontal overflow after wrapping a fixture-only diagnostic line. The screenshot contains only invented data.

Live results are recorded after deployment. Fictional UI verification does not establish actual downloaded-file delivery or customer recovery.
