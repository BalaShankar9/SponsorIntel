# SponsorIntel Agent Army — Operation Full Spectrum

## Design Specification

**Date:** 2026-03-24
**Codename:** Operation Full Spectrum
**Classification:** Internal Architecture Document
**Status:** Draft

---

## 1. Executive Summary

SponsorIntel's Agent Army is a domain-specific, military-structured intelligence network of 150+ autonomous agents purpose-built for UK immigration and sponsorship data. Unlike general-purpose orchestration platforms (Ruflo's 60 agents, CrewAI, LangGraph), every agent in this army is a deep specialist in immigration law, sponsorship registers, job markets, or compliance.

**Key differentiators over Ruflo and other frameworks:**

- **181 domain-specific agents** (150 operators + 25 squad leaders + 6 commanders) vs Ruflo's 60 general-purpose agents
- **Military chain of command** with lateral intel channels vs Ruflo's flat Hive Mind
- **5-tier self-learning LLM routing** vs Ruflo's static 3-tier system
- **6 specialized divisions** with isolated Celery queues vs single-queue architectures
- **Zero-cost T0 tier** handles ~40% of operations (regex/rules) — no LLM cost
- **Production-proven foundation** — built on existing 9-agent swarm with 140K sponsors, 54.2% job match rate

**Architecture decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent count | 181 across 6 divisions (150 operators + 31 leaders) | Full-spectrum coverage of every data source and intelligence need |
| Coordination | Military chain of command + lateral channels | Hierarchical control with fault isolation; lateral channels for cross-division urgency |
| LLM routing | 5-tier with self-learning | 65% cost reduction vs single-tier; continuous optimization |
| State management | Redis (hot) + Supabase (warm) + archive (cold) | Right storage tier for right access pattern |
| Migration | Promote existing agents, zero breaking changes | Existing `agent.*` tasks continue working alongside new `army.*` tasks |

---

## 2. Army Structure — 6 Divisions, 25 Squads, 181 Agents

> **Note:** Agent counts per division list operators only. Each squad also has a squad leader,
> and each division has a commander — all of whom are `ArmyAgent` instances registered in `army_agents`.
> Total: 150 operators + 25 squad leaders + 6 commanders = **181 agents** in the registry.

### 2.1 Division 1: ACQUISITION COMMAND (45 agents)

**Commander:** Colonel Aria Singh (promoted from existing Hunter agent)
**Mission:** Ingest data from every possible source — job boards, APIs, RSS feeds, career pages, government registers, social media, legal databases.
**Motto:** "Nothing escapes our net"

| Squad | NATO Code | Leader | Agents | Purpose |
|-------|-----------|--------|--------|---------|
| Free API Ops | Alpha | Sgt. Remotive | 14 | Zero-auth API scrapers: Remotive, Arbeitnow, Jobicy, TheMuse, Himalayas, RemoteOK, WWR, DevITJobs, HN Hiring, CharityJob, TeachingVacancies, NoFluffJobs, EscapeCity, CVLibrary |
| API Key Ops | Bravo | Sgt. Reed | 4 | Key-authenticated scrapers: Reed, Adzuna, Jooble, eFinancial |
| Browser Ops | Charlie | Sgt. Phantom | 8 | Playwright/headless scrapers: Indeed, LinkedIn, TotalJobs, CWJobs, Glassdoor, NHS Jobs, Guardian Jobs, FindAJob |
| Career Page Swarm | Delta | Sgt. Spider | 6 | Direct career page crawlers: URL discoverer, page classifier, job extractor, contact finder, tech stack detector, hiring signal analyzer |
| Gov Register | Echo | Sgt. Register | 4 | Government data: Sponsor Register CSV sync, Companies House filings, HMRC data, OISC/SRA lawyer registers |
| Intel Scanners | Foxtrot | Sgt. Watchdog | 5 | Immigration intelligence: Gov feeds, news RSS, legal blogs, Reddit/social, tribunal decisions |
| Deep Web Recon | Golf | Sgt. Shadow | 4 | NEW: LinkedIn company enrichment, Crunchbase funding signals, GitHub hiring signals, Glassdoor company reviews |

### 2.2 Division 2: INTELLIGENCE COMMAND (35 agents)

**Commander:** Brigadier Priya Kapoor (promoted from existing Enrichment agent)
**Mission:** Transform raw data into scored, classified, enriched intelligence.
**Motto:** "Raw data becomes actionable insight"

| Squad | NATO Code | Leader | Agents | Purpose |
|-------|-----------|--------|--------|---------|
| Job Enrichment | Hotel | Sgt. Analyst | 12 | Salary parser, normalizer, keyword scanner, sponsor matcher, visa threshold checker, shortage list matcher, score calculator, cert extractor, tech stack extractor, SOC classifier, work model detector, seniority detector |
| Company Profiling | India | Sgt. Profiler | 6 | Website finder, LinkedIn finder, careers page detector, contact extractor, financial health scorer, hiring velocity calculator |
| Intel Analysis | Juliet | Sgt. Cipher | 8 | Classifier, impact analyzer, policy tracker, before/after differ, nationality impact assessor, industry impact assessor, calendar event extractor, dedup engine |
| Entity Resolution | Kilo | Sgt. Matcher | 5 | Company name fuzzy matcher, sponsor register linker, job-to-company resolver, duplicate company merger, alias tracker |
| Predictive Analytics | Lima | Sgt. Oracle | 4 | NEW: Trend predictor, hiring forecast model, sponsorship probability predictor, market velocity forecaster |

### 2.3 Division 3: QUALITY COMMAND (20 agents)

**Commander:** Major Marcus Chen (promoted from existing Validator agent)
**Mission:** Ensure every data point meets quality standards before reaching users.
**Motto:** "If it's not verified, it doesn't exist"

| Squad | NATO Code | Leader | Agents | Purpose |
|-------|-----------|--------|--------|---------|
| Data Validation | Mike | Sgt. Clean | 8 | Description cleaner, company normalizer, title normalizer, salary validator, date validator, spam classifier, similarity scorer, cluster builder |
| Audit | November | Sgt. Audit | 4 | Completeness scorer, gap identifier, source health monitor, hiring score updater |
| Verification | Oscar | Sgt. Verify | 4 | NEW: URL liveness checker, company existence verifier, salary range plausibility checker, geo-location validator |
| Freshness | Papa | Sgt. Reaper | 4 | HTTP status checker, repost detector, stale job reaper, market velocity calculator |

