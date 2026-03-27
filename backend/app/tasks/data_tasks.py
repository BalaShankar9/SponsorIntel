"""Celery tasks for Data Foundation — ground truth data ingestion."""

import asyncio
import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_supabase():
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


@celery_app.task(name="data.sync_sponsor_register", soft_time_limit=600, time_limit=900)
def sync_sponsor_register():
    """Download and diff the Home Office Sponsor Register CSV."""
    async def _run():
        from app.scripts.sync_register import download_register, sync_to_supabase
        supabase = _get_supabase()

        records = await download_register()
        if not records:
            logger.error("[DATA] No records downloaded from register")
            return {"status": "error", "records": 0}

        stats = await sync_to_supabase(supabase, records)
        logger.info(f"[DATA] Register sync complete: {stats}")
        return stats

    return _run_async(_run())


@celery_app.task(name="data.monitor_hansard", soft_time_limit=120, time_limit=180)
def monitor_hansard():
    """Search Hansard for immigration debates and store in intel_items."""
    async def _run():
        from app.scripts.data_foundation.hansard_monitor import search_hansard
        supabase = _get_supabase()

        items = await search_hansard(days_back=1)
        inserted = 0
        for item in items:
            try:
                existing = supabase.table("intel_items").select("id").eq(
                    "source_url", item["source_url"]
                ).limit(1).execute()
                if existing.data:
                    continue
                supabase.table("intel_items").insert(item).execute()
                inserted += 1
            except Exception as e:
                logger.error(f"[DATA] Hansard insert failed: {e}")

        logger.info(f"[DATA] Hansard monitor: {inserted} new items from {len(items)} found")
        return {"items_found": len(items), "items_inserted": inserted}

    return _run_async(_run())


@celery_app.task(name="data.process_notifications", soft_time_limit=120, time_limit=180)
def process_notifications():
    """Match recent unprocessed intel items against subscriptions and notify."""
    async def _run():
        from app.services.notification_engine import process_intel_event
        supabase = _get_supabase()

        # Get recent analyzed items that haven't triggered notifications yet
        from datetime import datetime, timedelta, timezone
        since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

        result = supabase.table("intel_items").select("*").eq(
            "status", "analyzed"
        ).gte("updated_at", since).limit(50).execute()

        items = result.data or []
        total_sent = 0

        for item in items:
            event = {
                "id": item["id"],
                "title": item.get("title", ""),
                "topic": item.get("topic"),
                "impact_level": item.get("impact_level"),
                "visa_routes": item.get("visa_routes_affected") or [],
                "industries": item.get("industries_affected") or [],
                "summary": item.get("summary"),
                "content_snippet": item.get("content_snippet"),
            }
            sent = await process_intel_event(supabase, event)
            total_sent += sent

        logger.info(f"[DATA] Notification processing: {total_sent} notifications from {len(items)} items")
        return {"items_processed": len(items), "notifications_sent": total_sent}

    return _run_async(_run())


@celery_app.task(name="data.targeted_job_search", soft_time_limit=1800, time_limit=3600)
def targeted_job_search(limit: int = 100):
    """Search Adzuna for jobs from sponsors that have 0 job listings."""
    async def _run():
        from app.scripts.data_foundation.targeted_job_search import run_targeted_search
        from app.core.config import get_settings
        supabase = _get_supabase()
        s = get_settings()

        if not s.adzuna_app_id or not s.adzuna_app_key:
            logger.error("[DATA] Adzuna API keys not configured")
            return {"error": "Adzuna keys not set"}

        return await run_targeted_search(
            supabase,
            app_id=s.adzuna_app_id,
            app_key=s.adzuna_app_key,
            limit=limit,
        )

    return _run_async(_run())
