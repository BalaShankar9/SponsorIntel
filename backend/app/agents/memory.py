"""5-tier agent memory hierarchy.

L1: Working Memory (Redis, 1hr TTL) — current scan batch state
L2: Episodic Memory (Supabase, 90d) — per-company enrichment episodes
L3: Semantic Memory (Supabase, permanent) — learned patterns
L4: Procedural Memory (Supabase, permanent) — effective strategies
L5: Federated Memory (Redis Streams, 7d) — cross-division intel
"""

import json
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class AgentMemory:
    """Memory system for army agents."""

    def __init__(self, agent_id: str, redis=None, supabase=None):
        self.agent_id = agent_id
        self.redis = redis
        self.supabase = supabase

    # --- L1: Working Memory (Redis) ---

    async def set_working(self, key: str, value: dict, ttl: int = 3600):
        """Store in L1 working memory (Redis, default 1hr TTL)."""
        if not self.redis:
            return
        cache_key = f"army:mem:L1:{self.agent_id}:{key}"
        await self.redis.set(cache_key, json.dumps(value), ex=ttl)

    async def get_working(self, key: str) -> dict | None:
        """Retrieve from L1 working memory."""
        if not self.redis:
            return None
        cache_key = f"army:mem:L1:{self.agent_id}:{key}"
        raw = await self.redis.get(cache_key)
        if raw:
            return json.loads(raw if isinstance(raw, str) else raw.decode())
        return None

    # --- L2-L4: Persistent Memory (Supabase) ---

    async def store(self, tier: str, key: str, value: dict, confidence: float = 1.0, ttl_days: int | None = None):
        """Store a memory in L2/L3/L4."""
        if not self.supabase:
            return
        expires_at = None
        if ttl_days:
            expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()

        decay_rates = {"L2": 0.05, "L3": 0.001, "L4": 0.001, "L5": 0.1}

        try:
            self.supabase.table("agent_memory").upsert({
                "agent_id": self.agent_id,
                "memory_tier": tier,
                "memory_key": key,
                "memory_value": value,
                "confidence": confidence,
                "decay_rate": decay_rates.get(tier, 0.05),
                "expires_at": expires_at,
                "last_accessed_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="agent_id,memory_tier,memory_key").execute()
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Memory store failed: {e}")

    async def recall(self, tier: str, key: str) -> dict | None:
        """Recall a memory from L2/L3/L4. Updates access count."""
        if not self.supabase:
            return None
        try:
            result = self.supabase.table("agent_memory").select("*").eq(
                "agent_id", self.agent_id
            ).eq("memory_tier", tier).eq("memory_key", key).limit(1).execute()

            if not result.data:
                return None

            row = result.data[0]

            # Update access tracking
            self.supabase.table("agent_memory").update({
                "access_count": row["access_count"] + 1,
                "last_accessed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", row["id"]).execute()

            return row["memory_value"]
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Memory recall failed: {e}")
            return None

    async def recall_all(self, tier: str, limit: int = 50) -> list[dict]:
        """Recall all memories for a tier, ordered by confidence."""
        if not self.supabase:
            return []
        try:
            result = self.supabase.table("agent_memory").select("*").eq(
                "agent_id", self.agent_id
            ).eq("memory_tier", tier).order(
                "confidence", desc=True
            ).limit(limit).execute()
            return result.data or []
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Memory recall_all failed: {e}")
            return []

    # --- L5: Federated Memory (Redis Streams) ---

    async def share(self, channel: str, value: dict):
        """Share intel via L5 federated memory (Redis Stream)."""
        if not self.redis:
            return
        try:
            data = json.dumps({"agent_id": self.agent_id, "payload": value,
                               "timestamp": datetime.now(timezone.utc).isoformat()})
            await self.redis.xadd(f"army:mem:L5:{channel}", {"data": data}, maxlen=1000)
        except Exception as e:
            logger.debug(f"[{self.agent_id}] L5 share failed: {e}")

    # --- Decay ---

    async def decay_memories(self):
        """Apply decay to all memories. Called periodically."""
        if not self.supabase:
            return 0
        try:
            # Fetch memories with confidence > 0
            result = self.supabase.table("agent_memory").select(
                "id, confidence, decay_rate"
            ).eq("agent_id", self.agent_id).gt("confidence", 0).execute()

            decayed = 0
            for row in (result.data or []):
                new_conf = max(0, row["confidence"] - row["decay_rate"])
                if new_conf != row["confidence"]:
                    self.supabase.table("agent_memory").update(
                        {"confidence": new_conf}
                    ).eq("id", row["id"]).execute()
                    decayed += 1
            return decayed
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Decay failed: {e}")
            return 0
