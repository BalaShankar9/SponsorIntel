"""
Intel API routes — Immigration Intelligence Hub.

All reads go through Supabase anon client (RLS enforced).
All writes go through Supabase service role client.
"""

import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.config import get_settings

router = APIRouter(prefix="/intel", tags=["intel"])


def _supabase_anon():
    """Supabase client with anon key for RLS-protected reads."""
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key)


def _supabase_service():
    """Supabase client with service role key for writes."""
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


# ---- Feed ----

@router.get("/feed")
async def intel_feed(
    topic: Optional[str] = Query(None),
    impact: Optional[str] = Query(None),
    visa_route: Optional[str] = Query(None),
    nationality: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Paginated feed of analyzed intel items with filters."""
    sb = _supabase_anon()
    query = sb.table("intel_items").select("*", count="exact").in_(
        "status", ["classified", "analyzed"]
    )

    if topic:
        query = query.eq("topic", topic)
    if impact:
        query = query.eq("impact_level", impact)
    if visa_route:
        query = query.contains("visa_routes_affected", [visa_route])
    if nationality:
        query = query.contains("nationalities_affected", [nationality])
    if date_from:
        query = query.gte("published_at", date_from)
    if date_to:
        query = query.lte("published_at", date_to)

    offset = (page - 1) * per_page
    query = query.order("published_at", desc=True).range(offset, offset + per_page - 1)

    result = query.execute()
    total = result.count or 0

    return {
        "data": result.data or [],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
        "per_page": per_page,
    }


@router.get("/item/{item_id}")
async def intel_item_detail(item_id: str):
    """Get a single intel item with full details."""
    sb = _supabase_anon()
    result = sb.table("intel_items").select("*").eq("id", item_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return result.data[0]


# ---- Timeline ----

@router.get("/timeline")
async def intel_timeline(
    visa_route: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Rule changes for timeline visualization."""
    sb = _supabase_anon()
    query = sb.table("intel_items").select(
        "id, title, published_at, impact_level, visa_routes_affected, summary, before_after"
    ).eq("topic", "rule_change").in_("status", ["classified", "analyzed"])

    if visa_route:
        query = query.contains("visa_routes_affected", [visa_route])
    if date_from:
        query = query.gte("published_at", date_from)
    if date_to:
        query = query.lte("published_at", date_to)

    result = query.order("published_at", desc=True).limit(100).execute()
    return {"nodes": result.data or [], "total": len(result.data or [])}


# ---- Calendar ----

@router.get("/calendar")
async def intel_calendar(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    visa_route: Optional[str] = Query(None),
):
    """Calendar events for a given month."""
    sb = _supabase_anon()
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"

    query = sb.table("intel_calendar").select("*").gte(
        "event_date", start
    ).lt("event_date", end)

    if visa_route:
        query = query.contains("visa_routes", [visa_route])

    result = query.order("event_date").execute()
    return {"events": result.data or [], "month": month, "year": year}


# ---- Statistics ----

@router.get("/stats")
async def intel_stats(visa_route: Optional[str] = Query(None)):
    """Statistics data, optionally filtered by visa route."""
    sb = _supabase_anon()
    query = sb.table("intel_statistics").select("*", count="exact")
    if visa_route:
        query = query.eq("visa_route", visa_route)
    result = query.order("published_at", desc=True).limit(200).execute()
    return {
        "statistics": result.data or [],
        "total": result.count or 0,
        "visa_route": visa_route,
    }


@router.get("/stats/{route}")
async def intel_stats_by_route(route: str):
    """Stats for a specific visa route."""
    sb = _supabase_anon()
    result = sb.table("intel_statistics").select("*").eq(
        "visa_route", route
    ).order("published_at", desc=True).limit(100).execute()
    return {"statistics": result.data or [], "total": len(result.data or []), "visa_route": route}


# ---- Policies ----

@router.get("/policies")
async def intel_policies(
    stage: Optional[str] = Query(None),
    visa_route: Optional[str] = Query(None),
):
    """Active policies with optional stage/route filter."""
    sb = _supabase_anon()
    query = sb.table("intel_policies").select("*", count="exact")
    if stage:
        query = query.eq("stage", stage)
    if visa_route:
        query = query.contains("visa_routes_affected", [visa_route])
    result = query.order("last_updated_at", desc=True).execute()
    return {"policies": result.data or [], "total": result.count or 0}


@router.post("/policies/{policy_id}/follow")
async def follow_policy(policy_id: str):
    """Follow a policy for notifications. Requires auth."""
    # Placeholder: auth will be added per existing pattern
    sb = _supabase_service()
    try:
        sb.table("intel_policy_follows").insert({
            "user_id": "00000000-0000-0000-0000-000000000000",  # TODO: from auth
            "policy_id": policy_id,
        }).execute()
    except Exception:
        pass  # Ignore duplicate
    return {"status": "followed"}


@router.delete("/policies/{policy_id}/follow")
async def unfollow_policy(policy_id: str):
    """Unfollow a policy."""
    sb = _supabase_service()
    sb.table("intel_policy_follows").delete().eq(
        "policy_id", policy_id
    ).eq("user_id", "00000000-0000-0000-0000-000000000000").execute()  # TODO: from auth
    return {"status": "unfollowed"}


# ---- Subscriptions ----

@router.post("/subscribe")
async def create_subscription(body: dict):
    """Create an intel alert subscription."""
    sb = _supabase_service()
    result = sb.table("intel_subscriptions").insert({
        "user_id": "00000000-0000-0000-0000-000000000000",  # TODO: from auth
        "filter_topics": body.get("filter_topics"),
        "filter_visa_routes": body.get("filter_visa_routes"),
        "filter_nationalities": body.get("filter_nationalities"),
        "filter_industries": body.get("filter_industries"),
        "filter_min_impact": body.get("filter_min_impact", "medium"),
        "channel": body.get("channel", "in_app"),
    }).execute()
    return result.data[0] if result.data else {}


@router.get("/subscriptions")
async def get_subscriptions():
    """Get current user's subscriptions."""
    sb = _supabase_anon()
    result = sb.table("intel_subscriptions").select("*").eq(
        "user_id", "00000000-0000-0000-0000-000000000000"  # TODO: from auth
    ).execute()
    return result.data or []


@router.delete("/subscriptions/{sub_id}")
async def delete_subscription(sub_id: str):
    """Delete a subscription."""
    sb = _supabase_service()
    sb.table("intel_subscriptions").delete().eq("id", sub_id).execute()
    return {"status": "deleted"}


# ---- Notifications ----

@router.get("/notifications")
async def get_notifications(
    is_read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get user's notifications."""
    sb = _supabase_anon()
    user_id = "00000000-0000-0000-0000-000000000000"  # TODO: from auth
    query = sb.table("intel_notifications").select("*", count="exact").eq("user_id", user_id)
    if is_read is not None:
        query = query.eq("is_read", is_read)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    total = result.count or 0

    # Unread count
    unread = sb.table("intel_notifications").select("id", count="exact").eq(
        "user_id", user_id
    ).eq("is_read", False).execute()

    return {
        "notifications": result.data or [],
        "total": total,
        "unread_count": unread.count or 0,
        "page": page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
    }


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str):
    """Mark a notification as read."""
    sb = _supabase_service()
    sb.table("intel_notifications").update({
        "is_read": True,
        "read_at": datetime.utcnow().isoformat(),
    }).eq("id", notif_id).execute()
    return {"status": "read"}


# ---- Lawyer Finder ----

@router.post("/lawyers/search")
async def search_lawyers_endpoint(body: dict):
    """Search & match lawyers based on user criteria."""
    from app.scanners.intel_lawyer_matcher import search_lawyers
    from app.agents.llm_service import LLMService

    sb = _supabase_service()
    s = get_settings()
    llm = LLMService(
        backend="groq",
        groq_api_key=s.groq_api_key,
        nvidia_nim_api_key=s.nvidia_nim_api_key,
    )

    result = await search_lawyers(
        sb, llm,
        visa_route=body.get("visa_route", ""),
        nationality=body.get("nationality"),
        location=body.get("location"),
        case_complexity=body.get("case_complexity", "straightforward"),
        budget_range=body.get("budget_range"),
        language_pref=body.get("language_pref"),
        page=body.get("page", 1),
        per_page=body.get("per_page", 10),
    )
    return result


@router.get("/lawyers/compare")
async def compare_lawyers(ids: str = Query(..., description="Comma-separated lawyer IDs")):
    """Compare 2-3 lawyers side by side."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if len(id_list) < 2 or len(id_list) > 3:
        raise HTTPException(status_code=400, detail="Provide 2 or 3 lawyer IDs")

    sb = _supabase_anon()
    result = sb.table("intel_lawyers").select("*").in_("id", id_list).execute()
    return {
        "lawyers": result.data or [],
        "comparison_dimensions": ["rating", "fees", "accreditations", "reviews", "experience"],
    }


@router.get("/lawyers/{lawyer_id}")
async def get_lawyer_detail(lawyer_id: str):
    """Get full lawyer profile."""
    sb = _supabase_anon()
    result = sb.table("intel_lawyers").select("*").eq("id", lawyer_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return result.data[0]


@router.get("/lawyers/{lawyer_id}/reviews")
async def get_lawyer_reviews(
    lawyer_id: str,
    source: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    """Get paginated reviews for a lawyer."""
    sb = _supabase_anon()
    query = sb.table("intel_lawyer_reviews").select("*", count="exact").eq("lawyer_id", lawyer_id)
    if source:
        query = query.eq("source", source)

    offset = (page - 1) * per_page
    result = query.order("review_date", desc=True).range(offset, offset + per_page - 1).execute()

    # Avg rating
    all_ratings = sb.table("intel_lawyer_reviews").select("rating").eq("lawyer_id", lawyer_id).execute()
    ratings = [r["rating"] for r in (all_ratings.data or []) if r.get("rating")]
    avg = sum(ratings) / len(ratings) if ratings else None

    return {
        "reviews": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
        "avg_rating": round(avg, 2) if avg else None,
    }


# ---- Digest Preview ----

@router.post("/digest/preview")
async def digest_preview():
    """Preview weekly digest content."""
    from datetime import timedelta

    sb = _supabase_anon()
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    # Top items
    items = sb.table("intel_items").select(
        "id, title, topic, impact_level, summary, visa_routes_affected, published_at"
    ).in_("status", ["classified", "analyzed"]).gte(
        "created_at", week_ago
    ).order("created_at", desc=True).limit(10).execute()

    # Stats
    stats = sb.table("intel_statistics").select("*").gte(
        "created_at", week_ago
    ).limit(5).execute()

    # Calendar
    now = datetime.utcnow()
    two_weeks = (now + timedelta(days=14)).strftime("%Y-%m-%d")
    calendar = sb.table("intel_calendar").select("*").gte(
        "event_date", now.strftime("%Y-%m-%d")
    ).lte("event_date", two_weeks).order("event_date").execute()

    return {
        "subject": f"SponsorIntel Weekly: {len(items.data or [])} updates this week",
        "generated_at": datetime.utcnow().isoformat(),
        "top_items": items.data or [],
        "statistics_snapshot": stats.data or [],
        "upcoming_calendar": calendar.data or [],
        "personalized_items": [],
        "sections": [],
    }
