"""Intelligence Division — Enrichment, corporate intel, and immigration intelligence.

Commander: int.cmd
Squads:
  - alpha: EnrichmentAgent (Priya Kapoor) — sponsorship scoring
  - bravo: CompaniesHouseWatcherAgent (Daniel Mensah) — corporate intel
  - charlie: IntelScannerAgent — immigration news/policy scanning
  - delta: IntelProcessorAgent — classify, analyze, dedup intel items
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
    from app.agents.divisions.intel_agents import IntelScannerAgent, IntelProcessorAgent

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

    charlie = IntelScannerAgent(
        agent_id="int.charlie.intel_scanner",
        division="intelligence",
        squad="charlie",
        role=Role.OPERATOR,
        persona_name="Nadia Petrova",
        persona_title="Immigration Intelligence Analyst",
        default_tier=0,
        **shared,
    )

    delta = IntelProcessorAgent(
        agent_id="int.delta.intel_processor",
        division="intelligence",
        squad="delta",
        role=Role.OPERATOR,
        persona_name="Dr. Yusuf Osman",
        persona_title="Intel Classification Specialist",
        default_tier=2,
        **shared,
    )

    return Commander(
        agent_id="int.cmd",
        division="intelligence",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. Priya Kapoor",
        persona_title="Intelligence Commander",
        squads={"alpha": alpha, "bravo": bravo, "charlie": charlie, "delta": delta},
        **shared,
    )
