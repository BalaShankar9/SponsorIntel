# Advert Check — prepared store listing

Updated **3 November 2026, 19:06 UTC** for prepared Advert Check **0.1.7**; the public download remains **0.1.6**. **Draft only; not uploaded, submitted, approved or ready for submission.** The non-public candidate changes only the version, README version and 128-pixel icon. Its executable code, popup HTML/CSS, smaller icons, permissions/CSP and data handling match verified 0.1.6 byte-for-byte. The icon is rendered from the existing vector brand mark with a 96-pixel footprint and 16-pixel transparent padding. Fifteen existing targeted tests pass, archive CRC is valid, a second preparation is byte-identical and an existing candidate cannot be overwritten. These checks do not establish installed 0.1.7 acceptance. The earlier 34 fictional capture cases and popup bridge remain historical 0.1.6-code evidence, not a new installed run. The six reviewer examples below still require the manual installed-extension walkthrough. Earlier 0.1.0–0.1.6 store preflights are historical.

**Publisher handoff, 3 November:** the owner first requested account setup, then reported **“Done and paid”** after opening the console personally. A user-owned Chrome Web Store Developer Dashboard tab with a publisher-specific URL is present. Inspecting that page returned **“The extensions gallery cannot be scripted.”** Account activation, exact fee/currency, agreements accepted by the owner and remaining account fields are therefore not independently verified. Do not ask the owner to pay again, repeat the answered account/fee handoff, or bypass the browser restriction. The agent made no payment, accepted no agreement and uploaded nothing. [Google's registration guide](https://developer.chrome.com/docs/webstore/register) requires a one-time fee and developer agreement and says the account email cannot later be changed. Store actions must be completed manually through the existing dashboard; no new API credentials or permission expansion are authorized. Capacity/supervisor and all other holds remain.

## Exact candidate and public destinations

- Product: **Sponsor Intel — Advert Check**; prepared store manifest version **0.1.7**.
- Candidate: `cloudflare/store/advert-check/0.1.7/sponsor-intel-extension-0.1.7.zip`, **27,939 bytes**, SHA-256 `4bea24f8b62ede60bddf81873ee2595a5260d4622836b8a2d2793a900ec2d0d0`. This is outside public assets and has not been installed, uploaded or published. See the adjacent `receipt.json` and `README.md`.
- The [public download](https://sponsorintel.london/downloads/sponsor-intel-extension-0.1.6.zip) remains **0.1.6**, **28,360 bytes**, SHA-256 `564d8d1b6addf305d15194c4eefd72c3f50ccf969045b15c1444e7a7a18ee97f`. Do not label it 0.1.7 or replace its bytes.
- Homepage/help candidate: <https://sponsorintel.london/browser-extension>.
- Privacy-policy URL: **https://sponsorintel.london/extension-privacy.html**. The owner approved the exact [policy copy](EXTENSION_PRIVACY_DRAFT.md); release 2.98.10 published it at 16:21:59 UTC and excluded HTTP verified all bytes at 16:22 UTC. The approved substantive article is unchanged. Its header records that 0.1.6 retains the 0.1.1 data handling and Limited Use commitment while tightening local page-capture boundaries. This closes the public-policy gate only; current dashboard categories/certifications and publisher identity/contact still need manual review.
- Language: English. Suggested category: Productivity, subject to the current dashboard's available taxonomy. Distribution countries, publisher identity/contact and any verification declarations remain unselected; a UK job focus does not establish the user's location.
- Public store URL, submission/item ID and review status: **none**.

The manifest summary is already: “Read sponsorship wording in one job advert, with evidence. Local checks; unclear wording stays unclear.” Keep store copy consistent with the actual package. A revised icon or other package change needs a new version/hash, packaging and acceptance; do not silently replace the existing public ZIP.

## Listing description — ready to review

Check the sponsorship wording in a job advert and see the sentences behind the result.

Sponsor Intel Advert Check helps you read one complete English-language UK job advert. Open the extension, read the visible description or paste its public text, then review it before checking. It distinguishes wording that offers sponsorship, makes it conditional, explicitly refuses it or leaves the answer unclear.

Each supported result includes the relevant sentences so you can check the context yourself. If the page contains several jobs or cannot be read reliably, select one complete advert or paste it into the popup.

The check runs locally in your browser. No account, AI service, background scanner or text upload is used. The extension does not save your advert or result; closing the popup clears them.

This is an early wording-assistance preview. It does not check sponsor licences, confirm that a vacancy is still open, decide your eligibility or submit applications. Missing wording is not a refusal. Phrase checks can miss meaning, so confirm important conditions in the employer's original advert. Some layouts, embedded content, scanned PDFs, restricted browser pages and other languages are unsupported. Do not paste CVs, credentials or private application answers.

Help and the equivalent local website checker: https://sponsorintel.london/browser-extension

## Single-purpose and permission fields — ready to review

**Single purpose:** Help a user inspect sponsorship wording in one job advert, using local phrase checks and supporting sentences from the text they choose to read or paste.

| Field | Proposed explanation grounded in 0.1.6 |
| --- | --- |
| `activeTab` | Temporarily access the tab the user chose through the extension action. When they press Read this advert, inspect that tab and capture readable advert text. No browsing-history permission, background monitoring or persistent all-site access. |
| `scripting` | Run the packaged `captureAdvert` function in the chosen tab after Read this advert. It extracts text for the visible popup, with form/editable/hidden/navigation exclusions and selection fallback. It does not fetch or run remote code. |
| Remote code | No. All executable code is included in the ZIP. The extension's content security policy sets `connect-src 'none'`; there is no background process or remote script import. The ordinary help link opens the website only when the user follows it. |

Source evidence: `cloudflare/extension/manifest.json`, `popup.js`, `capture.js`, `analyse.js`, `popup.html`; package checksums and fictional Chrome acceptance are retained in the release receipts. No additional permission is proposed.

## Data handling — publisher review input, not a certification

The extension **handles website content locally**. A “no upload” design must not be described as “handles no user data.” Its active-tab query also makes the current URL available to check whether the page is HTTP/HTTPS; only the page origin is shown with captured text. There is no history API or tab inventory collection.

| Information / event | Actual handling in 0.1.6 |
| --- | --- |
| Visible advert or selected text | Read only after the user presses Read this advert; held in popup memory and analysed locally. The user reviews and confirms one complete advert. |
| Pasted/edited text | Held in popup memory. Edits invalidate the prior result and confirmation. Users are warned against private application material. |
| Origin, local capture time, result and sentences | Shown in the popup, not persisted or transmitted by the extension. |
| Closing or clearing the popup | Clears its text/result; no extension storage, sync, account save or recovery copy is implemented. |
| Forms and editable regions | Excluded from automatic capture; this is not a guarantee that arbitrary webpage text or user-pasted text contains no private information. |
| Help link | An ordinary user-initiated website visit. The website's separate hosting/aggregate measurement and data policy apply; extension text is not attached to the link. |
| Analytics, sale, advertising, training or third-party processing of advert text | None implemented by the extension. No new model call or telemetry permission. |

Chrome's [privacy-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) requires purpose, permission and data declarations. Its [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) includes local handling and requires consistent policy/disclosures. The publisher must review the current checkbox wording and certify accurate declarations after the policy is final. The complete proposed policy and code-to-disclosure review are in [EXTENSION_PRIVACY_DRAFT.md](EXTENSION_PRIVACY_DRAFT.md). The owner explicitly approved the complete policy before it was published. This document does not accept new platform terms, certify dashboard fields or assert Google approval.

## Reviewer walkthrough — fictional text only

No Sponsor Intel account or test credentials are required. After installing the exact candidate through the review environment, open the toolbar action. Paste one of the complete fictional examples below, tick the complete-advert confirmation and select Check wording. Compare the result and displayed sentence. Clear between examples; close/reopen the popup and check that nothing remains. Editing text must hide the previous result and clear confirmation.

| Fictional example | Expected wording result |
| --- | --- |
| Fictional London engineering role. Build software for our team. We offer visa sponsorship for this role. | Offered wording |
| Fictional London engineering role. Build software for our team. We may provide visa sponsorship, subject to eligibility. | Conditional wording |
| Fictional London engineering role. Build software for our team. We cannot offer visa sponsorship for this role. | Refused wording |
| Fictional London engineering role. Build and test software for our team. Read the full role description before applying. | Unclear; no sponsorship statement |
| Fictional London engineering role. Build software for our team. We offer visa sponsorship. This does not apply to this role. | Unclear; offered sentence and adjacent caveat both retained |
| Fictional London engineering role. Build software for our team. We cannot offer visa sponsorship. This statement is out of date. | Unclear; refusal and stale-statement caveat both retained |

For capture review, use a non-sensitive complete job description on an ordinary HTTP/HTTPS page, expand its description, open the action and press Read this advert. Inspect the captured text before confirmation. Open collapsed advert sections before capture. Selections crossing hidden/application regions are refused. Browsers lacking the visibility API require paste; this is not proof of visibility under every CSS layout. Multiple/embedded/inaccessible pages may require selection or paste. No site login, application, CAPTCHA bypass or claim of universal extraction is part of the review. The existing automated acceptance uses isolated fictional local pages, not real applicants.

## Asset preflight — icon prepared, screenshot still missing

The [store listing guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) calls for an icon and screenshot; the detailed [image guide](https://developer.chrome.com/docs/webstore/images) specifies dimensions and actual-experience screenshots. Official guidance was inspected on 3 November; dashboard acceptance remains untested.

| Asset | Current measured evidence | Remaining work |
| --- | --- | --- |
| Prepared 0.1.7 icon | 128×128 RGBA PNG; nontransparent bounds `(16,16)`–`(111,111)`; all outer 16-pixel alpha values zero | Corrected source-rendered icon is included in the new candidate and inspected visually. Native/store appearance remains unverified. Public 0.1.6 retains its original edge-reaching icon. |
| Actual Chrome popup screenshot | `chrome-packaged-popup.png`, 380×498, fictional local advert | Authentic QA evidence, but not a store-size asset. Capture an honest actual-experience image at the required 1280×800 size (the detailed guide also permits 640×400). Do not stretch, pad or fabricate a result to disguise the size mismatch. |
| Website screenshots | 1200×850 or full-page/mobile dimensions | Useful website QA, not a substitute for an extension-experience store screenshot. |
| Optional promotional tiles/video | Not prepared | Optional; no generated artwork, model spend or public marketing claim introduced by this preparation. |

Historical 0.1.0 byte/asset/source audit: `cloudflare/tests/evidence/extension-store-preflight-2026-11-03.json`. Live 0.1.6 evidence is in `cloudflare/tests/evidence/extension-capture-2026-11-03/`. Prepared 0.1.7 source/hash/alpha bounds are in `cloudflare/store/advert-check/0.1.7/receipt.json`; validation is in the adjacent `validation.json`. The icon preparation uses existing local rendering dependencies, not image generation or a model call. A browser retry found the existing LinkedIn tab blank and its inspection still unavailable; no real-site acceptance was added. This preflight is not platform rejection or approval.

## Remaining publication sequence

1. Validate the installed **0.1.7** candidate and capture an honest actual-experience screenshot at the required size. Its icon geometry/package preparation is complete; installed/native appearance is not. Keep all public 0.1.0, 0.1.1, 0.1.3 and 0.1.6 receipts intact. Unpublished 0.1.2/0.1.4/0.1.5 remain privately preserved and skipped.
2. The owner reports registration/payment complete. Confirm the remaining account fields manually in that existing dashboard; do not create or pay for a second publisher. The browser restriction prevents agent inspection. No guessed identity, trader status, address or agreement acceptance.
3. Use the published, owner-approved policy URL above. Review precise dashboard data categories, contact, distribution and declarations against the exact package and actual publisher; policy publication is not a dashboard certification.
4. Upload only the reviewed package/assets and exact approved listing under that verified publisher; preserve item/submission identity and platform outcome. No such upload or submission has occurred.
5. After approval, verify the exact public listing and ordinary consumer installation/update path before adding a one-click store link to Sponsor Intel. A submitted item is not a published listing; a listing is not independent semantic accuracy or universal compatibility.

For a **manual draft upload only**, Google documents **Add new item → Choose file → select the exact ZIP → Upload**. This creates a draft item, not a public listing. Keep it as a draft; the image/privacy/account gates above must be completed before Submit for Review. See [Google's upload instructions](https://developer.chrome.com/docs/webstore/publish). No draft upload has been observed yet.

Current status: **0.1.7 candidate and corrected icon prepared**, with code/permission/data handling identical to public 0.1.6. Listing/reviewer text prepared; policy approved and live. Actual installed verification/screenshot, dashboard declarations and account fields remain open. Owner reports payment complete; dashboard contents cannot be scripted; no store submission. Independent accuracy, live-site compatibility and usefulness gates remain in `BROWSER_EXTENSION.md`. No Worker deployment is needed for this non-public preparation.
