# backend/app/agents/divisions/command.py
"""Command Division — AEGIS Supreme Commander.

AEGIS orchestrates all 5 division Commanders. Provides the single
entry point for running divisions individually or the full army.
"""

import logging
from app.agents.army_agent import Commander
from app.agents.army_types import Role, AgentReport

logger = logging.getLogger(__name__)


class AEGIS(Commander):
    """Supreme Commander — orchestrates all division Commanders."""

    async def run_division(self, division: str = None, **kwargs) -> AgentReport:
        """Run a specific division or all divisions.

        Parameters
        ----------
        division : str, optional
            Division name to run. If None, runs all divisions.
        **kwargs
            Passed to the division Commander's execute().
        """
        if division and division in self.squads:
            target = self.squads[division]
            report = await target.execute(kwargs)
            await self.emit_signal(
                "stream:aegis_division_complete",
                {"division": division, "status": report.status},
            )
            return report

        # Run all divisions
        return await super().run_division(**kwargs)

    def get_division_status(self) -> dict:
        """Return status of all divisions."""
        status = {}
        for div_name, commander in self.squads.items():
            squad_count = len(commander.squads) if hasattr(commander, "squads") else 0
            status[div_name] = {
                "commander_id": commander.agent_id,
                "squad_count": squad_count,
                "persona": commander.persona_name,
            }
        return status


def create_aegis(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> AEGIS:
    """Factory: create AEGIS with all 5 division Commanders."""
    from app.agents.divisions.acquisition import create_acquisition_commander
    from app.agents.divisions.intelligence import create_intelligence_commander
    from app.agents.divisions.quality import create_quality_commander
    from app.agents.divisions.operations import create_operations_commander
    from app.agents.divisions.research import create_research_commander

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    divisions = {
        "acquisition": create_acquisition_commander(**shared),
        "intelligence": create_intelligence_commander(**shared),
        "quality": create_quality_commander(**shared),
        "operations": create_operations_commander(**shared),
        "research": create_research_commander(**shared),
    }

    return AEGIS(
        agent_id="aegis",
        division="command",
        squad="supreme",
        role=Role.SUPREME,
        persona_name="AEGIS",
        persona_title="Supreme Commander",
        squads=divisions,
        **shared,
    )
