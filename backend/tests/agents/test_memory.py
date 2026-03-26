"""Tests for 5-tier agent memory system."""

import pytest
from unittest.mock import AsyncMock, MagicMock
import json


class TestAgentMemory:
    @pytest.mark.asyncio
    async def test_set_and_get_working_memory(self):
        from app.agents.memory import AgentMemory

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.get = AsyncMock(return_value=json.dumps({"sector": "fintech"}).encode())

        mem = AgentMemory(agent_id="test.agent", redis=redis)
        await mem.set_working("context", {"sector": "fintech"})
        redis.set.assert_called_once()

        result = await mem.get_working("context")
        assert result == {"sector": "fintech"}

    @pytest.mark.asyncio
    async def test_store_persistent_memory(self):
        from app.agents.memory import AgentMemory

        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = None

        mem = AgentMemory(agent_id="test.agent", supabase=sb)
        await mem.store("L3", "fintech_pattern", {"insight": "A-rated fintech sponsors 80% likely"}, confidence=0.9)

        sb.table.assert_called_with("agent_memory")

    @pytest.mark.asyncio
    async def test_recall_memory(self):
        from app.agents.memory import AgentMemory

        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "1", "memory_value": {"insight": "test"}, "access_count": 5}]
        )
        sb.table.return_value.update.return_value.eq.return_value.execute.return_value = None

        mem = AgentMemory(agent_id="test.agent", supabase=sb)
        result = await mem.recall("L3", "pattern_key")

        assert result == {"insight": "test"}

    @pytest.mark.asyncio
    async def test_share_federated_memory(self):
        from app.agents.memory import AgentMemory

        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")

        mem = AgentMemory(agent_id="test.agent", redis=redis)
        await mem.share("new_sponsor", {"company": "TestCorp"})

        redis.xadd.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_redis_returns_none(self):
        from app.agents.memory import AgentMemory
        mem = AgentMemory(agent_id="test.agent")
        result = await mem.get_working("key")
        assert result is None

    @pytest.mark.asyncio
    async def test_no_supabase_returns_none(self):
        from app.agents.memory import AgentMemory
        mem = AgentMemory(agent_id="test.agent")
        result = await mem.recall("L3", "key")
        assert result is None