### 2.4 Division 4: OPERATIONS COMMAND (20 agents)

**Commander:** Colonel Raj Patel (promoted from existing Orchestrator agent)
**Mission:** Self-healing, monitoring, alerting, scheduling optimization.
**Motto:** "The machine runs itself"

| Squad | NATO Code | Leader | Agents | Purpose |
|-------|-----------|--------|--------|---------|
| Monitoring | Quebec | Sgt. Sentinel | 5 | Metrics collector, anomaly detector, alert publisher, SLA tracker, cost monitor |
| Circuit Breakers | Romeo | Sgt. Fuse | 4 | Per-source circuit breakers, provider health checker, auto-recovery prober, fallback router |
| Self-Healing | Sierra | Sgt. Phoenix | 4 | NEW: Failed task retrier, stuck pipeline detector, resource scaler, dead letter queue processor |
| Schedule Optimizer | Tango | Sgt. Clock | 3 | NEW: Dynamic schedule adjuster (based on source freshness), peak-time load balancer, rate limit coordinator |
| Cost Controller | Uniform | Sgt. Budget | 4 | NEW: LLM cost tracker, per-agent ROI calculator, tier routing optimizer, budget alert system |

### 2.5 Division 5: RESEARCH COMMAND (20 agents)

**Commander:** Professor Alex Thornton (promoted from existing Improvement agent)
**Mission:** Generate reports, research, predictions, and strategic recommendations.
**Motto:** "The brain trust"

| Squad | NATO Code | Leader | Agents | Purpose |
|-------|-----------|--------|--------|---------|
| Report Generation | Victor | Sgt. Scribe | 5 | NEW: Weekly digest generator, company deep-dive report builder, market analysis report builder, visa route comparison generator, PDF export engine |
| Lawyer Intelligence | Whiskey | Sgt. Scales | 5 | Lawyer discovery, lawyer matcher, review aggregator, fee comparator, disciplinary history checker |
| R&D | X-Ray | Sgt. Lab | 4 | Keyword optimizer, source scout, scoring calibrator, A/B test coordinator |
| User Intelligence | Yankee | Sgt. Persona | 3 | NEW: User behavior tracker, personalization engine, recommendation builder |
| Compliance | Zulu | Sgt. Shield | 3 | NEW: GDPR data handler, data retention enforcer, audit trail logger |

### 2.6 Division 6: SUPREME COMMAND (10 agents)

**Supreme Commander:** Field Marshal AEGIS (Autonomous Executive General Intelligence System)
**Mission:** Army-wide coordination, strategic decision-making, war room dashboards.
**Motto:** "Strategic oversight"

| Role | Agent Name | Purpose |
|------|------------|---------|
| Supreme Commander | AEGIS | Master orchestrator — receives division reports, sets strategic priorities, allocates resources |
| Chief of Staff | Atlas | Translates AEGIS decisions into operational orders for division commanders |
| Intelligence Director | Minerva | Cross-division intelligence fusion — connects dots between divisions |
| Comms Officer | Herald | User-facing notifications, digests, alerts — the voice of the army |
| War Room Analyst | Strategist | Real-time dashboard data aggregator — feeds the admin War Room UI |
| Diplomatic Liaison | Ambassador | External API relationship manager — tracks API health, negotiates rate limits |
| Quartermaster | Logistics | Resource allocation — Redis memory, Celery queues, LLM token budgets |
| Historian | Chronicle | Audit trail — logs every decision, every data flow, every agent action |
| Inspector General | Watchkeeper | Agent performance evaluator — identifies underperforming agents, recommends improvements |
| Training Officer | Mentor | Self-learning system — captures successful patterns, updates routing thresholds |

---

## 3. Communication Architecture — SIGINT Protocol

### 3.1 Channel 1: Chain of Command (Vertical)

```
AEGIS (Supreme Commander)
  ├── Colonel Aria Singh      → Acquisition Division (45 agents)
  ├── Brigadier Priya Kapoor  → Intelligence Division (35 agents)
  ├── Major Marcus Chen       → Quality Division (20 agents)
  ├── Colonel Raj Patel       → Operations Division (20 agents)
  ├── Professor Alex Thornton → Research Division (20 agents)
  └── Atlas, Minerva, Herald  → Supreme Command Staff (10 agents)
```

**Downward flow:** Orders dispatched as Celery tasks with priority levels:
- `critical` — Process immediately, interrupt current work if needed
- `high` — Next in queue
- `normal` — Standard FIFO processing
- `low` — Background/batch processing

**Upward flow:** Results reported as standardized `AgentReport` objects stored in `army_missions` table and published via Redis pub/sub for real-time monitoring.

### 3.2 Channel 2: Lateral Intel (Horizontal)

Cross-division intelligence sharing via Redis Streams. Named channels for specific intelligence types:

| Channel | Publisher | Subscriber | Trigger |
|---------|-----------|------------|---------|
| `stream:new_sponsor` | Echo squad (Gov Register) | Intelligence Div, Quality Div | New sponsor appears on register |
| `stream:sponsor_removed` | Echo squad | All divisions | Sponsor removed/suspended from register |
| `stream:policy_change` | Foxtrot squad (Intel Scanners) | Intelligence Div, Research Div, Herald | New immigration rule detected |
| `stream:hiring_surge` | Lima squad (Predictive) | Acquisition Div, Herald | Company hiring velocity spike detected |
| `stream:source_down` | Romeo squad (Circuit Breakers) | Operations Div, AEGIS | Data source goes offline |
| `stream:quality_alert` | November squad (Audit) | Quality Div, AEGIS | Data quality drops below threshold |
| `stream:cost_spike` | Uniform squad (Cost Controller) | AEGIS, Logistics | LLM spend exceeds budget threshold |
| `stream:new_jobs_batch` | Acquisition Div (any squad) | Intelligence Div | New batch of raw jobs ingested and ready for enrichment |
| `stream:enrichment_complete` | Intelligence Div | Quality Div, Research Div | Batch of jobs fully enriched |
| `stream:report_ready` | Victor squad (Reports) | Herald | New report generated, ready for distribution |

### 3.3 Channel 3: War Room Broadcast (Global)

- Redis pub/sub channel `warroom:*` — real-time metrics visible on admin dashboard
- Every 30 seconds, each division commander publishes a heartbeat with key metrics
- AEGIS publishes army-wide status every 60 seconds
- All War Room data persisted to `army_division_status` table for dashboard queries

---

