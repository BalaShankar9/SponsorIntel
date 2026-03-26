"""Tests for executive PDF report generator."""

import pytest


class TestReportGenerator:
    def test_generate_pdf_returns_bytes(self):
        from app.services.report_generator import generate_executive_report
        stats = {
            "sponsor_stats": {"total_active": 140000, "new_count": 50, "removed_count": 5, "rating_changes": 12, "a_rated_pct": 92.3},
            "job_stats": {"total_active": 45000, "new_count": 3200, "sponsorship_likely": 18000, "median_salary": 42000},
            "intel_stats": {"total_items": 150, "critical_high": 12, "top_topics": {"rule_change": 5, "policy_update": 7}},
            "agent_stats": {"total_missions": 5000, "success_rate": 94.2, "llm_cost": 12.50},
        }
        pdf = generate_executive_report(stats, period="weekly")
        assert isinstance(pdf, bytes)
        assert len(pdf) > 1000  # Should be a non-trivial PDF
        assert pdf[:5] == b"%PDF-"  # Valid PDF header

    def test_generate_pdf_with_empty_stats(self):
        from app.services.report_generator import generate_executive_report
        pdf = generate_executive_report({}, period="monthly")
        assert isinstance(pdf, bytes)
        assert pdf[:5] == b"%PDF-"
