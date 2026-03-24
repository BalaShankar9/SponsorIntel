"""
Celery tasks for the Intel — Immigration Intelligence Hub.

All tasks follow the existing pattern: sync wrapper calling async logic.
Uses Supabase service role client for writes (not anon key).
"""

import asyncio
import logging
import time

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a new event loop (for Celery tasks)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_supabase_service_client():
    """Get Supabase client using service role key for writes."""
    from supabase import create_client
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError("Supabase URL and service key must be configured")
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _get_redis_client():
    """Get async Redis client."""
    import redis.asyncio as aioredis
    from app.core.config import get_settings
    settings = get_settings()
    return aioredis.from_url(settings.redis_url, decode_responses=False)


def _get_llm_service():
    """Get LLM service configured with Groq + NVIDIA NIM."""
    from app.agents.llm_service import LLMService
    from app.core.config import get_settings
    settings = get_settings()
    return LLMService(
        backend="groq",
        groq_api_key=settings.groq_api_key,
        nvidia_nim_api_key=settings.nvidia_nim_api_key,
        nvidia_nim_base_url=settings.nvidia_nim_base_url,
    )


def _log_health(supabase_client, source_key: str, task_name: str, stats: dict):
    """Log scanner run health to intel_source_health_log."""
    try:
        supabase_client.table("intel_source_health_log").insert({
            "source_key": source_key,
            "scanner_task": task_name,
            "duration_ms": stats.get("duration_ms", 0),
            "items_fetched": stats.get("items_fetched", 0),
            "items_new": stats.get("items_new", 0),
            "items_filtered": stats.get("items_filtered", 0),
            "status": "error" if stats.get("errors", 0) > 0 else "success",
            "error_message": stats.get("error_message"),
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log health for {source_key}: {e}")


@celery_app.task(name="intel.scan_gov", bind=True, max_retries=3)
def intel_scan_gov(self):
    """Scan GOV.UK RSS feeds + Immigration Rules page diffs."""
    try:
        supabase = _get_supabase_service_client()
        redis = _get_redis_client()

        async def _run():
            from app.scanners.intel_gov import scan_gov_feeds
            return await scan_gov_feeds(supabase, redis)

        stats = _run_async(_run())
        _log_health(supabase, "gov_uk", "intel_scan_gov", stats)
        logger.info(f"intel_scan_gov complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_gov failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.scan_news", bind=True, max_retries=3)
def intel_scan_news(self):
    """Scan BBC, Guardian, Reuters, FT, Times RSS feeds."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_news import scan_news_feeds
            return await scan_news_feeds(supabase)

        stats = _run_async(_run())
        _log_health(supabase, "news_rss", "intel_scan_news", stats)
        logger.info(f"intel_scan_news complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_news failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.scan_legal", bind=True, max_retries=3)
def intel_scan_legal(self):
    """Scan legal blogs, tribunal decisions, Hansard."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_legal import scan_legal_sources
            return await scan_legal_sources(supabase)

        stats = _run_async(_run())
        _log_health(supabase, "legal", "intel_scan_legal", stats)
        logger.info(f"intel_scan_legal complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_legal failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.scan_social", bind=True, max_retries=3)
def intel_scan_social(self):
    """Scan Reddit r/ukvisa and r/iwantout."""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_social import scan_social_sources
            return await scan_social_sources(
                supabase, settings.reddit_client_id, settings.reddit_client_secret
            )

        stats = _run_async(_run())
        _log_health(supabase, "reddit", "intel_scan_social", stats)
        logger.info(f"intel_scan_social complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_social failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.classify")
def intel_classify():
    """Classify raw intel items using Groq LLM."""
    try:
        supabase = _get_supabase_service_client()
        llm = _get_llm_service()

        async def _run():
            from app.scanners.intel_classifier import classify_raw_items
            return await classify_raw_items(supabase, llm)

        stats = _run_async(_run())
        logger.info(f"intel_classify complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_classify failed: {e}")


@celery_app.task(name="intel.analyze")
def intel_analyze():
    """Analyze classified items with impact >= medium using NVIDIA NIM."""
    try:
        supabase = _get_supabase_service_client()
        llm = _get_llm_service()

        async def _run():
            from app.scanners.intel_classifier import analyze_classified_items
            return await analyze_classified_items(supabase, llm)

        stats = _run_async(_run())
        logger.info(f"intel_analyze complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_analyze failed: {e}")


@celery_app.task(name="intel.dedup")
def intel_dedup():
    """Deduplicate intel items using title similarity."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_classifier import run_dedup
            return await run_dedup(supabase)

        stats = _run_async(_run())
        logger.info(f"intel_dedup complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_dedup failed: {e}")
