"""Registry for all agents and their sub-agents.

Supports both legacy @register_agent('name') and new army-style
@register_agent('name', division='...', squad='...', role='...').
"""

_AGENTS: dict[str, type] = {}
_AGENT_META: dict[str, dict] = {}


def register_agent(name: str, *, division: str = "", squad: str = "", role: str = ""):
    """Decorator to register an agent class with optional army metadata."""
    def decorator(cls):
        _AGENTS[name] = cls
        if division:
            _AGENT_META[name] = {
                "division": division,
                "squad": squad,
                "role": role,
            }
        return cls
    return decorator


def get_agent(name: str):
    """Get agent class by name."""
    return _AGENTS.get(name)


def list_agents() -> list[str]:
    """List all registered agent names."""
    return list(_AGENTS.keys())


def get_agent_metadata(name: str) -> dict:
    """Get army metadata for an agent (empty dict for legacy agents)."""
    return _AGENT_META.get(name, {})


def get_agents_by_division(division: str) -> list[str]:
    """List agent names belonging to a division."""
    return [
        name for name, meta in _AGENT_META.items()
        if meta.get("division") == division
    ]
