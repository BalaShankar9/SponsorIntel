# Sub-Project 2: Agent Intelligence Engine

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Sub-Project 1 (Data Foundation)
**Blocks:** Sub-Projects 3, 4, 6

## Purpose

Transform the agent army from a task-execution system into a self-learning, cost-aware, memory-equipped intelligence engine. Agents learn from every enrichment run, optimize their strategies, and track costs per operation.

## Components

### 1. LiteLLM Proxy Integration

**What:** Replace direct API calls in TierRouter with LiteLLM proxy for unified model management, cost tracking, fallbacks, and caching.

**Why:** Current TierRouter manually manages httpx clients per provider. LiteLLM handles 100+ providers with automatic retries, load balancing, and cost tracking built in.

**Architecture:**
```
ArmyAgent → TierRouter → LiteLLM Proxy → Groq/NVIDIA/Anthropic/OpenRouter
                              ↓
                         Langfuse (tracing)
```

**Changes:**
- Deploy LiteLLM as a sidecar service on Railway (Docker container)
- Refactor `tier_router.py` to call LiteLLM's OpenAI-compatible endpoint instead of direct provider APIs
- Keep T0 (regex rules) as-is — only T1-T4 route through LiteLLM
- Configure fallback chains in LiteLLM config (replaces our manual FALLBACK_CHAINS)
- Budget alerts: LiteLLM tracks spend per model, alert when daily/monthly budget exceeded

**LiteLLM Config:**
```yaml
model_list:
  - model_name: "army-t1"
    litellm_params:
      model: "groq/llama-3.1-8b-instant"
      api_key: os.environ/GROQ_API_KEY
  - model_name: "army-t2"
    litellm_params:
      model: "groq/llama-3.3-70b-versatile"
      api_key: os.environ/GROQ_API_KEY
  - model_name: "army-t3"
    litellm_params:
      model: "nvidia_nim/meta/llama-3.1-405b-instruct"
      api_key: os.environ/NVIDIA_NIM_API_KEY
  - model_name: "army-t4"
    litellm_params:
      model: "anthropic/claude-haiku-4-5-20251001"
      api_key: os.environ/ANTHROPIC_API_KEY
    litellm_params:
      model: "openrouter/anthropic/claude-3.5-sonnet"
      api_key: os.environ/OPENROUTER_API_KEY

litellm_settings:
  cache: true
  cache_params:
    type: "redis"
    host: os.environ/REDIS_HOST
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
  set_verbose: false

general_settings:
  max_budget: 50  # $50/month hard cap
  budget_duration: "1mo"
```

### 2. Langfuse Observability

**What:** Trace every LLM call with cost, latency, input/output, and custom metadata (agent_id, division, mission_type).

**Why:** Currently blind to LLM costs. With 140K sponsors to enrich, need to know cost per enrichment and identify wasteful prompts.

**Integration:**
- Self-host Langfuse on Railway (single Docker container, Postgres for storage)
- Or use Langfuse Cloud free tier (50K observations/month)
- Tag traces with: `agent_id`, `division`, `mission_type`, `company_id`, `tier`
- Dashboard shows: cost per division, cost per enrichment, prompt efficiency scores

### 3. Pydantic AI Agent Migration

**What:** Migrate critical agents to Pydantic AI framework for type-safe, validated outputs.

**Why:** Current agents return dicts with no schema validation. A scraper returning `{"salary": "competitive"}` instead of `{"salary_min": 45000, "salary_max": 55000}` silently corrupts data. Pydantic AI enforces output schemas.

**Migration targets (ordered by impact):**
1. `EnrichmentAgent` → Pydantic AI with `EnrichmentResult` schema
2. `ValidatorAgent` → Pydantic AI with `ValidationResult` schema
3. `IntelClassifier` → Pydantic AI with `ClassificationResult` schema
4. `IntelAnalyzer` → Pydantic AI with `AnalysisResult` schema

**Pattern:**
```python
from pydantic_ai import Agent
from pydantic import BaseModel

class EnrichmentResult(BaseModel):
    salary_min: int | None
    salary_max: int | None
    sponsorship_score: float  # 0-100
    is_on_shortage_list: bool
    soc_code: str | None
    work_model: str | None  # remote/hybrid/onsite
    seniority: str | None

enrichment_agent = Agent(
    'groq:llama-3.3-70b-versatile',
    result_type=EnrichmentResult,
    system_prompt="You are a UK visa sponsorship analyst...",
)
```

