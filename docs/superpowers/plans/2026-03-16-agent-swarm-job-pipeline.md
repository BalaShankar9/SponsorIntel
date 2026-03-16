# Agent Swarm Job Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an intelligent agent swarm that scrapes jobs from 23 sources, validates, enriches with sponsorship scoring, and serves real-time data across the entire SponsorIntel frontend.

**Architecture:** Six main agents (Hunter, Validator, Enrichment, Freshness, Quality, Orchestrator) with 103 sub-agents running on Railway via Celery workers. Ollama (phi-3-mini) provides LLM intelligence for 22 sub-agents. All data stored in Supabase PostgreSQL, frontend on Vercel reads via Supabase JS client.

**Tech Stack:** Python 3.11, FastAPI, Celery + Redis, SQLAlchemy (async), Ollama, Playwright, httpx, Next.js 14, Supabase, Railway

**Spec:** `docs/superpowers/specs/2026-03-16-agent-swarm-job-pipeline-design.md`

---

## Phase 1: Core Infrastructure

Foundation that all agents depend on. Must complete first.

### Task 1.1: Database Migrations — New Tables

**Files:**
- Create: `backend/alembic/versions/002_add_swarm_tables.py`

- [ ] **Step 1: Create migration file for 9 new tables**

```python
"""Add swarm operational tables

Revision ID: 002_swarm_tables
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

def upgrade():
    # swarm_metrics
    op.create_table('swarm_metrics',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('run_id', UUID),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('duration_seconds', sa.Integer),
        sa.Column('jobs_scraped', sa.Integer, server_default='0'),
        sa.Column('jobs_validated', sa.Integer, server_default='0'),
        sa.Column('jobs_enriched', sa.Integer, server_default='0'),
        sa.Column('jobs_expired', sa.Integer, server_default='0'),
        sa.Column('errors_total', sa.Integer, server_default='0'),
        sa.Column('errors_by_source', JSONB, server_default='{}'),
        sa.Column('completeness_avg', sa.Float),
        sa.Column('sponsorship_scored_count', sa.Integer, server_default='0'),
        sa.Column('llm_calls_count', sa.Integer, server_default='0'),
        sa.Column('llm_avg_latency_ms', sa.Float),
    )
    op.create_index('idx_swarm_metrics_date', 'swarm_metrics', ['started_at'])

    # swarm_alerts
    op.create_table('swarm_alerts',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('alert_type', sa.String(50)),
        sa.Column('source', sa.String(50)),
        sa.Column('severity', sa.String(20)),
        sa.Column('message', sa.Text),
        sa.Column('metrics', JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('acknowledged', sa.Boolean, server_default='false'),
    )
    op.create_index('idx_swarm_alerts_type', 'swarm_alerts', ['alert_type', 'created_at'])

    # swarm_reports
    op.create_table('swarm_reports',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('report_date', sa.Date),
        sa.Column('report_type', sa.String(20)),
        sa.Column('content', sa.Text),
        sa.Column('metrics_snapshot', JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # swarm_errors
    op.create_table('swarm_errors',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('task_name', sa.String(200)),
        sa.Column('agent', sa.String(50)),
        sa.Column('sub_agent', sa.String(100)),
        sa.Column('error_type', sa.String(100)),
        sa.Column('error_message', sa.Text),
        sa.Column('traceback', sa.Text),
        sa.Column('retry_count', sa.Integer, server_default='0'),
        sa.Column('resolved', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_swarm_errors_created', 'swarm_errors', ['created_at'])
    op.create_index('idx_swarm_errors_agent', 'swarm_errors', ['agent'])

    # source_health_log
    op.create_table('source_health_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('source', sa.String(50)),
        sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('jobs_returned', sa.Integer),
        sa.Column('success_rate', sa.Float),
        sa.Column('avg_completeness', sa.Float),
        sa.Column('avg_response_time_ms', sa.Float),
        sa.Column('error_count', sa.Integer),
        sa.Column('is_paused', sa.Boolean, server_default='false'),
    )
    op.create_index('idx_source_health_source', 'source_health_log', ['source', 'logged_at'])

    # job_validation_log
    op.create_table('job_validation_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID),
        sa.Column('field', sa.String(100)),
        sa.Column('source_a', sa.String(50)),
        sa.Column('value_a', sa.Text),
        sa.Column('source_b', sa.String(50)),
        sa.Column('value_b', sa.Text),
        sa.Column('resolution', sa.Text),
        sa.Column('reason', sa.String(500)),
        sa.Column('resolved_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_jvl_job', 'job_validation_log', ['job_id'])
    op.create_index('idx_jvl_date', 'job_validation_log', ['resolved_at'])

    # job_change_log
    op.create_table('job_change_log',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID),
        sa.Column('field', sa.String(100)),
        sa.Column('old_value', sa.Text),
        sa.Column('new_value', sa.Text),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('idx_jcl_job', 'job_change_log', ['job_id'])
    op.create_index('idx_jcl_date', 'job_change_log', ['detected_at'])

    # sponsor_hiring_patterns
    op.create_table('sponsor_hiring_patterns',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('sponsor_id', UUID),
        sa.Column('year_month', sa.String(7)),
        sa.Column('job_count', sa.Integer),
        sa.Column('avg_salary', sa.Float),
        sa.Column('top_role', sa.String(500)),
        sa.UniqueConstraint('sponsor_id', 'year_month'),
    )

    # market_velocity
    op.create_table('market_velocity',
        sa.Column('id', UUID, primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('industry', sa.String(200)),
        sa.Column('location_city', sa.String(200)),
        sa.Column('measured_at', sa.Date),
        sa.Column('avg_days_to_fill', sa.Float),
        sa.Column('new_postings_per_week', sa.Float),
        sa.Column('churn_rate', sa.Float),
        sa.UniqueConstraint('industry', 'location_city', 'measured_at'),
    )

def downgrade():
    for t in ['market_velocity', 'sponsor_hiring_patterns', 'job_change_log',
              'job_validation_log', 'source_health_log', 'swarm_errors',
              'swarm_reports', 'swarm_alerts', 'swarm_metrics']:
        op.drop_table(t)
```

