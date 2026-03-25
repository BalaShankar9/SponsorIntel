# backend/tests/agents/test_adapters.py
"""Tests for LegacySquadAdapter — bridges BaseAgent to ArmyAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.agents.army_types import Role, AgentReport


class TestLegacySquadAdapter:
    @pytest.mark.asyncio
    async def test_adapter_wraps_base_agent_pipeline(self):
        """Adapter calls run_pipeline and returns AgentReport."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "hunter"
        mock_agent.run_pipeline = AsyncMock(return_value={
            "jobs_found": 42,
            "errors": [],
            "sources_scraped": ["free_apis"],
        })
        mock_agent.all_metrics = {"sub1": {"calls": 1, "errors": 0, "total_ms": 50}}

        adapter = LegacySquadAdapter(
            agent_id="acq.alpha.hunter",
            division="acquisition",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="hunt_jobs",
        )

        report = await adapter.run({"sources": ["free_apis"]})

        assert report.status == "success"
        assert report.data["jobs_found"] == 42
        assert report.mission_type == "hunt_jobs"
        mock_agent.run_pipeline.assert_called_once_with(sources=["free_apis"])

    @pytest.mark.asyncio
    async def test_adapter_handles_pipeline_error(self):
        """Adapter returns failed report when pipeline raises."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "broken"
        mock_agent.run_pipeline = AsyncMock(side_effect=RuntimeError("boom"))
        mock_agent.all_metrics = {}

        adapter = LegacySquadAdapter(
            agent_id="acq.alpha.broken",
            division="acquisition",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="hunt_jobs",
        )

        report = await adapter.run({"sources": ["free_apis"]})

        assert report.status == "failed"
        assert "boom" in report.errors[0]

    @pytest.mark.asyncio
    async def test_adapter_counts_llm_calls(self):
        """Adapter sums LLM calls from sub-agent metrics."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "enrichment"
        mock_agent.run_pipeline = AsyncMock(return_value={"enriched": 10})
        mock_agent.all_metrics = {
            "salary_parser": {"calls": 5, "errors": 0, "total_ms": 100},
            "soc_classifier": {"calls": 3, "errors": 1, "total_ms": 200},
        }

        adapter = LegacySquadAdapter(
            agent_id="int.alpha.enrichment",
            division="intelligence",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="enrich_jobs",
        )

        report = await adapter.run({"jobs": []})

        assert report.llm_calls == 8
        assert report.status == "success"

    @pytest.mark.asyncio
    async def test_adapter_passes_kwargs_from_input(self):
        """Adapter unpacks input dict as kwargs to run_pipeline."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "validator"
        mock_agent.run_pipeline = AsyncMock(return_value={"validated": 5})
        mock_agent.all_metrics = {}

        adapter = LegacySquadAdapter(
            agent_id="qlt.alpha.validator",
            division="quality",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="validate_jobs",
        )

        await adapter.run({"jobs": [{"id": 1}], "supabase": "mock_sb"})

        mock_agent.run_pipeline.assert_called_once_with(
            jobs=[{"id": 1}], supabase="mock_sb",
        )

    @pytest.mark.asyncio
    async def test_adapter_with_execute_wrapper(self):
        """Full execute() call including heartbeat and mission logging."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "hunter"
        mock_agent.run_pipeline = AsyncMock(return_value={"jobs_found": 10})
        mock_agent.all_metrics = {}

        redis = AsyncMock()
        redis.set = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        adapter = LegacySquadAdapter(
            agent_id="acq.alpha.hunter",
            division="acquisition",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="hunt_jobs",
            redis=redis,
            supabase=sb,
        )

        report = await adapter.execute({"sources": ["free_apis"]})

        assert report.status == "success"
        redis.set.assert_called()
        sb.table.assert_any_call("army_missions")
