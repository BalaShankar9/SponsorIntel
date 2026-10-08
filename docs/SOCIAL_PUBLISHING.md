# Sponsor Intel social publishing

Updated 8 October 2026. Owner authorised routine company posts and personal LinkedIn introductions. No advertising spend or subscription purchase is approved.

## Verified destinations

| Channel | Public account | Publisher connection |
| --- | --- | --- |
| Facebook | https://www.facebook.com/profile.php?id=61595389821505 | Metricool brand 7294726, Page 1319703417896763, Europe/London; verified through UI and connector |
| LinkedIn company | https://www.linkedin.com/company/sponsorintellondon/ | Native publishing verified; evidence report scheduled for 9 October at 10:00 BST; Metricool displays a paid-plan gate |
| Personal LinkedIn | https://www.linkedin.com/in/bala-sankar-bollineni-b246bb189/ | Native introduction published; no Metricool connection |
| Instagram company | https://www.instagram.com/sponsorintellondon/ | Business profile and direct Instagram connection to Metricool brand 7294726 verified through UI and connector on 8 October; username `sponsorintellondon`, Europe/London. Publishing permission granted; first delivery unverified. |

The owner completed Instagram registration on 7 October. On 8 October the editor worked: the existing logo was retained, a public bio was saved and the account was converted to Business, with the visible category “Business and economy website”. Public contact details were skipped. Saved bio: “UK jobs & clear sponsorship evidence. / Application tools and sourced immigration updates. / Free to explore: sponsorintel.london” (slashes denote line breaks). Instagram web explicitly requires its mobile app to edit website links, so a clickable website field remains incomplete; the plain address is present in the bio.

The owner explicitly approved Metricool access to this company profile/media, publishing and insights, with message and comment access off. The permission screen was checked before Allow. Metricool then displayed “Ready! You have connected your Instagram account”; after a reload it retained the exact professional account, and the connector returned `networksData.instagramData = sponsorintellondon`. This uses direct Instagram login and basic metrics. The optional Facebook-link flow was declined, and no inbox or comment permission was added. Do not widen permissions to remove a provider warning, reconnect `hellracer473`, or convert a personal profile. Proof in the parent task folder: `outputs/sponsorintel-instagram-permissions.png`, `outputs/sponsorintel-instagram-business.png`, `outputs/sponsorintel-instagram-connected.png`. The credential-free receipt is `instagram-connection-2026-10-08.json` beside this document.

No Instagram post was scheduled or sent during connection setup. Release 2.24 adds the exact Instagram destination, versioned registered artwork and receipt validation, plus the finite `ig-welcome` campaign mapping. One real welcome is now saved in the production Marketing desk as Needs review, with three checked sources and the launch artwork. The draft and image were verified after reload; it has no review or provider receipt. Independently review its exact copy and media, reconcile the real provider queue, and retain the schedule and eventual live post URL separately. See `cloudflare/RELEASE-2.24.md` and its production evidence. A basic analytics read for 8 October returned followers/posts/views/reach as zero without a provider error. This verifies read access; the newly connected, zero-post account does not yet provide meaningful performance evidence or a completeness guarantee. Connection success alone does not prove publishing delivery. Keep the existing posting allowance; do not silently multiply it for a new channel.

## Initial launch sequence

Native welcome posts were published on 7 October; their receipts are in BUSINESS_OPERATING_SYSTEM.md. The following Facebook posts were scheduled through the Metricool connector and read back with autoPublish=true, draft=false and provider facebook only:

| UK publication time | Topic | Metricool post ID |
| --- | --- | --- |
| 8 October 2026, 10:00 BST | Dated evidence snapshot: 846 roles, 16 stated, 34 conditional, 91 unavailable, 705 unstated, 30 selected boards | 390622747 |
| 10 October 2026, 10:00 BST | Reading sponsorship wording and asking about the exact vacancy | 390623458 |
| 12 October 2026, 10:00 BST | Reviewing an AI-assisted application for evidence, accuracy and relevance | 390624032 |

Exact text, UUIDs, publication times and pending provider states are in social-launch-receipts-2026-10-07.json. These are scheduled receipts, not proof of publication. Metricool's best-time response supported 10:00 as a starting experiment; the brand has no demonstrated audience-performance history. The native welcome plus these three posts comprise the initial launch sequence. After it, use a maximum of three Facebook posts in a rolling seven-day period, counting both queued and published content.

The evidence report, advert guide and Application Studio were checked in the live browser before scheduling. The report describes the 7 October snapshot, not live counts at the future publication time. Legal context was checked against https://www.gov.uk/skilled-worker-visa/your-job; posts avoid salary thresholds, personal eligibility decisions or guarantees. Do not publish user CV content, private account details or application notes. Link attribution uses utm_source=facebook, utm_medium=organic_social and utm_campaign=launch_week.

The Europe/London calendar cards and connector both show 10:00. Reopening the post editor displays 11:00; re-saving 10:00 changes the numeric post ID but leaves the read-back time at 10:00, with the same UUID. This unresolved editor-display discrepancy is recorded so a later agent does not repeatedly shift posts. Use the current IDs above and verify actual publication at the due time. No duplicate post was created.

The company LinkedIn evidence report is separately queued in LinkedIn's native scheduler for **9 October 2026 at 10:00 BST**. The native time selector explicitly displayed British Summer Time, the action returned “Post scheduled”, and Sponsor Intel's scheduled-posts dialog showed exactly one item with the expected date and report text. It uses the first Facebook post's dated snapshot text with `utm_source=linkedin`. No Metricool subscription or LinkedIn connection was added. The native admin page is https://www.linkedin.com/company/146710167/admin/page-posts/published/; open its scheduled-posts dialog to reconcile before creating any more report posts. Screenshot: `outputs/sponsor-intel-social-kit/linkedin-scheduled-report.png` in the parent task folder. No public post URL or delivery receipt exists yet. Do not publish the matching Cloudflare outbox draft again while this item is queued.

