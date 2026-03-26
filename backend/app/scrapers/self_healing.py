"""Self-healing scraper manager.

Monitors scraper health and automatically falls back to
Crawl4AI LLM extraction when CSS-based scrapers break.
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ScraperHealth:
    """Tracks per-source scraper health."""

    def __init__(self):
        self._failures: dict[str, int] = {}
        self._last_success: dict[str, datetime] = {}
        self._healed: dict[str, bool] = {}

    def record_success(self, source: str):
        """Record a successful scrape."""
        self._failures[source] = 0
        self._last_success[source] = datetime.now(timezone.utc)

    def record_failure(self, source: str):
        """Record a scrape failure."""
        self._failures[source] = self._failures.get(source, 0) + 1

    def consecutive_failures(self, source: str) -> int:
        """Get consecutive failure count for a source."""
        return self._failures.get(source, 0)

    def should_self_heal(self, source: str, threshold: int = 3) -> bool:
        """Check if a source should attempt self-healing."""
        return self._failures.get(source, 0) >= threshold and not self._healed.get(source, False)

    def mark_healed(self, source: str):
        """Mark a source as self-healed (using LLM fallback)."""
        self._healed[source] = True
        self._failures[source] = 0
        logger.info(f"[SELF-HEAL] Source '{source}' healed via LLM extraction")

    def get_status(self) -> dict:
        """Get health status of all tracked sources."""
        sources = set(list(self._failures.keys()) + list(self._last_success.keys()))
        return {
            source: {
                "consecutive_failures": self._failures.get(source, 0),
                "last_success": self._last_success.get(source, {}).isoformat() if self._last_success.get(source) else None,
                "is_healed": self._healed.get(source, False),
                "status": "healthy" if self._failures.get(source, 0) == 0 else (
                    "healed" if self._healed.get(source) else (
                        "degraded" if self._failures.get(source, 0) < 3 else "broken"
                    )
                ),
            }
            for source in sorted(sources)
        }


# Global instance
scraper_health = ScraperHealth()


async def scrape_with_healing(
    source: str,
    url: str,
    primary_scraper,
    schema: dict[str, str] | None = None,
    **kwargs,
) -> dict | None:
    """Run a scraper with self-healing fallback.

    Parameters
    ----------
    source : str
        Source identifier (e.g., 'glassdoor', 'linkedin')
    url : str
        Target URL
    primary_scraper : callable
        Primary async scraper function
    schema : dict
        Extraction schema for Crawl4AI fallback
    **kwargs
        Passed to primary scraper

    Returns
    -------
    dict with scraped data, or None
    """
    # Try primary scraper first
    if not scraper_health.should_self_heal(source):
        try:
            result = await primary_scraper(url, **kwargs)
            if result:
                scraper_health.record_success(source)
                return result
            scraper_health.record_failure(source)
        except Exception as e:
            logger.warning(f"[{source}] Primary scraper failed: {e}")
            scraper_health.record_failure(source)

    # Self-healing: try Crawl4AI LLM extraction
    if scraper_health.should_self_heal(source) and schema:
        logger.info(f"[SELF-HEAL] Attempting LLM extraction for {source}: {url}")
        try:
            from app.scrapers.crawl4ai_adapter import extract_with_schema
            result = await extract_with_schema(url, schema)
            if result:
                scraper_health.mark_healed(source)
                return result
        except Exception as e:
            logger.error(f"[SELF-HEAL] LLM extraction also failed for {source}: {e}")

    return None
