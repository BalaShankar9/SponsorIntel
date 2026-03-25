# backend/app/agents/divisions/acquisition.py
"""Acquisition Division — Job sourcing and discovery.

Commander: acq.cmd
Squads:
  - alpha: HunterAgent (Aria Singh) — sweeps 23+ job boards
"""

from app.agents.army_agent import Commander
from app.agents.army_types import Role
from app.agents.adapters import LegacySquadAdapter


def create_acquisition_commander(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> Commander:
    """Factory: create the Acquisition division Commander with all squads."""
    from app.agents.hunter.agent import HunterAgent

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    hunter = HunterAgent()
    alpha = LegacySquadAdapter(
        agent_id="acq.alpha.hunter",
        division="acquisition",
        squad="alpha",
        legacy_agent=hunter,
        mission_type="hunt_jobs",
        **shared,
    )

    commander = Commander(
        agent_id="acq.cmd",
        division="acquisition",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. Aria Singh",
        persona_title="Acquisition Commander",
        squads={"alpha": alpha},
        **shared,
    )

    return commander
