"""Army framework initialization.

Provides create_army_infra() to set up TierRouter, SignalBus, and Redis
for use by army agents. Called once per Celery worker or API server.
"""

import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_infra = None


class ArmyInfra:
    """Container for shared army infrastructure."""
    def __init__(self, redis, supabase, tier_router, signal_bus):
        self.redis = redis
        self.supabase = supabase
        self.tier_router = tier_router
        self.signal_bus = signal_bus


async def create_army_infra() -> ArmyInfra:
    """Create and return shared army infrastructure.

    Call once per process. Returns an ArmyInfra with:
    - redis: async Redis client
    - supabase: service role client
    - tier_router: TierRouter with connection pools
    - signal_bus: SignalBus with Redis + Supabase
    """
    global _infra
    if _infra:
        return _infra

    import redis.asyncio as aioredis
    from supabase import create_client
    from app.agents.tier_router import TierRouter
    from app.agents.signal_bus import SignalBus

    s = get_settings()

    r = aioredis.from_url(s.redis_url, decode_responses=False)
    sb = create_client(s.supabase_url, s.supabase_service_key)

    router = TierRouter(
        redis=r,
        supabase=sb,
        groq_api_key=s.groq_api_key,
        nvidia_nim_api_key=s.nvidia_nim_api_key,
        anthropic_api_key=s.anthropic_api_key or "",
        openrouter_api_key=s.openrouter_api_key,
        t1_model=s.army_t1_model,
        t2_model=s.army_t2_model,
        t3_model=s.army_t3_model,
        t4_model=s.army_t4_model,
    )

    # Load tier config from Supabase
    await router.load_tier_config()

    bus = SignalBus(redis=r, supabase=sb)

    _infra = ArmyInfra(
        redis=r, supabase=sb, tier_router=router, signal_bus=bus,
    )
    logger.info("[ARMY] Infrastructure initialized: TierRouter, SignalBus, Redis")
    return _infra


async def shutdown_army_infra():
    """Clean up army infrastructure. Call on worker/server shutdown."""
    global _infra
    if _infra:
        await _infra.tier_router.close()
        await _infra.redis.aclose()
        _infra = None
        logger.info("[ARMY] Infrastructure shut down")
