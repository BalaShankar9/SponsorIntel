"""
Proxy manager for scraping.

Manages a pool of proxies, rotating them per request and tracking failures.
Falls back to direct connection if no proxies are configured.
"""

import logging
from collections import defaultdict
from typing import Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ProxyManager:
    """
    Manages proxy pool from config, rotating per request.

    Tracks failures per proxy and removes proxies that exceed a failure threshold.
    Falls back to direct (no proxy) if no proxies are configured or all have failed.
    """

    MAX_FAILURES = 5  # Remove proxy after this many consecutive failures

    def __init__(self) -> None:
        self._proxies: List[str] = []
        self._failure_counts: Dict[str, int] = defaultdict(int)
        self._current_index: int = 0
        self._load_proxies()

    def _load_proxies(self) -> None:
        """Load proxies from application settings."""
        settings = get_settings()

        if settings.proxy_residential_url:
            self._proxies.append(settings.proxy_residential_url)

        if settings.proxy_datacenter_url:
            self._proxies.append(settings.proxy_datacenter_url)

        if self._proxies:
            logger.info("Loaded %d proxies", len(self._proxies))
        else:
            logger.info("No proxies configured; will use direct connections")

    def get_proxy(self, domain: str) -> Optional[str]:
        """
        Get the next proxy URL for the given domain, rotating round-robin.

        Returns None if no proxies are available (direct connection fallback).
        """
        if not self._proxies:
            return None

        # Round-robin rotation
        proxy = self._proxies[self._current_index % len(self._proxies)]
        self._current_index += 1
        return proxy

    def mark_failed(self, proxy: str) -> None:
        """
        Mark a proxy as having failed a request.

        Removes the proxy from the pool after MAX_FAILURES consecutive failures.
        """
        self._failure_counts[proxy] += 1
        logger.warning(
            "Proxy %s failed (%d/%d)",
            proxy[:30] + "...",
            self._failure_counts[proxy],
            self.MAX_FAILURES,
        )

        if self._failure_counts[proxy] >= self.MAX_FAILURES:
            if proxy in self._proxies:
                self._proxies.remove(proxy)
                logger.error(
                    "Proxy %s removed after %d failures. %d proxies remaining.",
                    proxy[:30] + "...",
                    self.MAX_FAILURES,
                    len(self._proxies),
                )

    def mark_success(self, proxy: str) -> None:
        """Reset failure count on successful request."""
        self._failure_counts[proxy] = 0

    @property
    def available_count(self) -> int:
        """Number of proxies currently available."""
        return len(self._proxies)

    def add_proxy(self, proxy_url: str) -> None:
        """Dynamically add a proxy to the pool."""
        if proxy_url not in self._proxies:
            self._proxies.append(proxy_url)
            logger.info("Added proxy to pool. %d proxies available.", len(self._proxies))
