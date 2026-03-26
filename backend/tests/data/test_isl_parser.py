"""Tests for Immigration Salary List parsing."""
import pytest

class TestISLParser:
    def test_parse_isl_entry(self):
        from app.scripts.data_foundation.isl_parser import parse_isl_entry
        entry = {"soc_code": "2136", "occupation": "Programmers", "job_titles": "Software Engineer, Developer, Programmer"}
        result = parse_isl_entry(entry)
        assert result["soc_code"] == "2136"
        assert result["is_going_rate_exempt"] is True
        assert len(result["job_titles"]) == 3

    def test_check_job_on_isl(self):
        from app.scripts.data_foundation.isl_parser import check_job_on_isl
        isl_entries = [
            {"soc_code": "2136", "job_titles": ["Software Engineer", "Developer"]},
            {"soc_code": "2137", "job_titles": ["Web Designer", "UX Designer"]},
        ]
        assert check_job_on_isl("Senior Software Engineer", isl_entries) == "2136"
        assert check_job_on_isl("UX Designer", isl_entries) == "2137"
        assert check_job_on_isl("Plumber", isl_entries) is None
