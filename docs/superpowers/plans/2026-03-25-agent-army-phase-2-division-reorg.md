# Agent Army Phase 2: Division Reorganization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the existing 9 agents (47+ sub-agents) into the 6-division army structure, wrapping each in the new ArmyAgent hierarchy while preserving all existing functionality.

**Architecture:** Each existing `BaseAgent` becomes a squad within its division. The existing `run_pipeline()` methods are preserved as-is — we wrap them with `ArmyAgent` adapters that provide tier routing, signal bus, heartbeats, and mission logging. No existing pipeline code is modified. A thin adapter pattern (`LegacySquadAdapter`) bridges `BaseAgent.run_pipeline()` → `ArmyAgent.run()`. Each division gets a Commander that orchestrates its squads.

**Tech Stack:** Python 3.11, Celery + Redis, Supabase, existing BaseAgent/BaseSubAgent classes

---

## Division Mapping

| Division | Commander | Squads (existing agents) |
|----------|-----------|-------------------------|
| **Acquisition** | `acq.cmd` | Hunter (`acq.alpha`) |
| **Intelligence** | `int.cmd` | Enrichment (`int.alpha`), Companies House (`int.bravo`) |
| **Quality** | `qlt.cmd` | Validator (`qlt.alpha`), Quality (`qlt.bravo`) |
| **Operations** | `ops.cmd` | Freshness (`ops.alpha`), Orchestrator (`ops.bravo`) |
| **Research** | `res.cmd` | Discovery (`res.alpha`), Improvement (`res.bravo`) |
| **Command** | `aegis` | No squads — supreme coordinator |

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/app/agents/adapters.py` | `LegacySquadAdapter` — bridges `BaseAgent` → `ArmyAgent` |
| `backend/app/agents/divisions/` | Division directory |
| `backend/app/agents/divisions/__init__.py` | Division exports |
| `backend/app/agents/divisions/acquisition.py` | Acquisition Commander + Hunter squad adapter |
| `backend/app/agents/divisions/intelligence.py` | Intelligence Commander + Enrichment/CH squads |
| `backend/app/agents/divisions/quality.py` | Quality Commander + Validator/Quality squads |
| `backend/app/agents/divisions/operations.py` | Operations Commander + Freshness/Orchestrator squads |
| `backend/app/agents/divisions/research.py` | Research Commander + Discovery/Improvement squads |
| `backend/app/agents/divisions/command.py` | AEGIS Supreme Commander — top-level orchestration |
| `backend/tests/agents/test_adapters.py` | Tests for LegacySquadAdapter |
| `backend/tests/agents/test_divisions.py` | Tests for division Commanders |
| `backend/tests/agents/test_aegis.py` | Tests for AEGIS supreme commander |

### Modified Files
| File | Change |
|------|--------|
| `backend/app/agents/divisions/__init__.py` | Export all commanders |
| `backend/app/agents/__init__.py` | Add division exports |
| `backend/app/tasks/army_tasks.py` | Add division execution tasks |

---

## Task 1: LegacySquadAdapter — Bridge Pattern

**Files:**
- Create: `backend/app/agents/adapters.py`
- Create: `backend/tests/agents/test_adapters.py`

The adapter wraps any existing `BaseAgent` (which has `run_pipeline(**kwargs)`) into an `ArmyAgent` (which has `run(input: dict) -> AgentReport`). This is the key bridge that lets us reorganize without rewriting any existing pipeline code.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/agents/test_adapters.py
"""Tests for LegacySquadAdapter — bridges BaseAgent to ArmyAgent."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.agents.army_types import Role, AgentReport


class TestLegacySquadAdapter:
    @pytest.mark.asyncio
    async def test_adapter_wraps_base_agent_pipeline(self):
        """Adapter calls run_pipeline and returns AgentReport."""
        from app.agents.adapters import LegacySquadAdapter

        # Create a mock BaseAgent
        mock_agent = MagicMock()
        mock_agent.name = "hunter"
        mock_agent.run_pipeline = AsyncMock(return_value={
            "jobs_found": 42,
            "errors": [],
            "sources_scraped": ["free_apis"],
        })
        mock_agent.all_metrics = {"sub1": {"calls": 1, "errors": 0, "total_ms": 50}}

        adapter = LegacySquadAdapter(
            agent_id="acq.alpha.hunter",
            division="acquisition",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="hunt_jobs",
        )

        report = await adapter.run({"sources": ["free_apis"]})

        assert report.status == "success"
        assert report.data["jobs_found"] == 42
        assert report.mission_type == "hunt_jobs"
        mock_agent.run_pipeline.assert_called_once_with(sources=["free_apis"])

    @pytest.mark.asyncio
    async def test_adapter_handles_pipeline_error(self):
        """Adapter returns failed report when pipeline raises."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "broken"
        mock_agent.run_pipeline = AsyncMock(side_effect=RuntimeError("boom"))
        mock_agent.all_metrics = {}

        adapter = LegacySquadAdapter(
            agent_id="acq.alpha.broken",
            division="acquisition",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="hunt_jobs",
        )

        report = await adapter.run({"sources": ["free_apis"]})

        assert report.status == "failed"
        assert "boom" in report.errors[0]

    @pytest.mark.asyncio
    async def test_adapter_counts_llm_calls(self):
        """Adapter sums LLM calls from sub-agent metrics."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "enrichment"
        mock_agent.run_pipeline = AsyncMock(return_value={"enriched": 10})
        mock_agent.all_metrics = {
            "salary_parser": {"calls": 5, "errors": 0, "total_ms": 100},
            "soc_classifier": {"calls": 3, "errors": 1, "total_ms": 200},
        }

        adapter = LegacySquadAdapter(
            agent_id="int.alpha.enrichment",
            division="intelligence",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="enrich_jobs",
        )

        report = await adapter.run({"jobs": []})

        assert report.llm_calls == 8  # 5 + 3
        assert report.status == "success"

    @pytest.mark.asyncio
    async def test_adapter_passes_kwargs_from_input(self):
        """Adapter unpacks input dict as kwargs to run_pipeline."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "validator"
        mock_agent.run_pipeline = AsyncMock(return_value={"validated": 5})
        mock_agent.all_metrics = {}

        adapter = LegacySquadAdapter(
            agent_id="qlt.alpha.validator",
            division="quality",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="validate_jobs",
        )

        await adapter.run({"jobs": [{"id": 1}], "supabase": "mock_sb"})

        mock_agent.run_pipeline.assert_called_once_with(
            jobs=[{"id": 1}], supabase="mock_sb",
        )

    @pytest.mark.asyncio
    async def test_adapter_with_execute_wrapper(self):
        """Full execute() call including heartbeat and mission logging."""
        from app.agents.adapters import LegacySquadAdapter

        mock_agent = MagicMock()
        mock_agent.name = "hunter"
        mock_agent.run_pipeline = AsyncMock(return_value={"jobs_found": 10})
        mock_agent.all_metrics = {}

        redis = AsyncMock()
        redis.set = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        adapter = LegacySquadAdapter(
            agent_id="acq.alpha.hunter",
            division="acquisition",
            squad="alpha",
            legacy_agent=mock_agent,
            mission_type="hunt_jobs",
            redis=redis,
            supabase=sb,
        )

        report = await adapter.execute({"sources": ["free_apis"]})

        assert report.status == "success"
        # Heartbeat should have been called
        redis.set.assert_called()
        # Mission should have been logged
        sb.table.assert_any_call("army_missions")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_adapters.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.adapters'`

