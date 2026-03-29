"""Base classes for the agent swarm framework."""

import time
import logging
from abc import ABC, abstractmethod
from typing import Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SubAgentResult:
    """Standard result from a sub-agent execution."""
    success: bool
    data: Any = None
    error: str | None = None
    duration_ms: float = 0
    llm_calls: int = 0


class BaseSubAgent(ABC):
    """Base class for all sub-agents (103 total across 6 main agents)."""

    name: str = "unnamed"
    agent_type: str = "DET"  # DET, LLM, HYB
    description: str = ""

    def __init__(self, llm_service=None, db_session=None, redis=None):
        self.llm = llm_service
        self.db = db_session
        self.redis = redis
        self._metrics = {"calls": 0, "errors": 0, "total_ms": 0}

    async def execute(self, **kwargs) -> SubAgentResult:
        """Execute with metrics tracking."""
        start = time.time()
        self._metrics["calls"] += 1
        try:
            result = await self.run(**kwargs)
            duration = (time.time() - start) * 1000
            self._metrics["total_ms"] += duration
            return SubAgentResult(
                success=True,
                data=result,
                duration_ms=duration,
            )
        except Exception as e:
            self._metrics["errors"] += 1
            duration = (time.time() - start) * 1000
            logger.error(f"[{self.name}] Error: {e}", exc_info=True)
            return SubAgentResult(
                success=False,
                error=str(e),
                duration_ms=duration,
            )

    @abstractmethod
    async def run(self, **kwargs) -> Any:
        """Implement the sub-agent's core logic."""
        ...

    @property
    def metrics(self) -> dict:
        return {**self._metrics}


class BaseAgent(ABC):
    """Base class for main agents (6 total)."""

    name: str = "unnamed"
    description: str = ""

    def __init__(self, llm_service=None, db_session=None, redis=None):
        self.llm = llm_service
        self.db = db_session
        self.redis = redis
        self.sub_agents: dict[str, BaseSubAgent] = {}
        self._register_sub_agents()

    @abstractmethod
    def _register_sub_agents(self):
        """Register all sub-agents for this agent."""
        ...

    @abstractmethod
    async def run_pipeline(self, **kwargs) -> dict:
        """Execute the agent's full pipeline."""
        ...

    def get_sub_agent(self, name: str) -> BaseSubAgent:
        """Get a registered sub-agent by name."""
        if name not in self.sub_agents:
            raise KeyError(f"Sub-agent '{name}' not registered in {self.name}")
        return self.sub_agents[name]

    def register(self, sub_agent: BaseSubAgent):
        """Register a sub-agent."""
        sub_agent.llm = self.llm
        sub_agent.db = self.db
        sub_agent.redis = self.redis
        self.sub_agents[sub_agent.name] = sub_agent

    @property
    def all_metrics(self) -> dict:
        return {name: sa.metrics for name, sa in self.sub_agents.items()}
