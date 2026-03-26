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