- [ ] **Step 3: Write the adapter implementation**

```python
# backend/app/agents/adapters.py
"""LegacySquadAdapter — bridges BaseAgent → ArmyAgent.

Wraps an existing BaseAgent (with run_pipeline(**kwargs)) into an ArmyAgent
(with run(input: dict) -> AgentReport). Preserves all existing pipeline logic
while gaining army features: heartbeats, mission logging, signal bus, tier routing.
"""

import logging
from app.agents.army_agent import ArmyAgent
from app.agents.army_types import AgentReport, Role

logger = logging.getLogger(__name__)


class LegacySquadAdapter(ArmyAgent):
    """Wraps a BaseAgent's run_pipeline() in the ArmyAgent execute() lifecycle."""

    def __init__(
        self,
        agent_id: str,
        division: str,
        squad: str,
        legacy_agent,
        mission_type: str = "legacy_pipeline",
        **kwargs,
    ):
        super().__init__(
            agent_id=agent_id,
            division=division,
            squad=squad,
            role=Role.SQUAD_LEADER,
            persona_name=getattr(legacy_agent, "persona", legacy_agent.name),
            persona_title=getattr(legacy_agent, "title", "Squad Leader"),
            **kwargs,
        )
        self.legacy_agent = legacy_agent
        self.mission_type = mission_type

    async def run(self, input: dict) -> AgentReport:
        try:
            result = await self.legacy_agent.run_pipeline(**input)

            # Sum LLM calls from sub-agent metrics
            total_llm_calls = sum(
                m.get("calls", 0)
                for m in self.legacy_agent.all_metrics.values()
            )

            return AgentReport(
                agent_id=self.agent_id,
                mission_type=self.mission_type,
                status="success",
                data=result if isinstance(result, dict) else {"result": result},
                llm_calls=total_llm_calls,
            )
        except Exception as e:
            logger.error(f"[{self.agent_id}] Legacy pipeline failed: {e}", exc_info=True)
            return AgentReport(
                agent_id=self.agent_id,
                mission_type=self.mission_type,
                status="failed",
                data={},
                errors=[str(e)],
            )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_adapters.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/adapters.py backend/tests/agents/test_adapters.py
git commit -m "feat(army): add LegacySquadAdapter — bridges BaseAgent to ArmyAgent

Wraps existing run_pipeline(**kwargs) in the ArmyAgent execute() lifecycle.
Gains heartbeats, mission logging, signal bus without modifying existing code."
```

