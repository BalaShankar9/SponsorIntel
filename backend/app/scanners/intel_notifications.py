"""
Notification matching: match analyzed intel items to user subscriptions.
"""

import logging

logger = logging.getLogger(__name__)

IMPACT_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


async def match_and_notify(supabase_client, item: dict) -> int:
    """Match a single analyzed item against all active subscriptions. Returns count of notifications created."""
    item_impact_rank = IMPACT_RANK.get(item.get("impact_level", "low"), 0)
    notifications_created = 0

    # Fetch all active subscriptions
    subs_result = supabase_client.table("intel_subscriptions").select(
        "id, user_id, channel, filter_topics, filter_visa_routes, filter_nationalities, filter_industries, filter_min_impact"
    ).eq("is_active", True).execute()

    for sub in (subs_result.data or []):
        # Impact threshold check
        sub_min_rank = IMPACT_RANK.get(sub.get("filter_min_impact", "medium"), 2)
        if item_impact_rank < sub_min_rank:
            continue

        # Topic filter
        filter_topics = sub.get("filter_topics")
        if filter_topics and item.get("topic") not in filter_topics:
            continue

        # Visa route filter (any overlap)
        filter_routes = sub.get("filter_visa_routes")
        item_routes = item.get("visa_routes_affected") or []
        if filter_routes and not set(filter_routes).intersection(set(item_routes)):
            continue

        # Nationality filter (any overlap)
        filter_nats = sub.get("filter_nationalities")
        item_nats = item.get("nationalities_affected") or []
        if filter_nats and not set(filter_nats).intersection(set(item_nats)):
            continue

        # Industry filter (any overlap)
        filter_inds = sub.get("filter_industries")
        item_inds = item.get("industries_affected") or []
        if filter_inds and not set(filter_inds).intersection(set(item_inds)):
            continue

        # Insert notification (ON CONFLICT ignore via unique index)
        try:
            supabase_client.table("intel_notifications").insert({
                "user_id": sub["user_id"],
                "intel_item_id": item["id"],
                "subscription_id": sub["id"],
                "title": item["title"],
                "body": item.get("summary"),
                "is_read": False,
            }).execute()
            notifications_created += 1
        except Exception:
            pass  # Duplicate, skip

    return notifications_created


async def process_notification_backlog(supabase_client) -> dict:
    """Process recently analyzed items that haven't been matched yet."""
    from datetime import datetime, timedelta

    stats = {"items_checked": 0, "notifications_created": 0}

    # Get recently analyzed items (last 30 min)
    cutoff = (datetime.utcnow() - timedelta(minutes=30)).isoformat()
    result = supabase_client.table("intel_items").select("*").eq(
        "status", "analyzed"
    ).gte("updated_at", cutoff).order("updated_at", desc=False).limit(50).execute()

    items = result.data or []
    stats["items_checked"] = len(items)

    for item in items:
        count = await match_and_notify(supabase_client, item)
        stats["notifications_created"] += count

    return stats
