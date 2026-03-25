"""Research Division — Company research and continuous improvement.

Commander: res.cmd
Squads:
  - alpha: DiscoveryAgent (Elena Volkov) — website, LinkedIn, career page discovery
  - bravo: ImprovementAgent (Dr. Alex Thornton) — keyword optimization, source scouting
"""

from app.agents.army_agent import Commander
from app.agents.army_types import Role
from app.agents.adapters import LegacySquadAdapter


def create_research_commander(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> Commander:
    from app.agents.discovery.agent import DiscoveryAgent
    from app.agents.improvement.agent import ImprovementAgent

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    discovery = DiscoveryAgent()
    alpha = LegacySquadAdapter(
        agent_id="res.alpha.discovery",
        division="research",
        squad="alpha",
        legacy_agent=discovery,
        mission_type="discover_companies",
        **shared,
    )

    improvement = ImprovementAgent()
    bravo = LegacySquadAdapter(
        agent_id="res.bravo.improvement",
        division="research",
        squad="bravo",
        legacy_agent=improvement,
        mission_type="improve_platform",
        **shared,
    )

    return Commander(
        agent_id="res.cmd",
        division="research",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. Elena Volkov",
        persona_title="Research Commander",
        squads={"alpha": alpha, "bravo": bravo},
        **shared,
    )
