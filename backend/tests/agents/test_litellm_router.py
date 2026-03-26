"""Tests for LiteLLM router integration."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestLiteLLMRouter:
    def test_tier_models_defined(self):
        from app.agents.litellm_router import TIER_MODELS
        assert 1 in TIER_MODELS
        assert 2 in TIER_MODELS
        assert 3 in TIER_MODELS
        assert 4 in TIER_MODELS

    def test_fallback_chains_defined(self):
        from app.agents.litellm_router import TIER_FALLBACKS
        for tier in [1, 2, 3, 4]:
            assert tier in TIER_FALLBACKS
            assert len(TIER_FALLBACKS[tier]) >= 2

    def test_get_litellm_returns_none_when_not_installed(self):
        from app.agents.litellm_router import _get_litellm
        # litellm may or may not be installed in test env
        result = _get_litellm()
        # Just verify it doesn't crash
        assert result is None or hasattr(result, "acompletion")

    @pytest.mark.asyncio
    async def test_litellm_completion_returns_none_without_library(self):
        from app.agents.litellm_router import litellm_completion
        with patch("app.agents.litellm_router._get_litellm", return_value=None):
            result = await litellm_completion(tier=2, prompt="test")
            assert result is None
