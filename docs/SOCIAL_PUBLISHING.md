# Sponsor Intel social publishing

Updated 7 October 2026. Owner authorised routine company posts and personal LinkedIn introductions. No advertising spend or subscription purchase is approved.

## Verified destinations

| Channel | Public account | Publisher connection |
| --- | --- | --- |
| Facebook | https://www.facebook.com/profile.php?id=61595389821505 | Metricool brand 7294726, Page 1319703417896763, Europe/London; verified through UI and connector |
| LinkedIn company | https://www.linkedin.com/company/sponsorintellondon/ | Native publishing verified; Metricool displays a paid-plan gate |
| Personal LinkedIn | https://www.linkedin.com/in/bala-sankar-bollineni-b246bb189/ | Native introduction published; no Metricool connection |
| Instagram company | Not yet created | A personal Instagram was mistakenly connected, then disconnected with a success receipt. Do not publish company posts to any personal Instagram account. |

Instagram registration is prepared at https://www.instagram.com/accounts/emailsignup/ with name Sponsor Intel and username sponsorintellondon. The UI accepted the username but it is not reserved until registration succeeds. Owner must enter the new password, contact details, date of birth, accept terms and complete verification. No account was created by preparing the form. After registration, verify the exact account, add the existing logo, bio and website, configure professional business mode, link only the Sponsor Intel Facebook Page where required, then inspect and confirm any new publisher access. Do not convert or rename a personal account.

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

## Daily operation

The existing Sponsor Intel daily improvement heartbeat remains at 10:00 local time. Its prompt now checks exact destination identity, existing schedules, source quality, duplication and delivery receipts. It can schedule at most one new Facebook post per run within the weekly limit, through the authenticated Metricool connector. It must not reconnect the removed personal Instagram. New social destinations require verified account ownership and authorised access.

Metricool holds the queued posts and performs publication. The Codex heartbeat that replenishes and reviews that queue depends on the desktop scheduler and connector access. It is not a direct Cloudflare-to-Metricool API integration. Metricool's official API guide says direct API access needs Advanced or Custom; no such plan has been purchased: https://help.metricool.com/basic-guide-for-api-integration-r97af.

After a due time, check the provider's published-post status or analytics and retain the external post ID/URL. An empty scheduled list is not a delivery receipt. For an uncertain result, investigate before retrying. Failed posts should create an actionable report, not duplicate retries. Keep notifications quiet unless there is a meaningful completion, failure, result or owner decision.

Measure actual delivered posts, attributable visits and useful product actions separately. Do not call a scheduled post reach, impressions users, or a Page connection successful distribution. The Cloudflare social outbox still holds LinkedIn report drafts; do not mark them delivered because Facebook launch content was scheduled.
