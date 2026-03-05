"""
Token-bucket rate limiter for scraping.

Limits requests per minute per domain using asyncio primitives.
Thread-safe and async-compatible.
"""

import asyncio
import time
from collections import defaultdict
from typing import Dict


class RateLimiter:
    """
    Token-bucket rate limiter.

    Tracks timestamps of recent requests and blocks (via async sleep)
    when the rate limit for a given domain is exceeded.
    """

    def __init__(self, requests_per_minute: int = 10):
        self.requests_per_minute = requests_per_minute
        self._window = 60.0  # 1 minute window
        self._timestamps: list[float] = []
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """
        Acquire permission to make a request.

        Blocks (async sleep) if the rate limit has been reached,
        waiting until the oldest request in the window expires.
        """
        async with self._lock:
            now = time.monotonic()

            # Purge timestamps outside the window
            self._timestamps = [
                ts for ts in self._timestamps
                if now - ts < self._window
            ]

            if len(self._timestamps) >= self.requests_per_minute:
                # Wait until the oldest timestamp expires
                oldest = self._timestamps[0]
                wait_time = self._window - (now - oldest) + 0.1
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
                # Purge again after sleeping
                now = time.monotonic()
                self._timestamps = [
                    ts for ts in self._timestamps
                    if now - ts < self._window
                ]

            self._timestamps.append(time.monotonic())


class DomainRateLimiter:
    """
    Manages per-domain rate limiters.

    Each domain gets its own RateLimiter instance with a configurable rate.
    """

    def __init__(self, default_rpm: int = 10):
        self._default_rpm = default_rpm
        self._limiters: Dict[str, RateLimiter] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, domain: str, rpm: int | None = None) -> None:
        """Acquire rate limit token for a specific domain."""
        async with self._lock:
            if domain not in self._limiters:
                self._limiters[domain] = RateLimiter(
                    requests_per_minute=rpm or self._default_rpm
                )

        await self._limiters[domain].acquire()
