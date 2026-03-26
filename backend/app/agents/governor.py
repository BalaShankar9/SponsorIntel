"""SafetyGovernor — centralized rate limiter for all agent external requests.

Every agent must call governor.approve() before making external API calls.
Uses Redis token bucket for per-domain rate limiting.
"""

import json
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Default rate limits per domain (requests per minute)
DEFAULT_LIMITS = {
    "api.company-information.service.gov.uk": 100,  # CH: 600/5min = 120/min, use 100 for safety
    "api.groq.com": 30,
    "integrate.api.nvidia.com": 10,
    "api.anthropic.com": 5,
    "openrouter.ai": 10,
    "api.reed.co.uk": 20,
    "api.adzuna.com": 10,
    "hansard.parliament.uk": 5,
    "_global": 200,  # Global across all domains
}


class SafetyGovernor:
    """Centralized rate limiter and budget enforcer."""

    def __init__(self, redis=None, supabase=None, daily_budget_usd: float = 10.0):
        self.redis = redis
        self.supabase = supabase
        self.daily_budget_usd = daily_budget_usd
        self.limits = dict(DEFAULT_LIMITS)

    async def approve(self, domain: str, agent_id: str = "", cost_estimate: float = 0.0) -> str:
        """Check if a request to the given domain is allowed.

        Returns: 'approved', 'rate_limited', or 'budget_exceeded'
        """
        if not self.redis:
            return "approved"

        # Check per-domain rate limit
        domain_key = f"army:governor:rate:{domain}"
        try:
            current = await self.redis.incr(domain_key)
            if current == 1:
                await self.redis.expire(domain_key, 60)  # 1-minute window

            limit = self.limits.get(domain, 50)
            if current > limit:
                await self._log_action(agent_id, domain, "rate_limited", cost_estimate)
                return "rate_limited"
        except Exception as e:
            logger.debug(f"Governor rate check failed: {e}")

        # Check global rate limit
        global_key = "army:governor:rate:_global"
        try:
            current = await self.redis.incr(global_key)
            if current == 1:
                await self.redis.expire(global_key, 60)
            if current > self.limits.get("_global", 200):
                await self._log_action(agent_id, domain, "rate_limited", cost_estimate)
                return "rate_limited"
        except Exception as e:
            logger.debug(f"Governor global check failed: {e}")

        # Check daily budget
        if cost_estimate > 0:
            budget_key = f"army:governor:budget:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
            try:
                spent_raw = await self.redis.get(budget_key)
                spent = float(spent_raw) if spent_raw else 0.0
                if spent + cost_estimate > self.daily_budget_usd:
                    await self._log_action(agent_id, domain, "budget_exceeded", cost_estimate)
                    return "budget_exceeded"
                await self.redis.incrbyfloat(budget_key, cost_estimate)
                await self.redis.expire(budget_key, 86400)
            except Exception as e:
                logger.debug(f"Governor budget check failed: {e}")

        await self._log_action(agent_id, domain, "approved", cost_estimate)
        return "approved"

    async def get_domain_usage(self, domain: str) -> int:
        """Get current request count for a domain in this minute."""
        if not self.redis:
            return 0
        try:
            count = await self.redis.get(f"army:governor:rate:{domain}")
            return int(count) if count else 0
        except Exception:
            return 0

    async def get_daily_spend(self) -> float:
        """Get total LLM spend today."""
        if not self.redis:
            return 0.0
        try:
            key = f"army:governor:budget:{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
            raw = await self.redis.get(key)
            return float(raw) if raw else 0.0
        except Exception:
            return 0.0

    async def _log_action(self, agent_id: str, domain: str, action: str, cost_estimate: float):
        """Log governor decision to Supabase (async, non-blocking)."""
        if not self.supabase:
            return
        try:
            self.supabase.table("governor_audit_log").insert({
                "agent_id": agent_id,
                "domain": domain,
                "action": action,
                "cost_estimate": cost_estimate,
            }).execute()
        except Exception as e:
            logger.debug(f"Governor audit log failed: {e}")
