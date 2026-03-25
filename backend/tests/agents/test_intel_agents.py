"""Tests for native Intel ArmyAgent operators."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.army_types import Role, AgentReport


class TestIntelScannerAgent:
    @pytest.mark.asyncio
    async def test_scanner_returns_report(self):
        """Scanner calls scan functions and returns AgentReport."""
        from app.agents.divisions.intel_agents import IntelScannerAgent

        sb = MagicMock()
        agent = IntelScannerAgent(
            agent_id="int.charlie.intel_scanner",
            division="intelligence",
            squad="charlie",
            role=Role.OPERATOR,
            persona_name="Nadia",
            persona_title="Analyst",
            supabase=sb,
        )

        with patch("app.agents.divisions.intel_agents.IntelScannerAgent._scan_source") as mock_scan:
            mock_scan.return_value = {"items_fetched": 10, "items_new": 3}

            report = await agent.run({
                "sources": ["gov", "news"],
                "supabase": sb,
            })

            assert report.status == "success"
            assert report.items_created == 6  # 3 + 3
            assert "gov" in report.data
            assert "news" in report.data
            assert mock_scan.call_count == 2

    @pytest.mark.asyncio
    async def test_scanner_handles_partial_failure(self):
        """Scanner reports partial when some sources fail."""
        from app.agents.divisions.intel_agents import IntelScannerAgent

        sb = MagicMock()
        agent = IntelScannerAgent(
            agent_id="int.charlie.intel_scanner",
            division="intelligence",
            squad="charlie",
            role=Role.OPERATOR,
            persona_name="Nadia",
            persona_title="Analyst",
            supabase=sb,
        )

        call_count = 0

        async def mock_scan(source, supabase, input):
            nonlocal call_count
            call_count += 1
            if source == "legal":
                raise ConnectionError("timeout")
            return {"items_fetched": 5, "items_new": 2}

        agent._scan_source = mock_scan

        report = await agent.run({
            "sources": ["gov", "legal"],
            "supabase": sb,
        })

        assert report.status == "partial"
        assert len(report.errors) == 1
        assert "legal" in report.errors[0]

    @pytest.mark.asyncio
    async def test_scanner_fails_without_supabase(self):
        """Scanner returns failed if no supabase client."""
        from app.agents.divisions.intel_agents import IntelScannerAgent

        agent = IntelScannerAgent(
            agent_id="int.charlie.intel_scanner",
            division="intelligence",
            squad="charlie",
            role=Role.OPERATOR,
            persona_name="Nadia",
            persona_title="Analyst",
        )

        report = await agent.run({"sources": ["gov"]})
        assert report.status == "failed"


class TestIntelProcessorAgent:
    @pytest.mark.asyncio
    async def test_processor_runs_pipeline(self):
        """Processor calls classify → analyze → dedup."""
        from app.agents.divisions.intel_agents import IntelProcessorAgent

        sb = MagicMock()
        agent = IntelProcessorAgent(
            agent_id="int.delta.intel_processor",
            division="intelligence",
            squad="delta",
            role=Role.OPERATOR,
            persona_name="Yusuf",
            persona_title="Specialist",
            supabase=sb,
        )

        async def mock_step(step, supabase):
            return {"items_processed": 10}

        agent._run_step = mock_step

        report = await agent.run({
            "steps": ["classify", "analyze", "dedup"],
            "supabase": sb,
        })

        assert report.status == "success"
        assert report.items_processed == 30  # 10 * 3 steps


class TestIntelligenceDivisionWithIntel:
    @pytest.mark.asyncio
    async def test_intelligence_has_intel_squads(self):
        """Intelligence Commander now includes charlie + delta squads."""
        from app.agents.divisions.intelligence import create_intelligence_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_intelligence_commander(redis=redis, supabase=sb)

        assert "charlie" in commander.squads  # IntelScanner
        assert "delta" in commander.squads    # IntelProcessor
        assert len(commander.squads) == 4     # alpha, bravo, charlie, delta
