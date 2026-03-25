"""Celery task infrastructure for the Agent Army.

Provides shared helper functions for creating Supabase, Redis, TierRouter,
and SignalBus instances used by all army division tasks. Individual division
tasks will be added in Phase 2+ as agents are migrated.
"""

import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_supabase():
    """Get Supabase service role client for army writes."""
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


async def _get_redis():
    """Get async Redis client."""
    import redis.asyncio as aioredis
    from app.core.config import get_settings
    s = get_settings()
    return aioredis.from_url(s.redis_url, decode_responses=False)


def _get_tier_router(redis, supabase):
    """Create a TierRouter with current settings."""
    from app.agents.tier_router import TierRouter
    from app.core.config import get_settings
    s = get_settings()
    return TierRouter(
        redis=redis,
        supabase=supabase,
        groq_api_key=s.groq_api_key,
        nvidia_nim_api_key=s.nvidia_nim_api_key,
        anthropic_api_key=s.anthropic_api_key or "",
        openrouter_api_key=s.openrouter_api_key,
        t1_model=s.army_t1_model,
        t2_model=s.army_t2_model,
        t3_model=s.army_t3_model,
        t4_model=s.army_t4_model,
    )


def _get_signal_bus(redis, supabase):
    """Create a SignalBus."""
    from app.agents.signal_bus import SignalBus
    return SignalBus(redis=redis, supabase=supabase)


# ---------------------------------------------------------------------------
# Health check task — verifies army infrastructure
# ---------------------------------------------------------------------------

@celery_app.task(name="army.command.health_check", soft_time_limit=30, time_limit=60)
def army_health_check():
    """Verify army infrastructure: tables exist, Redis streams accessible."""
    import asyncio

    async def _check():
        sb = _get_supabase()
        r = await _get_redis()

        checks = {}

        # Check Supabase tables
        for table in ["army_agents", "army_missions", "army_signals",
                       "army_routing_history", "army_tier_config", "army_division_status"]:
            try:
                result = sb.table(table).select("*", count="exact").limit(0).execute()
                checks[table] = {"ok": True, "count": result.count or 0}
            except Exception as e:
                checks[table] = {"ok": False, "error": str(e)}

        # Check Redis
        try:
            await r.ping()
            checks["redis"] = {"ok": True}
        except Exception as e:
            checks["redis"] = {"ok": False, "error": str(e)}

        await r.aclose()

        all_ok = all(c.get("ok") for c in checks.values())
        logger.info(f"[ARMY] Health check: {'PASS' if all_ok else 'FAIL'} — {checks}")
        return {"status": "healthy" if all_ok else "degraded", "checks": checks}

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_check())
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Division execution tasks
# ---------------------------------------------------------------------------

def _run_division(division: str, task_kwargs: dict | None = None):
    """Run a specific division through AEGIS. Not a Celery task itself."""
    import asyncio

    async def _run():
        sb = _get_supabase()
        r = await _get_redis()
        router = _get_tier_router(r, sb)
        bus = _get_signal_bus(r, sb)

        from app.agents.divisions.command import create_aegis
        aegis = create_aegis(redis=r, supabase=sb, tier_router=router, signal_bus=bus)

        report = await aegis.run_division(division=division, **(task_kwargs or {}))
        await router.close()
        await r.aclose()
        return report.to_dict()

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()


@celery_app.task(name="army.acquisition.hunt", soft_time_limit=1800, time_limit=3600)
def army_hunt_jobs(sources: list[str] | None = None):
    """Run Acquisition division — job hunting."""
    return _run_division("acquisition", {"sources": sources})


@celery_app.task(name="army.intelligence.enrich", soft_time_limit=1800, time_limit=3600)
def army_enrich_jobs(jobs: list[dict] | None = None):
    """Run Intelligence division — enrichment + companies house."""
    return _run_division("intelligence", {"jobs": jobs or []})


@celery_app.task(name="army.quality.validate", soft_time_limit=1800, time_limit=3600)
def army_validate_jobs(jobs: list[dict] | None = None):
    """Run Quality division — validation + completeness."""
    return _run_division("quality", {"jobs": jobs or []})


@celery_app.task(name="army.operations.maintain", soft_time_limit=1800, time_limit=3600)
def army_maintain():
    """Run Operations division — freshness + orchestrator."""
    return _run_division("operations")


@celery_app.task(name="army.research.discover", soft_time_limit=1800, time_limit=3600)
def army_discover():
    """Run Research division — discovery + improvement."""
    return _run_division("research")
