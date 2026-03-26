"""Tests for self-healing scraper manager."""

import pytest
from unittest.mock import AsyncMock, patch


class TestScraperHealth:
    def test_initial_state(self):
        from app.scrapers.self_healing import ScraperHealth
        health = ScraperHealth()
        assert health.consecutive_failures("test") == 0
        assert not health.should_self_heal("test")

    def test_record_failures(self):
        from app.scrapers.self_healing import ScraperHealth
        health = ScraperHealth()
        health.record_failure("glassdoor")
        health.record_failure("glassdoor")
        assert health.consecutive_failures("glassdoor") == 2
        assert not health.should_self_heal("glassdoor")

        health.record_failure("glassdoor")
        assert health.should_self_heal("glassdoor")

    def test_success_resets_failures(self):
        from app.scrapers.self_healing import ScraperHealth
        health = ScraperHealth()
        health.record_failure("test")
        health.record_failure("test")
        health.record_success("test")
        assert health.consecutive_failures("test") == 0

    def test_mark_healed(self):
        from app.scrapers.self_healing import ScraperHealth
        health = ScraperHealth()
        for _ in range(3):
            health.record_failure("test")
        assert health.should_self_heal("test")
        health.mark_healed("test")
        assert not health.should_self_heal("test")

    def test_get_status(self):
        from app.scrapers.self_healing import ScraperHealth
        health = ScraperHealth()
        health.record_success("good_source")
        health.record_failure("bad_source")
        health.record_failure("bad_source")
        health.record_failure("bad_source")
        status = health.get_status()
        assert status["good_source"]["status"] == "healthy"
        assert status["bad_source"]["status"] == "broken"


class TestScrapeWithHealing:
    @pytest.mark.asyncio
    async def test_uses_primary_scraper_first(self):
        from app.scrapers.self_healing import scrape_with_healing, ScraperHealth

        # Use a fresh health tracker
        with patch("app.scrapers.self_healing.scraper_health", ScraperHealth()):
            primary = AsyncMock(return_value={"data": "from_primary"})
            result = await scrape_with_healing("test", "https://example.com", primary)
            assert result == {"data": "from_primary"}
            primary.assert_called_once()

    @pytest.mark.asyncio
    async def test_falls_back_to_llm_after_failures(self):
        from app.scrapers.self_healing import scrape_with_healing, ScraperHealth

        health = ScraperHealth()
        # Simulate 3 prior failures
        for _ in range(3):
            health.record_failure("broken_source")

        with patch("app.scrapers.self_healing.scraper_health", health):
            with patch("app.scrapers.crawl4ai_adapter.extract_with_schema", new_callable=AsyncMock, return_value={"data": "from_llm"}):
                primary = AsyncMock(return_value=None)
                result = await scrape_with_healing(
                    "broken_source", "https://example.com", primary,
                    schema={"title": "string"},
                )
                assert result == {"data": "from_llm"}
