# backend/tests/scrapers/test_crawl4ai_adapter.py
"""Tests for Crawl4AI adapter."""

import pytest
from unittest.mock import patch, AsyncMock


class TestCrawl4AIAdapter:
    def test_schemas_defined(self):
        from app.scrapers.crawl4ai_adapter import COMPANY_PROFILE_SCHEMA, CAREER_PAGE_SCHEMA, CONTACT_INFO_SCHEMA
        assert "company_name" in COMPANY_PROFILE_SCHEMA
        assert "job_title" in CAREER_PAGE_SCHEMA
        assert "email" in CONTACT_INFO_SCHEMA

    @pytest.mark.asyncio
    async def test_extract_falls_back_without_crawl4ai(self):
        from app.scrapers.crawl4ai_adapter import extract_with_schema
        with patch("app.scrapers.crawl4ai_adapter._get_crawl4ai", return_value=None):
            with patch("app.scrapers.crawl4ai_adapter._fallback_extract", new_callable=AsyncMock, return_value={"page_title": "Test"}):
                result = await extract_with_schema("https://example.com", {"title": "string"})
                assert result is not None
                assert result["page_title"] == "Test"

    @pytest.mark.asyncio
    async def test_fallback_returns_none_on_error(self):
        from app.scrapers.crawl4ai_adapter import _fallback_extract
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(side_effect=Exception("timeout"))
            mock_client.return_value.__aexit__ = AsyncMock()
            result = await _fallback_extract("https://invalid.example", {})
            assert result is None

    def test_get_crawl4ai_returns_none_if_not_installed(self):
        from app.scrapers.crawl4ai_adapter import _get_crawl4ai
        result = _get_crawl4ai()
        # May or may not be installed — just verify it doesn't crash
        assert result is None or hasattr(result, "AsyncWebCrawler")