- [ ] **Step 2: Run migration against Supabase**

Run via node (since psql isn't available locally):
```bash
cd frontend && node -e "
const { Client } = require('pg');
const c = new Client({host:'aws-1-eu-west-2.pooler.supabase.com',port:5432,user:'postgres.aqhvuwrgfsfkqngnjjvh',password:'Shadow@Sairam987',database:'postgres',ssl:{rejectUnauthorized:false}});
c.connect().then(async () => {
  // Execute each CREATE TABLE statement
  await c.query('CREATE TABLE IF NOT EXISTS swarm_metrics (...)');
  // ... (all tables)
  console.log('Done');
  c.end();
});
"
```

Alternatively, run directly via Supabase SQL editor in the dashboard.

- [ ] **Step 3: Commit**
```bash
git add backend/alembic/versions/002_add_swarm_tables.py
git commit -m "feat: add swarm operational tables migration"
```

---

### Task 1.2: Database Migrations — Job Table Extensions

**Files:**
- Create: `backend/alembic/versions/003_add_job_columns.py`

- [ ] **Step 1: Create migration for new job columns**

Add 17 new columns to the jobs table + 3 to company_profiles:
```python
def upgrade():
    # Jobs table extensions
    op.add_column('jobs', sa.Column('data_quality_score', sa.Integer))
    op.add_column('jobs', sa.Column('is_flagged', sa.Boolean, server_default='false'))
    op.add_column('jobs', sa.Column('flag_reason', sa.String(50)))
    op.add_column('jobs', sa.Column('repost_of_job_id', UUID))
    op.add_column('jobs', sa.Column('repost_count', sa.Integer, server_default='0'))
    op.add_column('jobs', sa.Column('closing_signal', sa.Boolean, server_default='false'))
    op.add_column('jobs', sa.Column('work_model', sa.String(20)))
    op.add_column('jobs', sa.Column('salary_estimated_min', sa.Float))
    op.add_column('jobs', sa.Column('salary_estimated_max', sa.Float))
    op.add_column('jobs', sa.Column('salary_is_estimated', sa.Boolean, server_default='false'))
    op.add_column('jobs', sa.Column('salary_percentile', sa.Float))
    op.add_column('jobs', sa.Column('salary_vs_threshold', sa.String(20)))
    op.add_column('jobs', sa.Column('visa_routes_eligible', sa.ARRAY(sa.Text)))
    op.add_column('jobs', sa.Column('department', sa.String(100)))
    op.add_column('jobs', sa.Column('benefits', JSONB))
    op.add_column('jobs', sa.Column('red_flags', JSONB))
    op.add_column('jobs', sa.Column('culture_signals', JSONB))
    op.add_column('jobs', sa.Column('education_required', JSONB))
    op.add_column('jobs', sa.Column('certifications_required', sa.ARRAY(sa.Text)))
    op.add_column('jobs', sa.Column('languages_required', sa.ARRAY(sa.Text)))
    op.add_column('jobs', sa.Column('source_urls', sa.ARRAY(sa.Text)))

    # Indexes
    op.create_index('idx_jobs_quality', 'jobs', ['data_quality_score'])
    op.create_index('idx_jobs_work_model', 'jobs', ['work_model'])
    op.create_index('idx_jobs_department', 'jobs', ['department'])

    # Company profiles extensions
    op.add_column('company_profiles', sa.Column('name_variants', JSONB))
    op.add_column('company_profiles', sa.Column('careers_page_url', sa.String(2000)))
    op.add_column('company_profiles', sa.Column('has_careers_page', sa.Boolean))
```

- [ ] **Step 2: Run migration against Supabase**
- [ ] **Step 3: Add RLS policies for new tables**

```sql
-- Enable RLS on all new tables
ALTER TABLE swarm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_alerts ENABLE ROW LEVEL SECURITY;
-- ... (all new tables)

-- Public tables: anon select
CREATE POLICY anon_select ON sponsor_hiring_patterns FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON market_velocity FOR SELECT TO anon USING (true);

-- jobs table already has RLS — verify policy covers new columns
```

- [ ] **Step 4: Commit**

---

### Task 1.3: Base Agent Framework

**Files:**
- Create: `backend/app/agents/__init__.py`
- Create: `backend/app/agents/base.py`
- Create: `backend/app/agents/registry.py`

- [ ] **Step 1: Create base agent and sub-agent abstract classes**

```python
# backend/app/agents/base.py
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
```

- [ ] **Step 2: Create agent registry**

```python
# backend/app/agents/registry.py
"""Registry for all agents and their sub-agents."""

_AGENTS: dict[str, type] = {}


def register_agent(name: str):
    """Decorator to register an agent class."""
    def decorator(cls):
        _AGENTS[name] = cls
        return cls
    return decorator


def get_agent(name: str):
    """Get agent class by name."""
    return _AGENTS.get(name)


def list_agents() -> list[str]:
    return list(_AGENTS.keys())
```

- [ ] **Step 3: Create __init__.py**

```python
# backend/app/agents/__init__.py
from .base import BaseAgent, BaseSubAgent, SubAgentResult
from .registry import register_agent, get_agent, list_agents
```

- [ ] **Step 4: Commit**
```bash
git add backend/app/agents/
git commit -m "feat: base agent framework with BaseAgent, BaseSubAgent, registry"
```

---

### Task 1.4: LLM Service (Ollama Integration)

**Files:**
- Create: `backend/app/agents/llm_service.py`

- [ ] **Step 1: Implement unified LLM service with Ollama + fallback**

```python
# backend/app/agents/llm_service.py
"""Unified LLM service supporting Ollama, Anthropic, and disabled modes."""

import json
import hashlib
import logging
import httpx
from typing import Any

logger = logging.getLogger(__name__)


class LLMService:
    """Interface to Ollama with caching, batching, and fallback."""

    def __init__(
        self,
        backend: str = "ollama",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:mini",
        anthropic_key: str | None = None,
        redis=None,
    ):
        self.backend = backend
        self.ollama_url = ollama_url
        self.ollama_model = ollama_model
        self.anthropic_key = anthropic_key
        self.redis = redis
        self._healthy = True
        self._consecutive_failures = 0

    async def health_check(self) -> bool:
        """Check if LLM backend is available."""
        if self.backend == "disabled":
            return False
        if self.backend == "ollama":
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    r = await client.get(f"{self.ollama_url}/api/tags")
                    self._healthy = r.status_code == 200
                    if self._healthy:
                        self._consecutive_failures = 0
                    return self._healthy
            except Exception:
                self._consecutive_failures += 1
                if self._consecutive_failures >= 3 and self.anthropic_key:
                    logger.warning("Ollama unhealthy 3x, switching to Anthropic")
                    self.backend = "anthropic"
                self._healthy = False
                return False
        if self.backend == "anthropic":
            return bool(self.anthropic_key)
        return False

    async def complete(
        self,
        prompt: str,
        system: str = "",
        cache_key: str | None = None,
        timeout: int = 30,
    ) -> str | None:
        """Single completion with caching and retry."""
        if self.backend == "disabled":
            return None

        # Check cache
        if cache_key and self.redis:
            cached = await self.redis.get(f"llm:{cache_key}")
            if cached:
                return cached.decode() if isinstance(cached, bytes) else cached

        result = None
        try:
            if self.backend == "ollama":
                result = await self._ollama_complete(prompt, system, timeout)
            elif self.backend == "anthropic":
                result = await self._anthropic_complete(prompt, system, timeout)
        except Exception as e:
            logger.error(f"LLM completion failed: {e}")
            self._consecutive_failures += 1
            return None

        # Cache result
        if result and cache_key and self.redis:
            await self.redis.set(f"llm:{cache_key}", result, ex=86400 * 30)

        return result

    async def batch_complete(
        self,
        prompts: list[str],
        system: str = "",
        max_concurrent: int = 2,
    ) -> list[str | None]:
        """Process multiple prompts with concurrency limit."""
        import asyncio
        semaphore = asyncio.Semaphore(max_concurrent)
        async def _one(p):
            async with semaphore:
                return await self.complete(p, system)
        return await asyncio.gather(*[_one(p) for p in prompts])

    async def structured_output(
        self,
        prompt: str,
        system: str = "Respond with valid JSON only. No markdown.",
    ) -> dict | list | None:
        """Parse LLM output as JSON with retry on failure."""
        for attempt in range(2):
            raw = await self.complete(prompt, system)
            if not raw:
                return None
            try:
                # Strip markdown code fences if present
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
                return json.loads(cleaned)
            except json.JSONDecodeError:
                if attempt == 0:
                    continue
                logger.warning(f"Failed to parse JSON from LLM: {raw[:200]}")
                return None

    async def _ollama_complete(self, prompt: str, system: str, timeout: int) -> str:
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": self.ollama_model,
                "prompt": prompt,
                "system": system,
                "stream": False,
            }
            r = await client.post(f"{self.ollama_url}/api/generate", json=body)
            r.raise_for_status()
            return r.json()["response"]

    async def _anthropic_complete(self, prompt: str, system: str, timeout: int) -> str:
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 1024,
                "system": system or "You are a helpful assistant.",
                "messages": [{"role": "user", "content": prompt}],
            }
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=body,
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"]

    @staticmethod
    def cache_key_for(prefix: str, text: str) -> str:
        """Generate a stable cache key."""
        h = hashlib.md5(text.encode()).hexdigest()[:12]
        return f"{prefix}:{h}"
```

- [ ] **Step 2: Commit**
```bash
git add backend/app/agents/llm_service.py
git commit -m "feat: LLM service with Ollama, Anthropic fallback, caching"
```

---

### Task 1.5: Update Config for Agent Swarm

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add agent swarm settings**

Add to the Settings class:
```python
# Agent Swarm / LLM
llm_backend: str = "ollama"  # ollama | anthropic | openai | disabled
ollama_base_url: str = "http://localhost:11434"
ollama_model: str = "phi3:mini"
anthropic_api_key: str | None = None

# Supabase (for direct DB access from Railway)
supabase_url: str | None = None
supabase_service_key: str | None = None
```

- [ ] **Step 2: Commit**

---

### Task 1.6: Railway Deployment Configuration

**Files:**
- Create: `backend/railway.json`
- Create: `backend/Procfile`
- Create: `backend/supervisord.conf`
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Create supervisord config for multi-process Railway**

```ini
# backend/supervisord.conf
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0

[program:web]
command=uvicorn app.main:app --host 0.0.0.0 --port %(ENV_PORT)s
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:worker]
command=celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4 --max-memory-per-child=400000
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:beat]
command=celery -A app.tasks.celery_app beat --loglevel=info
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

- [ ] **Step 2: Update Dockerfile for Railway**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright browsers (for browser-tier scrapers)
RUN playwright install chromium --with-deps

# App code
COPY . .

# Supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

- [ ] **Step 3: Create railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- [ ] **Step 4: Commit**
```bash
git add backend/supervisord.conf backend/railway.json backend/Dockerfile
git commit -m "feat: Railway deployment with supervisord multi-process"
```

---

## Phase 2: HunterAgent + Free API Scrapers (Get Jobs Flowing)

The most critical phase — gets real jobs into the database immediately.

### Task 2.1: HunterAgent Main Class

**Files:**
- Create: `backend/app/agents/hunter/__init__.py`
- Create: `backend/app/agents/hunter/agent.py`

- [ ] **Step 1: Implement HunterAgent**

```python
# backend/app/agents/hunter/agent.py
"""HunterAgent — Discovery & Acquisition of job listings."""

import logging
from app.agents.base import BaseAgent
from app.agents.registry import register_agent

logger = logging.getLogger(__name__)


@register_agent("hunter")
class HunterAgent(BaseAgent):
    name = "hunter"
    description = "Discovers and acquires job listings from 23 sources"

    def _register_sub_agents(self):
        # Import and register sub-agents
        from .free_api_hunter import FreeAPIHunter
        from .source_selector import SourceSelector
        from .search_prioritiser import SearchPrioritiser

        self.register(FreeAPIHunter())
        self.register(SourceSelector())
        self.register(SearchPrioritiser())
        # More sub-agents registered as they're built

    async def run_pipeline(self, sources: list[str] | None = None, **kwargs) -> dict:
        """Run the hunting pipeline for specified sources."""
        results = {"jobs_found": 0, "errors": [], "sources_scraped": []}

        # Determine which sources to scrape
        selector = self.get_sub_agent("source_selector")
        if not sources:
            sources = (await selector.execute()).data or ["free_apis"]

        # Run free API hunter
        if "free_apis" in sources or any(s in sources for s in [
            "remotive", "arbeitnow", "jobicy", "themuse", "himalayas",
            "remoteok", "wwr", "devitjobs", "hn_hiring"
        ]):
            hunter = self.get_sub_agent("free_api_hunter")
            result = await hunter.execute(keywords=kwargs.get("keywords"))
            if result.success:
                results["jobs_found"] += len(result.data or [])
                results["sources_scraped"].append("free_apis")
            else:
                results["errors"].append(f"free_apis: {result.error}")

        return results
```

- [ ] **Step 2: Commit**

---

### Task 2.2: FreeAPIHunter — 11 Zero-Auth Sources

**Files:**
- Create: `backend/app/agents/hunter/free_api_hunter.py`

- [ ] **Step 1: Implement FreeAPIHunter that wraps all 11 free API scrapers**

```python
# backend/app/agents/hunter/free_api_hunter.py
"""FreeAPIHunter — Wraps all 11 zero-auth API scrapers and runs them concurrently."""

import asyncio
import logging
from app.agents.base import BaseSubAgent
from app.scrapers.remotive_api import RemotiveAPIScraper
from app.scrapers.arbeitnow_api import ArbeitnowAPIScraper
from app.scrapers.jobicy_api import JobicyAPIScraper
from app.scrapers.themuse_api import TheMuseAPIScraper
from app.scrapers.himalayas_api import HimalayasAPIScraper
from app.scrapers.remoteok_api import RemoteOKAPIScraper
from app.scrapers.wwr_rss import WWRRSSScraper
from app.scrapers.devitjobs_api import DevITJobsAPIScraper
from app.scrapers.hn_hiring_api import HNHiringAPIScraper

logger = logging.getLogger(__name__)

DEFAULT_KEYWORDS = [
    "software engineer", "data analyst", "project manager",
    "registered nurse", "accountant", "teacher",
    "marketing manager", "mechanical engineer",
    "financial analyst", "civil engineer",
]


class FreeAPIHunter(BaseSubAgent):
    name = "free_api_hunter"
    agent_type = "DET"
    description = "Runs all 11 zero-auth API scrapers concurrently"

    SCRAPERS = [
        RemotiveAPIScraper,
        ArbeitnowAPIScraper,
        JobicyAPIScraper,
        TheMuseAPIScraper,
        HimalayasAPIScraper,
        RemoteOKAPIScraper,
        WWRRSSScraper,
        DevITJobsAPIScraper,
        HNHiringAPIScraper,
    ]

    async def run(self, keywords: list[str] | None = None, **kwargs) -> list[dict]:
        """Run all free API scrapers concurrently."""
        kws = keywords or DEFAULT_KEYWORDS
        all_jobs = []

        async def _scrape_source(scraper_cls):
            """Run a single scraper safely."""
            scraper = scraper_cls()
            source_jobs = []
            try:
                for kw in kws[:5]:  # Limit keywords per source per run
                    try:
                        jobs = await scraper.scrape(keyword=kw)
                        if jobs:
                            source_jobs.extend(jobs)
                    except Exception as e:
                        logger.warning(f"[{scraper.name}] keyword '{kw}': {e}")
                logger.info(f"[{scraper.name}] Found {len(source_jobs)} jobs")
            except Exception as e:
                logger.error(f"[{scraper.name}] Failed: {e}")
            return source_jobs

        # Run all scrapers concurrently
        results = await asyncio.gather(
            *[_scrape_source(cls) for cls in self.SCRAPERS],
            return_exceptions=True,
        )

        for result in results:
            if isinstance(result, list):
                all_jobs.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"Scraper exception: {result}")

        logger.info(f"FreeAPIHunter total: {len(all_jobs)} jobs from {len(self.SCRAPERS)} sources")
        return all_jobs
