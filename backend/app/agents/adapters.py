# backend/app/agents/adapters.py
"""LegacySquadAdapter — bridges BaseAgent → ArmyAgent.

Wraps an existing BaseAgent (with run_pipeline(**kwargs)) into an ArmyAgent
(with run(input: dict) -> AgentReport). Preserves all existing pipeline logic
while gaining army features: heartbeats, mission logging, signal bus, tier routing.
"""

import logging
from app.agents.army_agent import ArmyAgent
from app.agents.army_types import AgentReport, Role

logger = logging.getLogger(__name__)


class LegacySquadAdapter(ArmyAgent):
    """Wraps a BaseAgent's run_pipeline() in the ArmyAgent execute() lifecycle."""

    def __init__(
        self,
        agent_id: str,
        division: str,
        squad: str,
        legacy_agent,
        mission_type: str = "legacy_pipeline",
        **kwargs,
    ):
        super().__init__(
            agent_id=agent_id,
            division=division,
            squad=squad,
            role=Role.SQUAD_LEADER,
            persona_name=getattr(legacy_agent, "persona", legacy_agent.name),
            persona_title=getattr(legacy_agent, "title", "Squad Leader"),
            **kwargs,
        )
        self.legacy_agent = legacy_agent
        self.mission_type = mission_type

    async def run(self, input: dict) -> AgentReport:
        try:
            result = await self.legacy_agent.run_pipeline(**input)

            total_llm_calls = sum(
                m.get("calls", 0)
                for m in self.legacy_agent.all_metrics.values()
            )

            return AgentReport(
                agent_id=self.agent_id,
                mission_type=self.mission_type,
                status="success",
                data=result if isinstance(result, dict) else {"result": result},
                llm_calls=total_llm_calls,
            )
        except Exception as e:
            logger.error(f"[{self.agent_id}] Legacy pipeline failed: {e}", exc_info=True)
            return AgentReport(
                agent_id=self.agent_id,
                mission_type=self.mission_type,
                status="failed",
                data={},
                errors=[str(e)],
            )
