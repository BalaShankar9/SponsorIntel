"""Army Divisions — organizational structure for the agent army.

Each division has a Commander that orchestrates SquadLeaders wrapping
existing BaseAgent pipelines via LegacySquadAdapter.

Imports are lazy (inside functions) to avoid pulling in heavy agent
dependencies at module load time.
"""


def get_division_factories() -> dict:
    """Return all division factory functions (lazy import)."""
    from app.agents.divisions.acquisition import create_acquisition_commander
    from app.agents.divisions.intelligence import create_intelligence_commander
    from app.agents.divisions.quality import create_quality_commander
    from app.agents.divisions.operations import create_operations_commander
    from app.agents.divisions.research import create_research_commander

    return {
        "acquisition": create_acquisition_commander,
        "intelligence": create_intelligence_commander,
        "quality": create_quality_commander,
        "operations": create_operations_commander,
        "research": create_research_commander,
    }


def get_aegis_factory():
    """Return AEGIS factory (lazy import)."""
    from app.agents.divisions.command import create_aegis
    return create_aegis