```

- [ ] **Step 2: Commit**

---

### Task 2.3: Entity Resolution — Link Jobs to Sponsors

**Files:**
- Create: `backend/app/agents/hunter/entity_resolver.py`

- [ ] **Step 1: Implement sponsor matching via normalised name lookup**

```python
# backend/app/agents/hunter/entity_resolver.py
"""EntityResolver — Fuzzy-matches scraped company names to sponsors in the register."""

import logging
from rapidfuzz import fuzz
from app.agents.base import BaseSubAgent

logger = logging.getLogger(__name__)


def normalise_company_name(name: str) -> str:
    """Normalise company name for matching."""
    if not name:
        return ""
    n = name.lower().strip()
    for suffix in [" limited", " ltd", " plc", " inc", " llp", " lp",
                   " & co", " corporation", " corp", " group"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)]
    # Remove punctuation
    n = "".join(c for c in n if c.isalnum() or c == " ")
    return " ".join(n.split())


class EntityResolver(BaseSubAgent):
    name = "entity_resolver"
    agent_type = "DET"
    description = "Matches scraped company names to sponsors in the register"

    async def run(self, company_name: str, sponsor_cache: dict | None = None, **kwargs) -> dict:
        """
        Match a company name to a sponsor.

        Args:
            company_name: Raw company name from scraper
            sponsor_cache: Dict of {normalised_name: sponsor_id}

        Returns:
            {sponsor_id: str|None, confidence: float, matched_name: str|None}
        """
        if not company_name or not sponsor_cache:
            return {"sponsor_id": None, "confidence": 0, "matched_name": None}

        normalised = normalise_company_name(company_name)
        if not normalised:
            return {"sponsor_id": None, "confidence": 0, "matched_name": None}

        # Exact match first
        if normalised in sponsor_cache:
            return {
                "sponsor_id": sponsor_cache[normalised],
                "confidence": 100,
                "matched_name": normalised,
            }

        # Fuzzy match
        best_score = 0
        best_match = None
        for cached_name, sponsor_id in sponsor_cache.items():
            score = fuzz.ratio(normalised, cached_name)
            if score > best_score:
                best_score = score
                best_match = (cached_name, sponsor_id)

        if best_score >= 85 and best_match:
            return {
                "sponsor_id": best_match[1],
                "confidence": best_score,
                "matched_name": best_match[0],
            }

        return {"sponsor_id": None, "confidence": best_score, "matched_name": None}
