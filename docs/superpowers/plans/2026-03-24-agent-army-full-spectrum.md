# Agent Army Phase 1: Base Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational framework for the 181-agent army — database tables, ArmyAgent base class, TierRouter with 5-tier LLM routing, SignalBus for lateral intel, and Celery queue routing.

**Architecture:** Military-structured agent hierarchy (Operator → Squad Leader → Commander → Supreme) with a 5-tier self-learning LLM router, Redis Streams for lateral communication, and Supabase for persistence. All new code is backward-compatible with existing `BaseSubAgent`/`BaseAgent` classes and `agent.*` Celery tasks.

**Tech Stack:** Python 3.11, FastAPI, Celery + Redis, Supabase (Postgres), httpx (connection-pooled), Pydantic

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/app/agents/army_types.py` | `Role`, `Division` enums, `AgentReport` dataclass, `TierResult` dataclass |
| `backend/app/agents/army_agent.py` | `ArmyAgent` base class, `SquadLeader`, `Commander` subclasses |
| `backend/app/agents/tier_router.py` | `TierRouter` — 5-tier LLM routing with fallback chains, connection pooling, caching |
| `backend/app/agents/signal_bus.py` | `SignalBus` — Redis Streams lateral intel + Supabase persistence |
| `backend/app/tasks/army_tasks.py` | Army Celery task wrappers and queue routing |
| `supabase/migrations/20260324_army_tables.sql` | 6 army database tables + indexes + RLS policies |
| `tests/agents/test_army_types.py` | Tests for enums, AgentReport, TierResult |
| `tests/agents/test_army_agent.py` | Tests for ArmyAgent, SquadLeader, Commander |
| `tests/agents/test_tier_router.py` | Tests for TierRouter routing logic, fallbacks, caching |
| `tests/agents/test_signal_bus.py` | Tests for SignalBus emit/subscribe/history |
| `tests/agents/test_registry_enhanced.py` | Tests for enhanced registry with division/squad metadata |

### Modified Files
| File | Change |
|------|--------|
| `backend/app/agents/registry.py` | Extend `@register_agent` to accept `division`, `squad`, `role` metadata |
| `backend/app/core/config.py` | Add `openrouter_api_key` and army-specific env vars |
| `backend/app/tasks/celery_app.py` | Add `army.*` queue routing and include `army_tasks` module |
| `backend/requirements.txt` | Add `prometheus_client`, `reportlab` |

---

## Task 1: Database Migration — 6 Army Tables

**Files:**
- Create: `supabase/migrations/20260324_army_tables.sql`

This SQL migration creates all 6 tables the army framework depends on: `army_agents`, `army_missions`, `army_signals`, `army_routing_history`, `army_tier_config`, and `army_division_status`. All have RLS enabled with service-role write and public read (except `army_routing_history` which is service-role only).

- [ ] **Step 1: Create the migration SQL file**

```sql
-- supabase/migrations/20260324_army_tables.sql
-- Agent Army Phase 1: Core tables for the 181-agent military framework

