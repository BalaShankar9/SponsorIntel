# backend/tests/agents/test_divisions.py
"""Tests for army division Commanders."""

import pytest
from unittest.mock import AsyncMock, MagicMock


class TestAcquisitionDivision:
    @pytest.mark.asyncio
    async def test_create_acquisition_commander(self):
        """Acquisition Commander wraps HunterAgent."""
        from app.agents.divisions.acquisition import create_acquisition_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_acquisition_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "acq.cmd"
        assert commander.division == "acquisition"
        assert "alpha" in commander.squads

    @pytest.mark.asyncio
    async def test_acquisition_runs_hunter_pipeline(self):
        """Acquisition Commander delegates to Hunter via adapter."""
        from app.agents.divisions.acquisition import create_acquisition_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_acquisition_commander(redis=redis, supabase=sb)

        hunter_adapter = commander.squads["alpha"]
        hunter_adapter.legacy_agent.run_pipeline = AsyncMock(return_value={
            "jobs_found": 25,
            "errors": [],
            "sources_scraped": ["free_apis"],
            "raw_jobs": [],
        })

        report = await commander.execute({"sources": ["free_apis"]})

        assert report.data["alpha"]["jobs_found"] == 25


class TestIntelligenceDivision:
    @pytest.mark.asyncio
    async def test_create_intelligence_commander(self):
        from app.agents.divisions.intelligence import create_intelligence_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_intelligence_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "int.cmd"
        assert commander.division == "intelligence"
        assert "alpha" in commander.squads
        assert "bravo" in commander.squads


class TestQualityDivision:
    @pytest.mark.asyncio
    async def test_create_quality_commander(self):
        from app.agents.divisions.quality import create_quality_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_quality_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "qlt.cmd"
        assert commander.division == "quality"
        assert "alpha" in commander.squads
        assert "bravo" in commander.squads


class TestOperationsDivision:
    @pytest.mark.asyncio
    async def test_create_operations_commander(self):
        from app.agents.divisions.operations import create_operations_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_operations_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "ops.cmd"
        assert commander.division == "operations"
        assert "alpha" in commander.squads
        assert "bravo" in commander.squads
