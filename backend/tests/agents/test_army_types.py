"""Tests for army core types: enums, AgentReport, TierResult."""

import uuid
import pytest
from app.agents.army_types import (
    Role, Division, AgentReport, TierResult, Priority, ALL_DIVISIONS,
)


class TestEnums:
    def test_role_values(self):
        assert Role.OPERATOR == "operator"
        assert Role.SQUAD_LEADER == "squad_leader"
        assert Role.COMMANDER == "commander"
        assert Role.SUPREME == "supreme"

    def test_division_values(self):
        assert Division.ACQUISITION == "acquisition"
        assert Division.INTELLIGENCE == "intelligence"
        assert Division.QUALITY == "quality"
        assert Division.OPERATIONS == "operations"
        assert Division.RESEARCH == "research"
        assert Division.COMMAND == "command"

    def test_priority_values(self):
        assert Priority.CRITICAL == 0
        assert Priority.HIGH == 3
        assert Priority.NORMAL == 6
        assert Priority.LOW == 9


class TestAgentReport:
    def test_create_success_report(self):
        report = AgentReport(
            agent_id="acq.alpha.remotive",
            mission_type="scrape_jobs",
            status="success",
            data={"jobs_found": 42},
            items_processed=100,
            items_created=42,
            items_updated=0,
            errors=[],
            duration_ms=1500,
            tier_used=0,
            llm_calls=0,
            llm_cost_usd=0.0,
            signals_emitted=[],
        )
        assert report.success is True
        assert report.agent_id == "acq.alpha.remotive"
        assert report.mission_id is not None  # auto-generated UUID

    def test_create_failed_report(self):
        report = AgentReport(
            agent_id="acq.alpha.remotive",
            mission_type="scrape_jobs",
            status="failed",
            data={},
            items_processed=0,
            items_created=0,
            items_updated=0,
            errors=["Connection timeout"],
            duration_ms=30000,
            tier_used=0,
            llm_calls=0,
            llm_cost_usd=0.0,
            signals_emitted=[],
        )
        assert report.success is False
        assert report.errors == ["Connection timeout"]

    def test_to_sub_agent_result(self):
        report = AgentReport(
            agent_id="int.hotel.salary_parser",
            mission_type="parse_salary",
            status="success",
            data={"salary_min": 30000},
            items_processed=1,
            items_created=0,
            items_updated=1,
            errors=[],
            duration_ms=50,
            tier_used=0,
            llm_calls=0,
            llm_cost_usd=0.0,
            signals_emitted=[],
        )
        result = report.to_sub_agent_result()
        assert result.success is True
        assert result.data == {"salary_min": 30000}
        assert result.duration_ms == 50

    def test_to_dict(self):
        report = AgentReport(
            agent_id="test.agent",
            mission_type="test",
            status="success",
            data={"key": "val"},
            items_processed=1,
            items_created=1,
            items_updated=0,
            errors=[],
            duration_ms=100,
            tier_used=2,
            llm_calls=1,
            llm_cost_usd=0.001,
            signals_emitted=["stream:new_jobs_batch"],
        )
        d = report.to_dict()
        assert d["agent_id"] == "test.agent"
        assert d["status"] == "success"
        assert isinstance(d["mission_id"], str)


class TestTierResult:
    def test_create_tier_result(self):
        result = TierResult(
            content="This is a spam job posting",
            tier_used=1,
            provider="groq",
            model="llama-3.3-70b-versatile",
            tokens_in=50,
            tokens_out=10,
            cost_usd=0.0001,
            latency_ms=200,
            from_cache=False,
        )
        assert result.content == "This is a spam job posting"
        assert result.tier_used == 1
        assert result.cost_usd == 0.0001

    def test_cached_result(self):
        result = TierResult(
            content="cached response",
            tier_used=2,
            provider="cache",
            model="",
            tokens_in=0,
            tokens_out=0,
            cost_usd=0.0,
            latency_ms=1,
            from_cache=True,
        )
        assert result.from_cache is True
        assert result.cost_usd == 0.0