## 4. 5-Tier Intelligent LLM Routing Engine

### 4.1 Tier Definitions

| Tier | Engine | Model | Latency | Cost/call | Operations |
|------|--------|-------|---------|-----------|------------|
| **T0: Zero-Cost** | Python rules/regex | None | <1ms | $0.00 | Regex matching, URL validation, dedup hashes, salary parsing, date normalization, keyword lookup, boolean checks, format validation |
| **T1: Micro** | Groq | llama-3.1-8b | ~200ms | ~$0.0001 | Spam/not-spam, title cleanup, simple yes/no classification, language detection, sentiment (positive/negative) |
| **T2: Standard** | Groq | llama-3.1-70b | ~500ms | ~$0.001 | Job enrichment, SOC classification, company matching, sponsorship keyword analysis, tech stack extraction, work model detection |
| **T3: Heavy** | NVIDIA NIM | llama-3.1-405b | ~2s | ~$0.01 | Deep analysis, report generation, policy impact assessment, lawyer matching, trend synthesis, multi-source correlation |
| **T4: Elite** | Anthropic / OpenRouter | Claude / GPT | ~3s | ~$0.05 | Legal document analysis, executive briefings, multi-document synthesis, complex edge cases, before/after rule diffing |

### 4.2 Routing Engine Flow

```
Input: prompt + agent_id + task_type + metadata
                    │
                    ▼
        ┌───────────────────────┐
        │  Step 1: T0 Check     │  Can this be done without LLM?
        │  (regex, rules, hash) │  If yes → return immediately ($0)
        └───────────┬───────────┘
                    │ no
                    ▼
        ┌───────────────────────┐
        │  Step 2: Load Config  │  Read army_tier_config for this task_type
        │  (task_type defaults) │  Get default_tier, min_tier, max_tier
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Step 3: Complexity   │  Estimate input complexity (0-1)
        │  Classification       │  Short prompt → lower tier
        │                       │  Multi-doc → higher tier
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Step 4: Self-Learn   │  Adjust based on routing_history
        │  Adjustments          │  High confidence at lower tier → downgrade
        │                       │  Recent failure at tier → upgrade
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Step 5: Provider     │  Check circuit breaker states
        │  Health Check         │  Check rate limit counters
        │                       │  Select available provider
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Step 6: Execute      │  Call provider, apply fallback chain
        │  with Fallbacks       │  on failure
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Step 7: Log & Learn  │  Log to army_routing_history
        │                       │  Update tier_config confidence
        └───────────────────────┘
                    │
                    ▼
        Output: result + tier_used + cost + latency
```

### 4.3 Fallback Chains

Each tier has a defined fallback chain for provider failures:

- **T4:** Anthropic → OpenRouter → NVIDIA NIM (downgrade to T3)
- **T3:** NVIDIA NIM → OpenRouter → Groq 70b (downgrade to T2)
- **T2:** Groq 70b → NVIDIA NIM → OpenRouter
- **T1:** Groq 8b → Groq 70b (upgrade if 8b unavailable)
- **T0:** Always available — pure Python, no external dependency

### 4.4 Self-Learning Feedback Loop

```
Agent completes task at Tier N
        │
        ▼
Was the result quality sufficient?
   ├── YES → Record: "task_type X works at Tier N"
   │         Increment confidence counter
   │         If confidence > 10, try downgrading to Tier N-1 next time
   │
   └── NO  → Record: "task_type X needs Tier N+1"
              Reset confidence, upgrade default for this task type

Every 24h: Mentor agent (Training Officer) reviews routing_history
  → Adjusts default tiers per task_type
  → Reports cost savings to AEGIS
  → Publishes updated routing table to army_tier_config

Anti-oscillation guards:
  → No re-attempt of downgrade for a task_type within 48h of a failed downgrade
  → Maximum 3 downgrade attempts per week per task_type
  → If 3 consecutive downgrades fail, lock tier for 7 days
  → Exponential backoff on downgrade attempts: 48h → 96h → 168h
```

### 4.5 Cost Projection

| Distribution | % of Operations | Avg Cost/Op | Monthly (100K ops/day) |
|-------------|-----------------|-------------|----------------------|
| T0 (free) | 40% | $0.00 | $0 |
| T1 (micro) | 24% | $0.0001 | $72 |
| T2 (standard) | 20% | $0.001 | $600 |
| T3 (heavy) | 11% | $0.01 | $3,300 |
| T4 (elite) | 5% | $0.05 | $7,500 |
| **Total** | **100%** | | **~$11,472/mo** |

Compared to routing everything through T3 ($0.01/call): 100K/day * 30 * $0.01 = $30,000/mo. **Estimated 62% cost reduction.** At T2 pricing ($0.001/call) the baseline would be $3,000/mo, still yielding significant savings from T0/T1 handling 64% of operations for near-zero cost.

---

## 5. Database Schema

### 5.1 Table: `army_agents` — Agent Registry

```sql
CREATE TABLE army_agents (
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

CREATE INDEX idx_army_agents_division ON army_agents (division, status);
CREATE INDEX idx_army_agents_squad ON army_agents (division, squad);
```

### 5.2 Table: `army_missions` — Task Execution Log

```sql
CREATE TABLE army_missions (
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
    division VARCHAR(30),              -- denormalized from army_agents for query performance
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_army_missions_agent ON army_missions (agent_id, created_at DESC);
CREATE INDEX idx_army_missions_status ON army_missions (status, created_at DESC);
CREATE INDEX idx_army_missions_type ON army_missions (mission_type, created_at DESC);
CREATE INDEX idx_army_missions_division ON army_missions (division, created_at DESC);
```

### 5.3 Table: `army_signals` — Lateral Intel Channel Log

```sql
CREATE TABLE army_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL,
    publisher_agent_id VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    severity VARCHAR(10) DEFAULT 'info',
    consumed_by TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_army_signals_channel ON army_signals (channel, created_at DESC);
CREATE INDEX idx_army_signals_severity ON army_signals (severity, created_at DESC);
```

### 5.4 Table: `army_routing_history` — Self-Learning Data

```sql
CREATE TABLE army_routing_history (
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

CREATE INDEX idx_army_routing_task ON army_routing_history (task_type, created_at DESC);
```

### 5.5 Table: `army_tier_config` — Current Routing Thresholds

```sql
CREATE TABLE army_tier_config (
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
```

### 5.6 Table: `army_division_status` — Division Heartbeats

```sql
CREATE TABLE army_division_status (
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
```