## Daily operation

**8 October delivery update:** Metricool schedule `390622747`, UUID `-9208903732162113867`, progressed to Published with Facebook post ID `1319703417896763_122093924469512994`. The [live post](https://www.facebook.com/122093616117512994/posts/122093924469512994) was checked against the exact Sponsor Intel author/profile, Public audience, complete dated copy and report campaign link. Marketing desk saved `launch-fb-evidence` as version 1/revision 2 Published at 09:09:26.936 UTC. The original schedule remains in history. Do not repost this report. No actual publication timestamp was returned; keep its observed outcome separate from the planned 10:00 UK slot. Later Facebook posts and the native LinkedIn schedule remain pending their own checks.

Release 2.33 adds read-only delivery-record monitoring to the owner dashboard and hourly business checks. An unresolved recorded slot becomes overdue after 30 minutes; that does not prove provider failure. Explicit uncertainty, incomplete evidence and confirmed failure stay distinct. Reconcile through the existing provider and Marketing desk; these cloud checks do not call a publishing API. The daily routine now follows a provider-confirmed Pending/Publishing job for up to 15 minutes with at least a minute between observations, then records exact verified delivery or preserves uncertainty. Its existing time, limits and permissions are unchanged. The routine's next unattended completion must be observed separately.

The next marketing build is specified in MARKETING_AGENTS.md. It separates planner, opportunities editor, writer/designer, reviewer, publisher and analyst responsibilities and records what is not yet implemented. Follow its source-quality and measurement gates before expanding posting volume.

The existing Sponsor Intel daily improvement heartbeat remains at 10:00 local time. Its prompt now checks exact destination identity, existing schedules, source quality, duplication and delivery receipts. It can schedule at most one new post per run through the authenticated Metricool connector. The initial Facebook sequence is retained; subsequent Facebook and Instagram posts share the three-post rolling weekly ceiling. It must not reconnect the removed personal Instagram. New social destinations require verified account ownership and authorised access.

Metricool holds the queued posts and performs publication. The Codex heartbeat that replenishes and reviews that queue depends on the desktop scheduler and connector access. It is not a direct Cloudflare-to-Metricool API integration. Metricool's official API guide says direct API access needs Advanced or Custom; no such plan has been purchased: https://help.metricool.com/basic-guide-for-api-integration-r97af.

After a due time, check the provider's published-post status or analytics and retain the external post ID/URL. For the native LinkedIn item, inspect the company Page's published posts and verify matching text, destination and date. An empty scheduled list is not a delivery receipt. For an uncertain result, investigate before retrying. Failed posts should create an actionable report, not duplicate retries. Keep notifications quiet unless there is a meaningful completion, failure, result or owner decision.

Measure actual delivered posts, attributable visits and useful product actions separately. Do not call a scheduled post reach, impressions users, or a Page connection successful distribution. The Cloudflare social outbox still holds LinkedIn report drafts; do not mark them delivered because Facebook launch content was scheduled.

Release 2.13 measures recognised launch-campaign page opens and successful feature responses. The mapping is the finite list in `cloudflare/shared/campaigns.js`; new campaign combinations need a reviewed mapping before they can appear in reports. Do not silently shorten or change existing UTM labels. The first three `fb-evidence` page opens on 7 October were operator verification visits. Exclude that known baseline from audience-growth claims. Counts are not unique visitors, verified conversions or causal evidence; attribution may be lost across page reloads and ends after 30 minutes in the current document. Provider reach and delivery remain separate checks.


## Marketing desk (2.14)

Use the Marketing desk in `/admin` before creating more posts. The four recorded launch schedules are imported as historical schedule observations, with exact copy, sources, destination and external references. The three Facebook records were read back as PENDING again during 2.14 validation; LinkedIn retains the earlier native UI observation from 7 October. None of these four is marked published.

A report draft for personal LinkedIn is held pending independent editorial review, overlap checks and a recognised campaign mapping. Repeating Prepare & reconcile creates no duplicate company draft and preserves the hold. New report drafts are prepared by the hourly cloud workflow. Matching legacy outbox drafts are hidden from the old copy interface, while their source records remain retained.

The desk records observations and decisions; it does not operate Metricool or LinkedIn. Review and scheduling are tied to the exact content version. A revised draft loses its review. Receipt changes require a current revision, exact destination/provider and evidence notes; publication also requires a live post URL. Inspect the actual account and content before recording it. An uncertain or missing result must not cause a fresh schedule. Current provider posting limits still apply; the ledger does not replace the external publisher's quota checks.

## Editorial preparation (2.15)

The cloud now prepares guide drafts with a bounded planner, writer and a different-model paragraph reviewer. At most one revision is allowed. These stages write to the Marketing desk and cannot publish, reschedule or cancel provider posts. The existing daily desktop routine remains the provider-facing path. Read MARKETING_AGENTS.md for the narrow source policy, shared allowance and remaining model-quality validation.

Before the routine schedules a reviewed agent brief, inspect the exact content and source, recheck the real provider queue and limits, use the exact destination and record the returned schedule against that version. Do not regenerate a matching topic to bypass a hold. Never mark a proposed slot as a provider schedule. Resolve overdue/uncertain delivery in the ledger after checking the actual provider; the guide planner otherwise deliberately selects no post. The initial October queue is unchanged.
