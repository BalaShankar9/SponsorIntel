"""Operations Division — Lifecycle management and monitoring.

Commander: ops.cmd
Squads:
  - alpha: FreshnessAgent (James Okafor) — job lifecycle, stale reaping
  - bravo: OrchestratorAgent (Raj Patel) — metrics, anomaly detection, alerts
"""

from app.agents.army_agent import Commander
from app.agents.army_types import Role
from app.agents.adapters import LegacySquadAdapter


def create_operations_commander(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> Commander:
    from app.agents.freshness.agent import FreshnessAgent
    from app.agents.orchestrator.agent import OrchestratorAgent

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    freshness = FreshnessAgent()
    alpha = LegacySquadAdapter(
        agent_id="ops.alpha.freshness",
        division="operations",
        squad="alpha",
        legacy_agent=freshness,
        mission_type="check_freshness",
        **shared,
    )

    orchestrator = OrchestratorAgent()
    bravo = LegacySquadAdapter(
        agent_id="ops.bravo.orchestrator",
        division="operations",
        squad="bravo",
        legacy_agent=orchestrator,
        mission_type="orchestrate_ops",
        **shared,
    )

    return Commander(
        agent_id="ops.cmd",
        division="operations",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. James Okafor",
        persona_title="Operations Commander",
        squads={"alpha": alpha, "bravo": bravo},
        **shared,
    )