### 5.7 RLS Policies

```sql
-- army_agents: public read (visible in admin War Room), service role write
ALTER TABLE army_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read agents" ON army_agents
    FOR SELECT USING (true);
CREATE POLICY "Service role manages agents" ON army_agents
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- army_missions: public read (War Room feed), service role write
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

-- army_routing_history: service role only (internal optimization data)
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

-- army_division_status: public read (War Room dashboard), service role write
ALTER TABLE army_division_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read division status" ON army_division_status
    FOR SELECT USING (true);
CREATE POLICY "Service role manages division status" ON army_division_status
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

### 5.8 State Management Architecture

```
Layer 1: HOT STATE (Redis)
  ├── Circuit breaker states per source (TTL: managed by breaker)
  ├── Agent heartbeats (TTL: 120s)
  ├── Rate limit counters (sliding window, TTL: 60s)
  ├── LLM response cache (TTL: 24h)
  ├── Active mission tracking (TTL: 1h)
  ├── Lateral intel streams (Redis Streams, trimmed at 10K entries)
  └── Real-time metrics for War Room (TTL: 300s)

Layer 2: WARM STATE (Supabase)
  ├── army_agents (registry + health)
  ├── army_missions (execution log — last 30 days)
  ├── army_signals (intel history — last 90 days)
  ├── army_routing_history (learning data — last 30 days)
  ├── army_tier_config (routing thresholds — permanent)
  └── army_division_status (dashboard data — overwritten per heartbeat)

Layer 3: COLD STATE (Supabase archive)
  ├── army_missions_archive (>30 days, compressed JSONB)
  └── army_signals_archive (>90 days, compressed JSONB)
```

**Archival schedule:**
- `army_missions` >30 days → `army_missions_archive` (weekly, Sunday 5 AM)
- `army_signals` >90 days → `army_signals_archive` (monthly, 1st Sunday)
- `army_routing_history` >30 days → aggregate into `army_tier_config` then delete (weekly)

---

## 6. Base Agent Framework

### 6.1 Core Classes

```python
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

@dataclass
class AgentReport:
    agent_id: str
    mission_id: UUID
    status: str                   # "success", "partial", "failed"
    data: dict                    # mission-specific output
    items_processed: int
    items_created: int
    items_updated: int
    errors: list[str]
    duration_ms: int
    tier_used: int
    llm_calls: int
    llm_cost_usd: float
    signals_emitted: list[str]

class ArmyAgent:
    agent_id: str                 # "acq.alpha.remotive"
    division: Division
    squad: str
    role: Role
    persona_name: str
    persona_title: str
    default_tier: int             # 0-4
    capabilities: list[str]

    async def execute(self, input: dict) -> AgentReport
    async def heartbeat(self) -> None
    async def emit_signal(self, channel: str, payload: dict) -> None
    async def listen_signal(self, channel: str, callback) -> None
    async def request_tier(self, prompt: str, system: str, task_type: str, tier: int = None) -> str
    async def escalate(self, message: str) -> None

class SquadLeader(ArmyAgent):
    operators: list[ArmyAgent]
    async def run_squad(self, input: dict) -> AgentReport
    async def assign_task(self, operator: ArmyAgent, task: dict) -> AgentReport

class Commander(ArmyAgent):
    squads: dict[str, SquadLeader]
    async def run_division(self, **kwargs) -> AgentReport
    async def report_to_aegis(self, report: AgentReport) -> None
    async def publish_heartbeat(self) -> None
```

### 6.2 TierRouter

```python
class TierRouter:
    def __init__(self, redis, supabase, llm_providers: dict):
        self.redis = redis
        self.supabase = supabase
        self.providers = llm_providers         # provider_name -> config
        self.circuit_breakers = {}             # provider_name -> CircuitBreaker
        self.tier_config_cache = {}            # task_type -> TierConfig

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
    ) -> TierResult:
        # Step 1: T0 check
        # Step 2: Load/cache tier_config for task_type
        # Step 3: Classify complexity
        # Step 4: Apply self-learning adjustments
        # Step 5: Check provider health
        # Step 6: Execute with fallback chain
        # Step 7: Log to routing_history
        pass

    async def _try_t0(self, prompt: str, task_type: str) -> str | None:
        """Attempt zero-cost resolution via rules/regex."""
        pass

    async def _call_tier(self, tier: int, prompt: str, system: str, ...) -> str:
        """Call the appropriate provider for a tier, with fallbacks."""
        pass

@dataclass
class TierResult:
    content: str
    tier_used: int
    provider: str
    model: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    latency_ms: int
    from_cache: bool
```

### 6.3 SignalBus — Lateral Intel

```python
class SignalBus:
    def __init__(self, redis):
        self.redis = redis

    async def emit(self, channel: str, publisher_id: str, payload: dict, severity: str = "info"):
        """Publish signal to Redis Stream + persist to army_signals table."""
        pass

    async def subscribe(self, channel: str, callback, consumer_group: str = None):
        """Subscribe to a Redis Stream channel."""
        pass

    async def get_history(self, channel: str, limit: int = 100) -> list[dict]:
        """Read recent signals from a channel."""
        pass
