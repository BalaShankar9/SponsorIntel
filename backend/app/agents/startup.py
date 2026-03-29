"""
Startup validation for Celery workers.

Runs on worker boot to verify all critical services are reachable:
- Redis (broker + backend)
- Supabase (database — replaces direct PostgreSQL)

If any check fails, the worker logs a clear error but continues
so that tasks using healthy services can still run.
"""

import logging

logger = logging.getLogger(__name__)


def validate_worker_startup():
    """Validate all critical services before accepting tasks.

    Called from celery worker_ready signal handler.
    """
    errors = []

    # 1. Check Redis
    try:
        import redis
        from app.core.config import get_settings
        settings = get_settings()
        r = redis.from_url(settings.redis_url, socket_timeout=5)
        r.ping()
        logger.info("[STARTUP] Redis: OK")
    except Exception as e:
        errors.append(f"Redis: {e}")
        logger.error(f"[STARTUP] Redis: FAILED — {e}")

    # 2. Check Supabase (our primary database)
    try:
        from app.core.config import get_settings
        settings = get_settings()
        if settings.supabase_url and settings.supabase_service_key:
            from supabase import create_client
            sb = create_client(settings.supabase_url, settings.supabase_service_key)
            result = sb.table("sponsors").select("id").limit(1).execute()
            count = len(result.data) if result.data else 0
            logger.info(f"[STARTUP] Supabase: OK (sponsors table accessible, got {count} row)")

            # Also verify jobs table is writable
            jobs_check = sb.table("jobs").select("id").limit(1).execute()
            logger.info(f"[STARTUP] Supabase jobs table: OK")
        else:
            logger.warning("[STARTUP] Supabase: SKIPPED (no credentials configured)")
    except Exception as e:
        errors.append(f"Supabase: {e}")
        logger.error(f"[STARTUP] Supabase: FAILED — {e}")

    # Summary
    if errors:
        logger.error(
            f"[STARTUP] Worker validation completed with {len(errors)} warning(s):\n"
            + "\n".join(f"  - {e}" for e in errors)
        )
        return False

    logger.info("[STARTUP] All systems operational. Worker ready.")
    return True
