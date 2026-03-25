"""Intelligence Division — Enrichment and corporate intelligence.

Commander: int.cmd
Squads:
  - alpha: EnrichmentAgent (Priya Kapoor) — sponsorship scoring
  - bravo: CompaniesHouseWatcherAgent (Daniel Mensah) — corporate intel
"""

from app.agents.army_agent import Commander
from app.agents.army_types import Role
from app.agents.adapters import LegacySquadAdapter


def create_intelligence_commander(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> Commander:
    from app.agents.enrichment.agent import EnrichmentAgent
    from app.agents.companies_house.agent import CompaniesHouseWatcherAgent

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    enrichment = EnrichmentAgent()
    alpha = LegacySquadAdapter(
        agent_id="int.alpha.enrichment",
        division="intelligence",
        squad="alpha",
        legacy_agent=enrichment,
        mission_type="enrich_jobs",
        **shared,
    )

    ch_watcher = CompaniesHouseWatcherAgent()
    bravo = LegacySquadAdapter(
        agent_id="int.bravo.companies_house",
        division="intelligence",
        squad="bravo",
        legacy_agent=ch_watcher,
        mission_type="watch_companies_house",
        **shared,
    )

    return Commander(
        agent_id="int.cmd",
        division="intelligence",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. Priya Kapoor",
        persona_title="Intelligence Commander",
        squads={"alpha": alpha, "bravo": bravo},
        **shared,
    )
