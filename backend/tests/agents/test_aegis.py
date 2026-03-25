# backend/tests/agents/test_aegis.py
"""Tests for AEGIS Supreme Commander."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.agents.army_types import Role, AgentReport


class TestAEGIS:
    @pytest.mark.asyncio
    async def test_create_aegis(self):
        """AEGIS wraps all 5 division Commanders."""
        from app.agents.divisions.command import create_aegis

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        aegis = create_aegis(redis=redis, supabase=sb)

        assert aegis.agent_id == "aegis"
        assert aegis.division == "command"
        assert aegis.role == Role.SUPREME
        assert len(aegis.squads) == 5
        assert set(aegis.squads.keys()) == {
            "acquisition", "intelligence", "quality", "operations", "research",
        }

    @pytest.mark.asyncio
    async def test_aegis_run_single_division(self):
        """AEGIS can run a specific division by name."""
        from app.agents.divisions.command import create_aegis

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        aegis = create_aegis(redis=redis, supabase=sb)

        # Mock just the acquisition commander's underlying pipeline
        acq = aegis.squads["acquisition"]
        acq.squads["alpha"].legacy_agent.run_pipeline = AsyncMock(
            return_value={"jobs_found": 50, "errors": [], "sources_scraped": ["free_apis"], "raw_jobs": []}
        )

        report = await aegis.run_division(
            division="acquisition",
            sources=["free_apis"],
        )

        assert report.status == "success"

    @pytest.mark.asyncio
    async def test_aegis_status_report(self):
        """AEGIS generates a status report of all divisions."""
        from app.agents.divisions.command import create_aegis

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        aegis = create_aegis(redis=redis, supabase=sb)

        status = aegis.get_division_status()

        assert len(status) == 5
        assert all(d in status for d in ["acquisition", "intelligence", "quality", "operations", "research"])
        for div_name, info in status.items():
            assert "commander_id" in info
            assert "squad_count" in info