```

---

## 7. File Structure

```
backend/app/agents/
├── base.py                         # ArmyAgent, AgentReport, Role, Division enums
├── registry.py                     # @register_agent decorator (existing, enhanced)
├── tier_router.py                  # TierRouter + TierResult + fallback chains
├── signal_bus.py                   # SignalBus — Redis Streams lateral intel
├── heartbeat.py                    # Health monitoring daemon
├── llm_service.py                  # Existing LLMService (kept for backward compat)
│
├── acquisition/                    # DIVISION 1 (45 agents)
│   ├── __init__.py
│   ├── commander.py                # Colonel Aria Singh
│   ├── alpha_free_apis/
│   │   ├── squad_leader.py         # Sgt. Remotive
│   │   ├── remotive.py
│   │   ├── arbeitnow.py
│   │   ├── jobicy.py
│   │   ├── themuse.py
│   │   ├── himalayas.py
│   │   ├── remoteok.py
│   │   ├── wwr.py
│   │   ├── devitjobs.py
│   │   ├── hn_hiring.py
│   │   ├── charityjob.py
│   │   ├── teaching_vacancies.py
│   │   ├── nofluffjobs.py
│   │   ├── escapecity.py
│   │   └── cvlibrary.py
│   ├── bravo_api_key/
│   │   ├── squad_leader.py         # Sgt. Reed
│   │   ├── reed.py
│   │   ├── adzuna.py
│   │   ├── jooble.py
│   │   └── efinancial.py
│   ├── charlie_browser/
│   │   ├── squad_leader.py         # Sgt. Phantom
│   │   ├── indeed.py
│   │   ├── linkedin.py
│   │   ├── totaljobs.py
│   │   ├── cwjobs.py
│   │   ├── glassdoor.py
│   │   ├── nhs_jobs.py
│   │   ├── guardian_jobs.py
│   │   └── findajob.py
│   ├── delta_career_pages/
│   │   ├── squad_leader.py         # Sgt. Spider
│   │   ├── url_discoverer.py
│   │   ├── page_classifier.py
│   │   ├── job_extractor.py
│   │   ├── contact_finder.py
│   │   ├── techstack_detector.py
│   │   └── hiring_signal.py
│   ├── echo_gov/
│   │   ├── squad_leader.py         # Sgt. Register
│   │   ├── sponsor_register.py
│   │   ├── companies_house.py
│   │   ├── hmrc_data.py
│   │   └── oisc_sra.py
│   ├── foxtrot_intel/
│   │   ├── squad_leader.py         # Sgt. Watchdog
│   │   ├── gov_feeds.py
│   │   ├── news_rss.py
│   │   ├── legal_blogs.py
│   │   ├── social_reddit.py
│   │   └── tribunal_decisions.py
│   └── golf_deepweb/
│       ├── squad_leader.py         # Sgt. Shadow
│       ├── linkedin_enricher.py
│       ├── crunchbase_signals.py
│       ├── github_hiring.py
│       └── glassdoor_reviews.py
│
├── intelligence/                   # DIVISION 2 (35 agents)
│   ├── __init__.py
│   ├── commander.py                # Brigadier Priya Kapoor
│   ├── hotel_enrichment/           # 12 operators
│   ├── india_profiling/            # 6 operators
│   ├── juliet_intel/               # 8 operators
│   ├── kilo_entity/                # 5 operators
│   └── lima_predictive/            # 4 operators
│
├── quality/                        # DIVISION 3 (20 agents)
│   ├── __init__.py
│   ├── commander.py                # Major Marcus Chen
│   ├── mike_validation/            # 8 operators
│   ├── november_audit/             # 4 operators
│   ├── oscar_verification/         # 4 operators
│   └── papa_freshness/             # 4 operators
│
├── operations/                     # DIVISION 4 (20 agents)
│   ├── __init__.py
│   ├── commander.py                # Colonel Raj Patel
│   ├── quebec_monitoring/          # 5 operators
│   ├── romeo_circuits/             # 4 operators
│   ├── sierra_healing/             # 4 operators
│   ├── tango_scheduling/           # 3 operators
│   └── uniform_costs/              # 4 operators
│
├── research/                       # DIVISION 5 (20 agents)
│   ├── __init__.py
│   ├── commander.py                # Professor Alex Thornton
│   ├── victor_reports/             # 5 operators
│   ├── whiskey_lawyers/            # 5 operators
│   ├── xray_rnd/                   # 4 operators
│   ├── yankee_users/               # 3 operators
│   └── zulu_compliance/            # 3 operators
│
└── command/                        # DIVISION 6: SUPREME COMMAND (10 agents)
    ├── __init__.py
    ├── aegis.py                    # Supreme Commander
    ├── atlas.py                    # Chief of Staff
    ├── minerva.py                  # Intelligence Director
    ├── herald.py                   # Comms Officer
    ├── strategist.py               # War Room Analyst
    ├── ambassador.py               # Diplomatic Liaison
    ├── logistics.py                # Quartermaster
    ├── chronicle.py                # Historian
    ├── watchkeeper.py              # Inspector General
    └── mentor.py                   # Training Officer
