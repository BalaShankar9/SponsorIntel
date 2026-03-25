"""Tests for ArmyAgent, SquadLeader, Commander base classes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.army_types import Division, Role, AgentReport


class TestArmyAgent:
    def _make_agent(self, agent_id="test.agent", division="acquisition", **kwargs):
        from app.agents.army_agent import ArmyAgent

        class ConcreteAgent(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(
                    agent_id=self.agent_id,
                    mission_type="test",
                    status="success",
                    data={"result": "ok"},
                    items_processed=1,
                    items_created=1,
                    duration_ms=50,
                )

        return ConcreteAgent(
            agent_id=agent_id,
            division=division,
            squad=kwargs.get("squad", "alpha"),
            role=kwargs.get("role", Role.OPERATOR),
            persona_name=kwargs.get("persona_name", "Test Agent"),
            persona_title=kwargs.get("persona_title", "Test"),
            default_tier=kwargs.get("default_tier", 2),
            redis=kwargs.get("redis", AsyncMock()),
            supabase=kwargs.get("supabase", MagicMock()),
            tier_router=kwargs.get("tier_router", AsyncMock()),
            signal_bus=kwargs.get("signal_bus", AsyncMock()),
        )

    @pytest.mark.asyncio
    async def test_execute_returns_agent_report(self):
        agent = self._make_agent()
        report = await agent.execute({"test": True})
        assert isinstance(report, AgentReport)
        assert report.status == "success"
        assert report.agent_id == "test.agent"

    @pytest.mark.asyncio
    async def test_execute_logs_mission_to_supabase(self):
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        agent = self._make_agent(supabase=sb)
        await agent.execute({"test": True})

        sb.table.assert_called_with("army_missions")

    @pytest.mark.asyncio
    async def test_execute_catches_errors(self):
        from app.agents.army_agent import ArmyAgent

        class FailAgent(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                raise ValueError("Something broke")

        agent = FailAgent(
            agent_id="fail.agent",
            division="quality",
            squad="mike",
            role=Role.OPERATOR,
            persona_name="Fail",
            persona_title="Fail",
            default_tier=2,
            redis=AsyncMock(),
            supabase=MagicMock(),
            tier_router=AsyncMock(),
            signal_bus=AsyncMock(),
        )
        report = await agent.execute({"test": True})
        assert report.status == "failed"
        assert "Something broke" in report.errors[0]

    @pytest.mark.asyncio
    async def test_heartbeat_updates_redis(self):
        redis = AsyncMock()
        agent = self._make_agent(redis=redis)
        await agent.heartbeat()
        redis.set.assert_called_once()
        call_args = redis.set.call_args
        assert "army:heartbeat:test.agent" in str(call_args)

    @pytest.mark.asyncio
    async def test_emit_signal_delegates_to_bus(self):
        bus = AsyncMock()
        agent = self._make_agent(signal_bus=bus)
        await agent.emit_signal("stream:test", {"data": 1})
        bus.emit.assert_called_once_with(
            channel="stream:test",
            publisher_id="test.agent",
            payload={"data": 1},
            severity="info",
        )

    @pytest.mark.asyncio
    async def test_request_tier_delegates_to_router(self):
        router = AsyncMock()
        from app.agents.army_types import TierResult
        router.route.return_value = TierResult(
            content="result", tier_used=2, provider="groq",
            model="test", tokens_in=10, tokens_out=5,
            cost_usd=0.001, latency_ms=200, from_cache=False,
        )
        agent = self._make_agent(tier_router=router)
        result = await agent.request_tier("Analyze this", "Be helpful", "job_enrichment")
        assert result.content == "result"
        router.route.assert_called_once()

    def test_agent_id_format(self):
        agent = self._make_agent(agent_id="acq.alpha.remotive")
        assert agent.agent_id == "acq.alpha.remotive"
        assert agent.division == "acquisition"


class TestSquadLeader:
    @pytest.mark.asyncio
    async def test_squad_leader_runs_operators(self):
        from app.agents.army_agent import ArmyAgent, SquadLeader

        class MockOperator(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(
                    agent_id=self.agent_id,
                    mission_type="scrape",
                    status="success",
                    data={"jobs": 10},
                    items_processed=10,
                    items_created=10,
                    duration_ms=100,
                )

        redis = AsyncMock()
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        router = AsyncMock()
        bus = AsyncMock()

        op1 = MockOperator(
            agent_id="acq.alpha.op1", division="acquisition", squad="alpha",
            role=Role.OPERATOR, persona_name="Op1", persona_title="Op1",
            default_tier=0, redis=redis, supabase=sb,
            tier_router=router, signal_bus=bus,
        )
        op2 = MockOperator(
            agent_id="acq.alpha.op2", division="acquisition", squad="alpha",
            role=Role.OPERATOR, persona_name="Op2", persona_title="Op2",
            default_tier=0, redis=redis, supabase=sb,
            tier_router=router, signal_bus=bus,
        )

        leader = SquadLeader(
            agent_id="acq.alpha.leader", division="acquisition", squad="alpha",
            role=Role.SQUAD_LEADER, persona_name="Sgt Alpha", persona_title="Squad Leader",
            default_tier=1, redis=redis, supabase=sb,
            tier_router=router, signal_bus=bus,
            operators=[op1, op2],
        )

        report = await leader.run_squad({"batch": True})
        assert report.status == "success"
        assert report.items_created == 20


class TestCommander:
    @pytest.mark.asyncio
    async def test_commander_runs_squads(self):
        from app.agents.army_agent import ArmyAgent, SquadLeader, Commander

        class MockOperator(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(
                    agent_id=self.agent_id, mission_type="test",
                    status="success", data={"n": 5},
                    items_processed=5, items_created=5,
                    duration_ms=100,
                )

        redis = AsyncMock()
        redis.set = AsyncMock()
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None
        bus = AsyncMock()
        shared = dict(redis=redis, supabase=sb, tier_router=AsyncMock(), signal_bus=bus)

        op = MockOperator(
            agent_id="acq.alpha.op1", division="acquisition", squad="alpha",
            role=Role.OPERATOR, persona_name="Op", persona_title="Op",
            default_tier=0, **shared,
        )
        leader = SquadLeader(
            agent_id="acq.alpha.leader", division="acquisition", squad="alpha",
            role=Role.SQUAD_LEADER, persona_name="Sgt", persona_title="Sgt",
            default_tier=1, operators=[op], **shared,
        )
        commander = Commander(
            agent_id="acq.commander", division="acquisition", squad="",
            role=Role.COMMANDER, persona_name="Colonel", persona_title="Cmdr",
            default_tier=2, squads={"alpha": leader}, **shared,
        )

        report = await commander.run_division()
        assert report.status == "success"
        assert report.items_created == 5

    @pytest.mark.asyncio
    async def test_commander_reports_to_aegis(self):
        from app.agents.army_agent import Commander

        bus = AsyncMock()
        commander = Commander(
            agent_id="acq.commander", division="acquisition", squad="",
            role=Role.COMMANDER, persona_name="Colonel", persona_title="Cmdr",
            default_tier=2, squads={},
            redis=AsyncMock(), supabase=MagicMock(), tier_router=AsyncMock(),
            signal_bus=bus,
        )
        report = AgentReport(
            agent_id="acq.commander", mission_type="division_acquisition",
            status="success", data={}, items_processed=100, items_created=50,
            llm_cost_usd=0.5,
        )
        await commander.report_to_aegis(report)
        bus.emit.assert_called_once()
        call_args = bus.emit.call_args
        assert call_args[1]["channel"] == "stream:division_report"

    @pytest.mark.asyncio
    async def test_commander_publishes_heartbeat(self):
        from app.agents.army_agent import Commander

        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = None
        commander = Commander(
            agent_id="acq.commander", division="acquisition", squad="",
            role=Role.COMMANDER, persona_name="Colonel", persona_title="Cmdr",
            default_tier=2, squads={},
            redis=AsyncMock(), supabase=sb, tier_router=AsyncMock(),
            signal_bus=AsyncMock(),
        )
        await commander.publish_heartbeat()
        sb.table.assert_called_with("army_division_status")

    @pytest.mark.asyncio
    async def test_listen_signal(self):
        from app.agents.army_agent import ArmyAgent

        class SimpleAgent(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(agent_id=self.agent_id, mission_type="test",
                                   status="success", data={})

        bus = AsyncMock()
        agent = SimpleAgent(
            agent_id="int.hotel.analyst", division="intelligence", squad="hotel",
            role=Role.OPERATOR, persona_name="Analyst", persona_title="Analyst",
            default_tier=2, redis=AsyncMock(), supabase=MagicMock(),
            tier_router=AsyncMock(), signal_bus=bus,
        )
        await agent.listen_signal("stream:new_jobs_batch")
        bus.subscribe.assert_called_once_with(
            "stream:new_jobs_batch", "intelligence_hotel", "int.hotel.analyst",
        )
