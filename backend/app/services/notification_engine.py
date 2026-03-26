"""Notification engine — matches events against subscriptions and dispatches.

Channels: in_app (Supabase insert), email_instant (Resend API), webhook.
"""

import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Impact level ordering for filter comparison
IMPACT_LEVELS = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def matches_subscription(event: dict, subscription: dict) -> bool:
    """Check if an event matches a subscription's filters.

    Parameters
    ----------
    event : dict
        Keys: topic, impact_level, visa_routes (list), industries (list)
    subscription : dict
        Keys: filter_topics (list), filter_visa_routes (list),
              filter_industries (list), filter_min_impact (str)
    """
    # Check minimum impact level
    min_impact = subscription.get("filter_min_impact", "medium")
    event_impact = event.get("impact_level", "low")
    if IMPACT_LEVELS.get(event_impact, 3) > IMPACT_LEVELS.get(min_impact, 2):
        return False

    # Check topic filter (if set, event topic must be in filter list)
    filter_topics = subscription.get("filter_topics") or []
    if filter_topics and event.get("topic") not in filter_topics:
        return False

    # Check visa route filter (if set, at least one route must overlap)
    filter_routes = subscription.get("filter_visa_routes") or []
    event_routes = event.get("visa_routes") or []
    if filter_routes and not set(filter_routes).intersection(set(event_routes)):
        return False

    # Check industry filter
    filter_industries = subscription.get("filter_industries") or []
    event_industries = event.get("industries") or []
    if filter_industries and not set(filter_industries).intersection(set(event_industries)):
        return False

    return True


async def dispatch_notification(
    supabase,
    user_id: str,
    subscription_id: str,
    intel_item_id: str | None,
    title: str,
    body: str,
    channel: str = "in_app",
):
    """Dispatch a notification to a user.

    Parameters
    ----------
    channel : str
        One of: in_app, email_instant, email_digest, webhook
    """
    if channel == "in_app":
        try:
            supabase.table("intel_notifications").insert({
                "user_id": user_id,
                "intel_item_id": intel_item_id,
                "subscription_id": subscription_id,
                "title": title,
                "body": body,
            }).execute()
            logger.info(f"[NOTIFY] In-app notification sent to {user_id}: {title[:50]}")
        except Exception as e:
            logger.error(f"[NOTIFY] In-app notification failed: {e}")

    elif channel == "email_instant":
        await _send_email(user_id, title, body, supabase)

    elif channel == "webhook":
        await _send_webhook(user_id, title, body, intel_item_id, supabase)


async def _send_email(user_id: str, title: str, body: str, supabase):
    """Send email via Resend API (if configured)."""
    try:
        from app.core.config import get_settings
        s = get_settings()
        if not s.resend_api_key:
            logger.debug("[NOTIFY] Resend not configured, skipping email")
            return

        # Get user email
        user = supabase.table("users").select("email").eq("id", user_id).limit(1).execute()
        if not user.data:
            return

        email = user.data[0].get("email")
        if not email:
            return

        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {s.resend_api_key}"},
                json={
                    "from": "SponsorIntel <alerts@sponsorintel.london>",
                    "to": [email],
                    "subject": f"[SponsorIntel] {title}",
                    "html": f"<h2>{title}</h2><p>{body}</p><p><a href='https://sponsorintel.london/intel'>View in SponsorIntel</a></p>",
                },
            )
            logger.info(f"[NOTIFY] Email sent to {email}: {title[:50]}")
    except Exception as e:
        logger.error(f"[NOTIFY] Email send failed: {e}")


async def _send_webhook(user_id: str, title: str, body: str, intel_item_id: str | None, supabase):
    """Send webhook notification."""
    try:
        # Get user's webhook URL from user_settings or similar
        # For now, log and skip
        logger.debug(f"[NOTIFY] Webhook delivery not yet implemented for user {user_id}")
    except Exception as e:
        logger.error(f"[NOTIFY] Webhook failed: {e}")


async def process_intel_event(supabase, event: dict) -> int:
    """Match an intel event against all active subscriptions and dispatch notifications.

    Returns number of notifications sent.
    """
    # Fetch active subscriptions
    try:
        result = supabase.table("intel_subscriptions").select("*").eq("is_active", True).execute()
        subscriptions = result.data or []
    except Exception as e:
        logger.error(f"[NOTIFY] Failed to fetch subscriptions: {e}")
        return 0

    sent = 0
    for sub in subscriptions:
        if matches_subscription(event, sub):
            title = event.get("title", "New Intel Alert")
            body = event.get("summary") or event.get("content_snippet") or ""
            channel = sub.get("channel", "in_app")

            await dispatch_notification(
                supabase,
                user_id=sub["user_id"],
                subscription_id=sub["id"],
                intel_item_id=event.get("id"),
                title=title,
                body=body,
                channel=channel,
            )
            sent += 1

    logger.info(f"[NOTIFY] Processed event: {sent} notifications from {len(subscriptions)} subscriptions")
    return sent