---

## Task 2: Acquisition Division — Hunter Squad

**Files:**
- Create: `backend/app/agents/divisions/__init__.py` (empty package)
- Create: `backend/app/agents/divisions/acquisition.py`
- Create: `backend/tests/agents/test_divisions.py`

The Acquisition division has one squad: Hunter (job sourcing).

- [ ] **Step 0: Create divisions directory**

```bash
mkdir -p backend/app/agents/divisions
touch backend/app/agents/divisions/__init__.py
```

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/agents/test_divisions.py
"""Tests for army division Commanders."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestAcquisitionDivision:
    @pytest.mark.asyncio
    async def test_create_acquisition_commander(self):
        """Acquisition Commander wraps HunterAgent."""
        from app.agents.divisions.acquisition import create_acquisition_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_acquisition_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "acq.cmd"
        assert commander.division == "acquisition"
        assert "alpha" in commander.squads

    @pytest.mark.asyncio
    async def test_acquisition_runs_hunter_pipeline(self):
        """Acquisition Commander delegates to Hunter via adapter."""
        from app.agents.divisions.acquisition import create_acquisition_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_acquisition_commander(redis=redis, supabase=sb)

        # Mock the underlying HunterAgent.run_pipeline
        hunter_adapter = commander.squads["alpha"]
        hunter_adapter.legacy_agent.run_pipeline = AsyncMock(return_value={
            "jobs_found": 25,
            "errors": [],
            "sources_scraped": ["free_apis"],
            "raw_jobs": [],
        })

        report = await commander.execute({"sources": ["free_apis"]})

        assert report.data["alpha"]["jobs_found"] == 25
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestAcquisitionDivision -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write the Acquisition division**

```python
# backend/app/agents/divisions/acquisition.py
"""Acquisition Division — Job sourcing and discovery.

Commander: acq.cmd
Squads:
  - alpha: HunterAgent (Aria Singh) — sweeps 23+ job boards
