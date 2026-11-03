# Advert Check privacy policy — approved copy and review record

Prepared **3 November 2026** for **Sponsor Intel — Advert Check 0.1.1**. The owner explicitly answered **“Approve this policy for publication”** after reviewing the exact draft at commit `fc5256f011405fef434a4ad78a995df2163c5f6d` (SHA-256 `8fbd60620bf58b834d6d129ac3491965c8d43e86585e7d79770b10d6d1628b60`). The unchanged text between the rules below is now [published policy](https://sponsorintel.london/extension-privacy.html), live **3 November 16:21:59 UTC** and byte-verified at 16:22 UTC. This is the approved policy commitment, not Google approval, a completed dashboard certification or independent legal advice.

The draft is tied to the 25,407-byte package with SHA-256 `42fec9e8d1b3cc0935dd14f1954cc0a1bbde84cd6e38b3b30ce3473d66cd44b7`. Re-review it if the package's behavior changes. Publisher identity, contact/account fields and the actual dashboard declarations must still be checked manually; the protected dashboard cannot be scripted. Registration/payment reported by the owner is not a submitted or approved listing.

---

## Sponsor Intel Advert Check: privacy and your information

This policy describes the Sponsor Intel Advert Check browser extension, version 0.1.1. It helps you inspect sponsorship wording in one job advert. Its checks run on your device without an account or an AI service.

### What the extension reads

When you press **Read this advert**, the extension accesses the active tab you chose. It checks the tab's web address to confirm it is an ordinary HTTP or HTTPS page, then reads the selected advert text or a detected description section. When it cannot isolate a description, it may read the page's main text and tells you to review it. It does not read every tab or monitor your browsing in the background.

The popup displays the captured text, the page's origin (for example, `https://example.com`), the capture method and your local capture time. The full page address is used for the page-type check; it is not displayed, saved or sent to Sponsor Intel. Browser access may also expose current-tab metadata, such as its title, which the extension does not use or save.

You can instead paste or edit an advert in the popup. Pasting uses the browser's ordinary paste action; the extension has no clipboard-reading permission. Please use public advert text only. Do not paste CVs, passwords, private messages or application answers. Automatic capture excludes form controls and editable regions, but it cannot guarantee that text elsewhere on a webpage, or text you select or paste, contains no personal information.

### How the text is used

After you review the text, confirm that it contains one complete advert and press **Check wording**, local phrase rules produce a wording result and supporting sentences. No text is sent to a model, Sponsor Intel server or another service. Editing the text invalidates the previous result and confirmation.

These are wording checks, not employer confirmation, sponsor-licence verification, an eligibility decision or an application submission. Unclear wording stays unclear.

### Storage, sharing and your controls

Advert text, captured page information and results are held temporarily in the open popup. The extension does not write them to browser storage, files, a cloud account or a database. Press **Clear** to remove the text and result, or close the popup. They are not restored when the popup is reopened. This describes the extension's behavior; it is not a promise of secure erasure from browser or operating-system memory.

The extension contains no analytics or advertising tracker, makes no background network requests and uploads no advert text or results. Sponsor Intel receives no copy through the extension, and does not sell, share, use for advertising or train models on that text. There is no extension history or saved profile for Sponsor Intel to retrieve or delete.

Remove the extension through your browser's extension settings to stop using it. Clearing or removing it does not delete the original webpage, text on your clipboard or files you saved separately.

### Permissions and external links

The extension asks for **activeTab** and **scripting**. They allow temporary access to the tab you choose and execution of the packaged text-capture code after your click. It does not request persistent access to all websites, browsing-history permission or additional account permissions. Its executable code is bundled with the extension; it does not download remote code.

Opening **Help, limits and privacy** takes you to the separate Sponsor Intel website. The link does not include your advert text, results or the job-page address. Ordinary website requests and the site's own data handling apply to that visit, including hosting/request information and aggregate page measurement. You can read the site's **Privacy & use** information from [Sponsor Intel](https://sponsorintel.london/about). The job website you are reading and your browser have their own privacy practices.

### Limited Use

Sponsor Intel Advert Check uses information obtained through browser APIs in accordance with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use), including its Limited Use restrictions. The extension uses the information only to provide the advert-wording check described here.

### Questions and changes

For a privacy question or a problem with Advert Check, open [Sponsor Intel](https://sponsorintel.london/about) and choose **Feedback**. That is a separate website submission: only send information you want the support team to review, and do not include private application documents or passwords. The form explains its own handling and provides a reference after a successful submission. This policy does not promise a response time.

Any future version that changes how information is read, stored or sent must have an updated disclosure. Check the extension version and the policy supplied with that version before using new features.

---

## Publisher review and evidence

The owner approved the affirmative Limited Use paragraph with the complete policy. It is now a published commitment, not an agent dashboard certification or a claim of Google approval. The published page is dated 3 November 2026. The current Feedback route is real, but a successful new support submission or timely response was not tested; do not substitute the account-email sender for an unverified support address.

| Proposed disclosure | Implementation inspected on 3 November |
| --- | --- |
| One user-initiated active-tab read | `extension/popup.js`: Read click, `tabs.query({active:true,currentWindow:true})`, HTTP(S) test, `scripting.executeScript`; no background entry in manifest |
| Text, origin, capture method and local time | `extension/capture.js` returns text/mode/`location.origin`; popup displays these with local time; `tab.url` is checked but not attached to a link |
| Automatic exclusions and their limits | Capture has explicit form/editable/hidden/navigation exclusions and rejects selections intersecting listed fields; arbitrary page/selected/pasted content is not proven free of personal data |
| Local wording analysis | `extension/analyse.js` and popup import; review/complete-advert confirmation before classification; six bounded evidence quotes; no network or model dependency |
| Temporary state and clear | Popup DOM/variables only; Clear invalidates pending captures and removes displayed text/result; no storage API, file writing or account integration |
| No extension telemetry or remote code | All ten ZIP entries inspected; manifest has only activeTab/scripting, no hosts/background/content scripts/storage, `connect-src 'none'`; no network APIs or remote imports in packaged JavaScript |
| Separate website visit | Popup link is a fixed HTTPS `/browser-extension` URL with `noopener noreferrer`, no text/address parameters; website has its own measurement and privacy UI |
| Existing support route | Website source `main.tsx`/`feedback.tsx`, `SUPPORT_OPERATIONS.md`; excluded HTTP `/about` at 16:06:50 UTC returned 200 and contained Feedback and Privacy & use controls. No form was submitted. |

Official references inspected on 3 November: [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use). Local processing still needs disclosure. Store declarations must accurately describe the actual package and agree with the public policy; they are not automatically completed by this document.

Suggested declaration review: **website content** is handled locally; the current page URL/origin also needs review against the dashboard's current **web history/browsing activity** definition. Do not select “no user data” merely because nothing leaves the device. Incidental personal information can exist in text, but the extension does not intentionally request identity, payment, health, authentication, communications or location information. The exact category wording and required certifications have not been read from the protected current dashboard. No checkbox is selected or certified here.

Policy approval and publication are complete; all 21 approved headings/paragraphs and the live HTML match. Store submission still requires accurate publisher identity/contact fields, consistent current dashboard declarations and inspection of the exact listing/candidate. Current source review is agent-assisted, not independent privacy/security or legal acceptance. Store image, installed 0.1.1 and consumer-installation gates in `EXTENSION_STORE_SUBMISSION.md` remain separate.
