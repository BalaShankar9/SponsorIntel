"""Tests for SafetyGovernor rate limiter."""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestSafetyGovernor:
    @pytest.mark.asyncio
    async def test_approve_with_no_redis(self):
        from app.agents.governor import SafetyGovernor
        gov = SafetyGovernor()
        result = await gov.approve("api.groq.com", "test.agent")
        assert result == "approved"

    @pytest.mark.asyncio
    async def test_approve_under_limit(self):
        from app.agents.governor import SafetyGovernor
        redis = AsyncMock()
        redis.incr = AsyncMock(return_value=1)
        redis.expire = AsyncMock()
        redis.get = AsyncMock(return_value=None)

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        gov = SafetyGovernor(redis=redis, supabase=sb)
        result = await gov.approve("api.groq.com", "test.agent")
        assert result == "approved"

    @pytest.mark.asyncio
    async def test_rate_limited_over_domain_limit(self):
        from app.agents.governor import SafetyGovernor
        redis = AsyncMock()
        redis.incr = AsyncMock(return_value=999)
        redis.expire = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        gov = SafetyGovernor(redis=redis, supabase=sb)
        result = await gov.approve("api.groq.com", "test.agent")
        assert result == "rate_limited"

    @pytest.mark.asyncio
    async def test_budget_exceeded(self):
        from app.agents.governor import SafetyGovernor
        redis = AsyncMock()
        redis.incr = AsyncMock(return_value=1)
        redis.expire = AsyncMock()
        redis.get = AsyncMock(return_value=b"9.99")
        redis.incrbyfloat = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        gov = SafetyGovernor(redis=redis, supabase=sb, daily_budget_usd=10.0)
        result = await gov.approve("api.groq.com", "test.agent", cost_estimate=0.05)
        assert result == "budget_exceeded"

    @pytest.mark.asyncio
    async def test_get_daily_spend(self):
        from app.agents.governor import SafetyGovernor
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=b"3.45")
        gov = SafetyGovernor(redis=redis)
        spend = await gov.get_daily_spend()
        assert spend == 3.45
