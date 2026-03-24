"""Tests for TierRouter — 5-tier LLM routing with fallbacks and caching."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.army_types import TierResult


class TestTierRouter:
    def _make_router(self, redis_mock=None, supabase_mock=None):
        from app.agents.tier_router import TierRouter
        return TierRouter(
            redis=redis_mock or AsyncMock(),
            supabase=supabase_mock or MagicMock(),
            groq_api_key="test-groq-key",
            nvidia_nim_api_key="test-nvidia-key",
            anthropic_api_key="test-anthropic-key",
            openrouter_api_key="test-openrouter-key",
        )

    def test_t0_salary_parse(self):
        """T0 should handle salary parsing without any LLM call."""
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("salary_parse", "£45,000 - £55,000 per annum", {})
        assert result is not None
        assert "45000" in result or "45,000" in result

    def test_t0_url_validate(self):
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("url_validate", "https://example.com/jobs", {})
        assert result is not None
        assert "valid" in result.lower()

    def test_t0_dedup_hash(self):
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("dedup_hash", "Software Engineer at Acme Corp London", {})
        assert result is not None
        assert len(result) > 0

    def test_t0_returns_none_for_complex_task(self):
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("deep_analysis", "Analyze this policy document...", {})
        assert result is None

    @pytest.mark.asyncio
    async def test_route_uses_cache(self):
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=json.dumps({
            "content": "cached result",
            "tier_used": 2,
            "provider": "cache",
            "model": "",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
            "latency_ms": 1,
            "from_cache": True,
        }).encode())

        router = self._make_router(redis_mock=redis)
        result = await router.route(
            prompt="test prompt",
            task_type="job_enrichment",
            agent_id="test",
            cache_key="test:cache:123",
        )

        assert result.from_cache is True
        assert result.cost_usd == 0.0

    @pytest.mark.asyncio
    async def test_route_t0_task(self):
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)

        router = self._make_router(redis_mock=redis)
        result = await router.route(
            prompt="£30,000 - £40,000",
            task_type="salary_parse",
            agent_id="int.hotel.salary_parser",
        )

        assert result.tier_used == 0
        assert result.cost_usd == 0.0
        assert result.provider == "t0_rules"

    def test_tier_for_task_type(self):
        router = self._make_router()
        assert router._get_default_tier("salary_parse") == 0
        assert router._get_default_tier("spam_check") == 1
        assert router._get_default_tier("job_enrichment") == 2
        assert router._get_default_tier("deep_analysis") == 3
        assert router._get_default_tier("legal_document") == 4
        assert router._get_default_tier("unknown_task") == 2

    def test_fallback_chain(self):
        from app.agents.tier_router import FALLBACK_CHAINS
        assert FALLBACK_CHAINS[4] == ["anthropic", "openrouter", "nvidia_nim"]
        assert FALLBACK_CHAINS[3] == ["nvidia_nim", "openrouter", "groq"]
        assert FALLBACK_CHAINS[2] == ["groq", "nvidia_nim", "openrouter"]
        assert FALLBACK_CHAINS[1] == ["groq", "groq_t2"]

    @pytest.mark.asyncio
    async def test_provider_fallback_on_failure(self):
        """When first provider fails, router tries next in chain."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        router = self._make_router(redis_mock=redis, supabase_mock=sb)

        call_count = 0

        async def mock_call(provider, tier, prompt, system, temp, max_tok):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Provider down")
            return TierResult(
                content="fallback result", tier_used=tier, provider=provider,
                model="test", tokens_in=10, tokens_out=5,
                cost_usd=0.001, latency_ms=200, from_cache=False,
            )

        router._call_provider = mock_call
        result = await router.route(
            prompt="test", task_type="job_enrichment", agent_id="test",
        )
        assert call_count == 2
        assert result.content == "fallback result"

    def test_complexity_classification(self):
        """Complexity classifier returns 0-1 score."""
        router = self._make_router()
        score = router._classify_complexity("hello", {})
        assert 0.0 <= score <= 1.0
        long_prompt = "Analyze this: " + "word " * 500
        score_long = router._classify_complexity(long_prompt, {})
        assert score_long > score
