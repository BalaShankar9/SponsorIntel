"""Tests for signal broadcaster."""

import pytest


class TestFormatSignal:
    def test_formats_sponsor_signal(self):
        from app.services.signal_broadcaster import format_signal_for_client
        signal = {"channel": "stream:sponsor:new", "payload": {"name": "TestCorp"}, "severity": "info"}
        result = format_signal_for_client(signal)
        assert result is not None
        assert result["type"] == "sponsor:new"

    def test_ignores_unknown_signal(self):
        from app.services.signal_broadcaster import format_signal_for_client
        signal = {"channel": "stream:internal_debug", "payload": {}}
        result = format_signal_for_client(signal)
        assert result is None

    def test_formats_intel_critical(self):
        from app.services.signal_broadcaster import format_signal_for_client
        signal = {"channel": "stream:intel:critical", "payload": {"title": "Threshold Change"}, "severity": "critical"}
        result = format_signal_for_client(signal)
        assert result is not None
        assert result["severity"] == "critical"


class TestSignalBroadcaster:
    def test_connect_disconnect(self):
        from app.services.signal_broadcaster import SignalBroadcaster
        b = SignalBroadcaster()
        ws = "fake_ws"
        b.connect(ws)
        assert b.connection_count == 1
        b.disconnect(ws)
        assert b.connection_count == 0

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_connections(self):
        from app.services.signal_broadcaster import SignalBroadcaster
        from unittest.mock import AsyncMock

        b = SignalBroadcaster()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        b.connect(ws1)
        b.connect(ws2)

        signal = {"channel": "stream:sponsor:new", "payload": {"name": "Test"}, "severity": "info"}
        await b.broadcast(signal)

        ws1.send_text.assert_called_once()
        ws2.send_text.assert_called_once()