```

- [ ] **Step 2: Commit**

---

### Task 2.4: Job Ingestion Celery Task

**Files:**
- Modify: `backend/app/tasks/scraping.py`
- Create: `backend/app/tasks/agent_tasks.py`

- [ ] **Step 1: Create agent task that runs HunterAgent and writes to Supabase**

```python
# backend/app/tasks/agent_tasks.py
"""Celery tasks for the agent swarm pipeline."""

import logging
import asyncio
from datetime import datetime, timezone
from app.tasks.celery_app import celery_app
from app.agents.hunter.agent import HunterAgent
from app.agents.hunter.entity_resolver import EntityResolver, normalise_company_name

logger = logging.getLogger(__name__)


def _get_supabase():
    """Get Supabase client for writing jobs."""
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def _load_sponsor_cache(supabase) -> dict:
    """Load normalised sponsor names → IDs for entity resolution."""
    cache = {}
    page = 0
    while True:
        result = supabase.table("sponsors").select(
            "id, organisation_name"
        ).range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not result.data:
            break
        for s in result.data:
            n = normalise_company_name(s["organisation_name"])
            if n:
                cache[n] = s["id"]
        if len(result.data) < 1000:
            break
        page += 1
    logger.info(f"Loaded {len(cache)} sponsors into cache")
    return cache


