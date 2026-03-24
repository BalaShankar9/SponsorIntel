"""Tests for SignalBus — Redis Streams lateral intel."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestSignalBus:
    def _make_bus(self, redis_mock=None, supabase_mock=None):
        from app.agents.signal_bus import SignalBus
        return SignalBus(
            redis=redis_mock or AsyncMock(),
            supabase=supabase_mock or MagicMock(),
        )

    @pytest.mark.asyncio
    async def test_emit_publishes_to_redis_stream(self):
        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234-0")
        redis.publish = AsyncMock()
        sb_mock = MagicMock()
        sb_mock.table.return_value.insert.return_value.execute.return_value = None

        bus = self._make_bus(redis_mock=redis, supabase_mock=sb_mock)
        await bus.emit(
            channel="stream:new_sponsor",
            publisher_id="acq.echo.register",
            payload={"sponsor_id": "abc123"},
            severity="info",
        )

        redis.xadd.assert_called_once()
        call_args = redis.xadd.call_args
        assert call_args[0][0] == "stream:new_sponsor"

    @pytest.mark.asyncio
    async def test_emit_persists_to_supabase(self):
        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234-0")
        redis.publish = AsyncMock()
        sb_mock = MagicMock()
        sb_mock.table.return_value.insert.return_value.execute.return_value = None

        bus = self._make_bus(redis_mock=redis, supabase_mock=sb_mock)
        await bus.emit(
            channel="stream:policy_change",
            publisher_id="acq.foxtrot.gov_feeds",
            payload={"title": "New visa rule"},
            severity="high",
        )

        sb_mock.table.assert_called_with("army_signals")
        insert_call = sb_mock.table.return_value.insert.call_args[0][0]
        assert insert_call["channel"] == "stream:policy_change"
        assert insert_call["severity"] == "high"

    @pytest.mark.asyncio
    async def test_emit_publishes_warroom_notification(self):
        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234-0")
        redis.publish = AsyncMock()
        sb_mock = MagicMock()
        sb_mock.table.return_value.insert.return_value.execute.return_value = None

        bus = self._make_bus(redis_mock=redis, supabase_mock=sb_mock)
        await bus.emit(
            channel="stream:source_down",
            publisher_id="ops.romeo.health",
            payload={"source": "indeed"},
            severity="critical",
        )

        redis.publish.assert_called_once()
        pub_args = redis.publish.call_args[0]
        assert pub_args[0] == "warroom:signals"

    @pytest.mark.asyncio
    async def test_get_history(self):
        redis = AsyncMock()
        redis.xrevrange = AsyncMock(return_value=[
            ("1234-0", {b"data": json.dumps({"channel": "test", "payload": {"x": 1}}).encode()}),
            ("1233-0", {b"data": json.dumps({"channel": "test", "payload": {"x": 2}}).encode()}),
        ])

        bus = self._make_bus(redis_mock=redis)
        history = await bus.get_history("stream:test", limit=10)
        assert len(history) == 2
        assert history[0]["payload"]["x"] == 1

    @pytest.mark.asyncio
    async def test_subscribe_creates_consumer_group(self):
        redis = AsyncMock()
        redis.xgroup_create = AsyncMock()
        bus = self._make_bus(redis_mock=redis)
        await bus.subscribe("stream:test", "my_group", "consumer_1")
        redis.xgroup_create.assert_called_once_with(
            "stream:test", "my_group", id="0", mkstream=True,
        )

    @pytest.mark.asyncio
    async def test_subscribe_ignores_existing_group(self):
        redis = AsyncMock()
        redis.xgroup_create = AsyncMock(side_effect=Exception("BUSYGROUP"))
        bus = self._make_bus(redis_mock=redis)
        await bus.subscribe("stream:test", "my_group", "consumer_1")

    @pytest.mark.asyncio
    async def test_read_group(self):
        redis = AsyncMock()
        redis.xreadgroup = AsyncMock(return_value=[
            ("stream:test", [
                ("1234-0", {b"data": json.dumps({"channel": "test", "payload": {"a": 1}}).encode()}),
            ]),
        ])
        redis.xack = AsyncMock()

        bus = self._make_bus(redis_mock=redis)
        messages = await bus.read_group("stream:test", "group", "consumer", count=5)
        assert len(messages) == 1
        assert messages[0]["payload"]["a"] == 1
        redis.xack.assert_called_once()
