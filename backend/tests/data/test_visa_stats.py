"""Tests for visa statistics parsing."""
import pytest

class TestVisaStatsParser:
    def test_parse_soc_row(self):
        from app.scripts.data_foundation.visa_stats import parse_soc_row
        row = {"soc_code": "2136", "occupation": "Programmers", "grants": "8420", "year": "2025"}
        result = parse_soc_row(row)
        assert result["soc_code"] == "2136"
        assert result["grants_total"] == 8420
        assert result["year"] == 2025

    def test_parse_comma_numbers(self):
        from app.scripts.data_foundation.visa_stats import parse_soc_row
        row = {"soc_code": "2136", "occupation": "Test", "grants": "12,345", "year": "2025"}
        result = parse_soc_row(row)
        assert result["grants_total"] == 12345

    def test_parse_suppressed_data(self):
        from app.scripts.data_foundation.visa_stats import parse_soc_row
        row = {"soc_code": "2136", "occupation": "Test", "grants": "..", "year": "2025"}
        result = parse_soc_row(row)
        assert result["grants_total"] == 0
