"""Tests for the enhanced agent registry with division/squad metadata."""

import pytest
from app.agents.registry import (
    register_agent, get_agent, list_agents,
    get_agents_by_division, get_agent_metadata, _AGENTS, _AGENT_META,
)


class FakeAgent:
    pass


class TestEnhancedRegistry:
    def setup_method(self):
        _AGENTS.clear()
        _AGENT_META.clear()

    def test_register_legacy_agent(self):
        """Existing pattern: @register_agent('name') with no metadata."""
        @register_agent("hunter")
        class HunterAgent:
            pass
        assert get_agent("hunter") is HunterAgent
        assert "hunter" in list_agents()

    def test_register_army_agent(self):
        """New pattern: @register_agent with division/squad/role."""
        @register_agent(
            "acq.alpha.remotive",
            division="acquisition",
            squad="alpha",
            role="operator",
        )
        class RemotiveAgent:
            pass
        assert get_agent("acq.alpha.remotive") is RemotiveAgent
        meta = get_agent_metadata("acq.alpha.remotive")
        assert meta["division"] == "acquisition"
        assert meta["squad"] == "alpha"
        assert meta["role"] == "operator"

    def test_get_agents_by_division(self):
        @register_agent("acq.alpha.a", division="acquisition", squad="alpha", role="operator")
        class A:
            pass
        @register_agent("acq.alpha.b", division="acquisition", squad="alpha", role="operator")
        class B:
            pass
        @register_agent("int.hotel.c", division="intelligence", squad="hotel", role="operator")
        class C:
            pass

        acq = get_agents_by_division("acquisition")
        assert len(acq) == 2
        intel = get_agents_by_division("intelligence")
        assert len(intel) == 1
        assert get_agents_by_division("quality") == []

    def test_legacy_agent_has_no_metadata(self):
        @register_agent("old_agent")
        class OldAgent:
            pass
        meta = get_agent_metadata("old_agent")
        assert meta == {}

    def test_list_agents_includes_all(self):
        @register_agent("legacy")
        class L:
            pass
        @register_agent("acq.echo.reg", division="acquisition", squad="echo", role="operator")
        class N:
            pass
        agents = list_agents()
        assert "legacy" in agents
        assert "acq.echo.reg" in agents