```

---

## 8. Celery Queue Architecture

### 8.1 Queue Routing

```python
CELERY_TASK_ROUTES = {
    "army.acquisition.*":  {"queue": "army_acquisition"},
    "army.intelligence.*": {"queue": "army_intelligence"},
    "army.quality.*":      {"queue": "army_quality"},
    "army.operations.*":   {"queue": "army_operations"},
    "army.research.*":     {"queue": "army_research"},
    "army.command.*":      {"queue": "army_command"},
    # Legacy tasks continue to work:
    "tasks.*":             {"queue": "default"},
    "agent.*":             {"queue": "agents"},
}
```

### 8.2 Worker Scaling

| Queue | Workers | Concurrency | Rationale |
|-------|---------|-------------|-----------|
| `army_acquisition` | 4 | 8 each | Highest throughput — scraping is I/O bound, benefits from concurrency |
| `army_intelligence` | 2 | 4 each | LLM-heavy, fewer but longer tasks |
| `army_quality` | 2 | 4 each | Steady validation workload |
| `army_operations` | 1 | 2 | Monitoring is lightweight |
| `army_research` | 1 | 2 | Periodic report generation |
| `army_command` | 1 | 1 | AEGIS orchestration — single leader, sequential decisions |

### 8.3 Task Priority

```python
# Priority levels (lower number = higher priority in Celery)
PRIORITY_CRITICAL = 0   # Sponsor removed, source outage
PRIORITY_HIGH = 3       # New policy change, quality alert
PRIORITY_NORMAL = 6     # Standard scraping, enrichment
PRIORITY_LOW = 9        # Reports, archival, R&D
```

---

## 9. Migration Path from Current Agents

### 9.1 Agent Promotion Map

| Current Agent | Current Role | New Position | Change Type |
|---------------|-------------|-------------|-------------|
| Hunter (Aria Singh) | Main agent, 5 sub-agents | Acquisition Commander, 7 squads, 45 agents | Promoted |
| Validator (Marcus Chen) | Main agent, 8 sub-agents | Quality Commander, 4 squads, 20 agents | Promoted |
| Enrichment (Priya Kapoor) | Main agent, 12 sub-agents | Intelligence Commander, 5 squads, 35 agents | Promoted |
| Freshness (James Okafor) | Main agent, 4 sub-agents | Papa Squad Leader (under Quality) | Lateral move |
| Discovery (Elena Volkov) | Main agent, 4 sub-agents | India Squad Leader (under Intelligence) | Lateral move |
| CH Watcher (Daniel Mensah) | Main agent, 4 sub-agents | Echo Squad operator (under Acquisition) | Focused |
| Quality (Sophie Laurent) | Main agent, 4 sub-agents | November Squad Leader (under Quality) | Lateral move |
| Orchestrator (Raj Patel) | Main agent, 3 sub-agents | Operations Commander, 5 squads, 20 agents | Promoted |
| Improvement (Dr. Alex Thornton) | Main agent, 3 sub-agents | Research Commander, 5 squads, 20 agents | Promoted |

### 9.2 Zero Breaking Changes Strategy

- All existing `agent.*` Celery tasks continue to work unchanged
- New `army.*` tasks run alongside on separate queues
- Existing agent code is refactored into the new division structure but maintains backward-compatible entry points
- The `@register_agent` decorator is extended (not replaced) to support division/squad metadata
- LLMService is preserved; TierRouter wraps it with multi-tier routing
- Circuit breaker states in Redis use the same key format

### 9.3 Phased Rollout

1. **Phase 1:** Deploy base framework (ArmyAgent, TierRouter, SignalBus) + database tables
2. **Phase 2:** Reorganize existing 9 agents into new division structure
3. **Phase 3:** Build Supreme Command (AEGIS + staff)
4. **Phase 4:** Add new squads (Golf, Lima, Oscar, Sierra, Tango, Uniform, Victor, Yankee, Zulu)
5. **Phase 5:** War Room dashboard frontend
6. **Phase 6:** Self-learning routing system
7. **Phase 7:** Full army activation + legacy task deprecation

---

## 10. War Room Admin Dashboard

### 10.1 Page Location

`/admin/war-room` — accessible from sidebar under ADMIN section.

### 10.2 Layout

4-zone grid layout:

- **Zone A (top bar, full width, 40px):** Army status bar — AEGIS status, total agents, missions/24h, cost/24h, uptime, signals/min
- **Zone B (left column, 320px):** Division command cards — 6 cards showing division health, agent count, mission count, cost, status indicator
- **Zone C (right top):** Live mission feed — real-time scrolling log of agent activity, color-coded by division, with filter controls
- **Zone D (right bottom):** Detail panel — contextual drill-down when clicking a division, squad, or agent

### 10.3 Frontend Components

```
frontend/src/app/admin/war-room/page.tsx
frontend/src/components/warroom/
  ├── ArmyStatusBar.tsx          # Zone A
  ├── DivisionCard.tsx           # Zone B (single card)
  ├── DivisionList.tsx           # Zone B (all 6 cards)
  ├── MissionFeed.tsx            # Zone C
  ├── DetailPanel.tsx            # Zone D (container)
  ├── DivisionDetail.tsx         # Zone D (division drill-down)
  ├── AgentDetail.tsx            # Zone D (agent drill-down)
  ├── TierRoutingChart.tsx       # Horizontal bar chart of tier distribution
  ├── CostSparkline.tsx          # 24h cost trend sparkline
  ├── SignalTimeline.tsx         # Lateral intel signal history
  ├── CircuitBreakerPanel.tsx    # Visual circuit breaker states
  └── AgentOrgChart.tsx          # Hierarchical org chart visualization
```

### 10.4 Backend API

```
GET  /api/v1/army/status                       # Army-wide metrics
GET  /api/v1/army/divisions                    # All 6 division summaries
GET  /api/v1/army/divisions/{div}              # Single division + squads
GET  /api/v1/army/divisions/{div}/{squad}      # Squad + operators
GET  /api/v1/army/agents/{agent_id}            # Single agent detail
GET  /api/v1/army/missions                     # Paginated mission log
GET  /api/v1/army/missions/live                # SSE stream for real-time feed
GET  /api/v1/army/agents/{agent_id}/missions   # Agent mission history
GET  /api/v1/army/signals                      # Recent signals
GET  /api/v1/army/signals/stream               # SSE stream for signals
GET  /api/v1/army/routing/stats                # Tier distribution
GET  /api/v1/army/routing/config               # Current tier_config
PATCH /api/v1/army/routing/config/{task_type}  # Manual tier override
POST /api/v1/army/agents/{agent_id}/pause      # Pause agent
POST /api/v1/army/agents/{agent_id}/resume     # Resume agent
POST /api/v1/army/divisions/{div}/pause        # Pause division
POST /api/v1/army/divisions/{div}/resume       # Resume division
POST /api/v1/army/command/redeploy             # Force full pipeline run
GET  /api/v1/army/costs                        # Cost breakdown
GET  /api/v1/army/costs/forecast               # Projected monthly cost
```

### 10.5 Real-Time Data Flow

```
Celery Worker (agent completes mission)
    ├──→ INSERT army_missions (Supabase)
    │         └──→ Supabase Realtime → MissionFeed component
    ├──→ UPDATE army_agents (heartbeat, stats)
    ├──→ UPDATE army_division_status (if commander)
    │         └──→ Supabase Realtime → DivisionCard component
    └──→ PUBLISH Redis Stream (if lateral signal)
              └──→ INSERT army_signals (Supabase)
                        └──→ SignalTimeline component
