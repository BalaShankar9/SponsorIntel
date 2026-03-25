"""Integration test: ArmyAgent + TierRouter + SignalBus working together."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.agents.army_types import Role, AgentReport, TierResult
from app.agents.army_agent import ArmyAgent, SquadLeader
from app.agents.signal_bus import SignalBus
from app.agents.tier_router import TierRouter, T0Engine


class SalaryParserAgent(ArmyAgent):
    """Example T0 agent that parses salaries without LLM."""

    async def run(self, input: dict) -> AgentReport:
        text = input.get("salary_text", "")
        result = await self.request_tier(
            prompt=text,
            task_type="salary_parse",
        )

        if result.content:
            await self.emit_signal(
                "stream:enrichment_complete",
                {"agent_id": self.agent_id, "parsed": result.content},
            )
            return AgentReport(
                agent_id=self.agent_id,
                mission_type="salary_parse",
                status="success",
                data={"parsed": result.content},
                items_processed=1,
                items_created=0,
                items_updated=1,
                tier_used=result.tier_used,
                llm_cost_usd=result.cost_usd,
            )
        return AgentReport(
            agent_id=self.agent_id,
            mission_type="salary_parse",
            status="failed",
            data={},
            errors=["Could not parse salary"],
        )


class TestArmyIntegration:
    @pytest.mark.asyncio
    async def test_t0_agent_full_pipeline(self):
        """Test: Agent → TierRouter (T0) → SignalBus → Mission log."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="123-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        router = TierRouter(
            redis=redis, supabase=sb,
            groq_api_key="test", nvidia_nim_api_key="test",
        )
        bus = SignalBus(redis=redis, supabase=sb)

        agent = SalaryParserAgent(
            agent_id="int.hotel.salary_parser",
            division="intelligence",
            squad="hotel",
            role=Role.OPERATOR,
            persona_name="Salary Parser",
            persona_title="Intel Analyst",
            default_tier=0,
            redis=redis,
            supabase=sb,
            tier_router=router,
            signal_bus=bus,
        )

        report = await agent.execute({"salary_text": "£45,000 - £55,000 per annum"})

        # Agent should have used T0 (free)
        assert report.status == "success"
        assert report.tier_used == 0
        assert report.llm_cost_usd == 0.0

        # Signal should have been emitted
        redis.xadd.assert_called()

        # Mission should have been logged
        sb.table.assert_any_call("army_missions")

    @pytest.mark.asyncio
    async def test_squad_leader_aggregates_operators(self):
        """Test: SquadLeader runs multiple operators and aggregates results."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="123-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        router = TierRouter(
            redis=redis, supabase=sb,
            groq_api_key="test", nvidia_nim_api_key="test",
        )
        bus = SignalBus(redis=redis, supabase=sb)

        shared = dict(
            division="intelligence", squad="hotel",
            role=Role.OPERATOR, default_tier=0,
            redis=redis, supabase=sb, tier_router=router, signal_bus=bus,
        )

        op1 = SalaryParserAgent(
            agent_id="int.hotel.salary1",
            persona_name="Parser 1", persona_title="Parser",
            **shared,
        )
        op2 = SalaryParserAgent(
            agent_id="int.hotel.salary2",
            persona_name="Parser 2", persona_title="Parser",
            **shared,
        )

        leader = SquadLeader(
            agent_id="int.hotel.leader",
            division="intelligence", squad="hotel",
            role=Role.SQUAD_LEADER,
            persona_name="Sgt. Analyst", persona_title="Squad Leader",
            default_tier=1,
            redis=redis, supabase=sb, tier_router=router, signal_bus=bus,
            operators=[op1, op2],
        )

        report = await leader.run_squad({
            "salary_text": "£30,000 - £40,000",
        })

        assert report.status == "success"
        assert report.items_updated == 2  # Both operators updated 1 each
        assert report.llm_cost_usd == 0.0  # All T0
