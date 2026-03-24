"""SignalBus — Redis Streams lateral intel for cross-division communication.

Agents emit signals to named channels (e.g., stream:new_sponsor).
Signals are published to Redis Streams for real-time consumption
and persisted to the army_signals Supabase table for history.
"""

import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

STREAM_MAXLEN = 10_000
WARROOM_MAXLEN = 1_000


class SignalBus:
    def __init__(self, redis, supabase=None):
        self.redis = redis
        self.supabase = supabase

    async def emit(
        self,
        channel: str,
        publisher_id: str,
        payload: dict,
        severity: str = "info",
    ) -> str | None:
        """Publish signal to Redis Stream + persist to army_signals."""
        message = {
            "channel": channel,
            "publisher_id": publisher_id,
            "payload": payload,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        serialized = json.dumps(message)

        stream_id = None
        try:
            stream_id = await self.redis.xadd(
                channel,
                {"data": serialized},
                maxlen=STREAM_MAXLEN,
            )
            await self.redis.publish("warroom:signals", serialized)
        except Exception as e:
            logger.error(f"SignalBus Redis emit failed: {e}")

        if self.supabase:
            try:
                self.supabase.table("army_signals").insert({
                    "channel": channel,
                    "publisher_agent_id": publisher_id,
                    "payload": payload,
                    "severity": severity,
                }).execute()
            except Exception as e:
                logger.error(f"SignalBus Supabase persist failed: {e}")

        return stream_id

    async def get_history(
        self,
        channel: str,
        limit: int = 100,
    ) -> list[dict]:
        """Read recent signals from a Redis Stream channel."""
        try:
            entries = await self.redis.xrevrange(channel, count=limit)
            results = []
            for _msg_id, fields in entries:
                raw = fields.get(b"data") or fields.get("data")
                if raw:
                    if isinstance(raw, bytes):
                        raw = raw.decode()
                    results.append(json.loads(raw))
            return results
        except Exception as e:
            logger.error(f"SignalBus get_history failed: {e}")
            return []

    async def subscribe(
        self,
        channel: str,
        consumer_group: str,
        consumer_name: str,
    ):
        """Create a consumer group for a Redis Stream."""
        try:
            await self.redis.xgroup_create(
                channel, consumer_group, id="0", mkstream=True,
            )
        except Exception:
            pass

    async def read_group(
        self,
        channel: str,
        consumer_group: str,
        consumer_name: str,
        count: int = 10,
        block_ms: int = 0,
    ) -> list[dict]:
        """Read new messages from a consumer group."""
        try:
            results = await self.redis.xreadgroup(
                consumer_group,
                consumer_name,
                {channel: ">"},
                count=count,
                block=block_ms,
            )
            messages = []
            for _stream, entries in (results or []):
                for msg_id, fields in entries:
                    raw = fields.get(b"data") or fields.get("data")
                    if raw:
                        if isinstance(raw, bytes):
                            raw = raw.decode()
                        messages.append(json.loads(raw))
                    await self.redis.xack(channel, consumer_group, msg_id)
            return messages
        except Exception as e:
            logger.error(f"SignalBus read_group failed: {e}")
            return []
