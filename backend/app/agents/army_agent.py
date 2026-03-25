"""ArmyAgent base classes for the military-structured agent framework.

ArmyAgent: Base class for all 181 agents. Handles mission execution with
automatic reporting, heartbeats, signal emission, and tier-routed LLM.

SquadLeader: Orchestrates a squad of operator agents.
Commander: Orchestrates squads within a division.
"""

import json
import logging
import time
from abc import abstractmethod
from datetime import datetime, timezone

from app.agents.army_types import AgentReport, TierResult, Role

logger = logging.getLogger(__name__)


class ArmyAgent:
    """Base class for all army agents (operators, squad leaders, commanders)."""

    def __init__(
        self,
        agent_id: str,
        division: str,
        squad: str,
        role: str,
        persona_name: str,
        persona_title: str,
        default_tier: int = 2,
        capabilities: list[str] | None = None,
        redis=None,
        supabase=None,
        tier_router=None,
        signal_bus=None,
    ):
        self.agent_id = agent_id
        self.division = division
        self.squad = squad
        self.role = role
        self.persona_name = persona_name
        self.persona_title = persona_title
        self.default_tier = default_tier
        self.capabilities = capabilities or []
        self.redis = redis
        self.supabase = supabase
        self.tier_router = tier_router
        self.signal_bus = signal_bus

    async def execute(self, input: dict) -> AgentReport:
        started_at = datetime.now(timezone.utc)
        start = time.time()
        try:
            report = await self.run(input)
            report.duration_ms = int((time.time() - start) * 1000)
        except Exception as e:
            duration = int((time.time() - start) * 1000)
            logger.error(f"[{self.agent_id}] Mission failed: {e}", exc_info=True)
            report = AgentReport(
                agent_id=self.agent_id,
                mission_type="unknown",
                status="failed",
                data={},
                errors=[str(e)],
                duration_ms=duration,
            )

        await self._log_mission(report, input, started_at)
        await self.heartbeat()
        return report

    @abstractmethod
    async def run(self, input: dict) -> AgentReport:
        ...

    async def heartbeat(self):
        if not self.redis:
            return
        try:
            data = json.dumps({
                "agent_id": self.agent_id,
                "division": self.division,
                "status": "active",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await self.redis.set(
                f"army:heartbeat:{self.agent_id}",
                data,
                ex=120,
            )
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Heartbeat failed: {e}")

    async def emit_signal(self, channel: str, payload: dict, severity: str = "info"):
        if not self.signal_bus:
            return
        await self.signal_bus.emit(
            channel=channel,
            publisher_id=self.agent_id,
            payload=payload,
            severity=severity,
        )

    async def request_tier(
        self,
        prompt: str,
        system: str = "",
        task_type: str = "general",
        tier: int | None = None,
        cache_key: str | None = None,
    ) -> TierResult:
        if not self.tier_router:
            return TierResult(
                content="", tier_used=0, provider="none", model="",
                tokens_in=0, tokens_out=0, cost_usd=0.0,
                latency_ms=0, from_cache=False,
            )
        return await self.tier_router.route(
            prompt=prompt,
            system=system,
            task_type=task_type,
            agent_id=self.agent_id,
            tier_hint=tier if tier is not None else self.default_tier,
            cache_key=cache_key,
        )

    async def listen_signal(self, channel: str, consumer_group: str | None = None):
        if not self.signal_bus:
            return
        group = consumer_group or f"{self.division}_{self.squad}"
        await self.signal_bus.subscribe(channel, group, self.agent_id)

    async def escalate(self, message: str):
        await self.emit_signal(
            "stream:escalation",
            {"agent_id": self.agent_id, "message": message},
            severity="high",
        )

    async def _log_mission(self, report: AgentReport, input: dict, started_at: datetime):
        if not self.supabase:
            return
        try:
            self.supabase.table("army_missions").insert({
                "id": str(report.mission_id),
                "agent_id": report.agent_id,
                "mission_type": report.mission_type,
                "status": report.status,
                "priority": "normal",
                "input": input,
                "output": report.data,
                "tier_used": report.tier_used,
                "llm_cost_usd": report.llm_cost_usd,
                "duration_ms": report.duration_ms,
                "error_message": report.errors[0] if report.errors else None,
                "division": self.division,
                "started_at": started_at.isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Mission log failed: {e}")


class SquadLeader(ArmyAgent):
    def __init__(self, operators: list[ArmyAgent] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.operators = operators or []

    async def run(self, input: dict) -> AgentReport:
        return await self.run_squad(input)

    async def run_squad(self, input: dict) -> AgentReport:
        total_processed = 0
        total_created = 0
        total_updated = 0
        total_errors = []
        total_cost = 0.0
        total_llm_calls = 0
        all_data = {}
        all_signals = []

        for op in self.operators:
            try:
                report = await op.execute(input)
                total_processed += report.items_processed
                total_created += report.items_created
                total_updated += report.items_updated
                total_errors.extend(report.errors)
                total_cost += report.llm_cost_usd
                total_llm_calls += report.llm_calls
                all_data[op.agent_id] = report.data
                all_signals.extend(report.signals_emitted)
            except Exception as e:
                total_errors.append(f"{op.agent_id}: {e}")

        status = "success" if not total_errors else ("partial" if total_created > 0 else "failed")

        return AgentReport(
            agent_id=self.agent_id,
            mission_type=f"squad_{self.squad}",
            status=status,
            data=all_data,
            items_processed=total_processed,
            items_created=total_created,
            items_updated=total_updated,
            errors=total_errors,
            tier_used=self.default_tier,
            llm_calls=total_llm_calls,
            llm_cost_usd=total_cost,
            signals_emitted=all_signals,
        )

    async def assign_task(self, operator: ArmyAgent, task: dict) -> AgentReport:
        return await operator.execute(task)


class Commander(ArmyAgent):
    def __init__(self, squads: dict[str, SquadLeader] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.squads = squads or {}

    async def run(self, input: dict) -> AgentReport:
        return await self.run_division(**input)

    async def run_division(self, **kwargs) -> AgentReport:
        total_processed = 0
        total_created = 0
        total_updated = 0
        total_errors = []
        total_cost = 0.0
        squad_data = {}

        for squad_name, leader in self.squads.items():
            try:
                report = await leader.execute(kwargs)
                total_processed += report.items_processed
                total_created += report.items_created
                total_updated += report.items_updated
                total_errors.extend(report.errors)
                total_cost += report.llm_cost_usd
                squad_data[squad_name] = report.data
            except Exception as e:
                total_errors.append(f"Squad {squad_name}: {e}")

        status = "success" if not total_errors else ("partial" if total_created > 0 else "failed")

        report = AgentReport(
            agent_id=self.agent_id,
            mission_type=f"division_{self.division}",
            status=status,
            data=squad_data,
            items_processed=total_processed,
            items_created=total_created,
            items_updated=total_updated,
            errors=total_errors,
            llm_cost_usd=total_cost,
        )

        await self.report_to_aegis(report)
        return report

    async def report_to_aegis(self, report: AgentReport):
        await self.emit_signal(
            "stream:division_report",
            {
                "division": self.division,
                "status": report.status,
                "items_processed": report.items_processed,
                "items_created": report.items_created,
                "errors": len(report.errors),
                "cost_usd": report.llm_cost_usd,
            },
        )

    async def publish_heartbeat(self):
        if not self.supabase:
            return
        try:
            active = sum(1 for s in self.squads.values() for _ in s.operators)
            self.supabase.table("army_division_status").upsert({
                "division": self.division,
                "commander_agent_id": self.agent_id,
                "status": "operational",
                "agents_active": active,
                "agents_paused": 0,
                "agents_error": 0,
                "heartbeat_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.debug(f"[{self.agent_id}] Division heartbeat failed: {e}")
