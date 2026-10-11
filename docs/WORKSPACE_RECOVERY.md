# Device recovery before loading a cloud workspace

Release 2.62 replaces an unsafe account action. Previously the browser requested a JSON download, immediately removed its local workspace cache and loaded the cloud copy, then claimed the download had completed. An actual fictional account screen reproduced loss of unsynced CV text when downloads were deliberately blocked. A browser download request does not prove that a file was saved.

The replacement keeps and reads back one account-scoped recovery copy in browser storage before requesting the cloud workspace. It never automatically downloads, exports or transmits that copy. The current workspace stays visible on failed storage or cloud access. A successful switch keeps the old copy accessible for download, copying or an explicit restore; a page reload does not remove it. An existing recovery copy blocks another switch rather than being silently replaced. Damaged copies remain exportable as raw text.

The account screen explains the local retention and exposes removal separately. Sign-out is held until the user deals with the recovery copy, following the existing unsynced-work protection. Explicit account deletion removes the recovery copy on this browser after server deletion succeeds. Clearing browser/site data can still remove browser copies: this is not a cloud backup or disaster-recovery system. Copies on other devices are not remotely erased by this browser action.

Download controls say requested, never delivered, and provide readable backup text when downloads are unavailable. Restore requires the user's confirmation, retains the original recovery copy and uses the normal cloud revision checks. A failed/conflicting save stays an explicit local state; restoration is not proof of cloud synchronization. Importing a career backup remains a merge and is distinct from restoring this copy.

Late cloud responses cannot replace edits, another account or a changed saved cache/recovery record. The provider prevents its persistence effect from overwriting a concurrently changed cache after a rejected switch. Workspace reads now return the authenticated account ID. New clients compare that identity and send an expected account ID with normal saves; the server rejects mismatches without selecting another account from client input. Older clients remain compatible when that optional guard is absent; existing authenticated-session isolation still applies.

## Verification

- Actual local account/provider/React screen: blocked-download loss reproduced before the repair; storage failure and cloud failure preserve local text afterward; recovery text survives reload; explicit restore retrieves the fictional CV; removing its recovery copy leaves the current workspace; sign-out protection is visible.
- Helper tests cover read-back, quota/silent storage failure, network/malformed response, account/edits/other-tab races, failed cache persistence, exact-copy removal, separate accounts and damaged records.
- Actual isolated Worker/auth/D1 checks assert returned account identity and reject a stale other-account save while keeping its stored data/revision unchanged. Existing account-deletion races and concurrent-save checks remain covered.
- All fixtures contain invented records and deny external calls. They do not establish real customer recovery, actual downloaded-file delivery or independent security acceptance.
