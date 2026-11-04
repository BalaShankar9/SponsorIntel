# Marketing review — 30 October 2026

Read-only observations collected during **12:24–12:34 UTC**. [Sanitized provider receipt](../cloudflare/tests/evidence/marketing-audit-2026-10-30.json). The provider audit is retained in this repository; **no new performance observation was saved to production**, whose daily D1 write allowance is exhausted. The current cloud planner cannot use this new evidence yet.

## Publishing inventory

| Channel | Verified pending schedules | Evidence and limits |
| --- | ---: | --- |
| Facebook | 0 | Metricool brand 7294726, Page 1319703417896763; queue query 23 October–30 November, Europe/London, returned no rows. |
| Instagram | 0 | Same queue query; exact connected account `sponsorintellondon`. Welcome remains held; connection is not delivery. |
| LinkedIn company | 0 | Native company 146710167 explicitly displayed “No scheduled posts yet”. Three substantive company posts are visible in its published list. |
| Personal LinkedIn | 0 | Approved Bala profile; native Scheduled tab displayed its empty state. No post was created. |
| WhatsApp communities | No connected queue | No recurring scheduler is connected. Earlier messages in eight groups were verified on 13 October; manual sends were not inspected today. Do not describe historical messages as future schedules or infer zero recent sends. |

The internal Marketing desk has seven Published briefs (five Facebook, two LinkedIn company), with zero Scheduled/uncertain briefs. Native welcome/setup posts are not all represented in that ledger. The LinkedIn report previously described as pending in `SOCIAL_PUBLISHING.md` was already verified and retained Published on 26 October; today's native page reconfirms it. The handoff now reflects that completed delivery rather than inviting a resend.

## Observed results

Facebook's query selected posts dated 7–29 October. Metricool documents that this publication filter returns cumulative post performance through the previous day, **not activity occurring only inside the selected dates**. [Provider definitions](https://help.metricool.com/facebook-metrics-8gdta), [window explanation](https://help.metricool.com/difference-between-published-posts-and-viewed-posts-in-the-period-2pwtf).

| Facebook post | Displayed publication day | Link-click events | Post reach |
| --- | --- | ---: | ---: |
| Company welcome | 7 October | 1 | 9 |
| Dated evidence report | 8 October | 0 | 3 |
| Reading advert wording | 10 October | 0 | 1 |
| Reviewing an application | 12 October | 0 | 2 |
| Building a shortlist | 16 October | 2 | 1 |
| Dated Carpentry advert | 18 October | 1 | 1 |

The six substantive posts total **four link-click events**, all with zero reported comments/reactions/shares. A seventh blank-caption provider row is kept separate and unclassified (zero link clicks, reach two). Reach is not summed. Operator visits may contribute, and these clicks do not prove four people, website visits, applications or conversions. The Carpentry post's performance is not a new source/licence review. The connector still calls `FBPO11` “impressions” while the official current post-list explanation uses “views”; the raw labelled values are retained, with both normalized fields left unknown under the existing definition hold. Raw publication time strings have no established timezone, so no exact publication timestamps were invented.

LinkedIn company has **two followers**. Its [23 October dated report](https://www.linkedin.com/feed/update/urn:li:activity:7519322228237381632) displays **102 organic impressions, one engagement/one general click, and zero reactions/comments/reposts**. The linked native analytics URL identifies that exact activity. The complete visible caption still dates 51 positive/conditional adverts out of 1,018 roles to 21 October, and its report campaign destination matches. The earlier report displays eight impressions and the welcome 156; different ages/content prevent a controlled comparison. External link clicks, current reach and provider synchronization time were not supplied. One general click is not an attributed website visit.

Instagram reports **four followers on its latest populated day, 28 October**. The requested 23–29 October period reports zero feed posts, reels, stories and views, with aggregate zeroes on the 29 October row. Missing daily values and the latest row's missing follower/reach figures remain unknown. This is not a confirmed 30 October follower count or evidence of a first delivered Instagram post.

## Decision and next gate

Marketing is tailored to the product, but distribution is still small and repeatable acquisition is unproven. The empty queues do not clear held reviews or establish that more posting would improve outcomes. The 11 October experiment has not produced a comparable, complete set of 24-hour/seven-day observations or attributable product actions; do not declare a winning format or silently call it successful.

The bounded decision this week is **no cadence or format change from these sparse results**. Restore dependable saving and genuine supervisor execution first. Then retain fresh, correctly timed performance observations through the owner desk and verify inclusion in a subsequent real eligible planner context. Preserve the existing three Facebook/Instagram posts per rolling seven days and one new schedule per run. Future advance scheduling should use a reviewed durable guide or dated report; a time-sensitive vacancy still requires an actively observed immediate pre-delivery check and reconciliation.

The cloud performance table currently contains five observations, latest 17 October; today's read consumed five rows and wrote none. The new results above have not been supplied to a model or backfilled into an old context. Existing Instagram, personal/company and Monzo holds, the expired unscheduled Sequence slot and all uncertain outcomes remain. No AI/Google call, post, schedule, message, email, purchase, permission change or production write was made in this audit. The one temporary browser tab was closed; unrelated user tabs and drafts were preserved.

At the 12:32–12:34 UTC source inspection, both the latest application receipt and provider list still ended at the 06:30 source run. The 12:30 slot had no new visible receipt; this is missing observation, not proof of absent cron execution. No run was forced. Current release and capacity limitations remain in [the checkpoint](OPERATOR_CHECKPOINT.md).
