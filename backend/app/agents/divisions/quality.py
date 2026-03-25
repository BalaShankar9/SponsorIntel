"""Quality Division — Data validation and completeness auditing.

Commander: qlt.cmd
Squads:
  - alpha: ValidatorAgent (Marcus Chen) — cleaning, validation, dedup
  - bravo: QualityAgent (Sophie Laurent) — completeness auditing, source health
"""

from app.agents.army_agent import Commander
from app.agents.army_types import Role
from app.agents.adapters import LegacySquadAdapter


def create_quality_commander(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> Commander:
    from app.agents.validator.agent import ValidatorAgent
    from app.agents.quality.agent import QualityAgent

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    validator = ValidatorAgent()
    alpha = LegacySquadAdapter(
        agent_id="qlt.alpha.validator",
        division="quality",
        squad="alpha",
        legacy_agent=validator,
        mission_type="validate_jobs",
        **shared,
    )

    quality = QualityAgent()
    bravo = LegacySquadAdapter(
        agent_id="qlt.bravo.quality",
        division="quality",
        squad="bravo",
        legacy_agent=quality,
        mission_type="audit_quality",
        **shared,
    )

    return Commander(
        agent_id="qlt.cmd",
        division="quality",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. Marcus Chen",
        persona_title="Quality Commander",
        squads={"alpha": alpha, "bravo": bravo},
        **shared,
    )