```

### 10.6 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `G W` | Navigate to War Room |
| `1-6` | Focus division 1-6 |
| `F` | Toggle mission feed filter |
| `R` | Force refresh all data |
| `P` | Pause/resume all agents |
| `Esc` | Close detail panel |

### 10.7 Sidebar Integration

Add to ADMIN section in Sidebar.tsx:
- War Room (`/admin/war-room`) with pulsing indicator: amber when any division degraded, red when critical
- Army Config (`/admin/army`) for agent configuration management

---

## 11. Comparison: SponsorIntel Agent Army vs Ruflo

| Dimension | Ruflo | SponsorIntel Agent Army |
|-----------|-------|------------------------|
| **Total agents** | 60+ general-purpose | 181 domain-specific (150 operators + 31 leaders) |
| **Agent categories** | 8 generic (researcher, coder, tester...) | 25 squads across 6 military divisions |
| **Coordination** | Hive Mind (flat event bus) | Military chain of command + lateral intel channels |
| **LLM routing** | 3-tier static (WASM/Haiku/Sonnet) | 5-tier self-learning (rules/8b/70b/405b/Claude) |
| **Zero-cost operations** | WASM for simple transforms | Python regex/rules handling 40% of all operations |
| **Self-learning** | Pattern reuse | Continuous tier optimization with quality feedback loop |
| **Domain expertise** | None (general-purpose) | Every agent is an immigration/sponsorship specialist |
| **Fault tolerance** | Byzantine/Raft/Gossip | Circuit breakers + auto-recovery + dead letter queues |
| **Cost tracking** | Not documented | Per-agent, per-tier, per-division cost tracking with forecasts |
| **Data sources** | None (tool-based) | 30+ integrated scrapers, APIs, feeds, government registers |
| **State management** | SQLite + AgentDB | Redis (hot) + Supabase (warm) + archive (cold) |
| **Observability** | Event logging | War Room dashboard with real-time feeds, org charts, tier analytics |
| **Production data** | None | 140K sponsors, 54.2% job match rate, live immigration intelligence |
| **Scheduling** | On-demand | 50+ Celery Beat schedules with staggered timing across 16 tiers |
| **MCP tools** | 215+ generic | Purpose-built for immigration intelligence pipeline |

---

## 12. Success Metrics

| Metric | Current (9 agents) | Target (181 agents) |
|--------|-------------------|---------------------|
| Data sources covered | 23 | 35+ |
| Jobs scraped/day | ~5,000 | ~50,000 |
| Enrichment throughput/hour | ~500 | ~5,000 |
| Sponsor match rate | 54.2% | 75%+ |
| Average enrichment latency | ~2s | ~800ms (T0/T1 handling simple cases) |
| LLM cost/month | ~$500 (single tier) | ~$200 (5-tier optimization, see Section 4.5 for breakdown at scale) |
| Data quality score | ~70% | 95%+ |
| System uptime | ~95% | 99.5%+ (self-healing) |
| Mean time to recover (MTTR) | Manual | <5 min (auto-recovery) |
| Intel items/day | ~50 | ~500 |
| Report generation | Manual | Automated daily/weekly |

---

## 13. Dependencies

### Backend (add to requirements.txt)

```
# Already present:
groq
httpx
redis
celery

# May need to add:
prometheus_client    # metrics export
reportlab           # PDF report generation (pure Python, no native deps)
```

### Environment Variables

```
# Already configured:
GROQ_API_KEY=gsk_...
NVIDIA_API_KEY=nvapi-...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
REDIS_URL=...

# May need to add:
OPENROUTER_API_KEY=sk-or-v1-...   # T4 fallback provider
ANTHROPIC_API_KEY=sk-ant-...       # T4 elite tier
```

### Frontend

No new dependencies — uses existing Tailwind, Recharts, lucide-react, Supabase Realtime.

---

## 14. Deployment Architecture

### 14.1 Railway Multi-Service Deployment

The current single-container Railway deployment cannot support 11 Celery workers. The army requires multiple Railway services:

| Railway Service | Process | Memory | Purpose |
|----------------|---------|--------|---------|
| `web` | FastAPI + uvicorn | 512 MB | API server |
| `beat` | Celery Beat | 256 MB | Task scheduler |
| `worker-acquisition` | Celery worker (4 concurrency) | 2 GB | Acquisition division queue |
| `worker-intelligence` | Celery worker (4 concurrency) | 1 GB | Intelligence division queue |
| `worker-quality` | Celery worker (4 concurrency) | 1 GB | Quality division queue |
| `worker-ops-research` | Celery worker (2 concurrency) | 512 MB | Operations + Research + Command queues (combined — low volume) |
| `worker-legacy` | Celery worker (4 concurrency) | 1 GB | Existing `default` + `agents` queues (backward compat) |

**Total: 7 Railway services, ~6.3 GB total RAM**

### 14.2 Progressive Scaling Plan

- **Phase 1-3:** Run all army queues on a single combined worker (like today). Test with reduced concurrency.
- **Phase 4:** Split acquisition into its own worker (highest throughput).
- **Phase 5:** Split intelligence into its own worker (LLM-heavy).
- **Phase 6+:** Split remaining divisions as volume warrants.

Each Railway service shares the same Docker image but runs a different Celery command:
```bash
# worker-acquisition
celery -A app.tasks.celery_app worker -Q army_acquisition -c 4 --max-tasks-per-child=200

# worker-intelligence
celery -A app.tasks.celery_app worker -Q army_intelligence -c 4 --max-tasks-per-child=100
```

---

## 15. Backpressure & Flow Control

### 15.1 Problem

At 50K jobs/day ingestion target, Acquisition can produce faster than Intelligence can enrich. Without backpressure, the `army_missions` pending queue grows unboundedly and Redis memory fills up.

### 15.2 Solution: Pull-Based Work Queues with Depth Limits

Each division pulls work from a bounded queue rather than being pushed:

```
Acquisition completes scrape batch
    │
    ▼
INSERT jobs into Supabase with status='raw'
    │
    ▼
Check: pending_enrichment_count < MAX_PENDING (10,000)
   ├── YES → Emit stream:new_jobs_batch signal
   └── NO  → Skip signal, log backpressure warning
              Intelligence will pull when ready

Intelligence division pulls:
    SELECT * FROM jobs WHERE status='raw'
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED    -- concurrent-safe
```

### 15.3 Queue Depth Limits

| Queue | Max Pending | Action When Full |
|-------|------------|------------------|
| Raw jobs awaiting enrichment | 10,000 | Acquisition pauses non-critical sources |
| Enriched jobs awaiting validation | 5,000 | Intelligence slows batch size |
| Signals awaiting processing | 1,000 | Oldest signals auto-acknowledged |
| Missions awaiting execution | 500 per division | New tasks queued with lower priority |

### 15.4 Redis Stream Trimming

All Redis Streams are trimmed to prevent unbounded memory growth:
- `stream:*` channels: MAXLEN ~10,000 entries
- `warroom:*` channels: MAXLEN ~1,000 entries
- Consumer groups auto-acknowledge messages older than 1 hour

---

## 16. Agent Health & SLA Definitions

### 16.1 Agent Health States

| State | Condition | Action |
|-------|-----------|--------|
| `active` | Last heartbeat <120s ago, error rate <10% | Normal operation |
| `degraded` | Error rate 10-30% or heartbeat >120s | Alert squad leader, increase monitoring |
| `paused` | Manually paused or circuit breaker open | No tasks dispatched, probe for recovery |
| `cooldown` | 3+ consecutive failures | Exponential backoff: 30s → 60s → 120s → max 300s |
| `disabled` | Manually disabled or >50% error rate for 1h | Requires manual re-enable via API or War Room |
| `training` | Self-learning calibration in progress | Runs shadow tasks, results not committed |

### 16.2 Division Health Aggregation

| Division Status | Condition |
|----------------|-----------|
| `operational` | >90% of agents active |
| `degraded` | 70-90% of agents active, or any squad fully down |
| `critical` | <70% of agents active, or commander agent down |
| `offline` | Commander agent unreachable for >5 minutes |

### 16.3 SLA Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Army uptime | 99.5% | At least 4/6 divisions operational |
| MTTR (auto-recovery) | <5 min | Time from agent failure to auto-recovery |
| MTTR (manual) | <30 min | Time from alert to human intervention |
| Data freshness | <2h | Max age of newest job from any active source |
| Enrichment latency (p95) | <5s | Time from raw job insert to enriched status |
| War Room data lag | <30s | Time from mission completion to dashboard update |

---

## 17. Connection Pooling

### 17.1 Shared HTTP Clients

The TierRouter MUST use shared `httpx.AsyncClient` instances per provider rather than creating new connections per call. At 100K operations/day, per-call client creation causes file descriptor exhaustion.

```python
class TierRouter:
    def __init__(self, ...):
        # Shared connection pools — created once, reused for all calls
        self._clients = {
            "groq": httpx.AsyncClient(
                base_url="https://api.groq.com",
                timeout=30,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            ),
            "nvidia_nim": httpx.AsyncClient(
                base_url="https://integrate.api.nvidia.com",
                timeout=60,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            ),
            "openrouter": httpx.AsyncClient(
                base_url="https://openrouter.ai",
                timeout=60,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            ),
            "anthropic": httpx.AsyncClient(
                base_url="https://api.anthropic.com",
                timeout=60,
                limits=httpx.Limits(max_connections=5, max_keepalive_connections=3),
            ),
        }

    async def close(self):
        """Call on worker shutdown."""
        for client in self._clients.values():
            await client.aclose()