### 4. Five-Tier Memory Hierarchy (from SecProbe)

**What:** Give agents persistent memory across runs so they learn from past enrichment outcomes.

**Architecture (adapted from SecProbe):**

| Tier | Name | Storage | TTL | Purpose |
|------|------|---------|-----|---------|
| L1 | Working Memory | Redis | 1 hour | Current scan batch state |
| L2 | Episodic Memory | Supabase | 90 days | Per-company enrichment episodes |
| L3 | Semantic Memory | Supabase | Permanent | Learned patterns ("fintech sponsors often have A rating") |
| L4 | Procedural Memory | Supabase | Permanent | Effective strategies ("check LinkedIn before Glassdoor for tech companies") |
| L5 | Federated Memory | Redis Streams | 7 days | Cross-division intel sharing |

**Schema:**
```sql
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL,
    memory_tier VARCHAR(5) NOT NULL CHECK (memory_tier IN ('L1', 'L2', 'L3', 'L4', 'L5')),
    memory_key VARCHAR(200) NOT NULL,
    memory_value JSONB NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    decay_rate FLOAT DEFAULT 0.05,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_memory_lookup ON agent_memory (agent_id, memory_tier, memory_key);
CREATE INDEX idx_agent_memory_expiry ON agent_memory (expires_at) WHERE expires_at IS NOT NULL;
```

**Memory decay:** Each memory has a confidence score that decays over time. L2 (episodic) decays at 0.05/day. L3/L4 (semantic/procedural) don't decay but get reinforced on access. Agent queries memory before each enrichment: "What do I know about this company sector?"

### 5. Reinforcement Learning Loop (from SecProbe)

**What:** Agents learn which enrichment strategies produce the best results for different company types.

**State space:** `(company_sector, company_size, region, sponsor_rating, enrichment_level)`

**Action space:** Which enrichment source to prioritize, which LLM tier to use, which sub-agents to activate.

**Reward signals:**
- +10: Visa sponsorship confirmed (job matched to sponsor with high confidence)
- +5: New job discovered for sponsor
- +2: Useful enrichment data found (website, LinkedIn, careers page)
- -3: Stale/duplicate data produced
- -5: API error or timeout
- -10: False positive (flagged non-sponsoring company as sponsor)

**Implementation:**
- Q-learning table stored in `agent_learning` Supabase table
- Experience replay buffer in Redis (last 10,000 episodes)
- Epsilon-greedy exploration (ε=0.1 initially, decay to 0.01)
- Weekly learning update: aggregate rewards, update Q-table
- Dashboard shows agent skill levels per company sector

**Schema:**
```sql
CREATE TABLE agent_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(50) NOT NULL,
    state_key VARCHAR(200) NOT NULL,
    action VARCHAR(100) NOT NULL,
    q_value FLOAT DEFAULT 0.0,
    visit_count INTEGER DEFAULT 0,
    avg_reward FLOAT DEFAULT 0.0,
    last_updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_agent_learning_sa ON agent_learning (agent_id, state_key, action);
```

### 6. SafetyGovernor for Rate Limiting (from SecProbe)

**What:** Centralized rate limiter that all agents must pass through before making external requests.

**Rules:**
- Companies House API: max 600 req/min (free tier)
- Glassdoor: max 100 req/hour (scraping)
- LinkedIn: max 50 req/hour (scraping)
- Job board APIs: per-source limits
- Global: max 10,000 external requests/hour across all agents
- Budget: max $X/day LLM spend (configurable)

**Implementation:**
- Redis-backed token bucket per domain
- Every agent calls `governor.approve(domain, cost_estimate)` before external request
- Governor returns `approved`, `rate_limited` (retry after N seconds), or `budget_exceeded` (halt)
- Audit log of every approval/denial in `governor_audit_log` table
- Admin API endpoint to view/adjust limits in real-time

## Success Criteria

1. Every LLM call is traced in Langfuse with cost attribution
2. Monthly LLM spend stays under $50 budget cap
3. Enrichment agents produce type-validated outputs (zero schema violations)
4. Agent memory persists across runs — repeated enrichment of same company sector is faster
5. Q-learning table shows measurable improvement in enrichment success rate over 30 days
6. SafetyGovernor prevents rate limit violations (zero 429 errors from external APIs)