"""

from app.agents.army_agent import Commander
from app.agents.army_types import Role
from app.agents.adapters import LegacySquadAdapter
from app.agents.registry import register_agent


def create_acquisition_commander(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> Commander:
    """Factory: create the Acquisition division Commander with all squads."""
    from app.agents.hunter.agent import HunterAgent

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    # Alpha Squad: Hunter
    hunter = HunterAgent()
    alpha = LegacySquadAdapter(
        agent_id="acq.alpha.hunter",
        division="acquisition",
        squad="alpha",
        legacy_agent=hunter,
        mission_type="hunt_jobs",
        **shared,
    )

    commander = Commander(
        agent_id="acq.cmd",
        division="acquisition",
        squad="command",
        role=Role.COMMANDER,
        persona_name="Col. Aria Singh",
        persona_title="Acquisition Commander",
        squads={"alpha": alpha},
        **shared,
    )

    return commander
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestAcquisitionDivision -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/divisions/__init__.py backend/app/agents/divisions/acquisition.py backend/tests/agents/test_divisions.py
git commit -m "feat(army): add Acquisition division — Hunter squad

Wraps HunterAgent as alpha squad under acq.cmd Commander."
```

---

## Task 3: Intelligence Division — Enrichment + Companies House Squads

**Files:**
- Create: `backend/app/agents/divisions/intelligence.py`
- Modify: `backend/tests/agents/test_divisions.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/agents/test_divisions.py`:

```python
class TestIntelligenceDivision:
    @pytest.mark.asyncio
    async def test_create_intelligence_commander(self):
        """Intelligence Commander wraps Enrichment + CompaniesHouse."""
        from app.agents.divisions.intelligence import create_intelligence_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_intelligence_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "int.cmd"
        assert commander.division == "intelligence"
        assert "alpha" in commander.squads  # Enrichment
        assert "bravo" in commander.squads  # Companies House

    @pytest.mark.asyncio
    async def test_intelligence_runs_enrichment(self):
        """Intelligence Commander delegates to Enrichment squad."""
        from app.agents.divisions.intelligence import create_intelligence_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None
        sb.table.return_value.update.return_value.eq.return_value.execute.return_value = None

        commander = create_intelligence_commander(redis=redis, supabase=sb)

        # Mock both squad pipelines
        commander.squads["alpha"].legacy_agent.run_pipeline = AsyncMock(return_value=[{"id": 1}])
        commander.squads["bravo"].legacy_agent.run_pipeline = AsyncMock(return_value={
            "checked": 10, "filings_found": 2, "errors": [],
        })

        report = await commander.execute({"jobs": [], "supabase": sb})

        assert "alpha" in report.data
        assert "bravo" in report.data
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestIntelligenceDivision -v
```

Expected: FAIL

- [ ] **Step 3: Write the Intelligence division**

```python
# backend/app/agents/divisions/intelligence.py
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
    """Factory: create the Intelligence division Commander."""
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestIntelligenceDivision -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/divisions/intelligence.py backend/tests/agents/test_divisions.py
git commit -m "feat(army): add Intelligence division — Enrichment + Companies House squads

Wraps EnrichmentAgent (alpha) and CompaniesHouseWatcherAgent (bravo)
under int.cmd Commander."
```

---

## Task 4: Quality Division — Validator + Quality Squads

**Files:**
- Create: `backend/app/agents/divisions/quality.py`
- Modify: `backend/tests/agents/test_divisions.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/agents/test_divisions.py`:

```python
class TestQualityDivision:
    @pytest.mark.asyncio
    async def test_create_quality_commander(self):
        """Quality Commander wraps Validator + Quality agents."""
        from app.agents.divisions.quality import create_quality_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_quality_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "qlt.cmd"
        assert commander.division == "quality"
        assert "alpha" in commander.squads  # Validator
        assert "bravo" in commander.squads  # Quality
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestQualityDivision -v
```

- [ ] **Step 3: Write the Quality division**

```python
# backend/app/agents/divisions/quality.py
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
    """Factory: create the Quality division Commander."""
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestQualityDivision -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/divisions/quality.py backend/tests/agents/test_divisions.py
git commit -m "feat(army): add Quality division — Validator + Quality squads

Wraps ValidatorAgent (alpha) and QualityAgent (bravo)
under qlt.cmd Commander."
```

---

## Task 5: Operations Division — Freshness + Orchestrator Squads

**Files:**
- Create: `backend/app/agents/divisions/operations.py`
- Modify: `backend/tests/agents/test_divisions.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/agents/test_divisions.py`:

```python
class TestOperationsDivision:
    @pytest.mark.asyncio
    async def test_create_operations_commander(self):
        """Operations Commander wraps Freshness + Orchestrator."""
        from app.agents.divisions.operations import create_operations_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_operations_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "ops.cmd"
        assert commander.division == "operations"
        assert "alpha" in commander.squads  # Freshness
        assert "bravo" in commander.squads  # Orchestrator
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestOperationsDivision -v
```

- [ ] **Step 3: Write the Operations division**

```python
# backend/app/agents/divisions/operations.py
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
    """Factory: create the Operations division Commander."""
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestOperationsDivision -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/divisions/operations.py backend/tests/agents/test_divisions.py
git commit -m "feat(army): add Operations division — Freshness + Orchestrator squads

Wraps FreshnessAgent (alpha) and OrchestratorAgent (bravo)
under ops.cmd Commander."
```

---

## Task 6: Research Division — Discovery + Improvement Squads

**Files:**
- Create: `backend/app/agents/divisions/research.py`
- Modify: `backend/tests/agents/test_divisions.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/agents/test_divisions.py`:

```python
class TestResearchDivision:
    @pytest.mark.asyncio
    async def test_create_research_commander(self):
        """Research Commander wraps Discovery + Improvement."""
        from app.agents.divisions.research import create_research_commander

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        commander = create_research_commander(redis=redis, supabase=sb)

        assert commander.agent_id == "res.cmd"
        assert commander.division == "research"
        assert "alpha" in commander.squads  # Discovery
        assert "bravo" in commander.squads  # Improvement
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestResearchDivision -v
```

- [ ] **Step 3: Write the Research division**

```python
# backend/app/agents/divisions/research.py
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
    """Factory: create the Research division Commander."""
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_divisions.py::TestResearchDivision -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/divisions/research.py backend/tests/agents/test_divisions.py
git commit -m "feat(army): add Research division — Discovery + Improvement squads

Wraps DiscoveryAgent (alpha) and ImprovementAgent (bravo)
under res.cmd Commander."
```

---

## Task 7: AEGIS Supreme Commander

**Files:**
- Create: `backend/app/agents/divisions/command.py`
- Create: `backend/tests/agents/test_aegis.py`

AEGIS is the top-level commander that orchestrates all 5 division Commanders. It provides a single entry point for running the entire army.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/agents/test_aegis.py
"""Tests for AEGIS Supreme Commander."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.army_types import Role, AgentReport


