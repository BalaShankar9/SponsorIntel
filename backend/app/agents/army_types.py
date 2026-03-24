"""Core types for the Agent Army framework.

Defines enums (Role, Division, Priority), AgentReport (standardized mission
result, backward-compatible with SubAgentResult), and TierResult (LLM call
result with cost/tier metadata).
"""

import uuid
from enum import Enum, IntEnum
from dataclasses import dataclass, field
from typing import Any

from app.agents.base import SubAgentResult


class Role(str, Enum):
    OPERATOR = "operator"
    SQUAD_LEADER = "squad_leader"
    COMMANDER = "commander"
    SUPREME = "supreme"


class Division(str, Enum):
    ACQUISITION = "acquisition"
    INTELLIGENCE = "intelligence"
    QUALITY = "quality"
    OPERATIONS = "operations"
    RESEARCH = "research"
    COMMAND = "command"


# All division values as a list (outside Enum to avoid member conflict)
ALL_DIVISIONS = [d.value for d in Division]


class Priority(IntEnum):
    CRITICAL = 0
    HIGH = 3
    NORMAL = 6
    LOW = 9


@dataclass
class AgentReport:
    """Standardized result from any army agent mission.

    Superset of SubAgentResult — includes tier routing data, cost tracking,
    and signal emission info. Use to_sub_agent_result() for backward compat.
    """
    agent_id: str
    mission_type: str
    status: str                    # "success", "partial", "failed"
    data: dict
    items_processed: int = 0
    items_created: int = 0
    items_updated: int = 0
    errors: list[str] = field(default_factory=list)
    duration_ms: int = 0
    tier_used: int = 0
    llm_calls: int = 0
    llm_cost_usd: float = 0.0
    signals_emitted: list[str] = field(default_factory=list)
    mission_id: uuid.UUID = field(default_factory=uuid.uuid4)

    @property
    def success(self) -> bool:
        return self.status == "success"

    def to_sub_agent_result(self) -> SubAgentResult:
        """Backward-compatible conversion to SubAgentResult."""
        return SubAgentResult(
            success=self.status == "success",
            data=self.data,
            error=self.errors[0] if self.errors else None,
            duration_ms=self.duration_ms,
            llm_calls=self.llm_calls,
        )

    def to_dict(self) -> dict:
        """Serialize for JSON storage in army_missions."""
        return {
            "agent_id": self.agent_id,
            "mission_id": str(self.mission_id),
            "mission_type": self.mission_type,
            "status": self.status,
            "data": self.data,
            "items_processed": self.items_processed,
            "items_created": self.items_created,
            "items_updated": self.items_updated,
            "errors": self.errors,
            "duration_ms": self.duration_ms,
            "tier_used": self.tier_used,
            "llm_calls": self.llm_calls,
            "llm_cost_usd": self.llm_cost_usd,
            "signals_emitted": self.signals_emitted,
        }


@dataclass
class TierResult:
    """Result from a TierRouter LLM call with cost/routing metadata."""
    content: str
    tier_used: int
    provider: str
    model: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    latency_ms: int
    from_cache: bool = False
