"""API endpoints for Data Foundation — visa stats, ISL, salary benchmarks, register changes."""

from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter(prefix="/data", tags=["data"])


def _get_supabase():
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


@router.get("/visa-stats")
async def get_visa_stats(
    soc_code: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = Query(default=50, le=200),
):
    """Get visa grant statistics, optionally filtered by SOC code and year."""
    sb = _get_supabase()
    query = sb.table("visa_statistics").select("*")
    if soc_code:
        query = query.eq("soc_code", soc_code)
    if year:
        query = query.eq("year", year)
    result = query.order("grants_total", desc=True).limit(limit).execute()
    return {"data": result.data or [], "count": len(result.data or [])}


@router.get("/visa-stats/{soc_code}")
async def get_visa_stats_by_soc(soc_code: str):
    """Get all visa stats for a specific SOC code across years."""
    sb = _get_supabase()
    result = sb.table("visa_statistics").select("*").eq("soc_code", soc_code).order("year", desc=True).execute()
    return {"data": result.data or []}


@router.get("/immigration-salary-list")
async def get_isl():
    """Get the current Immigration Salary List (active entries only)."""
    sb = _get_supabase()
    result = sb.table("immigration_salary_list").select("*").eq("is_active", True).order("soc_code").execute()
    return {"data": result.data or [], "count": len(result.data or [])}


@router.get("/salary-benchmarks/{soc_code}")
async def get_salary_benchmarks(soc_code: str, region: str = "UK"):
    """Get ONS salary benchmarks for a SOC code."""
    sb = _get_supabase()
    query = sb.table("ons_salary_benchmarks").select("*").eq("soc_code", soc_code)
    if region != "all":
        query = query.eq("region", region)
    result = query.order("year", desc=True).execute()
    return {"data": result.data or []}


@router.get("/register-changes")
async def get_register_changes(
    change_type: Optional[str] = None,
    days: int = Query(default=7, le=90),
    limit: int = Query(default=50, le=200),
):
    """Get recent sponsor register changes."""
    sb = _get_supabase()
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    query = sb.table("sponsor_changes").select("*").gte("detected_at", since)
    if change_type:
        query = query.eq("change_type", change_type)
    result = query.order("detected_at", desc=True).limit(limit).execute()
    return {"data": result.data or [], "count": len(result.data or [])}


@router.get("/register-changes/stats")
async def get_register_change_stats(days: int = Query(default=7, le=90)):
    """Summary stats of recent register changes."""
    sb = _get_supabase()
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = sb.table("sponsor_changes").select("change_type").gte("detected_at", since).execute()
    changes = result.data or []

    stats = {}
    for change in changes:
        ct = change.get("change_type", "unknown")
        stats[ct] = stats.get(ct, 0) + 1

    return {"period_days": days, "total_changes": len(changes), "by_type": stats}