```

### 17.2 LLM Model Configuration

Model names MUST NOT be hardcoded. Store in `army_tier_config` or environment variables to allow updates without code changes:

```python
# Default model map — overridable via ARMY_TIER_MODELS env var (JSON)
DEFAULT_MODEL_MAP = {
    "t1_groq": os.getenv("ARMY_T1_MODEL", "llama-3.3-70b-versatile"),
    "t2_groq": os.getenv("ARMY_T2_MODEL", "llama-3.3-70b-versatile"),
    "t3_nvidia": os.getenv("ARMY_T3_MODEL", "meta/llama-3.1-405b-instruct"),
    "t4_anthropic": os.getenv("ARMY_T4_MODEL", "claude-haiku-4-5-20251001"),
}
```

---

## 18. War Room Real-Time Strategy

### 18.1 SSE Over Supabase Realtime for High-Volume Tables

At 100K operations/day (~1,150 inserts/min), `army_missions` will saturate Supabase Realtime connections. Use Server-Sent Events (SSE) from the backend API as the primary channel:

| Table | Real-Time Method | Rationale |
|-------|-----------------|-----------|
| `army_missions` | SSE via `GET /army/missions/live` | High volume — 1K+ inserts/min |
| `army_signals` | SSE via `GET /army/signals/stream` | Medium volume — 10-100/min |
| `army_division_status` | Supabase Realtime | Low volume — 6 updates/30s, perfect for Realtime |
| `army_agents` | Supabase Realtime | Low volume — heartbeat updates |

### 18.2 SSE Implementation

```python
@router.get("/army/missions/live")
async def mission_stream():
    """SSE stream of recent missions for War Room MissionFeed."""
    async def event_generator():
        pubsub = redis.pubsub()
        await pubsub.subscribe("warroom:missions")
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield f"data: {message['data']}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## 19. Legacy Migration: swarm_metrics

### 19.1 Transition Plan

The existing `swarm_metrics` table continues to receive writes during Phases 1-3 (backward compatibility). Starting Phase 4:

1. All new agent tasks write to `army_missions` instead of `swarm_metrics`
2. A compatibility shim copies `army_missions` summaries to `swarm_metrics` for any legacy monitoring
3. After Phase 6, `swarm_metrics` is deprecated — reads redirected to `army_missions` views
4. After Phase 7, `swarm_metrics` table is archived and dropped

### 19.2 AgentReport Backward Compatibility

`AgentReport` is a superset of the existing `SubAgentResult`. During migration, both types are accepted:

```python
@dataclass
class AgentReport:
    # SubAgentResult-compatible fields:
    success: bool              # maps to status == "success"
    data: dict
    error: str | None
    duration_ms: int
    llm_calls: int
    # Extended fields:
    agent_id: str
    mission_id: UUID
    status: str
    items_processed: int
    items_created: int
    items_updated: int
    errors: list[str]
    tier_used: int
    llm_cost_usd: float
    signals_emitted: list[str]

    def to_sub_agent_result(self) -> SubAgentResult:
        """Backward-compatible conversion."""
        return SubAgentResult(
            success=self.status == "success",
            data=self.data,
            error=self.errors[0] if self.errors else None,
            duration_ms=self.duration_ms,
            llm_calls=self.llm_calls,
        )
```

---

## 20. Phased Rollout with Duration Estimates

| Phase | Description | Duration | Depends On | Go/No-Go Criteria |
|-------|------------|----------|------------|-------------------|
| **1** | Base framework: ArmyAgent, TierRouter, SignalBus + DB tables | 3-4 days | None | All base classes pass unit tests, tables created in Supabase |
| **2** | Reorganize existing 9 agents into division structure | 2-3 days | Phase 1 | All existing `agent.*` tasks still work, new `army.*` entry points functional |
| **3** | Build Supreme Command: AEGIS + 9 staff agents | 2-3 days | Phase 2 | AEGIS can collect division reports, heartbeats flowing |
| **4** | Add new squads: Golf, Lima, Oscar, Sierra, Tango, Uniform | 3-4 days | Phase 2 | New agents completing missions, metrics logged to army_missions |
| **5** | War Room dashboard frontend | 2-3 days | Phase 3 | Dashboard shows live division status, mission feed, tier routing stats |
| **6** | Self-learning routing + Mentor agent | 2 days | Phase 4 | Routing history being logged, tier adjustments happening |
| **7** | Victor, Yankee, Zulu squads + full army activation | 2-3 days | Phase 4 | All 181 agents registered and operational, legacy task deprecation begins |

**Total estimated: 16-23 days**

Phases 4 and 5 can run in parallel (backend new agents + frontend dashboard).
Phases 6 and 7 can run in parallel (self-learning + remaining squads).

**Overlap potential reduces total to ~12-16 days.**