class TestAEGIS:
    @pytest.mark.asyncio
    async def test_create_aegis(self):
        """AEGIS wraps all 5 division Commanders."""
        from app.agents.divisions.command import create_aegis

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        aegis = create_aegis(redis=redis, supabase=sb)

        assert aegis.agent_id == "aegis"
        assert aegis.division == "command"
        assert aegis.role == Role.SUPREME
        assert len(aegis.squads) == 5
        assert set(aegis.squads.keys()) == {
            "acquisition", "intelligence", "quality", "operations", "research",
        }

    @pytest.mark.asyncio
    async def test_aegis_run_single_division(self):
        """AEGIS can run a specific division by name."""
        from app.agents.divisions.command import create_aegis

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        aegis = create_aegis(redis=redis, supabase=sb)

        # Mock just the acquisition commander's underlying pipeline
        acq = aegis.squads["acquisition"]
        acq.squads["alpha"].legacy_agent.run_pipeline = AsyncMock(
            return_value={"jobs_found": 50, "errors": [], "sources_scraped": ["free_apis"], "raw_jobs": []}
        )

        report = await aegis.run_division(
            division="acquisition",
            sources=["free_apis"],
        )

        assert report.status == "success"

    @pytest.mark.asyncio
    async def test_aegis_status_report(self):
        """AEGIS generates a status report of all divisions."""
        from app.agents.divisions.command import create_aegis

        redis = AsyncMock()
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="1-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        aegis = create_aegis(redis=redis, supabase=sb)

        status = aegis.get_division_status()

        assert len(status) == 5
        assert all(d in status for d in ["acquisition", "intelligence", "quality", "operations", "research"])
        for div_name, info in status.items():
            assert "commander_id" in info
            assert "squad_count" in info
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python3 -m pytest tests/agents/test_aegis.py -v
```

Expected: FAIL

- [ ] **Step 3: Write AEGIS**

```python
# backend/app/agents/divisions/command.py
"""Command Division — AEGIS Supreme Commander.

AEGIS orchestrates all 5 division Commanders. Provides the single
entry point for running divisions individually or the full army.
"""

