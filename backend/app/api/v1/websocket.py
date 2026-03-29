"""
WebSocket endpoint for real-time event feed.

Connects to Redis pub/sub channel "events" and broadcasts new events
to all connected WebSocket clients. On connect, sends the last 20
events as an initial batch.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.core.redis import redis_client
from app.models.event import Event

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

REDIS_CHANNEL = "events"
JOBS_CHANNEL = "new_jobs"


def _serialize_event(e: Event) -> dict:
    """Convert an Event ORM instance to the wire format."""
    title = ""
    description = ""
    sponsor_id = None
    sponsor_name = None

    if e.payload:
        title = e.payload.get("title", "")
        description = e.payload.get("description", "")
        sponsor_id = e.payload.get("sponsor_id")
        sponsor_name = e.payload.get("sponsor_name")

    return {
        "id": str(e.id),
        "event_type": e.event_type.value,
        "severity": e.severity.value,
        "title": title,
        "description": description,
        "sponsor_id": sponsor_id,
        "sponsor_name": sponsor_name,
        "created_at": e.created_at.isoformat(),
    }


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._pubsub_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

        # Send initial batch of last 20 events
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(Event)
                    .order_by(Event.created_at.desc())
                    .limit(20)
                )
                events = result.scalars().all()
                initial_batch = [_serialize_event(e) for e in reversed(events)]
                await websocket.send_json({
                    "type": "initial_batch",
                    "data": initial_batch,
                })
        except Exception:
            logger.exception("Failed to send initial event batch")

        # Start Redis listener if not already running
        if self._pubsub_task is None or self._pubsub_task.done():
            self._pubsub_task = asyncio.create_task(self._redis_listener())

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        """Send a JSON message to all connected clients."""
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

    async def send_personal(self, websocket: WebSocket, message: dict) -> None:
        """Send a JSON message to a specific client."""
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

    async def _redis_listener(self) -> None:
        """Subscribe to Redis pub/sub and broadcast events to WebSocket clients."""
        pubsub = redis_client.pubsub()
        try:
            await pubsub.subscribe(REDIS_CHANNEL, JOBS_CHANNEL)
            logger.info(
                "Subscribed to Redis channels: %s, %s",
                REDIS_CHANNEL, JOBS_CHANNEL,
            )
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                if not self.active_connections:
                    continue
                try:
                    event_data = json.loads(message["data"])
                    channel = message.get("channel", REDIS_CHANNEL)
                    msg_type = "new_jobs" if channel == JOBS_CHANNEL else "event"
                    await self.broadcast({
                        "type": msg_type,
                        "data": event_data,
                    })
                except (json.JSONDecodeError, TypeError):
                    logger.warning("Invalid JSON received on Redis channel")
        except asyncio.CancelledError:
            logger.info("Redis listener cancelled")
        except Exception:
            logger.exception("Redis listener error, will retry on next connect")
        finally:
            try:
                await pubsub.unsubscribe(REDIS_CHANNEL, JOBS_CHANNEL)
                await pubsub.close()
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket):
    """
    Real-time event feed.

    On connect, the client receives the last 20 events as an initial batch
    in the format: {"type": "initial_batch", "data": [...]}.

    Subsequent events are pushed as they arrive via Redis pub/sub in the
    format: {"type": "event", "data": {id, event_type, severity, title,
    description, sponsor_id, sponsor_name, created_at}}.

    Clients can send text messages (e.g., "ping") and will receive a
    {"type": "pong"} heartbeat response.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; clients can send pings or commands
            data = await websocket.receive_text()
            # Echo back as heartbeat acknowledgment
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
