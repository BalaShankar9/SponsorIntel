"""Real-time signal broadcaster for WebSocket clients.

Subscribes to Redis warroom:signals pub/sub and broadcasts
to connected WebSocket clients.
"""

import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Signal types that are broadcast to frontend clients
BROADCAST_SIGNAL_TYPES = {
    "sponsor:new": "New sponsor detected",
    "sponsor:removed": "Sponsor removed from register",
    "sponsor:rating_change": "Sponsor rating changed",
    "job:new_batch": "New jobs discovered",
    "intel:critical": "Critical immigration policy change",
    "intel:high": "Important immigration update",
    "agent:mission_complete": "Agent completed mission",
    "enrichment:complete": "Company enrichment completed",
}


def format_signal_for_client(signal: dict) -> dict | None:
    """Format a raw signal for WebSocket broadcast.

    Returns None if the signal should not be broadcast.
    """
    channel = signal.get("channel", "")

    # Determine signal type from channel
    signal_type = None
    for prefix, description in BROADCAST_SIGNAL_TYPES.items():
        if prefix in channel:
            signal_type = prefix
            break

    if not signal_type:
        return None

    return {
        "type": signal_type,
        "description": BROADCAST_SIGNAL_TYPES.get(signal_type, ""),
        "payload": signal.get("payload", {}),
        "severity": signal.get("severity", "info"),
        "timestamp": signal.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "publisher": signal.get("publisher_id", ""),
    }


class SignalBroadcaster:
    """Manages WebSocket connections and broadcasts signals."""

    def __init__(self):
        self._connections: list = []

    def connect(self, websocket):
        """Register a new WebSocket connection."""
        self._connections.append(websocket)
        logger.info(f"[WS] Client connected. Total: {len(self._connections)}")

    def disconnect(self, websocket):
        """Remove a WebSocket connection."""
        if websocket in self._connections:
            self._connections.remove(websocket)
        logger.info(f"[WS] Client disconnected. Total: {len(self._connections)}")

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def broadcast(self, signal: dict):
        """Broadcast a signal to all connected clients."""
        formatted = format_signal_for_client(signal)
        if not formatted:
            return

        message = json.dumps(formatted)
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        # Clean up dead connections
        for ws in dead:
            self.disconnect(ws)


# Global broadcaster instance
broadcaster = SignalBroadcaster()