import logging
from app.agents.army_agent import Commander
from app.agents.army_types import Role, AgentReport

logger = logging.getLogger(__name__)


class AEGIS(Commander):
    """Supreme Commander — orchestrates all division Commanders."""

    async def run_division(self, division: str = None, **kwargs) -> AgentReport:
        """Run a specific division or all divisions.

        Parameters
        ----------
        division : str, optional
            Division name to run. If None, runs all divisions.
        **kwargs
            Passed to the division Commander's execute().
        """
        if division and division in self.squads:
            target = self.squads[division]
            report = await target.execute(kwargs)
            await self.emit_signal(
                "stream:aegis_division_complete",
                {"division": division, "status": report.status},
            )
            return report

        # Run all divisions
        return await super().run_division(**kwargs)

    def get_division_status(self) -> dict:
        """Return status of all divisions."""
        status = {}
        for div_name, commander in self.squads.items():
            squad_count = len(commander.squads) if hasattr(commander, "squads") else 0
            status[div_name] = {
                "commander_id": commander.agent_id,
                "squad_count": squad_count,
                "persona": commander.persona_name,
            }
        return status


def create_aegis(
    redis=None,
    supabase=None,
    tier_router=None,
    signal_bus=None,
) -> AEGIS:
    """Factory: create AEGIS with all 5 division Commanders."""
    from app.agents.divisions.acquisition import create_acquisition_commander
    from app.agents.divisions.intelligence import create_intelligence_commander
    from app.agents.divisions.quality import create_quality_commander
    from app.agents.divisions.operations import create_operations_commander
    from app.agents.divisions.research import create_research_commander

    shared = dict(redis=redis, supabase=supabase, tier_router=tier_router, signal_bus=signal_bus)

    divisions = {
        "acquisition": create_acquisition_commander(**shared),
        "intelligence": create_intelligence_commander(**shared),
        "quality": create_quality_commander(**shared),
        "operations": create_operations_commander(**shared),
        "research": create_research_commander(**shared),
    }

    return AEGIS(
        agent_id="aegis",
        division="command",
        squad="supreme",
        role=Role.SUPREME,
        persona_name="AEGIS",
        persona_title="Supreme Commander",
        squads=divisions,
        **shared,
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python3 -m pytest tests/agents/test_aegis.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/divisions/command.py backend/tests/agents/test_aegis.py
git commit -m "feat(army): add AEGIS Supreme Commander

Orchestrates all 5 division Commanders. Can run individual divisions
or full army. Includes get_division_status() for status reporting."
```

---

## Task 8: Army Division Tasks — Celery Integration

**Files:**
- Modify: `backend/app/tasks/army_tasks.py`

Add Celery tasks that invoke each division through AEGIS.

- [ ] **Step 1: Add division tasks to army_tasks.py**

Append after the existing `army_health_check` task in `backend/app/tasks/army_tasks.py`:

```python
# ---------------------------------------------------------------------------
# Division execution tasks
# ---------------------------------------------------------------------------

def _run_division(division: str, task_kwargs: dict | None = None):
    """Run a specific division through AEGIS. Not a Celery task itself."""
    import asyncio

    async def _run():
        sb = _get_supabase()
        r = await _get_redis()
        router = _get_tier_router(r, sb)
        bus = _get_signal_bus(r, sb)

        from app.agents.divisions.command import create_aegis
        aegis = create_aegis(redis=r, supabase=sb, tier_router=router, signal_bus=bus)

        report = await aegis.run_division(division=division, **(task_kwargs or {}))
        await router.close()
        await r.aclose()
        return report.to_dict()

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run())
    finally:
        loop.close()


@celery_app.task(name="army.acquisition.hunt", soft_time_limit=1800, time_limit=3600)
def army_hunt_jobs(sources: list[str] | None = None):
    """Run Acquisition division — job hunting."""
    return _run_division("acquisition", {"sources": sources})


@celery_app.task(name="army.intelligence.enrich", soft_time_limit=1800, time_limit=3600)
def army_enrich_jobs(jobs: list[dict] | None = None):
    """Run Intelligence division — enrichment + companies house."""
    return _run_division("intelligence", {"jobs": jobs or []})


