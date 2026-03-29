"""
Circuit breaker for agent self-healing.

Tracks consecutive failures per source in Redis. After MAX_FAILURES,
the source is paused automatically. A health probe runs periodically
and auto-resumes sources that start working again.

This is the backbone of the autonomous system — agents heal themselves.
"""

import json
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Config
MAX_FAILURES = 3          # Consecutive failures before pause
PAUSE_DURATION_SECS = 1800  # 30 min cooldown before auto-probe
HEALTH_CHECK_KEY = "circuit_breaker:{source}"
PAUSED_SOURCES_KEY = "circuit_breaker:paused"


def _get_redis():
    """Get Redis client."""
    import redis
    from app.core.config import get_settings
    settings = get_settings()
    return redis.from_url(settings.redis_url, decode_responses=True)


def record_success(source: str):
    """Record a successful scrape — resets failure counter."""
    try:
        r = _get_redis()
        key = HEALTH_CHECK_KEY.format(source=source)
        r.hset(key, mapping={
            "consecutive_failures": 0,
            "last_success": datetime.now(timezone.utc).isoformat(),
            "status": "healthy",
        })
        # Remove from paused set if it was there
        r.srem(PAUSED_SOURCES_KEY, source)
    except Exception as e:
        logger.warning(f"[CIRCUIT_BREAKER] Failed to record success for {source}: {e}")


def record_failure(source: str, error: str = ""):
    """Record a failure. If MAX_FAILURES reached, pause the source."""
    try:
        r = _get_redis()
        key = HEALTH_CHECK_KEY.format(source=source)

        # Increment failure count
        failures = r.hincrby(key, "consecutive_failures", 1)
        r.hset(key, mapping={
            "last_failure": datetime.now(timezone.utc).isoformat(),
            "last_error": error[:500],
        })

        if failures >= MAX_FAILURES:
            r.hset(key, mapping={
                "status": "paused",
                "paused_at": datetime.now(timezone.utc).isoformat(),
            })
            r.sadd(PAUSED_SOURCES_KEY, source)
            logger.warning(
                f"[CIRCUIT_BREAKER] Source '{source}' PAUSED after {failures} consecutive failures. "
                f"Last error: {error[:200]}"
            )
            return True  # Source was paused

        return False  # Source still active

    except Exception as e:
        logger.warning(f"[CIRCUIT_BREAKER] Failed to record failure for {source}: {e}")
        return False


def is_paused(source: str) -> bool:
    """Check if a source is currently paused by the circuit breaker."""
    try:
        r = _get_redis()
        return r.sismember(PAUSED_SOURCES_KEY, source)
    except Exception:
        return False  # Fail open — don't block scraping if Redis is down


def get_paused_sources() -> list[str]:
    """Get all currently paused sources."""
    try:
        r = _get_redis()
        return list(r.smembers(PAUSED_SOURCES_KEY))
    except Exception:
        return []


def get_source_health(source: str) -> dict:
    """Get health status for a specific source."""
    try:
        r = _get_redis()
        key = HEALTH_CHECK_KEY.format(source=source)
        data = r.hgetall(key)
        return data or {"status": "unknown"}
    except Exception:
        return {"status": "unknown"}


def get_all_health() -> dict[str, dict]:
    """Get health status for all tracked sources."""
    try:
        r = _get_redis()
        keys = r.keys("circuit_breaker:*")
        health = {}
        for key in keys:
            if key == PAUSED_SOURCES_KEY:
                continue
            source = key.split(":")[-1]
            health[source] = r.hgetall(key)
        return health
    except Exception:
        return {}


def force_resume(source: str):
    """Manually resume a paused source (admin action)."""
    try:
        r = _get_redis()
        key = HEALTH_CHECK_KEY.format(source=source)
        r.hset(key, mapping={
            "consecutive_failures": 0,
            "status": "healthy",
            "resumed_at": datetime.now(timezone.utc).isoformat(),
        })
        r.srem(PAUSED_SOURCES_KEY, source)
        logger.info(f"[CIRCUIT_BREAKER] Source '{source}' manually resumed")
    except Exception as e:
        logger.error(f"[CIRCUIT_BREAKER] Failed to resume {source}: {e}")


def auto_probe_paused_sources() -> dict:
    """
    Check paused sources and auto-resume those past cooldown.
    Called by the orchestrator agent on schedule.
    """
    results = {"probed": 0, "resumed": 0, "still_paused": 0}
    try:
        r = _get_redis()
        paused = r.smembers(PAUSED_SOURCES_KEY)
        now = time.time()

        for source in paused:
            results["probed"] += 1
            key = HEALTH_CHECK_KEY.format(source=source)
            data = r.hgetall(key)
            paused_at = data.get("paused_at", "")

            if paused_at:
                paused_time = datetime.fromisoformat(paused_at).timestamp()
                if now - paused_time >= PAUSE_DURATION_SECS:
                    # Cooldown passed — resume and let next scrape test it
                    r.hset(key, mapping={
                        "consecutive_failures": 0,
                        "status": "probing",
                        "probe_at": datetime.now(timezone.utc).isoformat(),
                    })
                    r.srem(PAUSED_SOURCES_KEY, source)
                    results["resumed"] += 1
                    logger.info(f"[CIRCUIT_BREAKER] Auto-resumed '{source}' after cooldown")
                else:
                    results["still_paused"] += 1
            else:
                # No timestamp — resume it
                force_resume(source)
                results["resumed"] += 1

    except Exception as e:
        logger.error(f"[CIRCUIT_BREAKER] Auto-probe failed: {e}")

    return results