async def _run_hunter_pipeline(sources: list[str] | None = None):
    """Run the full hunter → ingest pipeline."""
    supabase = _get_supabase()
    sponsor_cache = await _load_sponsor_cache(supabase)
    resolver = EntityResolver()

    # Run hunter
    hunter = HunterAgent()
    result = await hunter.run_pipeline(sources=sources)

    # Get raw jobs from free_api_hunter
    free_hunter = hunter.get_sub_agent("free_api_hunter")
    raw_result = await free_hunter.execute()
    raw_jobs = raw_result.data or []

    # Process and insert jobs
    inserted = 0
    skipped = 0
    for job_data in raw_jobs:
        try:
            # Entity resolution
            match = await resolver.execute(
                company_name=job_data.get("company_name_raw", ""),
                sponsor_cache=sponsor_cache,
            )

            # Build job record
            record = {
                "source": job_data.get("source", "unknown"),
                "source_job_id": job_data.get("source_job_id"),
                "source_url": job_data.get("source_url"),
                "title_raw": job_data.get("title_raw", ""),
                "company_name_raw": job_data.get("company_name_raw", ""),
                "location_raw": job_data.get("location_raw"),
                "location_city": job_data.get("location_city"),
                "location_is_remote": job_data.get("location_is_remote", False),
                "salary_min": job_data.get("salary_min"),
                "salary_max": job_data.get("salary_max"),
                "salary_currency": job_data.get("salary_currency", "GBP"),
                "salary_period": job_data.get("salary_period"),
                "salary_text_raw": job_data.get("salary_text_raw"),
                "description_full": job_data.get("description_full"),
                "description_snippet": (job_data.get("description_full") or "")[:500],
                "contract_type": job_data.get("contract_type"),
                "seniority": job_data.get("seniority"),
                "posted_date": job_data.get("posted_date"),
                "sponsorship_likelihood": job_data.get("sponsorship_likelihood"),
                "sponsorship_signals": job_data.get("sponsorship_signals"),
                "skills_extracted": job_data.get("skills_extracted"),
                "sponsor_id": match.data.get("sponsor_id") if match.success else None,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "first_seen_at": datetime.now(timezone.utc).isoformat(),
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
            }

            # Skip if missing required fields
            if not record["title_raw"] or not record["company_name_raw"]:
                skipped += 1
                continue

            # Upsert (skip duplicates by source + source_job_id)
            if record["source_job_id"]:
                existing = supabase.table("jobs").select("id").eq(
                    "source", record["source"]
                ).eq("source_job_id", record["source_job_id"]).execute()

                if existing.data:
                    # Update last_seen_at only
                    supabase.table("jobs").update({
                        "last_seen_at": record["last_seen_at"]
                    }).eq("id", existing.data[0]["id"]).execute()
                    skipped += 1
                    continue

            # Insert new job
            supabase.table("jobs").insert(record).execute()
            inserted += 1

        except Exception as e:
            logger.error(f"Failed to insert job: {e}")
            skipped += 1

    logger.info(f"Hunter pipeline: {inserted} inserted, {skipped} skipped")
    return {"inserted": inserted, "skipped": skipped, "total_found": len(raw_jobs)}