@celery_app.task(name="army.quality.validate", soft_time_limit=1800, time_limit=3600)
def army_validate_jobs(jobs: list[dict] | None = None):
    """Run Quality division — validation + completeness."""
    return _run_division("quality", {"jobs": jobs or []})


@celery_app.task(name="army.operations.maintain", soft_time_limit=1800, time_limit=3600)
def army_maintain():
    """Run Operations division — freshness + orchestrator."""
    return _run_division("operations")


@celery_app.task(name="army.research.discover", soft_time_limit=1800, time_limit=3600)
def army_discover():
    """Run Research division — discovery + improvement."""
    return _run_division("research")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/tasks/army_tasks.py
git commit -m "feat(army): add Celery tasks for division execution via AEGIS

Each division has a dedicated Celery task that routes through AEGIS.
Tasks: army_hunt_jobs, army_enrich_jobs, army_validate_jobs,
army_maintain, army_discover."
```

---

## Task 9: Update Division Exports

**Files:**
- Modify: `backend/app/agents/divisions/__init__.py`
- Modify: `backend/app/agents/__init__.py`

- [ ] **Step 1: Update divisions __init__.py**

```python
# backend/app/agents/divisions/__init__.py
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
```

- [ ] **Step 2: Update agents __init__.py**

Add to `backend/app/agents/__init__.py`:

```python
from .base import BaseAgent, BaseSubAgent, SubAgentResult
from .registry import register_agent, get_agent, list_agents
from .army_types import Role, Division, Priority, AgentReport, TierResult
from .adapters import LegacySquadAdapter
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/agents/divisions/__init__.py backend/app/agents/__init__.py
git commit -m "feat(army): export division factories and army types from packages"
```

---

## Task 10: Final Verification & Phase 2 Tag

- [ ] **Step 1: Run full test suite**

```bash
cd backend && python3 -m pytest tests/agents/ -v --tb=short
```

Expected: All tests pass (Phase 1 tests + Phase 2 tests).

- [ ] **Step 2: Verify all division files exist**

```bash
ls -la backend/app/agents/divisions/*.py backend/app/agents/adapters.py
```

Expected: 7 files (5 divisions + command + __init__) + 1 adapter.

- [ ] **Step 3: Verify AEGIS creates all divisions**

```bash
cd backend && python3 -c "
from app.agents.divisions.command import create_aegis
aegis = create_aegis()
status = aegis.get_division_status()
for div, info in status.items():
    print(f'{div}: {info[\"commander_id\"]} ({info[\"squad_count\"]} squads)')
print(f'Total divisions: {len(status)}')
"
```

Expected:
```
acquisition: acq.cmd (1 squads)
intelligence: int.cmd (2 squads)
quality: qlt.cmd (2 squads)
operations: ops.cmd (2 squads)
research: res.cmd (2 squads)
Total divisions: 5
```

- [ ] **Step 4: Create Phase 2 completion tag**

```bash
git tag army-phase-2-division-reorg
```

---

## Summary

Phase 2 delivers the **division reorganization** of all existing agents:

| Component | Status | Key Features |
|-----------|--------|-------------|
| LegacySquadAdapter | Created | Bridges BaseAgent.run_pipeline() → ArmyAgent.run() |
| Acquisition Division | Created | HunterAgent as alpha squad |
| Intelligence Division | Created | Enrichment (alpha) + Companies House (bravo) |
| Quality Division | Created | Validator (alpha) + Quality (bravo) |
| Operations Division | Created | Freshness (alpha) + Orchestrator (bravo) |
| Research Division | Created | Discovery (alpha) + Improvement (bravo) |
| AEGIS Supreme Commander | Created | Orchestrates all 5 divisions |
| Celery Tasks | Updated | Division-level execution tasks via AEGIS |

**Zero breaking changes.** All existing `BaseAgent` pipelines continue to work. The army structure is additive — existing `agent.*` Celery tasks are unaffected. New `army.*` tasks provide the division-structured entry points.

**Next Phase:** Phase 3 — Add new native ArmyAgent operators (not wrapped legacy) for Intel Immigration Intelligence, expanding from 47 to 100+ agents.