-- 1. army_agents — Agent Registry
CREATE TABLE IF NOT EXISTS army_agents (
    id VARCHAR(50) PRIMARY KEY,
    division VARCHAR(30) NOT NULL,
    squad VARCHAR(30),
    role VARCHAR(30) NOT NULL,
    persona_name VARCHAR(100),
    persona_title VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active',
    default_tier INTEGER DEFAULT 2,
    config JSONB DEFAULT '{}',
    capabilities TEXT[],
    dependencies TEXT[],
    last_heartbeat_at TIMESTAMPTZ,
    total_tasks_completed BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,
    avg_duration_ms INTEGER,
    total_llm_cost_usd FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_agents_division ON army_agents (division, status);
CREATE INDEX IF NOT EXISTS idx_army_agents_squad ON army_agents (division, squad);

-- 2. army_missions — Task Execution Log
CREATE TABLE IF NOT EXISTS army_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL REFERENCES army_agents(id),
    mission_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'normal',
    input JSONB,
    output JSONB,
    tier_requested INTEGER,
    tier_used INTEGER,
    llm_provider VARCHAR(30),
    llm_model VARCHAR(100),
    llm_tokens_in INTEGER,
    llm_tokens_out INTEGER,
    llm_cost_usd FLOAT,
    duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    parent_mission_id UUID,
    division VARCHAR(30),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_missions_agent ON army_missions (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_missions_status ON army_missions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_missions_type ON army_missions (mission_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_missions_division ON army_missions (division, created_at DESC);

-- 3. army_signals — Lateral Intel Channel Log
CREATE TABLE IF NOT EXISTS army_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL,
    publisher_agent_id VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    severity VARCHAR(10) DEFAULT 'info',
    consumed_by TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_signals_channel ON army_signals (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_army_signals_severity ON army_signals (severity, created_at DESC);

-- 4. army_routing_history — Self-Learning Data
CREATE TABLE IF NOT EXISTS army_routing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL,
    tier_used INTEGER NOT NULL,
    input_complexity_score FLOAT,
    result_quality_score FLOAT,
    cost_usd FLOAT,
    latency_ms INTEGER,
    could_downgrade BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_routing_task ON army_routing_history (task_type, created_at DESC);

-- 5. army_tier_config — Current Routing Thresholds
CREATE TABLE IF NOT EXISTS army_tier_config (
    task_type VARCHAR(50) PRIMARY KEY,
    default_tier INTEGER NOT NULL,
    min_tier INTEGER DEFAULT 0,
    max_tier INTEGER DEFAULT 4,
    confidence_count INTEGER DEFAULT 0,
    last_downgrade_attempt TIMESTAMPTZ,
    last_upgrade_at TIMESTAMPTZ,
    avg_quality_at_current_tier FLOAT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. army_division_status — Division Heartbeats
CREATE TABLE IF NOT EXISTS army_division_status (
    division VARCHAR(30) PRIMARY KEY,
    commander_agent_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'operational',
    agents_active INTEGER,
    agents_paused INTEGER,
    agents_error INTEGER,
    missions_last_hour INTEGER,
    errors_last_hour INTEGER,
    avg_latency_ms INTEGER,
    llm_cost_last_hour FLOAT,
    data_processed_last_hour INTEGER,
    heartbeat_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

-- army_agents: public read, service role write
ALTER TABLE army_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read agents" ON army_agents
    FOR SELECT USING (true);
CREATE POLICY "Service role manages agents" ON army_agents
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_missions: public read, service role write
ALTER TABLE army_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read missions" ON army_missions
    FOR SELECT USING (true);
CREATE POLICY "Service role manages missions" ON army_missions
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_signals: public read, service role write
ALTER TABLE army_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read signals" ON army_signals
    FOR SELECT USING (true);
CREATE POLICY "Service role manages signals" ON army_signals
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_routing_history: service role only
ALTER TABLE army_routing_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages routing" ON army_routing_history
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_tier_config: public read, service role write
ALTER TABLE army_tier_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tier config" ON army_tier_config
    FOR SELECT USING (true);
CREATE POLICY "Service role manages tier config" ON army_tier_config
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_division_status: public read, service role write
ALTER TABLE army_division_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read division status" ON army_division_status
    FOR SELECT USING (true);
CREATE POLICY "Service role manages division status" ON army_division_status
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Run the migration against Supabase**

Run the SQL in the Supabase SQL Editor (Dashboard → SQL Editor → paste and run). Alternatively, if using the Supabase CLI:

```bash
cd backend
# If supabase CLI available:
supabase db push
# Otherwise: paste into Supabase Dashboard SQL Editor
```

Expected: All 6 tables created, 9 indexes created, 12 RLS policies created, no errors.

- [ ] **Step 3: Verify tables exist**

Run in Supabase SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'army_%'
ORDER BY table_name;
```

Expected: 6 rows — `army_agents`, `army_division_status`, `army_missions`, `army_routing_history`, `army_signals`, `army_tier_config`.

- [ ] **Step 4: Seed initial tier_config rows**

These are the default routing thresholds for common task types:

```sql
INSERT INTO army_tier_config (task_type, default_tier, min_tier, max_tier) VALUES
    ('spam_check', 1, 0, 2),
    ('title_cleanup', 1, 0, 2),
    ('language_detect', 1, 0, 1),
    ('salary_parse', 0, 0, 0),
    ('url_validate', 0, 0, 0),
    ('dedup_hash', 0, 0, 0),
    ('date_normalize', 0, 0, 0),
    ('keyword_match', 0, 0, 1),
    ('job_enrichment', 2, 1, 3),
    ('soc_classify', 2, 1, 3),
    ('company_match', 2, 1, 3),
    ('sponsorship_analysis', 2, 1, 3),
    ('tech_stack_extract', 2, 1, 3),
    ('work_model_detect', 1, 0, 2),
    ('deep_analysis', 3, 2, 4),
    ('report_generation', 3, 2, 4),
    ('policy_impact', 3, 2, 4),
    ('lawyer_match', 3, 2, 4),
    ('legal_document', 4, 3, 4),
    ('executive_briefing', 4, 3, 4),
    ('multi_doc_synthesis', 4, 3, 4),
    ('general', 2, 0, 4)
ON CONFLICT (task_type) DO NOTHING;
```

- [ ] **Step 5: Seed initial division_status rows**

```sql
INSERT INTO army_division_status (division, status) VALUES
    ('acquisition', 'operational'),
    ('intelligence', 'operational'),
    ('quality', 'operational'),
    ('operations', 'operational'),
    ('research', 'operational'),
    ('command', 'operational')
ON CONFLICT (division) DO NOTHING;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260324_army_tables.sql
git commit -m "feat(army): add 6 army database tables with RLS and seed data

Phase 1 of Operation Full Spectrum. Creates army_agents, army_missions,
army_signals, army_routing_history, army_tier_config, army_division_status
with proper indexes and RLS policies (public read, service_role write)."
```

---

## Task 2: Core Types — Enums, AgentReport, TierResult

**Files:**
- Create: `backend/app/agents/army_types.py`
- Create: `tests/agents/test_army_types.py`

These are the shared data types used by every other army module. `Role` and `Division` enums enforce valid values. `AgentReport` is the standardized result from every agent mission (backward-compatible superset of `SubAgentResult`). `TierResult` wraps LLM call results with cost/tier metadata.

- [ ] **Step 1: Create test directory structure**

```bash
mkdir -p backend/tests/agents
touch backend/tests/__init__.py backend/tests/agents/__init__.py
```

Expected: Two `__init__.py` files created so pytest discovers `tests.agents` as a package.

- [ ] **Step 2: Write the failing tests**

```python
# tests/agents/test_army_types.py
"""Tests for army core types: enums, AgentReport, TierResult."""

import uuid
import pytest
from app.agents.army_types import (
    Role, Division, AgentReport, TierResult, Priority, ALL_DIVISIONS,
)


class TestEnums:
    def test_role_values(self):
        assert Role.OPERATOR == "operator"
        assert Role.SQUAD_LEADER == "squad_leader"
        assert Role.COMMANDER == "commander"
        assert Role.SUPREME == "supreme"

    def test_division_values(self):
        assert Division.ACQUISITION == "acquisition"
        assert Division.INTELLIGENCE == "intelligence"
        assert Division.QUALITY == "quality"
        assert Division.OPERATIONS == "operations"
        assert Division.RESEARCH == "research"
        assert Division.COMMAND == "command"

    def test_priority_values(self):
        assert Priority.CRITICAL == 0
        assert Priority.HIGH == 3
        assert Priority.NORMAL == 6
        assert Priority.LOW == 9


class TestAgentReport:
    def test_create_success_report(self):
        report = AgentReport(
            agent_id="acq.alpha.remotive",
            mission_type="scrape_jobs",
            status="success",
            data={"jobs_found": 42},
            items_processed=100,
            items_created=42,
            items_updated=0,
            errors=[],
            duration_ms=1500,
            tier_used=0,
            llm_calls=0,
            llm_cost_usd=0.0,
            signals_emitted=[],
        )
        assert report.success is True
        assert report.agent_id == "acq.alpha.remotive"
        assert report.mission_id is not None  # auto-generated UUID

    def test_create_failed_report(self):
        report = AgentReport(
            agent_id="acq.alpha.remotive",
            mission_type="scrape_jobs",
            status="failed",
            data={},
            items_processed=0,
            items_created=0,
            items_updated=0,
            errors=["Connection timeout"],
            duration_ms=30000,
            tier_used=0,
            llm_calls=0,
            llm_cost_usd=0.0,
            signals_emitted=[],
        )
        assert report.success is False
        assert report.errors == ["Connection timeout"]

    def test_to_sub_agent_result(self):
        report = AgentReport(
            agent_id="int.hotel.salary_parser",
            mission_type="parse_salary",
            status="success",
            data={"salary_min": 30000},
            items_processed=1,
            items_created=0,
            items_updated=1,
            errors=[],
            duration_ms=50,
            tier_used=0,
            llm_calls=0,
            llm_cost_usd=0.0,
            signals_emitted=[],
        )
        result = report.to_sub_agent_result()
        assert result.success is True
        assert result.data == {"salary_min": 30000}
        assert result.duration_ms == 50

    def test_to_dict(self):
        report = AgentReport(
            agent_id="test.agent",
            mission_type="test",
            status="success",
            data={"key": "val"},
            items_processed=1,
            items_created=1,
            items_updated=0,
            errors=[],
            duration_ms=100,
            tier_used=2,
            llm_calls=1,
            llm_cost_usd=0.001,
            signals_emitted=["stream:new_jobs_batch"],
        )
        d = report.to_dict()
        assert d["agent_id"] == "test.agent"
        assert d["status"] == "success"
        assert isinstance(d["mission_id"], str)


class TestTierResult:
    def test_create_tier_result(self):
        result = TierResult(
            content="This is a spam job posting",
            tier_used=1,
            provider="groq",
            model="llama-3.3-70b-versatile",
            tokens_in=50,
            tokens_out=10,
            cost_usd=0.0001,
            latency_ms=200,
            from_cache=False,
        )
        assert result.content == "This is a spam job posting"
        assert result.tier_used == 1
        assert result.cost_usd == 0.0001

    def test_cached_result(self):
        result = TierResult(
            content="cached response",
            tier_used=2,
            provider="cache",
            model="",
            tokens_in=0,
            tokens_out=0,
            cost_usd=0.0,
            latency_ms=1,
            from_cache=True,
        )
        assert result.from_cache is True
        assert result.cost_usd == 0.0
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/agents/test_army_types.py -v 2>&1 | head -20
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.agents.army_types'`

- [ ] **Step 4: Write the implementation**

```python
# backend/app/agents/army_types.py
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/agents/test_army_types.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/__init__.py backend/tests/agents/__init__.py backend/app/agents/army_types.py tests/agents/test_army_types.py
git commit -m "feat(army): add core types — Role, Division, AgentReport, TierResult

AgentReport is backward-compatible superset of SubAgentResult with
tier routing, cost tracking, and signal emission metadata."
```

---

## Task 3: Enhanced Agent Registry

**Files:**
- Modify: `backend/app/agents/registry.py`
- Create: `tests/agents/test_registry_enhanced.py`

The existing `@register_agent(name)` decorator is extended to accept optional `division`, `squad`, and `role` kwargs. Existing registrations continue to work unchanged. New army agents get division/squad metadata for querying.

- [ ] **Step 1: Write the failing tests**

```python
# tests/agents/test_registry_enhanced.py
"""Tests for the enhanced agent registry with division/squad metadata."""

import pytest
from app.agents.registry import (
    register_agent, get_agent, list_agents,
    get_agents_by_division, get_agent_metadata, _AGENTS, _AGENT_META,
)


class FakeAgent:
    pass


class TestEnhancedRegistry:
    def setup_method(self):
        _AGENTS.clear()
        _AGENT_META.clear()

    def test_register_legacy_agent(self):
        """Existing pattern: @register_agent('name') with no metadata."""
        @register_agent("hunter")
        class HunterAgent:
            pass
        assert get_agent("hunter") is HunterAgent
        assert "hunter" in list_agents()

    def test_register_army_agent(self):
        """New pattern: @register_agent with division/squad/role."""
        @register_agent(
            "acq.alpha.remotive",
            division="acquisition",
            squad="alpha",
            role="operator",
        )
        class RemotiveAgent:
            pass
        assert get_agent("acq.alpha.remotive") is RemotiveAgent
        meta = get_agent_metadata("acq.alpha.remotive")
        assert meta["division"] == "acquisition"
        assert meta["squad"] == "alpha"
        assert meta["role"] == "operator"

    def test_get_agents_by_division(self):
        @register_agent("acq.alpha.a", division="acquisition", squad="alpha", role="operator")
        class A:
            pass
        @register_agent("acq.alpha.b", division="acquisition", squad="alpha", role="operator")
        class B:
            pass
        @register_agent("int.hotel.c", division="intelligence", squad="hotel", role="operator")
        class C:
            pass

        acq = get_agents_by_division("acquisition")
        assert len(acq) == 2
        intel = get_agents_by_division("intelligence")
        assert len(intel) == 1
        assert get_agents_by_division("quality") == []

    def test_legacy_agent_has_no_metadata(self):
        @register_agent("old_agent")
        class OldAgent:
            pass
        meta = get_agent_metadata("old_agent")
        assert meta == {}

    def test_list_agents_includes_all(self):
        @register_agent("legacy")
        class L:
            pass
        @register_agent("acq.echo.reg", division="acquisition", squad="echo", role="operator")
        class N:
            pass
        agents = list_agents()
        assert "legacy" in agents
        assert "acq.echo.reg" in agents
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/agents/test_registry_enhanced.py -v 2>&1 | head -20
```

Expected: FAIL — `ImportError: cannot import name 'get_agents_by_division' from 'app.agents.registry'`

- [ ] **Step 3: Implement the enhanced registry**

Replace `backend/app/agents/registry.py` with:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/agents/test_registry_enhanced.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Verify existing code still imports correctly**

```bash
cd backend && python -c "from app.agents.registry import register_agent, get_agent, list_agents; print('Legacy imports OK')"
```

Expected: `Legacy imports OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/agents/registry.py tests/agents/test_registry_enhanced.py
git commit -m "feat(army): enhance registry with division/squad/role metadata

Backward-compatible: existing @register_agent('name') still works.
New: @register_agent('name', division='...', squad='...', role='...')
adds army metadata. Adds get_agents_by_division() and get_agent_metadata()."
```

---

## Task 4: Config Updates — Army Environment Variables

**Files:**
- Modify: `backend/app/core/config.py`

Add `openrouter_api_key` (T4 fallback) and army-specific model configuration env vars.

- [ ] **Step 1: Add army config fields**

Add below the existing `nvidia_nim_base_url` field in `backend/app/core/config.py`:

```python
    # OpenRouter (for T4 fallback)
    openrouter_api_key: str = ""

    # Army Tier Router model overrides
    army_t1_model: str = "llama-3.1-8b-instant"
    army_t2_model: str = "llama-3.3-70b-versatile"
    army_t3_model: str = "meta/llama-3.1-405b-instruct"
    army_t4_model: str = "claude-haiku-4-5-20251001"
```

- [ ] **Step 2: Verify config loads**

```bash
cd backend && python -c "from app.core.config import get_settings; s = get_settings(); print(f'openrouter_api_key={repr(s.openrouter_api_key)}, t1={s.army_t1_model}')"
```

Expected: `openrouter_api_key='', t1=llama-3.1-8b-instant`

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py
git commit -m "feat(army): add OpenRouter and tier model config env vars

Adds openrouter_api_key for T4 fallback, and army_t1/t2/t3/t4_model
fields for configurable LLM model selection per tier."
```

---

## Task 5: SignalBus — Redis Streams Lateral Intel

**Files:**
- Create: `backend/app/agents/signal_bus.py`
- Create: `tests/agents/test_signal_bus.py`

The SignalBus wraps Redis Streams for cross-division lateral intel. Agents emit signals to named channels (e.g., `stream:new_sponsor`), and subscriber agents receive them. Signals are also persisted to the `army_signals` Supabase table.

- [ ] **Step 1: Write the failing tests**

```python
# tests/agents/test_signal_bus.py
"""Tests for SignalBus — Redis Streams lateral intel."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestSignalBus:
    def _make_bus(self, redis_mock=None, supabase_mock=None):
        from app.agents.signal_bus import SignalBus
        return SignalBus(
            redis=redis_mock or AsyncMock(),
            supabase=supabase_mock or MagicMock(),
        )

    @pytest.mark.asyncio
    async def test_emit_publishes_to_redis_stream(self):
        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234-0")
        redis.publish = AsyncMock()
        sb_mock = MagicMock()
        sb_mock.table.return_value.insert.return_value.execute.return_value = None

        bus = self._make_bus(redis_mock=redis, supabase_mock=sb_mock)
        await bus.emit(
            channel="stream:new_sponsor",
            publisher_id="acq.echo.register",
            payload={"sponsor_id": "abc123"},
            severity="info",
        )

        redis.xadd.assert_called_once()
        call_args = redis.xadd.call_args
        assert call_args[0][0] == "stream:new_sponsor"  # stream name

    @pytest.mark.asyncio
    async def test_emit_persists_to_supabase(self):
        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234-0")
        redis.publish = AsyncMock()
        sb_mock = MagicMock()
        sb_mock.table.return_value.insert.return_value.execute.return_value = None

        bus = self._make_bus(redis_mock=redis, supabase_mock=sb_mock)
        await bus.emit(
            channel="stream:policy_change",
            publisher_id="acq.foxtrot.gov_feeds",
            payload={"title": "New visa rule"},
            severity="high",
        )

        sb_mock.table.assert_called_with("army_signals")
        insert_call = sb_mock.table.return_value.insert.call_args[0][0]
        assert insert_call["channel"] == "stream:policy_change"
        assert insert_call["severity"] == "high"

    @pytest.mark.asyncio
    async def test_emit_publishes_warroom_notification(self):
        redis = AsyncMock()
        redis.xadd = AsyncMock(return_value="1234-0")
        redis.publish = AsyncMock()
        sb_mock = MagicMock()
        sb_mock.table.return_value.insert.return_value.execute.return_value = None

        bus = self._make_bus(redis_mock=redis, supabase_mock=sb_mock)
        await bus.emit(
            channel="stream:source_down",
            publisher_id="ops.romeo.health",
            payload={"source": "indeed"},
            severity="critical",
        )

        redis.publish.assert_called_once()
        pub_args = redis.publish.call_args[0]
        assert pub_args[0] == "warroom:signals"

    @pytest.mark.asyncio
    async def test_get_history(self):
        redis = AsyncMock()
        redis.xrevrange = AsyncMock(return_value=[
            ("1234-0", {b"data": json.dumps({"channel": "test", "payload": {"x": 1}}).encode()}),
            ("1233-0", {b"data": json.dumps({"channel": "test", "payload": {"x": 2}}).encode()}),
        ])

        bus = self._make_bus(redis_mock=redis)
        history = await bus.get_history("stream:test", limit=10)
        assert len(history) == 2
        assert history[0]["payload"]["x"] == 1

    @pytest.mark.asyncio
    async def test_subscribe_creates_consumer_group(self):
        redis = AsyncMock()
        redis.xgroup_create = AsyncMock()
        bus = self._make_bus(redis_mock=redis)
        await bus.subscribe("stream:test", "my_group", "consumer_1")
        redis.xgroup_create.assert_called_once_with(
            "stream:test", "my_group", id="0", mkstream=True,
        )

    @pytest.mark.asyncio
    async def test_subscribe_ignores_existing_group(self):
        redis = AsyncMock()
        redis.xgroup_create = AsyncMock(side_effect=Exception("BUSYGROUP"))
        bus = self._make_bus(redis_mock=redis)
        # Should not raise
        await bus.subscribe("stream:test", "my_group", "consumer_1")

    @pytest.mark.asyncio
    async def test_read_group(self):
        redis = AsyncMock()
        redis.xreadgroup = AsyncMock(return_value=[
            ("stream:test", [
                ("1234-0", {b"data": json.dumps({"channel": "test", "payload": {"a": 1}}).encode()}),
            ]),
        ])
        redis.xack = AsyncMock()

        bus = self._make_bus(redis_mock=redis)
        messages = await bus.read_group("stream:test", "group", "consumer", count=5)
        assert len(messages) == 1
        assert messages[0]["payload"]["a"] == 1
        redis.xack.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/agents/test_signal_bus.py -v 2>&1 | head -20
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.agents.signal_bus'`

- [ ] **Step 3: Write the implementation**

```python
# backend/app/agents/signal_bus.py
"""SignalBus — Redis Streams lateral intel for cross-division communication.

Agents emit signals to named channels (e.g., stream:new_sponsor).
Signals are published to Redis Streams for real-time consumption
and persisted to the army_signals Supabase table for history.
"""

import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Max entries per Redis Stream before trimming
STREAM_MAXLEN = 10_000
WARROOM_MAXLEN = 1_000


class SignalBus:
    def __init__(self, redis, supabase=None):
        self.redis = redis
        self.supabase = supabase

    async def emit(
        self,
        channel: str,
        publisher_id: str,
        payload: dict,
        severity: str = "info",
    ) -> str | None:
        """Publish signal to Redis Stream + persist to army_signals.

        Returns the Redis Stream message ID, or None on failure.
        """
        message = {
            "channel": channel,
            "publisher_id": publisher_id,
            "payload": payload,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        serialized = json.dumps(message)

        stream_id = None
        try:
            # Publish to Redis Stream (the main channel)
            stream_id = await self.redis.xadd(
                channel,
                {"data": serialized},
                maxlen=STREAM_MAXLEN,
            )

            # Publish to War Room pub/sub for real-time dashboard
            await self.redis.publish("warroom:signals", serialized)

        except Exception as e:
            logger.error(f"SignalBus Redis emit failed: {e}")

        # Persist to Supabase for history
        if self.supabase:
            try:
                self.supabase.table("army_signals").insert({
                    "channel": channel,
                    "publisher_agent_id": publisher_id,
                    "payload": payload,
                    "severity": severity,
                }).execute()
            except Exception as e:
                logger.error(f"SignalBus Supabase persist failed: {e}")

        return stream_id

    async def get_history(
        self,
        channel: str,
        limit: int = 100,
    ) -> list[dict]:
        """Read recent signals from a Redis Stream channel."""
        try:
            entries = await self.redis.xrevrange(channel, count=limit)
            results = []
            for _msg_id, fields in entries:
                raw = fields.get(b"data") or fields.get("data")
                if raw:
                    if isinstance(raw, bytes):
                        raw = raw.decode()
                    results.append(json.loads(raw))
            return results
        except Exception as e:
            logger.error(f"SignalBus get_history failed: {e}")
            return []

    async def subscribe(
        self,
        channel: str,
        consumer_group: str,
        consumer_name: str,
    ):
        """Create a consumer group for a Redis Stream.

        Call this once per subscriber to set up the group.
        Actual consumption happens via xreadgroup in the agent's event loop.
        """
        try:
            await self.redis.xgroup_create(
                channel, consumer_group, id="0", mkstream=True,
            )
        except Exception:
            # Group already exists — that's fine
            pass

    async def read_group(
        self,
        channel: str,
        consumer_group: str,
        consumer_name: str,
        count: int = 10,
        block_ms: int = 0,
    ) -> list[dict]:
        """Read new messages from a consumer group.

        Returns parsed signal dicts. Messages are auto-acknowledged.
        """
        try:
            results = await self.redis.xreadgroup(
                consumer_group,
                consumer_name,
                {channel: ">"},
                count=count,
                block=block_ms,
            )
            messages = []
            for _stream, entries in (results or []):
                for msg_id, fields in entries:
                    raw = fields.get(b"data") or fields.get("data")
                    if raw:
                        if isinstance(raw, bytes):
                            raw = raw.decode()
                        messages.append(json.loads(raw))
                    # Auto-acknowledge
                    await self.redis.xack(channel, consumer_group, msg_id)
            return messages
        except Exception as e:
            logger.error(f"SignalBus read_group failed: {e}")
            return []
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/agents/test_signal_bus.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/signal_bus.py tests/agents/test_signal_bus.py
git commit -m "feat(army): add SignalBus for Redis Streams lateral intel

Cross-division communication via named channels (e.g., stream:new_sponsor).
Emits to Redis Streams + persists to army_signals table. Includes consumer
group support for reliable processing and War Room pub/sub notifications."
```

---

## Task 6: TierRouter — 5-Tier LLM Routing Engine

**Files:**
- Create: `backend/app/agents/tier_router.py`
- Create: `tests/agents/test_tier_router.py`

The TierRouter is the core LLM routing engine. It implements: T0 (regex/rules, $0), T1-T4 LLM tiers with different models, fallback chains, connection pooling via shared httpx.AsyncClient instances, Redis caching, and routing history logging.

- [ ] **Step 1: Write the failing tests**

```python
# tests/agents/test_tier_router.py
"""Tests for TierRouter — 5-tier LLM routing with fallbacks and caching."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.army_types import TierResult


class TestTierRouter:
    def _make_router(self, redis_mock=None, supabase_mock=None):
        from app.agents.tier_router import TierRouter
        return TierRouter(
            redis=redis_mock or AsyncMock(),
            supabase=supabase_mock or MagicMock(),
            groq_api_key="test-groq-key",
            nvidia_nim_api_key="test-nvidia-key",
            anthropic_api_key="test-anthropic-key",
            openrouter_api_key="test-openrouter-key",
        )

    def test_t0_salary_parse(self):
        """T0 should handle salary parsing without any LLM call."""
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("salary_parse", "£45,000 - £55,000 per annum", {})
        assert result is not None
        assert "45000" in result or "45,000" in result

    def test_t0_url_validate(self):
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("url_validate", "https://example.com/jobs", {})
        assert result is not None
        assert "valid" in result.lower()

    def test_t0_dedup_hash(self):
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("dedup_hash", "Software Engineer at Acme Corp London", {})
        assert result is not None
        assert len(result) > 0

    def test_t0_returns_none_for_complex_task(self):
        from app.agents.tier_router import T0Engine
        engine = T0Engine()
        result = engine.try_resolve("deep_analysis", "Analyze this policy document...", {})
        assert result is None

    @pytest.mark.asyncio
    async def test_route_uses_cache(self):
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=json.dumps({
            "content": "cached result",
            "tier_used": 2,
            "provider": "cache",
            "model": "",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
            "latency_ms": 1,
            "from_cache": True,
        }).encode())

        router = self._make_router(redis_mock=redis)
        result = await router.route(
            prompt="test prompt",
            task_type="job_enrichment",
            agent_id="test",
            cache_key="test:cache:123",
        )

        assert result.from_cache is True
        assert result.cost_usd == 0.0

    @pytest.mark.asyncio
    async def test_route_t0_task(self):
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)

        router = self._make_router(redis_mock=redis)
        result = await router.route(
            prompt="£30,000 - £40,000",
            task_type="salary_parse",
            agent_id="int.hotel.salary_parser",
        )

        assert result.tier_used == 0
        assert result.cost_usd == 0.0
        assert result.provider == "t0_rules"

    def test_tier_for_task_type(self):
        router = self._make_router()
        assert router._get_default_tier("salary_parse") == 0
        assert router._get_default_tier("spam_check") == 1
        assert router._get_default_tier("job_enrichment") == 2
        assert router._get_default_tier("deep_analysis") == 3
        assert router._get_default_tier("legal_document") == 4
        assert router._get_default_tier("unknown_task") == 2  # default

    def test_fallback_chain(self):
        from app.agents.tier_router import FALLBACK_CHAINS
        assert FALLBACK_CHAINS[4] == ["anthropic", "openrouter", "nvidia_nim"]
        assert FALLBACK_CHAINS[3] == ["nvidia_nim", "openrouter", "groq"]
        assert FALLBACK_CHAINS[2] == ["groq", "nvidia_nim", "openrouter"]
        assert FALLBACK_CHAINS[1] == ["groq", "groq_t2"]

    @pytest.mark.asyncio
    async def test_provider_fallback_on_failure(self):
        """When first provider fails, router tries next in chain."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        router = self._make_router(redis_mock=redis, supabase_mock=sb)

        # Mock _call_provider to fail on first call, succeed on second
        call_count = 0
        original_call = router._call_provider

        async def mock_call(provider, tier, prompt, system, temp, max_tok):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Provider down")
            return TierResult(
                content="fallback result", tier_used=tier, provider=provider,
                model="test", tokens_in=10, tokens_out=5,
                cost_usd=0.001, latency_ms=200, from_cache=False,
            )

        router._call_provider = mock_call
        result = await router.route(
            prompt="test", task_type="job_enrichment", agent_id="test",
        )
        assert call_count == 2  # Tried first, fell back to second
        assert result.content == "fallback result"

    def test_complexity_classification(self):
        """Complexity classifier returns 0-1 score."""
        router = self._make_router()
        # Short prompt -> low complexity
        score = router._classify_complexity("hello", {})
        assert 0.0 <= score <= 1.0
        # Long prompt -> higher complexity
        long_prompt = "Analyze this: " + "word " * 500
        score_long = router._classify_complexity(long_prompt, {})
        assert score_long > score
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/agents/test_tier_router.py -v 2>&1 | head -20
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.agents.tier_router'`

- [ ] **Step 3: Write the implementation**

```python
# backend/app/agents/tier_router.py
"""TierRouter — 5-tier intelligent LLM routing engine.

Routes agent LLM requests through 5 tiers:
  T0: Zero-cost Python rules/regex ($0)
  T1: Groq 8b micro (~$0.0001)
  T2: Groq 70b standard (~$0.001)
  T3: NVIDIA NIM 405b heavy (~$0.01)
  T4: Anthropic/OpenRouter elite (~$0.05)

Features: fallback chains, connection pooling, Redis caching,
routing history logging for self-learning.
"""

import hashlib
import json
import logging
import re
import time
from datetime import datetime, timezone

import httpx

from app.agents.army_types import TierResult

logger = logging.getLogger(__name__)

# Fallback chains: tier -> ordered list of providers to try
FALLBACK_CHAINS = {
    4: ["anthropic", "openrouter", "nvidia_nim"],
    3: ["nvidia_nim", "openrouter", "groq"],
    2: ["groq", "nvidia_nim", "openrouter"],
    1: ["groq", "groq_t2"],  # Falls back to 70b model if 8b unavailable
    0: [],  # T0 never calls LLM
}

# Default task_type -> tier mapping (overridden by army_tier_config table)
DEFAULT_TIER_MAP = {
    "salary_parse": 0, "url_validate": 0, "dedup_hash": 0,
    "date_normalize": 0, "keyword_match": 0,
    "spam_check": 1, "title_cleanup": 1, "language_detect": 1,
    "work_model_detect": 1,
    "job_enrichment": 2, "soc_classify": 2, "company_match": 2,
    "sponsorship_analysis": 2, "tech_stack_extract": 2,
    "deep_analysis": 3, "report_generation": 3, "policy_impact": 3,
    "lawyer_match": 3,
    "legal_document": 4, "executive_briefing": 4,
    "multi_doc_synthesis": 4,
}

# Cost estimates per tier (used for tracking)
TIER_COSTS = {
    0: 0.0,
    1: 0.0001,
    2: 0.001,
    3: 0.01,
    4: 0.05,
}


class T0Engine:
    """Zero-cost rule-based resolution for simple tasks."""

    _SALARY_RE = re.compile(
        r"[£$€]?\s*([\d,]+(?:\.\d+)?)\s*(?:[-–to]+\s*[£$€]?\s*([\d,]+(?:\.\d+)?))?",
        re.IGNORECASE,
    )
    _URL_RE = re.compile(r"^https?://[^\s]+$")

    def try_resolve(self, task_type: str, prompt: str, metadata: dict) -> str | None:
        """Attempt to resolve without LLM. Returns None if can't handle."""
        handler = getattr(self, f"_handle_{task_type}", None)
        if handler:
            return handler(prompt, metadata)
        return None

    def _handle_salary_parse(self, prompt: str, metadata: dict) -> str | None:
        match = self._SALARY_RE.search(prompt)
        if match:
            low = match.group(1).replace(",", "")
            high = match.group(2).replace(",", "") if match.group(2) else low
            return json.dumps({"salary_min": float(low), "salary_max": float(high), "raw": prompt})
        return None

    def _handle_url_validate(self, prompt: str, metadata: dict) -> str | None:
        url = prompt.strip()
        if self._URL_RE.match(url):
            return json.dumps({"url": url, "valid": True})
        return json.dumps({"url": url, "valid": False})

    def _handle_dedup_hash(self, prompt: str, metadata: dict) -> str | None:
        normalized = re.sub(r"\s+", " ", prompt.strip().lower())
        h = hashlib.md5(normalized.encode()).hexdigest()
        return h

    def _handle_date_normalize(self, prompt: str, metadata: dict) -> str | None:
        # Simple ISO date extraction
        iso_match = re.search(r"\d{4}-\d{2}-\d{2}", prompt)
        if iso_match:
            return iso_match.group(0)
        return None

    def _handle_keyword_match(self, prompt: str, metadata: dict) -> str | None:
        keywords = metadata.get("keywords", [])
        if not keywords:
            return None
        text_lower = prompt.lower()
        matches = [kw for kw in keywords if kw.lower() in text_lower]
        return json.dumps({"matches": matches, "count": len(matches)})


class TierRouter:
    """5-tier intelligent LLM routing with fallbacks and connection pooling."""

    def __init__(
        self,
        redis,
        supabase=None,
        groq_api_key: str = "",
        nvidia_nim_api_key: str = "",
        anthropic_api_key: str = "",
        openrouter_api_key: str = "",
        t1_model: str = "llama-3.1-8b-instant",
        t2_model: str = "llama-3.3-70b-versatile",
        t3_model: str = "meta/llama-3.1-405b-instruct",
        t4_model: str = "claude-haiku-4-5-20251001",
    ):
        self.redis = redis
        self.supabase = supabase
        self.t0 = T0Engine()

        self._api_keys = {
            "groq": groq_api_key,
            "nvidia_nim": nvidia_nim_api_key,
            "anthropic": anthropic_api_key,
            "openrouter": openrouter_api_key,
        }
        self._models = {
            "t1": t1_model,
            "t2": t2_model,
            "t3": t3_model,
            "t4": t4_model,
        }

        # Shared connection pools — created once, reused for all calls
        self._clients: dict[str, httpx.AsyncClient] = {}
        self._tier_config_cache: dict[str, dict] = {}

    def _get_client(self, provider: str) -> httpx.AsyncClient:
        """Get or create a shared httpx client for a provider."""
        # groq_t2 reuses the groq client
        lookup = "groq" if provider == "groq_t2" else provider
        if lookup not in self._clients:
            configs = {
                "groq": ("https://api.groq.com", 30, 20, 10),
                "nvidia_nim": ("https://integrate.api.nvidia.com", 60, 10, 5),
                "openrouter": ("https://openrouter.ai", 60, 10, 5),
                "anthropic": ("https://api.anthropic.com", 60, 5, 3),
            }
            base_url, timeout, max_conn, keepalive = configs.get(
                provider, ("", 30, 10, 5)
            )
            self._clients[lookup] = httpx.AsyncClient(
                base_url=base_url,
                timeout=timeout,
                limits=httpx.Limits(
                    max_connections=max_conn,
                    max_keepalive_connections=keepalive,
                ),
            )
        return self._clients[lookup]

    def _get_default_tier(self, task_type: str) -> int:
        """Get default tier for a task type from cache or hardcoded defaults."""
        cached = self._tier_config_cache.get(task_type)
        if cached:
            return cached.get("default_tier", 2)
        return DEFAULT_TIER_MAP.get(task_type, 2)

    def _classify_complexity(self, prompt: str, metadata: dict) -> float:
        """Estimate input complexity on a 0-1 scale.

        Used to adjust tier selection: short/simple prompts may be handled
        at a lower tier. Phase 6 will add self-learning adjustments.
        """
        length = len(prompt)
        if length < 100:
            return 0.1
        elif length < 500:
            return 0.3
        elif length < 2000:
            return 0.5
        elif length < 5000:
            return 0.7
        return 0.9

    async def route(
        self,
        prompt: str,
        system: str = "",
        task_type: str = "general",
        agent_id: str = "",
        tier_hint: int | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        cache_key: str | None = None,
        metadata: dict | None = None,
    ) -> TierResult:
        """Route an LLM request through the appropriate tier.

        Steps:
        1. Check cache
        2. Try T0 (rules/regex)
        3. Determine target tier
        4. Execute with fallback chain
        5. Cache result
        6. Log to routing history
        """
        start = time.time()

        # Step 1: Check cache
        if cache_key:
            cached = await self._check_cache(cache_key)
            if cached:
                return cached

        # Step 2: Try T0
        t0_result = self.t0.try_resolve(task_type, prompt, metadata or {})
        if t0_result is not None:
            result = TierResult(
                content=t0_result,
                tier_used=0,
                provider="t0_rules",
                model="",
                tokens_in=0,
                tokens_out=0,
                cost_usd=0.0,
                latency_ms=int((time.time() - start) * 1000),
                from_cache=False,
            )
            await self._log_routing(task_type, result)
            return result

        # Step 3: Determine target tier
        tier = tier_hint if tier_hint is not None else self._get_default_tier(task_type)
        tier = max(1, min(4, tier))  # Clamp to 1-4 for LLM tiers

        # Step 4: Execute with fallback chain
        chain = FALLBACK_CHAINS.get(tier, ["groq"])
        result = None
        for provider in chain:
            # groq_t2 uses the groq API key
            key_lookup = "groq" if provider == "groq_t2" else provider
            if not self._api_keys.get(key_lookup):
                continue
            try:
                result = await self._call_provider(
                    provider, tier, prompt, system, temperature, max_tokens,
                )
                if result:
                    break
            except Exception as e:
                logger.warning(f"TierRouter: {provider} failed for tier {tier}: {e}")
                continue

        if result is None:
            # All providers failed
            latency = int((time.time() - start) * 1000)
            result = TierResult(
                content="",
                tier_used=tier,
                provider="none",
                model="",
                tokens_in=0,
                tokens_out=0,
                cost_usd=0.0,
                latency_ms=latency,
                from_cache=False,
            )

        result.latency_ms = int((time.time() - start) * 1000)

        # Step 5: Cache result
        if cache_key and result.content:
            await self._set_cache(cache_key, result)

        # Step 6: Log routing
        await self._log_routing(task_type, result)

        return result

    async def _call_provider(
        self,
        provider: str,
        tier: int,
        prompt: str,
        system: str,
        temperature: float,
        max_tokens: int,
    ) -> TierResult | None:
        """Call an LLM provider and return TierResult."""
        client = self._get_client(provider)
        model = self._get_model(provider, tier)

        if provider in ("groq", "groq_t2"):
            if provider == "groq_t2":
                model = self._models["t2"]  # Upgrade to 70b model
            return await self._call_groq(client, model, prompt, system, temperature, max_tokens, tier)
        elif provider == "nvidia_nim":
            return await self._call_nvidia(client, model, prompt, system, temperature, max_tokens, tier)
        elif provider == "anthropic":
            return await self._call_anthropic(client, model, prompt, system, temperature, max_tokens, tier)
        elif provider == "openrouter":
            return await self._call_openrouter(client, model, prompt, system, temperature, max_tokens, tier)
        return None

    def _get_model(self, provider: str, tier: int) -> str:
        """Get the model name for a provider/tier combination."""
        if tier == 1:
            return self._models["t1"]
        elif tier == 2:
            return self._models["t2"]
        elif tier == 3:
            return self._models["t3"]
        elif tier == 4:
            return self._models["t4"]
        return self._models["t2"]  # default

    async def _call_groq(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = await client.post(
            "/openai/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_keys['groq']}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["choices"][0]["message"]["content"],
            tier_used=tier,
            provider="groq",
            model=model,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.001),
            latency_ms=0,
            from_cache=False,
        )

    async def _call_nvidia(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = await client.post(
            "/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_keys['nvidia_nim']}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["choices"][0]["message"]["content"],
            tier_used=tier,
            provider="nvidia_nim",
            model=model,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.01),
            latency_ms=0,
            from_cache=False,
        )

    async def _call_anthropic(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system or "You are a helpful assistant.",
            "messages": [{"role": "user", "content": prompt}],
        }
        r = await client.post(
            "/v1/messages",
            json=body,
            headers={
                "x-api-key": self._api_keys["anthropic"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["content"][0]["text"],
            tier_used=tier,
            provider="anthropic",
            model=model,
            tokens_in=usage.get("input_tokens", 0),
            tokens_out=usage.get("output_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.05),
            latency_ms=0,
            from_cache=False,
        )

    async def _call_openrouter(self, client, model, prompt, system, temperature, max_tokens, tier) -> TierResult:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system or "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = await client.post(
            "/api/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_keys['openrouter']}",
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()
        usage = data.get("usage", {})
        return TierResult(
            content=data["choices"][0]["message"]["content"],
            tier_used=tier,
            provider="openrouter",
            model=model,
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            cost_usd=TIER_COSTS.get(tier, 0.01),
            latency_ms=0,
            from_cache=False,
        )

    async def _check_cache(self, cache_key: str) -> TierResult | None:
        """Check Redis for a cached TierResult."""
        try:
            raw = await self.redis.get(f"army:llm:{cache_key}")
            if raw:
                data = json.loads(raw if isinstance(raw, str) else raw.decode())
                return TierResult(**data)
        except Exception:
            pass
        return None

    async def _set_cache(self, cache_key: str, result: TierResult, ttl: int = 86400):
        """Cache a TierResult in Redis."""
        try:
            data = {
                "content": result.content,
                "tier_used": result.tier_used,
                "provider": "cache",
                "model": result.model,
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
                "latency_ms": 1,
                "from_cache": True,
            }
            await self.redis.set(f"army:llm:{cache_key}", json.dumps(data), ex=ttl)
        except Exception as e:
            logger.debug(f"TierRouter cache set failed: {e}")

    async def _log_routing(self, task_type: str, result: TierResult):
        """Log routing decision to army_routing_history for self-learning."""
        if not self.supabase:
            return
        try:
            self.supabase.table("army_routing_history").insert({
                "task_type": task_type,
                "tier_used": result.tier_used,
                "cost_usd": result.cost_usd,
                "latency_ms": result.latency_ms,
            }).execute()
        except Exception as e:
            logger.debug(f"TierRouter log_routing failed: {e}")

    async def load_tier_config(self):
        """Load tier configuration from Supabase into memory cache."""
        if not self.supabase:
            return
        try:
            result = self.supabase.table("army_tier_config").select("*").execute()
            for row in (result.data or []):
                self._tier_config_cache[row["task_type"]] = row
            logger.info(f"TierRouter loaded {len(self._tier_config_cache)} tier configs")
        except Exception as e:
            logger.warning(f"TierRouter load_tier_config failed: {e}")

    async def close(self):
        """Close all shared HTTP clients. Call on worker shutdown."""
        for client in self._clients.values():
            await client.aclose()
        self._clients.clear()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/agents/test_tier_router.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/tier_router.py tests/agents/test_tier_router.py
git commit -m "feat(army): add TierRouter — 5-tier LLM routing engine

T0 (rules/regex, $0) → T1 (Groq 8b) → T2 (Groq 70b) → T3 (NIM 405b)
→ T4 (Anthropic/OpenRouter). Connection-pooled httpx clients, fallback
chains, Redis caching, and routing history logging for self-learning."
```

---

## Task 7: ArmyAgent Base Class + SquadLeader + Commander

**Files:**
- Create: `backend/app/agents/army_agent.py`
- Create: `tests/agents/test_army_agent.py`

The `ArmyAgent` base class wraps all army functionality: executing missions with automatic reporting, heartbeats, signal emission, and tier-routed LLM calls. `SquadLeader` orchestrates a set of operators. `Commander` orchestrates squads and reports to AEGIS.

- [ ] **Step 1: Write the failing tests**

```python
# tests/agents/test_army_agent.py
"""Tests for ArmyAgent, SquadLeader, Commander base classes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agents.army_types import Division, Role, AgentReport


class TestArmyAgent:
    def _make_agent(self, agent_id="test.agent", division="acquisition", **kwargs):
        from app.agents.army_agent import ArmyAgent

        class ConcreteAgent(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(
                    agent_id=self.agent_id,
                    mission_type="test",
                    status="success",
                    data={"result": "ok"},
                    items_processed=1,
                    items_created=1,
                    duration_ms=50,
                )

        return ConcreteAgent(
            agent_id=agent_id,
            division=division,
            squad=kwargs.get("squad", "alpha"),
            role=kwargs.get("role", Role.OPERATOR),
            persona_name=kwargs.get("persona_name", "Test Agent"),
            persona_title=kwargs.get("persona_title", "Test"),
            default_tier=kwargs.get("default_tier", 2),
            redis=kwargs.get("redis", AsyncMock()),
            supabase=kwargs.get("supabase", MagicMock()),
            tier_router=kwargs.get("tier_router", AsyncMock()),
            signal_bus=kwargs.get("signal_bus", AsyncMock()),
        )

    @pytest.mark.asyncio
    async def test_execute_returns_agent_report(self):
        agent = self._make_agent()
        report = await agent.execute({"test": True})
        assert isinstance(report, AgentReport)
        assert report.status == "success"
        assert report.agent_id == "test.agent"

    @pytest.mark.asyncio
    async def test_execute_logs_mission_to_supabase(self):
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        agent = self._make_agent(supabase=sb)
        await agent.execute({"test": True})

        sb.table.assert_called_with("army_missions")

    @pytest.mark.asyncio
    async def test_execute_catches_errors(self):
        from app.agents.army_agent import ArmyAgent

        class FailAgent(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                raise ValueError("Something broke")

        agent = FailAgent(
            agent_id="fail.agent",
            division="quality",
            squad="mike",
            role=Role.OPERATOR,
            persona_name="Fail",
            persona_title="Fail",
            default_tier=2,
            redis=AsyncMock(),
            supabase=MagicMock(),
            tier_router=AsyncMock(),
            signal_bus=AsyncMock(),
        )
        report = await agent.execute({"test": True})
        assert report.status == "failed"
        assert "Something broke" in report.errors[0]

    @pytest.mark.asyncio
    async def test_heartbeat_updates_redis(self):
        redis = AsyncMock()
        agent = self._make_agent(redis=redis)
        await agent.heartbeat()
        redis.set.assert_called_once()
        call_args = redis.set.call_args
        assert "army:heartbeat:test.agent" in str(call_args)

    @pytest.mark.asyncio
    async def test_emit_signal_delegates_to_bus(self):
        bus = AsyncMock()
        agent = self._make_agent(signal_bus=bus)
        await agent.emit_signal("stream:test", {"data": 1})
        bus.emit.assert_called_once_with(
            channel="stream:test",
            publisher_id="test.agent",
            payload={"data": 1},
            severity="info",
        )

    @pytest.mark.asyncio
    async def test_request_tier_delegates_to_router(self):
        router = AsyncMock()
        from app.agents.army_types import TierResult
        router.route.return_value = TierResult(
            content="result", tier_used=2, provider="groq",
            model="test", tokens_in=10, tokens_out=5,
            cost_usd=0.001, latency_ms=200, from_cache=False,
        )
        agent = self._make_agent(tier_router=router)
        result = await agent.request_tier("Analyze this", "Be helpful", "job_enrichment")
        assert result.content == "result"
        router.route.assert_called_once()

    def test_agent_id_format(self):
        agent = self._make_agent(agent_id="acq.alpha.remotive")
        assert agent.agent_id == "acq.alpha.remotive"
        assert agent.division == "acquisition"


class TestSquadLeader:
    @pytest.mark.asyncio
    async def test_squad_leader_runs_operators(self):
        from app.agents.army_agent import ArmyAgent, SquadLeader
        from app.agents.army_types import TierResult

        class MockOperator(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(
                    agent_id=self.agent_id,
                    mission_type="scrape",
                    status="success",
                    data={"jobs": 10},
                    items_processed=10,
                    items_created=10,
                    duration_ms=100,
                )

        redis = AsyncMock()
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        router = AsyncMock()
        bus = AsyncMock()

        op1 = MockOperator(
            agent_id="acq.alpha.op1", division="acquisition", squad="alpha",
            role=Role.OPERATOR, persona_name="Op1", persona_title="Op1",
            default_tier=0, redis=redis, supabase=sb,
            tier_router=router, signal_bus=bus,
        )
        op2 = MockOperator(
            agent_id="acq.alpha.op2", division="acquisition", squad="alpha",
            role=Role.OPERATOR, persona_name="Op2", persona_title="Op2",
            default_tier=0, redis=redis, supabase=sb,
            tier_router=router, signal_bus=bus,
        )

        leader = SquadLeader(
            agent_id="acq.alpha.leader", division="acquisition", squad="alpha",
            role=Role.SQUAD_LEADER, persona_name="Sgt Alpha", persona_title="Squad Leader",
            default_tier=1, redis=redis, supabase=sb,
            tier_router=router, signal_bus=bus,
            operators=[op1, op2],
        )

        report = await leader.run_squad({"batch": True})
        assert report.status == "success"
        assert report.items_created == 20  # 10 from each operator


class TestCommander:
    @pytest.mark.asyncio
    async def test_commander_runs_squads(self):
        from app.agents.army_agent import ArmyAgent, SquadLeader, Commander

        class MockOperator(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(
                    agent_id=self.agent_id, mission_type="test",
                    status="success", data={"n": 5},
                    items_processed=5, items_created=5,
                    duration_ms=100,
                )

        redis = AsyncMock()
        redis.set = AsyncMock()
        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None
        bus = AsyncMock()
        shared = dict(redis=redis, supabase=sb, tier_router=AsyncMock(), signal_bus=bus)

        op = MockOperator(
            agent_id="acq.alpha.op1", division="acquisition", squad="alpha",
            role=Role.OPERATOR, persona_name="Op", persona_title="Op",
            default_tier=0, **shared,
        )
        leader = SquadLeader(
            agent_id="acq.alpha.leader", division="acquisition", squad="alpha",
            role=Role.SQUAD_LEADER, persona_name="Sgt", persona_title="Sgt",
            default_tier=1, operators=[op], **shared,
        )
        commander = Commander(
            agent_id="acq.commander", division="acquisition", squad="",
            role=Role.COMMANDER, persona_name="Colonel", persona_title="Cmdr",
            default_tier=2, squads={"alpha": leader}, **shared,
        )

        report = await commander.run_division()
        assert report.status == "success"
        assert report.items_created == 5

    @pytest.mark.asyncio
    async def test_commander_reports_to_aegis(self):
        from app.agents.army_agent import Commander

        bus = AsyncMock()
        commander = Commander(
            agent_id="acq.commander", division="acquisition", squad="",
            role=Role.COMMANDER, persona_name="Colonel", persona_title="Cmdr",
            default_tier=2, squads={},
            redis=AsyncMock(), supabase=MagicMock(), tier_router=AsyncMock(),
            signal_bus=bus,
        )
        report = AgentReport(
            agent_id="acq.commander", mission_type="division_acquisition",
            status="success", data={}, items_processed=100, items_created=50,
            llm_cost_usd=0.5,
        )
        await commander.report_to_aegis(report)
        bus.emit.assert_called_once()
        call_args = bus.emit.call_args
        assert call_args[1]["channel"] == "stream:division_report"

    @pytest.mark.asyncio
    async def test_commander_publishes_heartbeat(self):
        from app.agents.army_agent import Commander

        sb = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = None
        commander = Commander(
            agent_id="acq.commander", division="acquisition", squad="",
            role=Role.COMMANDER, persona_name="Colonel", persona_title="Cmdr",
            default_tier=2, squads={},
            redis=AsyncMock(), supabase=sb, tier_router=AsyncMock(),
            signal_bus=AsyncMock(),
        )
        await commander.publish_heartbeat()
        sb.table.assert_called_with("army_division_status")

    @pytest.mark.asyncio
    async def test_listen_signal(self):
        from app.agents.army_agent import ArmyAgent

        class SimpleAgent(ArmyAgent):
            async def run(self, input: dict) -> AgentReport:
                return AgentReport(agent_id=self.agent_id, mission_type="test",
                                   status="success", data={})

        bus = AsyncMock()
        agent = SimpleAgent(
            agent_id="int.hotel.analyst", division="intelligence", squad="hotel",
            role=Role.OPERATOR, persona_name="Analyst", persona_title="Analyst",
            default_tier=2, redis=AsyncMock(), supabase=MagicMock(),
            tier_router=AsyncMock(), signal_bus=bus,
        )
        await agent.listen_signal("stream:new_jobs_batch")
        bus.subscribe.assert_called_once_with(
            "stream:new_jobs_batch", "intelligence_hotel", "int.hotel.analyst",
        )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/agents/test_army_agent.py -v 2>&1 | head -20
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.agents.army_agent'`

- [ ] **Step 3: Write the implementation**

```python
# backend/app/agents/army_agent.py
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
        """Execute a mission with automatic reporting and error handling.

        Subclasses implement run(). This method wraps it with:
        - Timing
        - Error catching
        - Mission logging to army_missions
        - Heartbeat update
        """
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

        # Log mission to Supabase
        await self._log_mission(report, input, started_at)

        # Update heartbeat
        await self.heartbeat()

        return report

    @abstractmethod
    async def run(self, input: dict) -> AgentReport:
        """Implement the agent's core mission logic.

        Must return an AgentReport with mission results.
        """
        ...

    async def heartbeat(self):
        """Send heartbeat to Redis (120s TTL)."""
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
        """Emit a lateral intel signal via the SignalBus."""
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
        """Request an LLM completion through the TierRouter."""
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
        """Subscribe to a lateral intel channel via the SignalBus.

        Sets up a consumer group for the given channel. Use signal_bus.read_group()
        in the agent's event loop to consume messages.
        """
        if not self.signal_bus:
            return
        group = consumer_group or f"{self.division}_{self.squad}"
        await self.signal_bus.subscribe(channel, group, self.agent_id)

    async def escalate(self, message: str):
        """Escalate an issue to the squad leader / commander."""
        await self.emit_signal(
            f"stream:escalation",
            {"agent_id": self.agent_id, "message": message},
            severity="high",
        )

    async def _log_mission(self, report: AgentReport, input: dict, started_at: datetime):
        """Log completed mission to army_missions table."""
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
    """Squad leader that orchestrates a group of operator agents."""

    def __init__(self, operators: list[ArmyAgent] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.operators = operators or []

    async def run(self, input: dict) -> AgentReport:
        """Default: run all operators and aggregate results."""
        return await self.run_squad(input)

    async def run_squad(self, input: dict) -> AgentReport:
        """Execute all operators and aggregate their reports."""
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
        """Assign a specific task to a single operator."""
        return await operator.execute(task)


class Commander(ArmyAgent):
    """Division commander that orchestrates squads."""

    def __init__(self, squads: dict[str, SquadLeader] | None = None, **kwargs):
        super().__init__(**kwargs)
        self.squads = squads or {}

    async def run(self, input: dict) -> AgentReport:
        """Default: run all squads and aggregate results."""
        return await self.run_division(**input)

    async def run_division(self, **kwargs) -> AgentReport:
        """Execute all squads and aggregate their reports."""
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

        # Report to AEGIS
        await self.report_to_aegis(report)

        return report

    async def report_to_aegis(self, report: AgentReport):
        """Send division report to Supreme Command via signal."""
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
        """Publish division-level heartbeat to army_division_status."""
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/agents/test_army_agent.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/army_agent.py tests/agents/test_army_agent.py
git commit -m "feat(army): add ArmyAgent, SquadLeader, Commander base classes

ArmyAgent wraps mission execution with reporting, heartbeats, signal
emission, and tier-routed LLM. SquadLeader orchestrates operators.
Commander orchestrates squads and reports to AEGIS via signals."
```

---

## Task 8: Celery Queue Routing for Army Tasks

**Files:**
- Modify: `backend/app/tasks/celery_app.py`
- Create: `backend/app/tasks/army_tasks.py`

Add army queue routing to Celery config and create the initial army task module with helper functions for creating Supabase/Redis/TierRouter/SignalBus instances.

- [ ] **Step 1: Update celery_app.py task routes**

In `backend/app/tasks/celery_app.py`, add army queue routing to `task_routes` and include the new module:

Change the `include` list to add `"app.tasks.army_tasks"`:
```python
    include=[
        "app.tasks.scraping",
        "app.tasks.agent_tasks",
        "app.tasks.schedule",
        "app.tasks.intel_tasks",
        "app.tasks.army_tasks",
    ],
```

Change the `task_routes` to add army queues:
```python
    task_routes={
        "army.acquisition.*":  {"queue": "army_acquisition"},
        "army.intelligence.*": {"queue": "army_intelligence"},
        "army.quality.*":      {"queue": "army_quality"},
        "army.operations.*":   {"queue": "army_operations"},
        "army.research.*":     {"queue": "army_research"},
        "army.command.*":      {"queue": "army_command"},
        "tasks.*":             {"queue": "default"},
        "agent.*":             {"queue": "agents"},
    },
```

- [ ] **Step 2: Create army_tasks.py with shared helpers**

```python
# backend/app/tasks/army_tasks.py
"""Celery task infrastructure for the Agent Army.

Provides shared helper functions for creating Supabase, Redis, TierRouter,
and SignalBus instances used by all army division tasks. Individual division
tasks will be added in Phase 2+ as agents are migrated.
"""

import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_supabase():
    """Get Supabase service role client for army writes."""
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


async def _get_redis():
    """Get async Redis client."""
    import redis.asyncio as aioredis
    from app.core.config import get_settings
    s = get_settings()
    return aioredis.from_url(s.redis_url, decode_responses=False)


def _get_tier_router(redis, supabase):
    """Create a TierRouter with current settings."""
    from app.agents.tier_router import TierRouter
    from app.core.config import get_settings
    s = get_settings()
    return TierRouter(
        redis=redis,
        supabase=supabase,
        groq_api_key=s.groq_api_key,
        nvidia_nim_api_key=s.nvidia_nim_api_key,
        anthropic_api_key=s.anthropic_api_key or "",
        openrouter_api_key=s.openrouter_api_key,
        t1_model=s.army_t1_model,
        t2_model=s.army_t2_model,
        t3_model=s.army_t3_model,
        t4_model=s.army_t4_model,
    )


def _get_signal_bus(redis, supabase):
    """Create a SignalBus."""
    from app.agents.signal_bus import SignalBus
    return SignalBus(redis=redis, supabase=supabase)


# ---------------------------------------------------------------------------
# Health check task — verifies army infrastructure
# ---------------------------------------------------------------------------

@celery_app.task(name="army.command.health_check", soft_time_limit=30, time_limit=60)
def army_health_check():
    """Verify army infrastructure: tables exist, Redis streams accessible."""
    import asyncio

    async def _check():
        sb = _get_supabase()
        r = await _get_redis()

        checks = {}

        # Check Supabase tables
        for table in ["army_agents", "army_missions", "army_signals",
                       "army_routing_history", "army_tier_config", "army_division_status"]:
            try:
                result = sb.table(table).select("*", count="exact").limit(0).execute()
                checks[table] = {"ok": True, "count": result.count or 0}
            except Exception as e:
                checks[table] = {"ok": False, "error": str(e)}

        # Check Redis
        try:
            await r.ping()
            checks["redis"] = {"ok": True}
        except Exception as e:
            checks["redis"] = {"ok": False, "error": str(e)}

        await r.aclose()

        all_ok = all(c.get("ok") for c in checks.values())
        logger.info(f"[ARMY] Health check: {'PASS' if all_ok else 'FAIL'} — {checks}")
        return {"status": "healthy" if all_ok else "degraded", "checks": checks}

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_check())
    finally:
        loop.close()
```

- [ ] **Step 3: Verify Celery config loads correctly**

```bash
cd backend && python -c "
from app.tasks.celery_app import celery_app
routes = celery_app.conf.task_routes
print('Army routes:')
for k, v in routes.items():
    if 'army' in k:
        print(f'  {k} -> {v}')
print('Include:', celery_app.conf.include)
"
```

Expected: Shows army queue routes and `app.tasks.army_tasks` in include list.

- [ ] **Step 4: Commit**

```bash
git add backend/app/tasks/celery_app.py backend/app/tasks/army_tasks.py
git commit -m "feat(army): add Celery queue routing and army task infrastructure

Six army queues (acquisition, intelligence, quality, operations, research,
command) with task routing. Shared helpers for creating TierRouter, SignalBus,
Supabase, and Redis instances. Health check task verifies army tables."
```

---

## Task 9: Requirements Update

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add new dependencies**

Add to `backend/requirements.txt` (if not already present):

```
prometheus_client
reportlab
```

- [ ] **Step 2: Verify install**

```bash
cd backend && pip install prometheus_client reportlab 2>&1 | tail -5
```

Expected: Successfully installed.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(army): add prometheus_client and reportlab dependencies

prometheus_client for metrics export, reportlab for PDF report generation
(pure Python, no native deps — replaces WeasyPrint)."
```

---

## Task 10: Integration Test — Full Stack Verification

**Files:**
- Create: `tests/agents/test_army_integration.py`

End-to-end test that creates an ArmyAgent, routes through TierRouter, emits a signal via SignalBus, and verifies the full pipeline works together with mocked externals.

- [ ] **Step 1: Write integration test**

```python
# tests/agents/test_army_integration.py
"""Integration test: ArmyAgent + TierRouter + SignalBus working together."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.agents.army_types import Role, AgentReport, TierResult
from app.agents.army_agent import ArmyAgent, SquadLeader
from app.agents.signal_bus import SignalBus
from app.agents.tier_router import TierRouter, T0Engine


class SalaryParserAgent(ArmyAgent):
    """Example T0 agent that parses salaries without LLM."""

    async def run(self, input: dict) -> AgentReport:
        text = input.get("salary_text", "")
        result = await self.request_tier(
            prompt=text,
            task_type="salary_parse",
        )

        if result.content:
            await self.emit_signal(
                "stream:enrichment_complete",
                {"agent_id": self.agent_id, "parsed": result.content},
            )
            return AgentReport(
                agent_id=self.agent_id,
                mission_type="salary_parse",
                status="success",
                data={"parsed": result.content},
                items_processed=1,
                items_created=0,
                items_updated=1,
                tier_used=result.tier_used,
                llm_cost_usd=result.cost_usd,
            )
        return AgentReport(
            agent_id=self.agent_id,
            mission_type="salary_parse",
            status="failed",
            data={},
            errors=["Could not parse salary"],
        )


class TestArmyIntegration:
    @pytest.mark.asyncio
    async def test_t0_agent_full_pipeline(self):
        """Test: Agent → TierRouter (T0) → SignalBus → Mission log."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="123-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None
        sb.table.return_value.upsert.return_value.execute.return_value = None

        router = TierRouter(
            redis=redis, supabase=sb,
            groq_api_key="test", nvidia_nim_api_key="test",
        )
        bus = SignalBus(redis=redis, supabase=sb)

        agent = SalaryParserAgent(
            agent_id="int.hotel.salary_parser",
            division="intelligence",
            squad="hotel",
            role=Role.OPERATOR,
            persona_name="Salary Parser",
            persona_title="Intel Analyst",
            default_tier=0,
            redis=redis,
            supabase=sb,
            tier_router=router,
            signal_bus=bus,
        )

        report = await agent.execute({"salary_text": "£45,000 - £55,000 per annum"})

        # Agent should have used T0 (free)
        assert report.status == "success"
        assert report.tier_used == 0
        assert report.llm_cost_usd == 0.0

        # Signal should have been emitted
        redis.xadd.assert_called()

        # Mission should have been logged
        sb.table.assert_any_call("army_missions")

    @pytest.mark.asyncio
    async def test_squad_leader_aggregates_operators(self):
        """Test: SquadLeader runs multiple operators and aggregates results."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()
        redis.xadd = AsyncMock(return_value="123-0")
        redis.publish = AsyncMock()

        sb = MagicMock()
        sb.table.return_value.insert.return_value.execute.return_value = None

        router = TierRouter(
            redis=redis, supabase=sb,
            groq_api_key="test", nvidia_nim_api_key="test",
        )
        bus = SignalBus(redis=redis, supabase=sb)

        shared = dict(
            division="intelligence", squad="hotel",
            role=Role.OPERATOR, default_tier=0,
            redis=redis, supabase=sb, tier_router=router, signal_bus=bus,
        )

        op1 = SalaryParserAgent(
            agent_id="int.hotel.salary1",
            persona_name="Parser 1", persona_title="Parser",
            **shared,
        )
        op2 = SalaryParserAgent(
            agent_id="int.hotel.salary2",
            persona_name="Parser 2", persona_title="Parser",
            **shared,
        )

        leader = SquadLeader(
            agent_id="int.hotel.leader",
            division="intelligence", squad="hotel",
            role=Role.SQUAD_LEADER,
            persona_name="Sgt. Analyst", persona_title="Squad Leader",
            default_tier=1,
            redis=redis, supabase=sb, tier_router=router, signal_bus=bus,
            operators=[op1, op2],
        )

        report = await leader.run_squad({
            "salary_text": "£30,000 - £40,000",
        })

        assert report.status == "success"
        assert report.items_updated == 2  # Both operators updated 1 each
        assert report.llm_cost_usd == 0.0  # All T0
```

- [ ] **Step 2: Run the integration test**

```bash
cd backend && python -m pytest tests/agents/test_army_integration.py -v
```

Expected: All tests PASS.

- [ ] **Step 3: Run all army tests together**

```bash
cd backend && python -m pytest tests/agents/test_army_*.py tests/agents/test_registry_enhanced.py -v
```

Expected: All tests PASS (should be ~25+ tests across 5 test files).

- [ ] **Step 4: Commit**

```bash
git add tests/agents/test_army_integration.py
git commit -m "test(army): add integration tests for full agent pipeline

Verifies ArmyAgent → TierRouter (T0) → SignalBus → Mission log pipeline.
Tests SquadLeader aggregation of multiple operators. All mocked externals."
```

---

## Task 11: Register Base Framework in Agent Registry

**Files:**
- Create: `backend/app/agents/army_init.py`

A module that registers the base framework components and provides a factory function for creating army infrastructure (TierRouter + SignalBus + Redis).

- [ ] **Step 1: Write the army init module**

```python
# backend/app/agents/army_init.py
"""Army framework initialization.

Provides create_army_infra() to set up TierRouter, SignalBus, and Redis
for use by army agents. Called once per Celery worker or API server.
"""

import logging
from app.core.config import get_settings

logger = logging.getLogger(__name__)

_infra = None


class ArmyInfra:
    """Container for shared army infrastructure."""
    def __init__(self, redis, supabase, tier_router, signal_bus):
        self.redis = redis
        self.supabase = supabase
        self.tier_router = tier_router
        self.signal_bus = signal_bus


async def create_army_infra() -> ArmyInfra:
    """Create and return shared army infrastructure.

    Call once per process. Returns an ArmyInfra with:
    - redis: async Redis client
    - supabase: service role client
    - tier_router: TierRouter with connection pools
    - signal_bus: SignalBus with Redis + Supabase
    """
    global _infra
    if _infra:
        return _infra

    import redis.asyncio as aioredis
    from supabase import create_client
    from app.agents.tier_router import TierRouter
    from app.agents.signal_bus import SignalBus

    s = get_settings()

    r = aioredis.from_url(s.redis_url, decode_responses=False)
    sb = create_client(s.supabase_url, s.supabase_service_key)

    router = TierRouter(
        redis=r,
        supabase=sb,
        groq_api_key=s.groq_api_key,
        nvidia_nim_api_key=s.nvidia_nim_api_key,
        anthropic_api_key=s.anthropic_api_key or "",
        openrouter_api_key=s.openrouter_api_key,
        t1_model=s.army_t1_model,
        t2_model=s.army_t2_model,
        t3_model=s.army_t3_model,
        t4_model=s.army_t4_model,
    )

    # Load tier config from Supabase
    await router.load_tier_config()

    bus = SignalBus(redis=r, supabase=sb)

    _infra = ArmyInfra(
        redis=r, supabase=sb, tier_router=router, signal_bus=bus,
    )
    logger.info("[ARMY] Infrastructure initialized: TierRouter, SignalBus, Redis")
    return _infra


async def shutdown_army_infra():
    """Clean up army infrastructure. Call on worker/server shutdown."""
    global _infra
    if _infra:
        await _infra.tier_router.close()
        await _infra.redis.aclose()
        _infra = None
        logger.info("[ARMY] Infrastructure shut down")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/agents/army_init.py
git commit -m "feat(army): add army infrastructure factory

create_army_infra() sets up shared TierRouter + SignalBus + Redis.
Called once per process, returns ArmyInfra container. Includes
shutdown_army_infra() for clean connection pool cleanup."
```

---

## Task 12: Final Verification & Phase 1 Complete Commit

- [ ] **Step 1: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

Expected: All tests pass, no regressions.

- [ ] **Step 2: Verify all new files exist**

```bash
ls -la backend/app/agents/army_*.py backend/app/agents/signal_bus.py backend/app/agents/tier_router.py backend/app/tasks/army_tasks.py supabase/migrations/20260324_army_tables.sql
```

Expected: All 6 new files listed.

- [ ] **Step 3: Verify imports work end-to-end**

```bash
cd backend && python -c "
from app.agents.army_types import Role, Division, Priority, AgentReport, TierResult
from app.agents.army_agent import ArmyAgent, SquadLeader, Commander
from app.agents.tier_router import TierRouter, T0Engine, FALLBACK_CHAINS
from app.agents.signal_bus import SignalBus
from app.agents.registry import register_agent, get_agents_by_division
from app.agents.army_init import create_army_infra, shutdown_army_infra
print('All army imports OK')
print(f'Roles: {Role.OPERATOR}, {Role.SQUAD_LEADER}, {Role.COMMANDER}, {Role.SUPREME}')
print(f'Divisions: {Division.ALL}')
print(f'Priorities: CRITICAL={Priority.CRITICAL}, HIGH={Priority.HIGH}, NORMAL={Priority.NORMAL}, LOW={Priority.LOW}')
print(f'Fallback chains: {FALLBACK_CHAINS}')
"
```

Expected: All imports succeed, prints enum values and fallback chains.

- [ ] **Step 4: Create Phase 1 completion tag**

```bash
git tag army-phase-1-base-framework
```

---

## Summary

Phase 1 delivers the **complete foundation** for the 181-agent army:

| Component | Status | Key Features |
|-----------|--------|-------------|
| Database (6 tables) | Created | army_agents, army_missions, army_signals, army_routing_history, army_tier_config, army_division_status |
| Core Types | Created | Role, Division, Priority enums; AgentReport (backward-compat with SubAgentResult); TierResult |
| Enhanced Registry | Modified | Supports division/squad/role metadata; get_agents_by_division() |
| TierRouter | Created | 5-tier routing, T0 rules engine, fallback chains, connection pooling, caching |
| SignalBus | Created | Redis Streams lateral intel, Supabase persistence, consumer groups |
| ArmyAgent | Created | Base class with mission execution, heartbeats, signals, tier routing |
| SquadLeader | Created | Operator orchestration and aggregation |
| Commander | Created | Squad orchestration, division heartbeats, AEGIS reporting |
| Celery Routing | Modified | 6 army queues with task routing |
| Army Init | Created | Factory for shared infrastructure (one-time per process) |

**Next Phase:** Phase 2 — Reorganize existing 9 agents into the new division structure.