@celery_app.task(name="agent.run_hunter", soft_time_limit=1800, time_limit=3600)
def run_hunter_task(sources: list[str] | None = None):
    """Celery task to run the hunter pipeline."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_hunter_pipeline(sources))
    finally:
        loop.close()
```

- [ ] **Step 2: Register task in Celery Beat schedule**

Add to `backend/app/tasks/schedule.py`:
```python
# Agent swarm tasks
"agent-hunter-free-apis": {
    "task": "agent.run_hunter",
    "schedule": crontab(minute="*/120"),  # Every 2 hours
    "args": [["free_apis"]],
},
```

- [ ] **Step 3: Commit**
```bash
git add backend/app/tasks/agent_tasks.py backend/app/tasks/schedule.py
git commit -m "feat: hunter agent Celery task with entity resolution and job ingestion"
```

---

### Task 2.5: Source-Specific Hunters (API-Key + Browser Tiers)

**Files:**
- Create: `backend/app/agents/hunter/reed_hunter.py`
- Create: `backend/app/agents/hunter/adzuna_hunter.py`
- Create: `backend/app/agents/hunter/source_selector.py`
- Create: `backend/app/agents/hunter/search_prioritiser.py`

- [ ] **Step 1: Implement SourceSelector (maps sponsors to relevant sources)**

```python
# backend/app/agents/hunter/source_selector.py
"""SourceSelector — Decides which sources to search for a given sponsor."""

from app.agents.base import BaseSubAgent

INDUSTRY_SOURCE_MAP = {
    "Healthcare": ["nhs_jobs", "gov_findajob"],
    "Education": ["teaching_vacancies", "guardian"],
    "Technology & IT": ["devitjobs", "cwjobs", "remotive", "remoteok"],
    "Charity & Non-Profit": ["charityjob", "guardian"],
}

ALWAYS_SEARCH = ["free_apis", "reed", "adzuna", "indeed", "linkedin"]


class SourceSelector(BaseSubAgent):
    name = "source_selector"
    agent_type = "DET"
    description = "Selects which job sources to search based on sponsor industry"

    async def run(self, industry: str | None = None, **kwargs) -> list[str]:
        sources = list(ALWAYS_SEARCH)
        if industry and industry in INDUSTRY_SOURCE_MAP:
            sources.extend(INDUSTRY_SOURCE_MAP[industry])
        return list(set(sources))
```

- [ ] **Step 2: Implement SearchPrioritiser**

```python
# backend/app/agents/hunter/search_prioritiser.py
"""SearchPrioritiser — Ranks sponsors by search priority."""

from app.agents.base import BaseSubAgent


class SearchPrioritiser(BaseSubAgent):
    name = "search_prioritiser"
    agent_type = "DET"
    description = "Ranks sponsors by priority for searching"

    async def run(self, sponsors: list[dict], **kwargs) -> list[dict]:
        """Score and sort sponsors by search priority."""
        for s in sponsors:
            score = 0
            if s.get("rating") == "A":
                score += 50
            elif s.get("rating") == "B":
                score += 20
            if s.get("has_recent_jobs"):
                score += 30
            if not s.get("last_searched"):
                score += 40
            s["_priority"] = score

        return sorted(sponsors, key=lambda x: x.get("_priority", 0), reverse=True)
```

- [ ] **Step 3: Implement ReedHunter (wraps existing scraper)**

```python
# backend/app/agents/hunter/reed_hunter.py
"""ReedHunter — Wraps Reed API + HTML scrapers."""

import logging
from app.agents.base import BaseSubAgent
from app.core.config import settings

logger = logging.getLogger(__name__)


class ReedHunter(BaseSubAgent):
    name = "reed_hunter"
    agent_type = "DET"
    description = "Scrapes jobs from Reed (API primary, HTML fallback)"

    async def run(self, keywords: list[str] | None = None, **kwargs) -> list[dict]:
        if not settings.reed_api_key:
            logger.info("Reed API key not configured, skipping")
            return []

        from app.scrapers.reed_api import ReedAPIScraper
        scraper = ReedAPIScraper()
        all_jobs = []
        kws = keywords or ["software engineer", "data analyst", "nurse"]

        for kw in kws[:3]:  # Budget API calls
            try:
                jobs = await scraper.scrape(keyword=kw)
                if jobs:
                    all_jobs.extend(jobs)
            except Exception as e:
                logger.warning(f"Reed '{kw}': {e}")

        logger.info(f"ReedHunter: {len(all_jobs)} jobs")
        return all_jobs
```

- [ ] **Step 4: Implement AdzunaHunter (same pattern)**
- [ ] **Step 5: Register all hunters in HunterAgent._register_sub_agents()**
- [ ] **Step 6: Commit**

---

## Phase 3: ValidatorAgent + EnrichmentAgent

### Task 3.1: ValidatorAgent with Dedup Sub-Agents

**Files:**
- Create: `backend/app/agents/validator/__init__.py`
- Create: `backend/app/agents/validator/agent.py`
- Create: `backend/app/agents/validator/company_normaliser.py`
- Create: `backend/app/agents/validator/similarity_scorer.py`
- Create: `backend/app/agents/validator/cluster_builder.py`
- Create: `backend/app/agents/validator/description_cleaner.py`
- Create: `backend/app/agents/validator/salary_validator.py`
- Create: `backend/app/agents/validator/date_validator.py`

- [ ] **Step 1: Implement CompanyNormaliser (DET)**
- [ ] **Step 2: Implement SimilarityScorer (DET) — 5-dimension comparison**
- [ ] **Step 3: Implement ClusterBuilder (DET) — union-find dedup**
- [ ] **Step 4: Implement DescriptionCleaner (DET) — strip HTML/boilerplate**
- [ ] **Step 5: Implement SalaryValidator (DET) — sanity checks**
- [ ] **Step 6: Implement DateValidator (DET) — temporal sanity**
- [ ] **Step 7: Implement ValidatorAgent main class that chains them**
- [ ] **Step 8: Commit**

### Task 3.2: EnrichmentAgent — Sponsorship Scoring

**Files:**
- Create: `backend/app/agents/enrichment/__init__.py`
- Create: `backend/app/agents/enrichment/agent.py`
- Create: `backend/app/agents/enrichment/sponsorship_keyword_scanner.py`
- Create: `backend/app/agents/enrichment/sponsor_register_matcher.py`
- Create: `backend/app/agents/enrichment/visa_threshold_checker.py`
- Create: `backend/app/agents/enrichment/shortage_list_matcher.py`
- Create: `backend/app/agents/enrichment/sponsorship_score_calculator.py`
- Create: `backend/app/agents/enrichment/salary_parser.py`
- Create: `backend/app/agents/enrichment/salary_normaliser.py`
- Create: `backend/app/agents/enrichment/certification_extractor.py`

- [ ] **Step 1: Implement SponsorshipKeywordScanner (DET) — 40+ regex patterns**
- [ ] **Step 2: Implement SponsorRegisterMatcher (DET) — lookup sponsor**
- [ ] **Step 3: Implement VisaThresholdChecker (DET) — salary vs threshold**
- [ ] **Step 4: Implement ShortageListMatcher (DET) — SOC code lookup**
- [ ] **Step 5: Implement SponsorshipScoreCalculator (DET) — 4-track formula**
- [ ] **Step 6: Implement SalaryParser + SalaryNormaliser (DET)**
- [ ] **Step 7: Implement CertificationExtractor (DET) — 200 patterns**
- [ ] **Step 8: Implement EnrichmentAgent main class**
- [ ] **Step 9: Commit**

### Task 3.3: LLM-Powered Sub-Agents

**Files:**
- Create: `backend/app/agents/enrichment/soc_classifier.py`
- Create: `backend/app/agents/enrichment/seniority_detector.py`
- Create: `backend/app/agents/enrichment/tech_stack_extractor.py`
- Create: `backend/app/agents/enrichment/job_summariser.py`
- Create: `backend/app/agents/enrichment/sponsorship_context_analyser.py`
- Create: `backend/app/agents/enrichment/visa_route_classifier.py`
- Create: `backend/app/agents/validator/spam_classifier.py`
- Create: `backend/app/agents/validator/title_normaliser.py`
- Create prompt templates in: `backend/app/agents/prompts/`

- [ ] **Step 1: Create prompt templates directory with all 22 prompts**
- [ ] **Step 2: Implement SOCClassifier (LLM) — title → SOC code**
- [ ] **Step 3: Implement SeniorityDetector (LLM)**
- [ ] **Step 4: Implement TechStackExtractor (LLM)**
- [ ] **Step 5: Implement JobSummariser (LLM)**
- [ ] **Step 6: Implement SponsorshipContextAnalyser (LLM)**
- [ ] **Step 7: Implement VisaRouteClassifier (LLM)**
- [ ] **Step 8: Implement SpamClassifier (LLM)**
- [ ] **Step 9: Implement TitleNormaliser (LLM)**
- [ ] **Step 10: Wire LLM sub-agents into their parent agents**
- [ ] **Step 11: Commit**

### Task 3.4: Validation + Enrichment Celery Tasks

**Files:**
- Modify: `backend/app/tasks/agent_tasks.py`

- [ ] **Step 1: Add validate_jobs task**
- [ ] **Step 2: Add enrich_jobs task**
- [ ] **Step 3: Add Celery Beat schedules for validation + enrichment**
- [ ] **Step 4: Commit**

---

## Phase 4: FreshnessAgent + QualityAgent + OrchestratorAgent

### Task 4.1: FreshnessAgent

**Files:**
- Create: `backend/app/agents/freshness/__init__.py`
- Create: `backend/app/agents/freshness/agent.py`
- Create: `backend/app/agents/freshness/http_status_checker.py`
- Create: `backend/app/agents/freshness/api_status_checker.py`
- Create: `backend/app/agents/freshness/repost_detector.py`
- Create: `backend/app/agents/freshness/adaptive_scheduler.py`
- Create: `backend/app/agents/freshness/stale_job_reaper.py`
- Create: `backend/app/agents/freshness/market_velocity_calculator.py`

- [ ] **Step 1: Implement HTTPStatusChecker (DET) — HEAD requests**
- [ ] **Step 2: Implement APIStatusChecker (DET) — re-query APIs**
- [ ] **Step 3: Implement RepostDetector (DET) — same company + similar title**
- [ ] **Step 4: Implement AdaptiveScheduler (DET) — age-based frequency**
- [ ] **Step 5: Implement StaleJobReaper (DET) — 60+ day archival**
- [ ] **Step 6: Implement MarketVelocityCalculator (DET)**
- [ ] **Step 7: Implement FreshnessAgent main class**
- [ ] **Step 8: Add freshness Celery task + Beat schedule (every 6 hours)**
- [ ] **Step 9: Commit**

### Task 4.2: QualityAgent

**Files:**
- Create: `backend/app/agents/quality/__init__.py`
- Create: `backend/app/agents/quality/agent.py`
- Create: `backend/app/agents/quality/completeness_scorer.py`
- Create: `backend/app/agents/quality/gap_identifier.py`
- Create: `backend/app/agents/quality/cross_source_filler.py`
- Create: `backend/app/agents/quality/source_health_monitor.py`
- Create: `backend/app/agents/quality/source_degradation_detector.py`
- Create: `backend/app/agents/quality/daily_quality_reporter.py`

- [ ] **Step 1: Implement CompletenessScorer (DET) — 100-point formula**
- [ ] **Step 2: Implement GapIdentifier (DET)**
- [ ] **Step 3: Implement CrossSourceFiller (DET)**
- [ ] **Step 4: Implement SourceHealthMonitor (DET)**
- [ ] **Step 5: Implement SourceDegradationDetector (DET)**
- [ ] **Step 6: Implement DailyQualityReporter (LLM)**
- [ ] **Step 7: Implement QualityAgent main class**
- [ ] **Step 8: Add quality Celery task + Beat schedule**
- [ ] **Step 9: Commit**

### Task 4.3: OrchestratorAgent

**Files:**
- Create: `backend/app/agents/orchestrator/__init__.py`
- Create: `backend/app/agents/orchestrator/agent.py`
- Create: `backend/app/agents/orchestrator/pipeline_sequencer.py`
- Create: `backend/app/agents/orchestrator/rate_limit_budgeter.py`
- Create: `backend/app/agents/orchestrator/metrics_collector.py`
- Create: `backend/app/agents/orchestrator/anomaly_detector.py`
- Create: `backend/app/agents/orchestrator/alert_publisher.py`

- [ ] **Step 1: Implement PipelineSequencer (DET) — Celery chains**
- [ ] **Step 2: Implement RateLimitBudgeter (DET) — Redis counters**
- [ ] **Step 3: Implement MetricsCollector (DET) — writes to swarm_metrics**
- [ ] **Step 4: Implement AnomalyDetector (DET) — 7-day rolling comparison**
- [ ] **Step 5: Implement AlertPublisher (DET) — Redis pub/sub**
- [ ] **Step 6: Implement OrchestratorAgent main class**
- [ ] **Step 7: Create master pipeline task that chains Hunter → Validator → Enrichment → Quality**
- [ ] **Step 8: Commit**

### Task 4.4: Update hiring_activity_score in Sponsor Scores

**Files:**
- Create: `backend/app/agents/quality/hiring_score_updater.py`

- [ ] **Step 1: Implement HiringScoreUpdater**

After jobs are ingested, recompute `sponsor_scores.hiring_activity_score`:
```
active_jobs >= 20 → 95
active_jobs >= 10 → 80
active_jobs >= 5  → 65
active_jobs >= 1  → 50
active_jobs == 0  → 25
```

- [ ] **Step 2: Add to QualityAgent pipeline**
- [ ] **Step 3: Commit**

---

## Phase 5: Frontend Integration

### Task 5.1: Jobs Page with Real Data

**Files:**
- Verify: `frontend/src/app/jobs/page.tsx` (already queries Supabase `jobs` table)
- Verify: `frontend/src/components/jobs/JobTable.tsx`
- Verify: `frontend/src/components/jobs/JobFilters.tsx`
- Verify: `frontend/src/components/jobs/JobStats.tsx`

- [ ] **Step 1: Verify jobs page works with real data in Supabase**
- [ ] **Step 2: Fix any TypeScript issues with new job columns**
- [ ] **Step 3: Update JobTable to show new fields (work_model, visa_routes, data_quality_score)**
- [ ] **Step 4: Commit**

### Task 5.2: Company Profile — Jobs Tab

**Files:**
- Modify: `frontend/src/app/company/[id]/CompanyProfileClient.tsx`
- Create: `frontend/src/components/company/JobsTab.tsx`

- [ ] **Step 1: Create JobsTab component**

Queries: `jobs.sponsor_id = this_sponsor AND is_expired = false`
Shows: active listings with sponsorship score, salary, source badges.
Also shows: recently expired (last 30 days) greyed out.

- [ ] **Step 2: Add "Jobs" tab to CompanyProfileClient when sponsor has jobs**
- [ ] **Step 3: Commit**

### Task 5.3: Dashboard — Job Stats Integration

**Files:**
- Modify: `frontend/src/components/dashboard/MarketPulse.tsx`
- Modify: `frontend/src/components/dashboard/LiveFeed.tsx`

- [ ] **Step 1: Add "Total Jobs" and "Sponsorship Likely" cards to MarketPulse**
- [ ] **Step 2: Add new jobs to LiveFeed alongside new sponsors**
- [ ] **Step 3: Commit**

### Task 5.4: Trends Page — Job Trends

**Files:**
- Modify: `frontend/src/app/trends/page.tsx`
- Create: `frontend/src/components/trends/JobsBySource.tsx`
- Create: `frontend/src/components/trends/SponsorshipDistribution.tsx`

- [ ] **Step 1: Create JobsBySource chart — stacked bar by source**
- [ ] **Step 2: Create SponsorshipDistribution — histogram of likelihood scores**
- [ ] **Step 3: Add to trends page**
- [ ] **Step 4: Commit**

### Task 5.5: Search — Include Jobs in Results

**Files:**
- Modify: `frontend/src/app/search/page.tsx`
- Modify: `frontend/src/components/ui/CommandPalette.tsx`

- [ ] **Step 1: Add job search tab to search page**
- [ ] **Step 2: Include jobs in CommandPalette results (Ctrl+K)**
- [ ] **Step 3: Commit**

### Task 5.6: Admin Dashboard — Swarm Health

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/components/admin/SwarmHealth.tsx`

- [ ] **Step 1: Create SwarmHealth component**

Shows: per-source status (green/amber/red), pipeline metrics, recent alerts.
Queries: `swarm_metrics`, `source_health_log`, `swarm_alerts` via server-side API.

- [ ] **Step 2: Add to admin page**
- [ ] **Step 3: Commit**

### Task 5.7: Signals Page — Job Alerts

**Files:**
- Modify: `frontend/src/components/signals/SignalFeed.tsx`

- [ ] **Step 1: Add high-value job signals**

Trigger: A-rated sponsor + sponsorship_likelihood > 80 + salary > threshold

- [ ] **Step 2: Commit**

### Task 5.8: Build and Deploy

- [ ] **Step 1: Run `npm run build` and fix any TypeScript errors**
- [ ] **Step 2: Deploy frontend: `npx vercel --yes --prod`**
- [ ] **Step 3: Deploy backend to Railway**
- [ ] **Step 4: Configure Railway environment variables**
- [ ] **Step 5: Verify jobs flowing end-to-end**
- [ ] **Step 6: Commit all remaining changes**

---

## Execution Order

```
Phase 1 (Tasks 1.1-1.6) → DEPLOY BACKEND TO RAILWAY
         ↓
Phase 2 (Tasks 2.1-2.5) → FIRST JOBS IN DATABASE
         ↓
Phase 3 (Tasks 3.1-3.4) → JOBS ENRICHED WITH SCORES
         ↓
Phase 4 (Tasks 4.1-4.4) → FULL PIPELINE RUNNING
         ↓
Phase 5 (Tasks 5.1-5.8) → FRONTEND SHOWS EVERYTHING
```

**Critical path**: Phase 1 → Phase 2 → Phase 5.1 (minimal viable: jobs visible on frontend). Phases 3 and 4 can run in parallel after Phase 2.
