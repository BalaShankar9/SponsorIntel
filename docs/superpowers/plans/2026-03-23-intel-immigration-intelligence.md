# Intel — Immigration Intelligence Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time immigration news and policy tracker at /intel with AI-powered scanning of 20+ sources, classification, impact analysis, deduplication, and personalized notifications.

**Architecture:** Celery Beat scheduled scanner tasks fetch from GOV.UK, BBC, Guardian, Reddit, legal blogs. Items stored in `intel_items` table, classified by Groq LLM, analyzed by NVIDIA NIM LLM. Frontend shows live feed via Supabase Realtime. Sub-pages: timeline, calendar, stats, policies, lawyers.

**Tech Stack:** FastAPI, Celery Beat, Supabase (PostgreSQL + Realtime), Groq API, NVIDIA NIM API, feedparser (RSS), BeautifulSoup4, httpx, Next.js 14, Tailwind CSS, Recharts

---

## Task 1: Supabase SQL Migration — Core Tables

**Files:**
- Create: `supabase/migrations/20260323000001_intel_core_tables.sql`

- [ ] 1.1. Create the migration file with `intel_items` table, trigger, and indexes:

```sql
-- supabase/migrations/20260323000001_intel_core_tables.sql

-- Enable pg_trgm for dedup fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- intel_items: core feed items from all scanners
-- ============================================================
CREATE TABLE intel_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(1000) NOT NULL,
    source_name VARCHAR(200) NOT NULL,
    source_url VARCHAR(2000),
    source_category VARCHAR(50) NOT NULL CHECK (source_category IN ('government', 'legal', 'news', 'community')),
    published_at TIMESTAMPTZ,
    content_text TEXT,
    content_snippet VARCHAR(500),

    -- Classification
    topic VARCHAR(50) CHECK (topic IN ('rule_change', 'policy_update', 'court_decision', 'statistics', 'opinion', 'news', 'community')),
    impact_level VARCHAR(20) CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
    visa_routes_affected TEXT[],
    nationalities_affected TEXT[],
    industries_affected TEXT[],

    -- AI Analysis
    summary TEXT,
    who_affected TEXT,
    action_required TEXT,
    before_after JSONB,

    -- Processing
    status VARCHAR(20) NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'classified', 'analyzed', 'deduped')),
    dedup_cluster_id UUID,
    scanner_agent VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_intel_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_intel_items_updated_at BEFORE UPDATE ON intel_items
FOR EACH ROW EXECUTE FUNCTION update_intel_items_updated_at();

CREATE INDEX idx_intel_items_status ON intel_items (status, created_at DESC);
CREATE INDEX idx_intel_items_topic ON intel_items (topic, created_at DESC);
CREATE INDEX idx_intel_items_impact ON intel_items (impact_level, created_at DESC);
CREATE INDEX idx_intel_items_published ON intel_items (published_at DESC);
CREATE INDEX idx_intel_items_routes ON intel_items USING gin (visa_routes_affected);
CREATE INDEX idx_intel_items_title_trgm ON intel_items USING gin (title gin_trgm_ops);

-- ============================================================
-- intel_policies: policy lifecycle tracker
-- ============================================================
CREATE TABLE intel_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('proposed', 'consultation', 'parliamentary_debate', 'enacted', 'effective')),
    visa_routes_affected TEXT[],
    source_url VARCHAR(2000),
    effective_date DATE,
    last_update_summary TEXT,
    last_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_policies_stage ON intel_policies (stage);
CREATE INDEX idx_intel_policies_routes ON intel_policies USING gin (visa_routes_affected);

-- ============================================================
-- intel_policy_follows: user follows for policies
-- ============================================================
CREATE TABLE intel_policy_follows (
    user_id UUID NOT NULL REFERENCES users(id),
    policy_id UUID NOT NULL REFERENCES intel_policies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, policy_id)
);

-- ============================================================
-- intel_calendar: upcoming immigration dates
-- ============================================================
CREATE TABLE intel_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type VARCHAR(50),
    visa_routes TEXT[],
    source_url VARCHAR(2000),
    is_confirmed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_calendar_date ON intel_calendar (event_date);

-- ============================================================
-- intel_statistics: visa grant rates, processing times, etc.
-- ============================================================
CREATE TABLE intel_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_type VARCHAR(100) NOT NULL,
    visa_route VARCHAR(100),
    nationality VARCHAR(100),
    period VARCHAR(20),
    value FLOAT NOT NULL,
    previous_value FLOAT,
    change_pct FLOAT,
    source VARCHAR(200),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_stats_type ON intel_statistics (stat_type, period);
CREATE INDEX idx_intel_stats_route ON intel_statistics (visa_route, period);
```

- [ ] 1.2. Run the migration in Supabase dashboard SQL Editor (copy-paste) or via `supabase db push`.

- [ ] 1.3. Enable Supabase Realtime on `intel_items`:
  - In Supabase Dashboard -> Database -> Replication, enable the `intel_items` table for Realtime.
  - Or run: `ALTER PUBLICATION supabase_realtime ADD TABLE intel_items;`

- [ ] 1.4. Commit:
```bash
cd "/Users/balabollineni/Sponsorship DOG"
git add supabase/migrations/20260323000001_intel_core_tables.sql
git commit -m "feat(intel): add core tables — intel_items, policies, calendar, statistics"
```

---

## Task 2: Supabase SQL Migration — Subscriptions, Notifications, Health

**Files:**
- Create: `supabase/migrations/20260323000002_intel_notifications_health.sql`

- [ ] 2.1. Create the migration file:

```sql
-- supabase/migrations/20260323000002_intel_notifications_health.sql

-- ============================================================
-- intel_subscriptions: user alert subscriptions
-- ============================================================
CREATE TABLE intel_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    filter_topics TEXT[],
    filter_visa_routes TEXT[],
    filter_nationalities TEXT[],
    filter_industries TEXT[],
    filter_min_impact VARCHAR(20) DEFAULT 'medium',
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email_instant', 'email_digest')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_subs_user ON intel_subscriptions (user_id);
CREATE INDEX idx_intel_subs_active ON intel_subscriptions (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_intel_subs_impact ON intel_subscriptions (filter_min_impact) WHERE is_active = TRUE;

-- ============================================================
-- intel_notifications: per-user notifications
-- ============================================================
CREATE TABLE intel_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    intel_item_id UUID REFERENCES intel_items(id),
    subscription_id UUID REFERENCES intel_subscriptions(id),
    title VARCHAR(500) NOT NULL,
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_notif_user ON intel_notifications (user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX idx_intel_notif_user_item ON intel_notifications (user_id, intel_item_id);

-- ============================================================
-- intel_source_health_log: scanner run health
-- ============================================================
CREATE TABLE intel_source_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(50) NOT NULL,
    scanner_task VARCHAR(100) NOT NULL,
    ran_at TIMESTAMPTZ DEFAULT now(),
    duration_ms INTEGER,
    items_fetched INTEGER DEFAULT 0,
    items_new INTEGER DEFAULT 0,
    items_filtered INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
    error_message TEXT,
    http_status_code INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    is_circuit_open BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_health_source ON intel_source_health_log (source_key, ran_at DESC);
CREATE INDEX idx_intel_health_errors ON intel_source_health_log (status, ran_at DESC) WHERE status != 'success';

-- ============================================================
-- intel_quality_samples: LLM classification accuracy tracking
-- ============================================================
CREATE TABLE intel_quality_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_item_id UUID REFERENCES intel_items(id),
    llm_topic VARCHAR(50),
    llm_impact VARCHAR(20),
    llm_confidence FLOAT,
    human_topic VARCHAR(50),
    human_impact VARCHAR(20),
    is_correct BOOLEAN,
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] 2.2. Run migration in Supabase SQL Editor.

- [ ] 2.3. Commit:
```bash
git add supabase/migrations/20260323000002_intel_notifications_health.sql
git commit -m "feat(intel): add subscriptions, notifications, health log tables"
```

---

## Task 3: Supabase SQL Migration — RLS Policies

**Files:**
- Create: `supabase/migrations/20260323000003_intel_rls_policies.sql`

- [ ] 3.1. Create RLS migration:

```sql
-- supabase/migrations/20260323000003_intel_rls_policies.sql

-- intel_items: public read (classified/analyzed only), service role write
ALTER TABLE intel_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read analyzed items" ON intel_items FOR SELECT
    USING (status IN ('classified', 'analyzed'));
CREATE POLICY "Service role manages items" ON intel_items FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_policies: public read, service role write
ALTER TABLE intel_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read policies" ON intel_policies FOR SELECT USING (true);
CREATE POLICY "Service role manages policies" ON intel_policies FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_policy_follows: user-scoped
ALTER TABLE intel_policy_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON intel_policy_follows FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- intel_subscriptions: user-scoped
ALTER TABLE intel_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON intel_subscriptions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- intel_notifications: user reads, service role writes
ALTER TABLE intel_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON intel_notifications FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON intel_notifications FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts notifications" ON intel_notifications FOR INSERT
    TO service_role WITH CHECK (true);

-- intel_calendar: public read, service role write
ALTER TABLE intel_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read calendar" ON intel_calendar FOR SELECT USING (true);
CREATE POLICY "Service role manages calendar" ON intel_calendar FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_statistics: public read, service role write
ALTER TABLE intel_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read statistics" ON intel_statistics FOR SELECT USING (true);
CREATE POLICY "Service role manages statistics" ON intel_statistics FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_source_health_log: service role only
ALTER TABLE intel_source_health_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages health log" ON intel_source_health_log FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_quality_samples: service role only
ALTER TABLE intel_quality_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages quality samples" ON intel_quality_samples FOR ALL
    TO service_role USING (true) WITH CHECK (true);
```

- [ ] 3.2. Run migration in Supabase SQL Editor.

- [ ] 3.3. Commit:
```bash
git add supabase/migrations/20260323000003_intel_rls_policies.sql
git commit -m "feat(intel): add RLS policies for all intel tables"
```

---

## Task 4: Add Config Settings for Groq, NVIDIA NIM, Reddit

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] 4.1. Add new settings fields to the `Settings` class:

```python
# Add after the existing "Notifications" section (after line 38) in config.py:

    # Groq (for intel classification + digest)
    groq_api_key: str = ""

    # NVIDIA NIM (for intel impact analysis)
    nvidia_nim_api_key: str = ""
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"

    # Reddit API (for intel social scanner)
    reddit_client_id: str = ""
    reddit_client_secret: str = ""

    # Resend (for email notifications)
    resend_api_key: str = ""
```

- [ ] 4.2. Commit:
```bash
git add backend/app/core/config.py
git commit -m "feat(intel): add Groq, NVIDIA NIM, Reddit, Resend config settings"
```

---

## Task 5: Extend LLM Service with Groq and NVIDIA NIM Providers

**Files:**
- Modify: `backend/app/agents/llm_service.py`

- [ ] 5.1. Update `LLMService.__init__` to accept new provider config:

```python
# Replace the __init__ method:

    def __init__(
        self,
        backend: str = "ollama",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:mini",
        anthropic_key: str | None = None,
        groq_api_key: str | None = None,
        nvidia_nim_api_key: str | None = None,
        nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1",
        redis=None,
    ):
        self.backend = backend
        self.ollama_url = ollama_url
        self.ollama_model = ollama_model
        self.anthropic_key = anthropic_key
        self.groq_api_key = groq_api_key
        self.nvidia_nim_api_key = nvidia_nim_api_key
        self.nvidia_nim_base_url = nvidia_nim_base_url
        self.redis = redis
        self._healthy = True
        self._consecutive_failures = 0
```

- [ ] 5.2. Add `_groq_complete` method after `_anthropic_complete`:

```python
    async def _groq_complete(self, prompt: str, system: str, timeout: int) -> str:
        """Complete via Groq API (OpenAI-compatible endpoint)."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": "llama-3.1-70b-versatile",
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
            }
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=body,
                headers={
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
```

- [ ] 5.3. Add `_nvidia_nim_complete` method:

```python
    async def _nvidia_nim_complete(self, prompt: str, system: str, timeout: int) -> str:
        """Complete via NVIDIA NIM API (OpenAI-compatible endpoint)."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            body = {
                "model": "meta/llama-3.1-405b-instruct",
                "messages": [
                    {"role": "system", "content": system or "You are a helpful assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 1500,
            }
            r = await client.post(
                f"{self.nvidia_nim_base_url}/chat/completions",
                json=body,
                headers={
                    "Authorization": f"Bearer {self.nvidia_nim_api_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
```

- [ ] 5.4. Add a `complete_with_provider` method for explicit provider selection:

```python
    async def complete_with_provider(
        self,
        provider: str,
        prompt: str,
        system: str = "",
        cache_key: str | None = None,
        timeout: int = 30,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str | None:
        """Complete using a specific provider (groq, nvidia_nim, ollama, anthropic)."""
        # Check cache
        if cache_key and self.redis:
            cached = await self.redis.get(f"llm:{cache_key}")
            if cached:
                return cached.decode() if isinstance(cached, bytes) else cached

        result = None
        try:
            if provider == "groq":
                result = await self._groq_complete(prompt, system, timeout)
            elif provider == "nvidia_nim":
                result = await self._nvidia_nim_complete(prompt, system, timeout)
            elif provider == "ollama":
                result = await self._ollama_complete(prompt, system, timeout)
            elif provider == "anthropic":
                result = await self._anthropic_complete(prompt, system, timeout)
            else:
                logger.error(f"Unknown LLM provider: {provider}")
                return None
        except Exception as e:
            logger.error(f"LLM completion failed ({provider}): {e}")
            return None

        # Cache result
        if result and cache_key and self.redis:
            await self.redis.set(f"llm:{cache_key}", result, ex=86400 * 30)

        return result

    async def structured_output_with_provider(
        self,
        provider: str,
        prompt: str,
        system: str = "Respond with valid JSON only. No markdown.",
    ) -> dict | list | None:
        """Parse LLM output as JSON using a specific provider, with retry."""
        for attempt in range(2):
            raw = await self.complete_with_provider(provider, prompt, system)
            if not raw:
                return None
            try:
                cleaned = raw.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
                return json.loads(cleaned)
            except json.JSONDecodeError:
                if attempt == 0:
                    continue
                logger.warning(f"Failed to parse JSON from {provider}: {raw[:200]}")
                return None
```

- [ ] 5.5. Update `health_check` to include Groq/NIM:

```python
    async def health_check(self) -> bool:
        """Check if LLM backend is available."""
        if self.backend == "disabled":
            return False
        if self.backend == "groq":
            return bool(self.groq_api_key)
        if self.backend == "nvidia_nim":
            return bool(self.nvidia_nim_api_key)
        # ... existing ollama / anthropic checks ...
```

- [ ] 5.6. Commit:
```bash
git add backend/app/agents/llm_service.py
git commit -m "feat(intel): extend LLMService with Groq and NVIDIA NIM providers"
```

---

## Task 6: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/intel.py`

- [ ] 6.1. Create the schema file with all Pydantic V2 models from the spec. The file is defined verbatim in the spec (lines 613-1032). Copy the full content from the spec's "Pydantic Schemas" section into `backend/app/schemas/intel.py`. The file starts with:

```python
"""Intel feature Pydantic V2 schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---- Enums as literals (avoid DB-level Enum migration churn) ----

SourceCategory = str  # "government" | "legal" | "news" | "community"
IntelTopic = str      # "rule_change" | "policy_update" | "court_decision" | "statistics" | "opinion" | "news" | "community"
ImpactLevel = str     # "critical" | "high" | "medium" | "low"
PolicyStage = str     # "proposed" | "consultation" | "parliamentary_debate" | "enacted" | "effective"
NotifChannel = str    # "in_app" | "email_instant" | "email_digest"

VALID_TOPICS = {"rule_change", "policy_update", "court_decision", "statistics", "opinion", "news", "community"}
VALID_IMPACTS = {"critical", "high", "medium", "low"}
VALID_STAGES = {"proposed", "consultation", "parliamentary_debate", "enacted", "effective"}
VALID_CHANNELS = {"in_app", "email_instant", "email_digest"}


class IntelItemBase(BaseModel):
    title: str = Field(..., max_length=1000)
    source_name: str = Field(..., max_length=200)
    source_url: Optional[str] = Field(None, max_length=2000)
    source_category: SourceCategory
    published_at: Optional[datetime] = None
    content_snippet: Optional[str] = Field(None, max_length=500)

    @field_validator("source_category")
    @classmethod
    def validate_source_category(cls, v: str) -> str:
        if v not in {"government", "legal", "news", "community"}:
            raise ValueError("source_category must be one of: government, legal, news, community")
        return v


class IntelItemSummary(IntelItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    topic: Optional[IntelTopic] = None
    impact_level: Optional[ImpactLevel] = None
    visa_routes_affected: Optional[list[str]] = None
    summary: Optional[str] = None
    status: str
    created_at: datetime


class IntelItemDetail(IntelItemSummary):
    content_text: Optional[str] = None
    nationalities_affected: Optional[list[str]] = None
    industries_affected: Optional[list[str]] = None
    who_affected: Optional[str] = None
    action_required: Optional[str] = None
    before_after: Optional[dict] = None
    dedup_cluster_id: Optional[uuid.UUID] = None
    scanner_agent: Optional[str] = None
    updated_at: datetime


class IntelFeedResponse(BaseModel):
    data: list[IntelItemSummary]
    total: int
    page: int = Field(..., ge=1)
    pages: int = Field(..., ge=0)
    per_page: int = Field(20, ge=1, le=100)


class IntelFeedQuery(BaseModel):
    topic: Optional[IntelTopic] = None
    impact: Optional[ImpactLevel] = None
    visa_route: Optional[str] = None
    nationality: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    per_page: int = Field(20, ge=1, le=100)

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TOPICS:
            raise ValueError(f"topic must be one of: {VALID_TOPICS}")
        return v

    @field_validator("impact")
    @classmethod
    def validate_impact(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_IMPACTS:
            raise ValueError(f"impact must be one of: {VALID_IMPACTS}")
        return v


class TimelineNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    published_at: Optional[datetime] = None
    impact_level: Optional[ImpactLevel] = None
    visa_routes_affected: Optional[list[str]] = None
    summary: Optional[str] = None
    before_after: Optional[dict] = None


class TimelineResponse(BaseModel):
    nodes: list[TimelineNode]
    total: int


class IntelCalendarEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    event_date: date
    event_type: Optional[str] = None
    visa_routes: Optional[list[str]] = None
    source_url: Optional[str] = Field(None, max_length=2000)
    is_confirmed: bool = True


class CalendarResponse(BaseModel):
    events: list[IntelCalendarEvent]
    month: int = Field(..., ge=1, le=12)
    year: int


class IntelStatistic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    stat_type: str = Field(..., max_length=100)
    visa_route: Optional[str] = Field(None, max_length=100)
    nationality: Optional[str] = Field(None, max_length=100)
    period: Optional[str] = Field(None, max_length=20)
    value: float
    previous_value: Optional[float] = None
    change_pct: Optional[float] = None
    source: Optional[str] = Field(None, max_length=200)
    published_at: Optional[datetime] = None


class StatsResponse(BaseModel):
    statistics: list[IntelStatistic]
    total: int
    visa_route: Optional[str] = None


class PolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    stage: PolicyStage
    visa_routes_affected: Optional[list[str]] = None
    source_url: Optional[str] = Field(None, max_length=2000)
    effective_date: Optional[date] = None
    last_update_summary: Optional[str] = None
    last_updated_at: Optional[datetime] = None
    created_at: datetime
    is_followed: bool = False

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        if v not in VALID_STAGES:
            raise ValueError(f"stage must be one of: {VALID_STAGES}")
        return v


class PolicyListResponse(BaseModel):
    policies: list[PolicyResponse]
    total: int


class SubscriptionCreate(BaseModel):
    filter_topics: Optional[list[str]] = None
    filter_visa_routes: Optional[list[str]] = None
    filter_nationalities: Optional[list[str]] = None
    filter_industries: Optional[list[str]] = None
    filter_min_impact: ImpactLevel = "medium"
    channel: NotifChannel = "in_app"

    @field_validator("filter_topics")
    @classmethod
    def validate_topics(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None:
            invalid = set(v) - VALID_TOPICS
            if invalid:
                raise ValueError(f"Invalid topics: {invalid}")
        return v

    @field_validator("filter_min_impact")
    @classmethod
    def validate_min_impact(cls, v: str) -> str:
        if v not in VALID_IMPACTS:
            raise ValueError(f"filter_min_impact must be one of: {VALID_IMPACTS}")
        return v

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        if v not in VALID_CHANNELS:
            raise ValueError(f"channel must be one of: {VALID_CHANNELS}")
        return v


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    filter_topics: Optional[list[str]] = None
    filter_visa_routes: Optional[list[str]] = None
    filter_nationalities: Optional[list[str]] = None
    filter_industries: Optional[list[str]] = None
    filter_min_impact: str
    channel: str
    is_active: bool
    created_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    intel_item_id: Optional[uuid.UUID] = None
    subscription_id: Optional[uuid.UUID] = None
    title: str = Field(..., max_length=500)
    body: Optional[str] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime
    item_impact_level: Optional[ImpactLevel] = None
    item_source_name: Optional[str] = None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    pages: int


class DigestSection(BaseModel):
    heading: str
    items: list[IntelItemSummary]


class DigestPreviewResponse(BaseModel):
    subject: str
    generated_at: datetime
    top_items: list[IntelItemSummary]
    statistics_snapshot: list[IntelStatistic]
    upcoming_calendar: list[IntelCalendarEvent]
    personalized_items: list[IntelItemSummary]
    sections: list[DigestSection]


class LawyerSearchRequest(BaseModel):
    visa_route: str = Field(..., min_length=2, max_length=100)
    nationality: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=200)
    case_complexity: str = Field("straightforward", pattern="^(straightforward|complex|appeal)$")
    budget_range: str | None = Field(None, max_length=100)
    language_pref: str | None = Field(None, max_length=100)
    page: int = Field(1, ge=1)
    per_page: int = Field(10, ge=1, le=20)


class LawyerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    firm_name: str | None
    registration_type: str
    registration_number: str
    oisc_level: int | None
    accreditations: list[str]
    practice_areas: list[str]
    city: str | None
    offers_remote: bool
    combined_rating: float | None
    google_review_count: int
    trustpilot_review_count: int
    fee_initial_consultation: str | None
    fee_hourly_range: str | None
    website: str | None
    distance_miles: float | None = None
    match_score: float
    why_matched: str


class LawyerSearchResponse(BaseModel):
    results: list[LawyerSummary]
    total: int
    page: int
    per_page: int
    search_id: UUID


class LawyerDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    firm_name: str | None
    registration_type: str
    registration_number: str
    oisc_level: int | None
    practising_status: str
    accreditations: list[str]
    practice_areas: list[str]
    languages: list[str]
    fee_initial_consultation: str | None
    fee_hourly_range: str | None
    fee_fixed_range: str | None
    offers_legal_aid: bool
    address: str | None
    city: str | None
    postcode: str | None
    offers_remote: bool
    google_rating: float | None
    google_review_count: int
    trustpilot_rating: float | None
    trustpilot_review_count: int
    combined_rating: float | None
    website: str | None
    email: str | None
    phone: str | None
    bio: str | None
    profile_photo_url: str | None
    disciplinary_history: list[dict]
    last_verified_at: datetime | None
    source_url: str | None


class LawyerReviewItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    source: str
    author_name: str | None
    rating: float
    review_text: str | None
    review_date: datetime | None
    visa_route_mentioned: str | None
    sentiment: str | None


class LawyerReviewsResponse(BaseModel):
    reviews: list[LawyerReviewItem]
    total: int
    page: int
    per_page: int
    avg_rating: float | None


class LawyerCompareResponse(BaseModel):
    lawyers: list[LawyerDetail]
    comparison_dimensions: list[str]
```

- [ ] 6.2. Commit:
```bash
git add backend/app/schemas/intel.py
git commit -m "feat(intel): add all Pydantic V2 schemas for intel module"
```

---

## Task 7: GOV.UK Scanner — Celery Task

**Files:**
- Create: `backend/app/scanners/__init__.py`
- Create: `backend/app/scanners/intel_gov.py`

- [ ] 7.1. Create `backend/app/scanners/__init__.py` (empty file).

- [ ] 7.2. Create `backend/app/scanners/intel_gov.py`:

```python
"""
Intel scanner: GOV.UK government sources.

Scans 4 Atom RSS feeds (UKVI, Home Office, MAC, ONS)
plus 11 Immigration Rules pages via content-hash diffing.
"""

import hashlib
import json
import logging
import xml.etree.ElementTree as ET
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

ATOM_NS = "{http://www.w3.org/2005/Atom}"

GOV_UK_FEEDS = {
    "ukvi": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=uk-visas-and-immigration&order=updated-newest",
        "source_name": "GOV.UK UKVI",
    },
    "home_office": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=home-office&order=updated-newest",
        "source_name": "GOV.UK Home Office",
    },
    "mac": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=migration-advisory-committee&order=updated-newest",
        "source_name": "GOV.UK MAC",
    },
    "ons_migration": {
        "feed_url": "https://www.gov.uk/search/all.atom?organisations[]=office-for-national-statistics&topics[]=population-and-migration",
        "source_name": "GOV.UK ONS Migration",
    },
}

GOV_UK_IMMIGRATION_RULES_PAGES = [
    "https://www.gov.uk/guidance/immigration-rules",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-worker",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-global-talent",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-graduate-route",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-innovator-founder",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-high-potential-individual",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-scale-up",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-occupations",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-immigration-salary-list",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-part-1-leave-to-enter-or-stay-in-the-uk",
    "https://www.gov.uk/guidance/immigration-rules/immigration-rules-part-6a-the-points-based-system",
]

IMMIGRATION_KEYWORDS = [
    "immigration", "immigrant", "visa", "visas", "sponsor", "sponsorship",
    "home office", "ukvi", "skilled worker", "points-based", "points based",
    "right to work", "migrant", "migration", "asylum", "deportation",
    "windrush", "tier 2", "tier 5", "global talent", "graduate visa",
    "innovator founder", "shortage occupation", "sol review", "mac report",
    "immigration rules", "statement of changes", "net migration",
    "biometric residence", "brp", "ics", "cos", "certificate of sponsorship",
    "settled status", "pre-settled", "eu settlement", "indefinite leave",
    "ilr", "naturalisation", "citizenship", "border force",
]


def is_immigration_relevant(title: str, snippet: str | None = None) -> bool:
    """Quick keyword check before sending to LLM classifier."""
    text = (title + " " + (snippet or "")).lower()
    return any(kw in text for kw in IMMIGRATION_KEYWORDS)


def parse_govuk_atom(xml_text: str, source_name: str) -> list[dict]:
    """Parse GOV.UK Atom feed into raw intel items."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse Atom XML from {source_name}: {e}")
        return []

    items = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        title_el = entry.find(f"{ATOM_NS}title")
        link_el = entry.find(f"{ATOM_NS}link")
        updated_el = entry.find(f"{ATOM_NS}updated")
        summary_el = entry.find(f"{ATOM_NS}summary")

        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        snippet = (summary_el.text or "")[:500] if summary_el is not None else None

        if not title:
            continue

        items.append({
            "title": title,
            "source_url": link_el.attrib.get("href", "") if link_el is not None else "",
            "published_at": updated_el.text if updated_el is not None else None,
            "content_snippet": snippet,
            "source_name": source_name,
            "source_category": "government",
        })
    return items


async def check_page_diff(url: str, redis_client, http_client) -> dict | None:
    """Fetch page, compare hash with stored version, extract changed sections."""
    import difflib

    try:
        response = await http_client.get(url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return None

    html = response.text
    current_hash = hashlib.sha256(html.encode()).hexdigest()
    stored_hash = await redis_client.get(f"intel:page_hash:{url}")

    if stored_hash and stored_hash.decode() == current_hash:
        return None  # No change

    # Extract sections using regex (avoid selectolax dependency for plan simplicity)
    import re
    sections: dict[str, str] = {}
    current_heading = "preamble"
    # Simple heading extraction
    parts = re.split(r'<h[23][^>]*>(.*?)</h[23]>', html, flags=re.DOTALL)
    for i, part in enumerate(parts):
        cleaned = re.sub(r'<[^>]+>', '', part).strip()
        if i % 2 == 1:  # This is a heading
            current_heading = cleaned
        else:
            if cleaned:
                sections[current_heading] = cleaned[:2000]

    # Compare with stored sections
    stored_sections_raw = await redis_client.get(f"intel:page_sections:{url}")
    changed_sections: dict[str, dict] = {}

    if stored_sections_raw:
        stored_sections = json.loads(stored_sections_raw)
        all_keys = set(list(stored_sections.keys()) + list(sections.keys()))
        for key in all_keys:
            old_text = stored_sections.get(key, "")
            new_text = sections.get(key, "")
            if old_text != new_text:
                diff = list(difflib.unified_diff(
                    old_text.splitlines(), new_text.splitlines(),
                    fromfile="before", tofile="after", lineterm=""
                ))
                changed_sections[key] = {
                    "before": old_text[:1000],
                    "after": new_text[:1000],
                    "diff_lines": diff[:50],
                    "is_new_section": key not in stored_sections,
                    "is_removed_section": key not in sections,
                }

    # Store new hash and sections
    await redis_client.set(f"intel:page_hash:{url}", current_hash, ex=86400 * 7)
    await redis_client.set(f"intel:page_sections:{url}", json.dumps(sections), ex=86400 * 7)

    if not changed_sections:
        return None

    return {
        "url": url,
        "changed_sections": changed_sections,
        "total_sections_changed": len(changed_sections),
    }


async def scan_gov_feeds(supabase_client, redis_client) -> dict:
    """Scan all GOV.UK RSS feeds and insert new items."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        for key, config in GOV_UK_FEEDS.items():
            try:
                resp = await client.get(config["feed_url"])
                resp.raise_for_status()
                items = parse_govuk_atom(resp.text, config["source_name"])
                stats["items_fetched"] += len(items)

                for item in items:
                    if not is_immigration_relevant(item["title"], item.get("content_snippet")):
                        stats["items_filtered"] += 1
                        continue

                    # Dedup by source_url
                    existing = supabase_client.table("intel_items").select("id").eq(
                        "source_url", item["source_url"]
                    ).limit(1).execute()
                    if existing.data:
                        continue

                    supabase_client.table("intel_items").insert({
                        "title": item["title"],
                        "source_name": item["source_name"],
                        "source_url": item["source_url"],
                        "source_category": item["source_category"],
                        "published_at": item["published_at"],
                        "content_snippet": item["content_snippet"],
                        "status": "raw",
                        "scanner_agent": "intel_scan_gov",
                    }).execute()
                    stats["items_new"] += 1

            except Exception as e:
                logger.error(f"Failed scanning {key}: {e}")

    # Scan Immigration Rules pages for diffs
    async with httpx.AsyncClient(timeout=30) as client:
        for url in GOV_UK_IMMIGRATION_RULES_PAGES:
            try:
                diff_result = await check_page_diff(url, redis_client, client)
                if diff_result:
                    title = f"Immigration Rules Update: {diff_result['total_sections_changed']} section(s) changed"
                    supabase_client.table("intel_items").insert({
                        "title": title,
                        "source_name": "GOV.UK Immigration Rules",
                        "source_url": url,
                        "source_category": "government",
                        "published_at": datetime.utcnow().isoformat(),
                        "content_snippet": f"Detected changes in {diff_result['total_sections_changed']} sections",
                        "content_text": json.dumps(diff_result["changed_sections"])[:5000],
                        "status": "raw",
                        "scanner_agent": "intel_scan_gov",
                    }).execute()
                    stats["items_new"] += 1
            except Exception as e:
                logger.error(f"Failed checking page diff for {url}: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
```

- [ ] 7.3. Commit:
```bash
git add backend/app/scanners/__init__.py backend/app/scanners/intel_gov.py
git commit -m "feat(intel): GOV.UK scanner — Atom RSS + Immigration Rules page diff"
```

---

## Task 8: News Scanner (BBC, Guardian, Reuters, FT, Times)

**Files:**
- Create: `backend/app/scanners/intel_news.py`

- [ ] 8.1. Create `backend/app/scanners/intel_news.py`:

```python
"""
Intel scanner: News media RSS feeds.

Scans BBC, Guardian, Reuters, Financial Times, The Times
for immigration-related articles using RSS feeds + keyword filtering.
"""

import logging
import re
import xml.etree.ElementTree as ET

import httpx

from app.scanners.intel_gov import is_immigration_relevant

logger = logging.getLogger(__name__)

NEWS_RSS_SOURCES = {
    "bbc": {
        "feed_url": "https://feeds.bbci.co.uk/news/uk/rss.xml",
        "source_name": "BBC News",
    },
    "guardian": {
        "feed_url": "https://www.theguardian.com/uk/immigration/rss",
        "source_name": "The Guardian",
    },
    "guardian_politics": {
        "feed_url": "https://www.theguardian.com/politics/immigration/rss",
        "source_name": "The Guardian",
    },
    "reuters": {
        "feed_url": "https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best",
        "source_name": "Reuters",
    },
    "ft": {
        "feed_url": "https://www.ft.com/immigration?format=rss",
        "source_name": "Financial Times",
    },
    "times": {
        "feed_url": "https://www.thetimes.co.uk/topic/immigration?format=rss",
        "source_name": "The Times",
    },
}


def parse_rss2_entry(item_el, source_name: str) -> dict:
    """Parse a single <item> from an RSS 2.0 feed."""
    def text_or_none(tag: str) -> str | None:
        el = item_el.find(tag)
        return el.text.strip() if el is not None and el.text else None

    return {
        "title": text_or_none("title") or "",
        "source_url": text_or_none("link"),
        "published_at": text_or_none("pubDate"),
        "content_snippet": (text_or_none("description") or "")[:500],
        "source_name": source_name,
        "source_category": "news",
        "guid": text_or_none("guid"),
    }


def parse_rss2_feed(xml_text: str, source_name: str) -> list[dict]:
    """Parse full RSS 2.0 feed XML into list of items."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse RSS XML from {source_name}: {e}")
        return []

    items = []
    for item_el in root.findall(".//item"):
        parsed = parse_rss2_entry(item_el, source_name)
        if parsed["title"]:
            # Strip HTML from snippet
            parsed["content_snippet"] = re.sub(
                r'<[^>]+>', '', parsed.get("content_snippet") or ""
            ).strip()[:500]
            items.append(parsed)
    return items


async def scan_news_feeds(supabase_client) -> dict:
    """Scan all news RSS feeds and insert immigration-relevant items."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        for key, config in NEWS_RSS_SOURCES.items():
            try:
                resp = await client.get(config["feed_url"])
                resp.raise_for_status()
                items = parse_rss2_feed(resp.text, config["source_name"])
                stats["items_fetched"] += len(items)

                for item in items:
                    if not is_immigration_relevant(item["title"], item.get("content_snippet")):
                        stats["items_filtered"] += 1
                        continue

                    # Dedup by source_url or guid
                    dedup_field = "source_url"
                    dedup_value = item.get("source_url") or item.get("guid")
                    if not dedup_value:
                        continue

                    existing = supabase_client.table("intel_items").select("id").eq(
                        dedup_field, dedup_value
                    ).limit(1).execute()
                    if existing.data:
                        continue

                    supabase_client.table("intel_items").insert({
                        "title": item["title"],
                        "source_name": item["source_name"],
                        "source_url": item.get("source_url"),
                        "source_category": item["source_category"],
                        "published_at": item.get("published_at"),
                        "content_snippet": item.get("content_snippet"),
                        "status": "raw",
                        "scanner_agent": "intel_scan_news",
                    }).execute()
                    stats["items_new"] += 1

            except Exception as e:
                logger.error(f"Failed scanning news source {key}: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
```

- [ ] 8.2. Commit:
```bash
git add backend/app/scanners/intel_news.py
git commit -m "feat(intel): news scanner — BBC, Guardian, Reuters, FT, Times RSS"
```

---

## Task 9: Legal Blog Scanner

**Files:**
- Create: `backend/app/scanners/intel_legal.py`

- [ ] 9.1. Create `backend/app/scanners/intel_legal.py`:

```python
"""
Intel scanner: Legal blogs and tribunal decisions.

Scans Free Movement, Colin Yeo, Law Society (RSS),
ILPA, Upper Tribunal (page scrape), and Hansard API.
"""

import logging
import re
import xml.etree.ElementTree as ET

import httpx

logger = logging.getLogger(__name__)

LEGAL_RSS_SOURCES = {
    "free_movement": {
        "feed_url": "https://freemovement.org.uk/feed/",
        "source_name": "Free Movement Blog",
    },
    "colin_yeo": {
        "feed_url": "https://www.immigrationbarrister.co.uk/feed/",
        "source_name": "Immigration Barrister (Colin Yeo)",
    },
    "law_society": {
        "feed_url": "https://www.lawsociety.org.uk/campaigns/immigration/rss",
        "source_name": "Law Society Immigration",
    },
}

LEGAL_SCRAPE_SELECTORS = {
    "ilpa": {
        "url": "https://ilpa.org.uk/resources/",
        "list_pattern": r'<article[^>]*>(.*?)</article>',
        "title_pattern": r'<h[23][^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
        "date_pattern": r'<time[^>]*datetime="([^"]*)"',
        "source_name": "ILPA",
    },
    "upper_tribunal": {
        "url": "https://www.judiciary.uk/judgments/?search=immigration&court=upper-tribunal-immigration-and-asylum-chamber",
        "list_pattern": r'<li[^>]*class="[^"]*judgment[^"]*"[^>]*>(.*?)</li>',
        "title_pattern": r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
        "date_pattern": r'<time[^>]*datetime="([^"]*)"',
        "source_name": "Upper Tribunal IAC",
    },
}

HANSARD_API_BASE = "https://hansard-api.parliament.uk"


def parse_legal_rss(xml_text: str, source_name: str) -> list[dict]:
    """Parse RSS 2.0 legal blog feed."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"Failed to parse legal RSS from {source_name}: {e}")
        return []

    items = []
    for item_el in root.findall(".//item"):
        title_el = item_el.find("title")
        link_el = item_el.find("link")
        pub_el = item_el.find("pubDate")
        desc_el = item_el.find("description")

        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        if not title:
            continue

        snippet = ""
        if desc_el is not None and desc_el.text:
            snippet = re.sub(r'<[^>]+>', '', desc_el.text).strip()[:500]

        items.append({
            "title": title,
            "source_url": link_el.text.strip() if link_el is not None and link_el.text else "",
            "published_at": pub_el.text.strip() if pub_el is not None and pub_el.text else None,
            "content_snippet": snippet,
            "source_name": source_name,
            "source_category": "legal",
        })
    return items


async def scrape_legal_page(source_key: str, http_client) -> list[dict]:
    """Scrape a legal source that lacks RSS using regex patterns."""
    config = LEGAL_SCRAPE_SELECTORS[source_key]
    try:
        response = await http_client.get(config["url"], timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch {config['url']}: {e}")
        return []

    html = response.text
    items = []

    # Find all article/list-item blocks
    blocks = re.findall(config["list_pattern"], html, re.DOTALL)
    for block in blocks[:30]:  # Limit to 30 items
        title_match = re.search(config["title_pattern"], block, re.DOTALL)
        date_match = re.search(config["date_pattern"], block)

        if not title_match:
            continue

        href = title_match.group(1)
        title = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()
        if not href.startswith("http"):
            href = config["url"].rstrip("/") + "/" + href.lstrip("/")

        items.append({
            "title": title,
            "source_url": href,
            "published_at": date_match.group(1) if date_match else None,
            "content_snippet": None,
            "source_name": config["source_name"],
            "source_category": "legal",
        })

    return items


async def fetch_hansard_debates(http_client, date_from: str) -> list[dict]:
    """Fetch recent immigration-related parliamentary debates."""
    params = {
        "q": 'immigration OR visa OR migration OR "home office"',
        "startDate": date_from,
        "house": "Commons",
        "take": 20,
    }
    try:
        response = await http_client.get(
            f"{HANSARD_API_BASE}/search.json", params=params, timeout=30
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.error(f"Hansard API failed: {e}")
        return []

    items = []
    for result in data.get("Results", []):
        highlights = result.get("SearchResultHighlights", [])
        snippet = highlights[0].get("Value", "")[:500] if highlights else ""

        items.append({
            "title": result.get("Title", ""),
            "source_url": f"https://hansard.parliament.uk{result.get('Url', '')}",
            "published_at": result.get("Date"),
            "content_snippet": snippet,
            "source_name": "Parliament Hansard",
            "source_category": "government",
        })
    return items


async def scan_legal_sources(supabase_client) -> dict:
    """Scan all legal RSS feeds, page scrapes, and Hansard."""
    import time
    from datetime import datetime, timedelta

    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        # RSS feeds
        for key, config in LEGAL_RSS_SOURCES.items():
            try:
                resp = await client.get(config["feed_url"])
                resp.raise_for_status()
                items = parse_legal_rss(resp.text, config["source_name"])
                stats["items_fetched"] += len(items)

                for item in items:
                    if not item.get("source_url"):
                        continue
                    existing = supabase_client.table("intel_items").select("id").eq(
                        "source_url", item["source_url"]
                    ).limit(1).execute()
                    if existing.data:
                        continue

                    supabase_client.table("intel_items").insert({
                        **item, "status": "raw", "scanner_agent": "intel_scan_legal",
                    }).execute()
                    stats["items_new"] += 1
            except Exception as e:
                logger.error(f"Failed scanning legal RSS {key}: {e}")

        # Page scrapes
        for source_key in LEGAL_SCRAPE_SELECTORS:
            try:
                items = await scrape_legal_page(source_key, client)
                stats["items_fetched"] += len(items)
                for item in items:
                    if not item.get("source_url"):
                        continue
                    existing = supabase_client.table("intel_items").select("id").eq(
                        "source_url", item["source_url"]
                    ).limit(1).execute()
                    if existing.data:
                        continue
                    supabase_client.table("intel_items").insert({
                        **item, "status": "raw", "scanner_agent": "intel_scan_legal",
                    }).execute()
                    stats["items_new"] += 1
            except Exception as e:
                logger.error(f"Failed scraping legal page {source_key}: {e}")

        # Hansard
        try:
            date_from = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
            hansard_items = await fetch_hansard_debates(client, date_from)
            stats["items_fetched"] += len(hansard_items)
            for item in hansard_items:
                if not item.get("source_url"):
                    continue
                existing = supabase_client.table("intel_items").select("id").eq(
                    "source_url", item["source_url"]
                ).limit(1).execute()
                if existing.data:
                    continue
                supabase_client.table("intel_items").insert({
                    **item, "status": "raw", "scanner_agent": "intel_scan_legal",
                }).execute()
                stats["items_new"] += 1
        except Exception as e:
            logger.error(f"Hansard scan failed: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
```

- [ ] 9.2. Commit:
```bash
git add backend/app/scanners/intel_legal.py
git commit -m "feat(intel): legal scanner — blogs RSS, ILPA/tribunal scrape, Hansard API"
```

---

## Task 10: Reddit Social Scanner

**Files:**
- Create: `backend/app/scanners/intel_social.py`

- [ ] 10.1. Create `backend/app/scanners/intel_social.py`:

```python
"""
Intel scanner: Reddit r/ukvisa and r/iwantout.

Uses Reddit OAuth2 (script-type app) to fetch new posts.
Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars.
"""

import logging
from datetime import datetime

import httpx

from app.scanners.intel_gov import is_immigration_relevant

logger = logging.getLogger(__name__)

REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"
USER_AGENT = "SponsorIntel/1.0 (by /u/sponsorintel)"

SUBREDDITS = {
    "ukvisa": {"subreddit": "ukvisa", "filter_uk": False},
    "iwantout": {"subreddit": "IWantOut", "filter_uk": True},
}


async def get_reddit_token(client_id: str, client_secret: str) -> str | None:
    """Get Reddit OAuth2 bearer token using client_credentials grant."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                REDDIT_AUTH_URL,
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            response.raise_for_status()
            return response.json()["access_token"]
    except Exception as e:
        logger.error(f"Reddit auth failed: {e}")
        return None


async def fetch_subreddit_new(
    token: str, subreddit: str, limit: int = 50
) -> list[dict]:
    """Fetch new posts from a subreddit."""
    headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    params = {"limit": limit, "sort": "new"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{REDDIT_API_BASE}/r/{subreddit}/new",
                headers=headers, params=params, timeout=15,
            )
            response.raise_for_status()
            data = response.json()
    except Exception as e:
        logger.error(f"Reddit fetch failed for r/{subreddit}: {e}")
        return []

    posts = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        posts.append({
            "title": post.get("title", ""),
            "source_url": f"https://reddit.com{post.get('permalink', '')}",
            "published_at": datetime.utcfromtimestamp(
                post.get("created_utc", 0)
            ).isoformat(),
            "content_text": post.get("selftext", "")[:5000],
            "content_snippet": post.get("selftext", "")[:500],
            "source_name": f"Reddit r/{subreddit}",
            "source_category": "community",
        })
    return posts


async def scan_social_sources(supabase_client, reddit_client_id: str, reddit_client_secret: str) -> dict:
    """Scan Reddit subreddits for immigration-related posts."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_filtered": 0}
    start = time.time()

    if not reddit_client_id or not reddit_client_secret:
        logger.warning("Reddit credentials not configured, skipping social scan")
        return stats

    token = await get_reddit_token(reddit_client_id, reddit_client_secret)
    if not token:
        return stats

    for key, config in SUBREDDITS.items():
        try:
            posts = await fetch_subreddit_new(token, config["subreddit"])
            stats["items_fetched"] += len(posts)

            for post in posts:
                # For r/iwantout, filter to UK-relevant posts only
                if config["filter_uk"]:
                    uk_keywords = ["uk", "united kingdom", "britain", "england", "scotland", "wales"]
                    text = (post["title"] + " " + (post.get("content_snippet") or "")).lower()
                    if not any(kw in text for kw in uk_keywords):
                        stats["items_filtered"] += 1
                        continue

                existing = supabase_client.table("intel_items").select("id").eq(
                    "source_url", post["source_url"]
                ).limit(1).execute()
                if existing.data:
                    continue

                supabase_client.table("intel_items").insert({
                    "title": post["title"],
                    "source_name": post["source_name"],
                    "source_url": post["source_url"],
                    "source_category": post["source_category"],
                    "published_at": post.get("published_at"),
                    "content_text": post.get("content_text"),
                    "content_snippet": post.get("content_snippet"),
                    "status": "raw",
                    "scanner_agent": "intel_scan_social",
                }).execute()
                stats["items_new"] += 1

        except Exception as e:
            logger.error(f"Failed scanning Reddit {key}: {e}")

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
```

- [ ] 10.2. Commit:
```bash
git add backend/app/scanners/intel_social.py
git commit -m "feat(intel): Reddit social scanner — r/ukvisa + r/iwantout"
```

---

## Task 11: Classifier and Impact Analyzer Tasks

**Files:**
- Create: `backend/app/scanners/intel_classifier.py`

- [ ] 11.1. Create `backend/app/scanners/intel_classifier.py`:

```python
"""
Intel AI pipeline: classifier (Groq) + impact analyzer (NVIDIA NIM) + dedup.
"""

import json
import logging
import random
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

CLASSIFIER_SYSTEM_PROMPT = """You are an immigration policy classifier for the United Kingdom. You receive raw news items, government announcements, legal blog posts, court decisions, and community discussions related to UK immigration.

Your job is to classify each item into structured metadata. You must return valid JSON only, with no additional text.

Output JSON schema:
{
  "topic": "rule_change" | "policy_update" | "court_decision" | "statistics" | "opinion" | "news" | "community",
  "impact_level": "critical" | "high" | "medium" | "low",
  "visa_routes_affected": ["Skilled Worker", "Global Talent", "Graduate", "Innovator Founder", "Family", "Visitor", "Student", "High Potential Individual", "Scale-up", "General"],
  "nationalities_affected": ["string"] or [],
  "industries_affected": ["string"] or [],
  "confidence": 0.0 to 1.0
}

Classification rules:
- "critical": Changes that immediately affect current visa holders or pending applications.
- "high": Confirmed changes with a future effective date, major court rulings, significant policy shifts.
- "medium": Proposed changes under consultation, notable statistics releases, MAC recommendations.
- "low": Opinion pieces, community discussions, minor news coverage.
- "rule_change": Official Statement of Changes to the Immigration Rules.
- "policy_update": Home Office guidance updates, UKVI procedural changes.
- "court_decision": Upper Tribunal or higher court immigration judgments.
- "statistics": ONS migration data, Home Office quarterly stats.
- "opinion": Blog posts, expert commentary, editorials.
- "news": General news coverage of immigration topics.
- "community": Reddit posts, forum discussions, user experiences.
- visa_routes_affected: Only include routes specifically mentioned or clearly affected. Use "General" if it affects the overall system.
- nationalities_affected: Only include if specific nationalities are mentioned. Leave empty for general items.
- industries_affected: Only include if specific industries are mentioned."""

CLASSIFIER_USER_TEMPLATE = """Classify this item:

Title: {title}
Source: {source_name} ({source_category})
Published: {published_at}
Content: {content}

Return JSON only."""

ANALYZER_SYSTEM_PROMPT = """You are an immigration policy analyst specialising in the UK immigration system. You receive classified immigration news items and produce detailed impact analysis.

Your audience includes: visa applicants, employers who sponsor workers, immigration lawyers, HR professionals, and recruiters.

You must return valid JSON only, with no additional text.

Output JSON schema:
{
  "summary": "string (2-3 sentences: what happened, in plain English)",
  "who_affected": "string (specific groups affected)",
  "action_required": "string or null (what should affected people do NOW)",
  "before_after": {
    "before": "string (how things were before)",
    "after": "string (how things are after)"
  } or null,
  "key_dates": [{"date": "YYYY-MM-DD", "description": "string"}],
  "severity_reasoning": "string (1 sentence: why this impact level)"
}

Guidelines:
- Write for a non-expert audience. Avoid legal jargon.
- Be specific about WHO is affected.
- For rule changes: always provide before_after if possible.
- action_required should be concrete or null.
- Never speculate beyond what the source material states."""

ANALYZER_USER_TEMPLATE = """Analyze this classified item:

Title: {title}
Source: {source_name}
Topic: {topic}
Impact Level: {impact_level}
Visa Routes Affected: {visa_routes_affected}
Content:
{content}

Return JSON only."""


async def classify_raw_items(supabase_client, llm_service, batch_size: int = 20) -> dict:
    """Classify raw intel items using Groq LLM."""
    stats = {"processed": 0, "classified": 0, "errors": 0}

    # Fetch raw items
    result = supabase_client.table("intel_items").select("*").eq(
        "status", "raw"
    ).order("created_at", desc=False).limit(batch_size).execute()

    items = result.data or []
    stats["processed"] = len(items)

    for item in items:
        try:
            content = item.get("content_text") or item.get("content_snippet") or ""
            prompt = CLASSIFIER_USER_TEMPLATE.format(
                title=item["title"],
                source_name=item["source_name"],
                source_category=item["source_category"],
                published_at=item.get("published_at") or "Unknown",
                content=content[:2000],
            )

            classification = await llm_service.structured_output_with_provider(
                provider="groq",
                prompt=prompt,
                system=CLASSIFIER_SYSTEM_PROMPT,
            )

            if not classification:
                stats["errors"] += 1
                continue

            update_data = {
                "topic": classification.get("topic", "news"),
                "impact_level": classification.get("impact_level", "low"),
                "visa_routes_affected": classification.get("visa_routes_affected", []),
                "nationalities_affected": classification.get("nationalities_affected", []),
                "industries_affected": classification.get("industries_affected", []),
                "status": "classified",
            }

            supabase_client.table("intel_items").update(update_data).eq(
                "id", item["id"]
            ).execute()
            stats["classified"] += 1

            # Quality sampling: 1% of items
            if random.random() < 0.01:
                supabase_client.table("intel_quality_samples").insert({
                    "intel_item_id": item["id"],
                    "llm_topic": classification.get("topic"),
                    "llm_impact": classification.get("impact_level"),
                    "llm_confidence": classification.get("confidence", 0.0),
                    "reviewed": False,
                }).execute()

        except Exception as e:
            logger.error(f"Classification failed for item {item['id']}: {e}")
            stats["errors"] += 1

    return stats


async def analyze_classified_items(supabase_client, llm_service, batch_size: int = 10) -> dict:
    """Analyze classified items with impact >= medium using NVIDIA NIM."""
    stats = {"processed": 0, "analyzed": 0, "errors": 0}

    result = supabase_client.table("intel_items").select("*").eq(
        "status", "classified"
    ).in_("impact_level", ["critical", "high", "medium"]).order(
        "created_at", desc=False
    ).limit(batch_size).execute()

    items = result.data or []
    stats["processed"] = len(items)

    for item in items:
        try:
            content = item.get("content_text") or item.get("content_snippet") or ""
            prompt = ANALYZER_USER_TEMPLATE.format(
                title=item["title"],
                source_name=item["source_name"],
                topic=item.get("topic", "news"),
                impact_level=item.get("impact_level", "medium"),
                visa_routes_affected=", ".join(item.get("visa_routes_affected") or ["General"]),
                content=content[:4000],
            )

            analysis = await llm_service.structured_output_with_provider(
                provider="nvidia_nim",
                prompt=prompt,
                system=ANALYZER_SYSTEM_PROMPT,
            )

            if not analysis:
                # Fallback to Groq
                analysis = await llm_service.structured_output_with_provider(
                    provider="groq",
                    prompt=prompt,
                    system=ANALYZER_SYSTEM_PROMPT,
                )

            if not analysis:
                stats["errors"] += 1
                continue

            update_data = {
                "summary": analysis.get("summary"),
                "who_affected": analysis.get("who_affected"),
                "action_required": analysis.get("action_required"),
                "before_after": analysis.get("before_after"),
                "status": "analyzed",
            }

            supabase_client.table("intel_items").update(update_data).eq(
                "id", item["id"]
            ).execute()
            stats["analyzed"] += 1

        except Exception as e:
            logger.error(f"Analysis failed for item {item['id']}: {e}")
            stats["errors"] += 1

    return stats


async def run_dedup(supabase_client, window_hours: int = 48, similarity_threshold: float = 0.6) -> dict:
    """Deduplicate intel items using pg_trgm similarity within a time window."""
    stats = {"clusters_created": 0, "items_deduped": 0}

    # Use RPC call for the similarity query (requires a Supabase function)
    # For now, fetch recent items and do client-side dedup by exact title match
    from datetime import timedelta

    cutoff = (datetime.utcnow() - timedelta(hours=window_hours)).isoformat()
    result = supabase_client.table("intel_items").select(
        "id, title, source_name, published_at, created_at"
    ).in_("status", ["classified", "analyzed"]).is_(
        "dedup_cluster_id", "null"
    ).gte("created_at", cutoff).order("created_at", desc=False).limit(500).execute()

    items = result.data or []
    if len(items) < 2:
        return stats

    # Simple client-side dedup: group by normalized title similarity
    from difflib import SequenceMatcher

    processed = set()
    for i, a in enumerate(items):
        if a["id"] in processed:
            continue
        cluster = [a]
        for b in items[i + 1:]:
            if b["id"] in processed:
                continue
            ratio = SequenceMatcher(None, a["title"].lower(), b["title"].lower()).ratio()
            if ratio > similarity_threshold:
                cluster.append(b)
                processed.add(b["id"])

        if len(cluster) >= 2:
            processed.add(a["id"])
            cluster_id = str(uuid.uuid4())

            # Keep earliest as canonical
            canonical_id = cluster[0]["id"]
            supabase_client.table("intel_items").update(
                {"dedup_cluster_id": cluster_id}
            ).eq("id", canonical_id).execute()

            for dup in cluster[1:]:
                supabase_client.table("intel_items").update(
                    {"status": "deduped", "dedup_cluster_id": cluster_id}
                ).eq("id", dup["id"]).execute()
                stats["items_deduped"] += 1

            stats["clusters_created"] += 1

    return stats
```

- [ ] 11.2. Commit:
```bash
git add backend/app/scanners/intel_classifier.py
git commit -m "feat(intel): classifier (Groq), impact analyzer (NIM), dedup tasks"
```

---

## Task 12: Intel Celery Tasks Module

**Files:**
- Create: `backend/app/tasks/intel_tasks.py`
- Modify: `backend/app/tasks/celery_app.py`

- [ ] 12.1. Create `backend/app/tasks/intel_tasks.py`:

```python
"""
Celery tasks for the Intel — Immigration Intelligence Hub.

All tasks follow the existing pattern: sync wrapper calling async logic.
Uses Supabase service role client for writes (not anon key).
"""

import asyncio
import logging
import time

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a new event loop (for Celery tasks)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_supabase_service_client():
    """Get Supabase client using service role key for writes."""
    from supabase import create_client
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError("Supabase URL and service key must be configured")
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _get_redis_client():
    """Get async Redis client."""
    import redis.asyncio as aioredis
    from app.core.config import get_settings
    settings = get_settings()
    return aioredis.from_url(settings.redis_url, decode_responses=False)


def _get_llm_service():
    """Get LLM service configured with Groq + NVIDIA NIM."""
    from app.agents.llm_service import LLMService
    from app.core.config import get_settings
    settings = get_settings()
    return LLMService(
        backend="groq",
        groq_api_key=settings.groq_api_key,
        nvidia_nim_api_key=settings.nvidia_nim_api_key,
        nvidia_nim_base_url=settings.nvidia_nim_base_url,
    )


def _log_health(supabase_client, source_key: str, task_name: str, stats: dict):
    """Log scanner run health to intel_source_health_log."""
    try:
        supabase_client.table("intel_source_health_log").insert({
            "source_key": source_key,
            "scanner_task": task_name,
            "duration_ms": stats.get("duration_ms", 0),
            "items_fetched": stats.get("items_fetched", 0),
            "items_new": stats.get("items_new", 0),
            "items_filtered": stats.get("items_filtered", 0),
            "status": "error" if stats.get("errors", 0) > 0 else "success",
            "error_message": stats.get("error_message"),
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log health for {source_key}: {e}")


@celery_app.task(name="intel.scan_gov", bind=True, max_retries=3)
def intel_scan_gov(self):
    """Scan GOV.UK RSS feeds + Immigration Rules page diffs."""
    try:
        supabase = _get_supabase_service_client()
        redis = _get_redis_client()

        async def _run():
            from app.scanners.intel_gov import scan_gov_feeds
            return await scan_gov_feeds(supabase, redis)

        stats = _run_async(_run())
        _log_health(supabase, "gov_uk", "intel_scan_gov", stats)
        logger.info(f"intel_scan_gov complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_gov failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.scan_news", bind=True, max_retries=3)
def intel_scan_news(self):
    """Scan BBC, Guardian, Reuters, FT, Times RSS feeds."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_news import scan_news_feeds
            return await scan_news_feeds(supabase)

        stats = _run_async(_run())
        _log_health(supabase, "news_rss", "intel_scan_news", stats)
        logger.info(f"intel_scan_news complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_news failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.scan_legal", bind=True, max_retries=3)
def intel_scan_legal(self):
    """Scan legal blogs, tribunal decisions, Hansard."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_legal import scan_legal_sources
            return await scan_legal_sources(supabase)

        stats = _run_async(_run())
        _log_health(supabase, "legal", "intel_scan_legal", stats)
        logger.info(f"intel_scan_legal complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_legal failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.scan_social", bind=True, max_retries=3)
def intel_scan_social(self):
    """Scan Reddit r/ukvisa and r/iwantout."""
    try:
        from app.core.config import get_settings
        settings = get_settings()
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_social import scan_social_sources
            return await scan_social_sources(
                supabase, settings.reddit_client_id, settings.reddit_client_secret
            )

        stats = _run_async(_run())
        _log_health(supabase, "reddit", "intel_scan_social", stats)
        logger.info(f"intel_scan_social complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_social failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="intel.classify")
def intel_classify():
    """Classify raw intel items using Groq LLM."""
    try:
        supabase = _get_supabase_service_client()
        llm = _get_llm_service()

        async def _run():
            from app.scanners.intel_classifier import classify_raw_items
            return await classify_raw_items(supabase, llm)

        stats = _run_async(_run())
        logger.info(f"intel_classify complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_classify failed: {e}")


@celery_app.task(name="intel.analyze")
def intel_analyze():
    """Analyze classified items with impact >= medium using NVIDIA NIM."""
    try:
        supabase = _get_supabase_service_client()
        llm = _get_llm_service()

        async def _run():
            from app.scanners.intel_classifier import analyze_classified_items
            return await analyze_classified_items(supabase, llm)

        stats = _run_async(_run())
        logger.info(f"intel_analyze complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_analyze failed: {e}")


@celery_app.task(name="intel.dedup")
def intel_dedup():
    """Deduplicate intel items using title similarity."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_classifier import run_dedup
            return await run_dedup(supabase)

        stats = _run_async(_run())
        logger.info(f"intel_dedup complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_dedup failed: {e}")
```

- [ ] 12.2. Add `"app.tasks.intel_tasks"` to the `include` list in `backend/app/tasks/celery_app.py`:

```python
# In celery_app.py, update the include list:
    include=[
        "app.tasks.scraping",
        "app.tasks.agent_tasks",
        "app.tasks.schedule",
        "app.tasks.intel_tasks",
    ],
```

- [ ] 12.3. Commit:
```bash
git add backend/app/tasks/intel_tasks.py backend/app/tasks/celery_app.py
git commit -m "feat(intel): Celery tasks — scan_gov, scan_news, scan_legal, scan_social, classify, analyze, dedup"
```

---

## Task 13: Add Intel Tasks to Celery Beat Schedule

**Files:**
- Modify: `backend/app/tasks/schedule.py`

- [ ] 13.1. Add the Intel beat schedule entries after the existing Tier 15 section:

```python
# Add to the end of beat_schedule dict in schedule.py, before the closing }:

    # ===================================================================
    # Tier 16: Intel — Immigration Intelligence Hub
    # Real-time scanning of government, news, legal, and social sources.
    # ===================================================================
    "intel-scan-gov": {
        "task": "intel.scan_gov",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-scan-news": {
        "task": "intel.scan_news",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-scan-legal": {
        "task": "intel.scan_legal",
        "schedule": crontab(minute="*/30"),  # every 30 min
    },
    "intel-scan-social": {
        "task": "intel.scan_social",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-classify": {
        "task": "intel.classify",
        "schedule": crontab(minute="*/5"),  # every 5 min
    },
    "intel-analyze": {
        "task": "intel.analyze",
        "schedule": crontab(minute="*/5"),  # every 5 min
    },
    "intel-dedup": {
        "task": "intel.dedup",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
```

- [ ] 13.2. Commit:
```bash
git add backend/app/tasks/schedule.py
git commit -m "feat(intel): add intel scanner tasks to Celery Beat schedule"
```

---

## Task 14: TypeScript Types for Intel Module

**Files:**
- Create: `frontend/src/types/intel.ts`

- [ ] 14.1. Create `frontend/src/types/intel.ts` with the full TypeScript interfaces from the spec (lines 1040-1331). The file starts with:

```typescript
// ---- Intel Module ----

export type IntelTopic =
  | "rule_change"
  | "policy_update"
  | "court_decision"
  | "statistics"
  | "opinion"
  | "news"
  | "community";

export type IntelImpactLevel = "critical" | "high" | "medium" | "low";
export type IntelSourceCategory = "government" | "legal" | "news" | "community";
export type IntelPolicyStage =
  | "proposed"
  | "consultation"
  | "parliamentary_debate"
  | "enacted"
  | "effective";
export type IntelNotifChannel = "in_app" | "email_instant" | "email_digest";
export type IntelItemStatus = "raw" | "classified" | "analyzed" | "deduped";

export interface IntelItem {
  id: string;
  title: string;
  source_name: string;
  source_url: string | null;
  source_category: IntelSourceCategory;
  published_at: string | null;
  content_snippet: string | null;
  topic: IntelTopic | null;
  impact_level: IntelImpactLevel | null;
  visa_routes_affected: string[] | null;
  summary: string | null;
  status: IntelItemStatus;
  created_at: string;
}

export interface IntelItemDetail extends IntelItem {
  content_text: string | null;
  nationalities_affected: string[] | null;
  industries_affected: string[] | null;
  who_affected: string | null;
  action_required: string | null;
  before_after: Record<string, string> | null;
  dedup_cluster_id: string | null;
  scanner_agent: string | null;
  updated_at: string;
}

export interface IntelFeedResponse {
  data: IntelItem[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface IntelFeedFilters {
  topic?: IntelTopic;
  impact?: IntelImpactLevel;
  visa_route?: string;
  nationality?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface IntelTimelineNode {
  id: string;
  title: string;
  published_at: string | null;
  impact_level: IntelImpactLevel | null;
  visa_routes_affected: string[] | null;
  summary: string | null;
  before_after: Record<string, string> | null;
}

export interface IntelTimelineResponse {
  nodes: IntelTimelineNode[];
  total: number;
}

export interface IntelCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string | null;
  visa_routes: string[] | null;
  source_url: string | null;
  is_confirmed: boolean;
}

export interface IntelCalendarResponse {
  events: IntelCalendarEvent[];
  month: number;
  year: number;
}

export interface IntelStatistic {
  id: string;
  stat_type: string;
  visa_route: string | null;
  nationality: string | null;
  period: string | null;
  value: number;
  previous_value: number | null;
  change_pct: number | null;
  source: string | null;
  published_at: string | null;
}

export interface IntelStatsResponse {
  statistics: IntelStatistic[];
  total: number;
  visa_route: string | null;
}

export interface IntelPolicy {
  id: string;
  title: string;
  description: string | null;
  stage: IntelPolicyStage;
  visa_routes_affected: string[] | null;
  source_url: string | null;
  effective_date: string | null;
  last_update_summary: string | null;
  last_updated_at: string | null;
  created_at: string;
  is_followed: boolean;
}

export interface IntelPolicyListResponse {
  policies: IntelPolicy[];
  total: number;
}

export interface IntelSubscription {
  id: string;
  user_id: string;
  filter_topics: string[] | null;
  filter_visa_routes: string[] | null;
  filter_nationalities: string[] | null;
  filter_industries: string[] | null;
  filter_min_impact: IntelImpactLevel;
  channel: IntelNotifChannel;
  is_active: boolean;
  created_at: string;
}

export interface IntelSubscriptionCreate {
  filter_topics?: string[];
  filter_visa_routes?: string[];
  filter_nationalities?: string[];
  filter_industries?: string[];
  filter_min_impact?: IntelImpactLevel;
  channel?: IntelNotifChannel;
}

export interface IntelNotification {
  id: string;
  intel_item_id: string | null;
  subscription_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  item_impact_level: IntelImpactLevel | null;
  item_source_name: string | null;
}

export interface IntelNotificationListResponse {
  notifications: IntelNotification[];
  total: number;
  unread_count: number;
  page: number;
  pages: number;
}

export interface IntelDigestSection {
  heading: string;
  items: IntelItem[];
}

export interface IntelDigestPreview {
  subject: string;
  generated_at: string;
  top_items: IntelItem[];
  statistics_snapshot: IntelStatistic[];
  upcoming_calendar: IntelCalendarEvent[];
  personalized_items: IntelItem[];
  sections: IntelDigestSection[];
}

// ---- Lawyer Finder ----

export type CaseComplexity = 'straightforward' | 'complex' | 'appeal';
export type RegistrationType = 'oisc' | 'sra';
export type ReviewSource = 'google' | 'trustpilot' | 'user';
export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

export interface LawyerSearchParams {
  visa_route: string;
  nationality?: string;
  location?: string;
  case_complexity: CaseComplexity;
  budget_range?: string;
  language_pref?: string;
  page?: number;
  per_page?: number;
}

export interface LawyerSummary {
  id: string;
  name: string;
  firm_name: string | null;
  registration_type: RegistrationType;
  registration_number: string;
  oisc_level: number | null;
  accreditations: string[];
  practice_areas: string[];
  city: string | null;
  offers_remote: boolean;
  combined_rating: number | null;
  google_review_count: number;
  trustpilot_review_count: number;
  fee_initial_consultation: string | null;
  fee_hourly_range: string | null;
  website: string | null;
  distance_miles: number | null;
  match_score: number;
  why_matched: string;
}

export interface LawyerSearchResponse {
  results: LawyerSummary[];
  total: number;
  page: number;
  per_page: number;
  search_id: string;
}

export interface LawyerDetail extends Omit<LawyerSummary, 'distance_miles' | 'match_score' | 'why_matched'> {
  practising_status: string;
  languages: string[];
  fee_fixed_range: string | null;
  offers_legal_aid: boolean;
  address: string | null;
  postcode: string | null;
  google_rating: number | null;
  trustpilot_rating: number | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  disciplinary_history: Array<{ date: string; summary: string; outcome: string }>;
  last_verified_at: string | null;
  source_url: string | null;
}

export interface LawyerReview {
  id: string;
  source: ReviewSource;
  author_name: string | null;
  rating: number;
  review_text: string | null;
  review_date: string | null;
  visa_route_mentioned: string | null;
  sentiment: ReviewSentiment | null;
}

export interface LawyerReviewsResponse {
  reviews: LawyerReview[];
  total: number;
  page: number;
  per_page: number;
  avg_rating: number | null;
}

export interface LawyerCompareResponse {
  lawyers: LawyerDetail[];
  comparison_dimensions: string[];
}
```

- [ ] 14.2. Commit:
```bash
git add frontend/src/types/intel.ts
git commit -m "feat(intel): add TypeScript interfaces for intel module"
```

---

## Task 15: FastAPI Intel Routes — Feed, Item, Timeline

**Files:**
- Create: `backend/app/api/v1/intel.py`
- Modify: `backend/app/main.py`

- [ ] 15.1. Create `backend/app/api/v1/intel.py`:

```python
"""
Intel API routes — Immigration Intelligence Hub.

All reads go through Supabase anon client (RLS enforced).
All writes go through Supabase service role client.
"""

import math
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.config import get_settings

router = APIRouter(prefix="/intel", tags=["intel"])


def _supabase_anon():
    """Supabase client with anon key for RLS-protected reads."""
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key)


def _supabase_service():
    """Supabase client with service role key for writes."""
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


# ---- Feed ----

@router.get("/feed")
async def intel_feed(
    topic: Optional[str] = Query(None),
    impact: Optional[str] = Query(None),
    visa_route: Optional[str] = Query(None),
    nationality: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Paginated feed of analyzed intel items with filters."""
    sb = _supabase_anon()
    query = sb.table("intel_items").select("*", count="exact").in_(
        "status", ["classified", "analyzed"]
    )

    if topic:
        query = query.eq("topic", topic)
    if impact:
        query = query.eq("impact_level", impact)
    if visa_route:
        query = query.contains("visa_routes_affected", [visa_route])
    if nationality:
        query = query.contains("nationalities_affected", [nationality])
    if date_from:
        query = query.gte("published_at", date_from)
    if date_to:
        query = query.lte("published_at", date_to)

    offset = (page - 1) * per_page
    query = query.order("published_at", desc=True).range(offset, offset + per_page - 1)

    result = query.execute()
    total = result.count or 0

    return {
        "data": result.data or [],
        "total": total,
        "page": page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
        "per_page": per_page,
    }


@router.get("/item/{item_id}")
async def intel_item_detail(item_id: str):
    """Get a single intel item with full details."""
    sb = _supabase_anon()
    result = sb.table("intel_items").select("*").eq("id", item_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return result.data[0]


# ---- Timeline ----

@router.get("/timeline")
async def intel_timeline(
    visa_route: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Rule changes for timeline visualization."""
    sb = _supabase_anon()
    query = sb.table("intel_items").select(
        "id, title, published_at, impact_level, visa_routes_affected, summary, before_after"
    ).eq("topic", "rule_change").in_("status", ["classified", "analyzed"])

    if visa_route:
        query = query.contains("visa_routes_affected", [visa_route])
    if date_from:
        query = query.gte("published_at", date_from)
    if date_to:
        query = query.lte("published_at", date_to)

    result = query.order("published_at", desc=True).limit(100).execute()
    return {"nodes": result.data or [], "total": len(result.data or [])}


# ---- Calendar ----

@router.get("/calendar")
async def intel_calendar(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    visa_route: Optional[str] = Query(None),
):
    """Calendar events for a given month."""
    sb = _supabase_anon()
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"

    query = sb.table("intel_calendar").select("*").gte(
        "event_date", start
    ).lt("event_date", end)

    if visa_route:
        query = query.contains("visa_routes", [visa_route])

    result = query.order("event_date").execute()
    return {"events": result.data or [], "month": month, "year": year}


# ---- Statistics ----

@router.get("/stats")
async def intel_stats(visa_route: Optional[str] = Query(None)):
    """Statistics data, optionally filtered by visa route."""
    sb = _supabase_anon()
    query = sb.table("intel_statistics").select("*", count="exact")
    if visa_route:
        query = query.eq("visa_route", visa_route)
    result = query.order("published_at", desc=True).limit(200).execute()
    return {
        "statistics": result.data or [],
        "total": result.count or 0,
        "visa_route": visa_route,
    }


@router.get("/stats/{route}")
async def intel_stats_by_route(route: str):
    """Stats for a specific visa route."""
    sb = _supabase_anon()
    result = sb.table("intel_statistics").select("*").eq(
        "visa_route", route
    ).order("published_at", desc=True).limit(100).execute()
    return {"statistics": result.data or [], "total": len(result.data or []), "visa_route": route}


# ---- Policies ----

@router.get("/policies")
async def intel_policies(
    stage: Optional[str] = Query(None),
    visa_route: Optional[str] = Query(None),
):
    """Active policies with optional stage/route filter."""
    sb = _supabase_anon()
    query = sb.table("intel_policies").select("*", count="exact")
    if stage:
        query = query.eq("stage", stage)
    if visa_route:
        query = query.contains("visa_routes_affected", [visa_route])
    result = query.order("last_updated_at", desc=True).execute()
    return {"policies": result.data or [], "total": result.count or 0}


@router.post("/policies/{policy_id}/follow")
async def follow_policy(policy_id: str):
    """Follow a policy for notifications. Requires auth."""
    # Placeholder: auth will be added per existing pattern
    sb = _supabase_service()
    try:
        sb.table("intel_policy_follows").insert({
            "user_id": "00000000-0000-0000-0000-000000000000",  # TODO: from auth
            "policy_id": policy_id,
        }).execute()
    except Exception:
        pass  # Ignore duplicate
    return {"status": "followed"}


@router.delete("/policies/{policy_id}/follow")
async def unfollow_policy(policy_id: str):
    """Unfollow a policy."""
    sb = _supabase_service()
    sb.table("intel_policy_follows").delete().eq(
        "policy_id", policy_id
    ).eq("user_id", "00000000-0000-0000-0000-000000000000").execute()  # TODO: from auth
    return {"status": "unfollowed"}


# ---- Subscriptions ----

@router.post("/subscribe")
async def create_subscription(body: dict):
    """Create an intel alert subscription."""
    sb = _supabase_service()
    result = sb.table("intel_subscriptions").insert({
        "user_id": "00000000-0000-0000-0000-000000000000",  # TODO: from auth
        "filter_topics": body.get("filter_topics"),
        "filter_visa_routes": body.get("filter_visa_routes"),
        "filter_nationalities": body.get("filter_nationalities"),
        "filter_industries": body.get("filter_industries"),
        "filter_min_impact": body.get("filter_min_impact", "medium"),
        "channel": body.get("channel", "in_app"),
    }).execute()
    return result.data[0] if result.data else {}


@router.get("/subscriptions")
async def get_subscriptions():
    """Get current user's subscriptions."""
    sb = _supabase_anon()
    result = sb.table("intel_subscriptions").select("*").eq(
        "user_id", "00000000-0000-0000-0000-000000000000"  # TODO: from auth
    ).execute()
    return result.data or []


@router.delete("/subscriptions/{sub_id}")
async def delete_subscription(sub_id: str):
    """Delete a subscription."""
    sb = _supabase_service()
    sb.table("intel_subscriptions").delete().eq("id", sub_id).execute()
    return {"status": "deleted"}


# ---- Notifications ----

@router.get("/notifications")
async def get_notifications(
    is_read: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get user's notifications."""
    sb = _supabase_anon()
    user_id = "00000000-0000-0000-0000-000000000000"  # TODO: from auth
    query = sb.table("intel_notifications").select("*", count="exact").eq("user_id", user_id)
    if is_read is not None:
        query = query.eq("is_read", is_read)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    total = result.count or 0

    # Unread count
    unread = sb.table("intel_notifications").select("id", count="exact").eq(
        "user_id", user_id
    ).eq("is_read", False).execute()

    return {
        "notifications": result.data or [],
        "total": total,
        "unread_count": unread.count or 0,
        "page": page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
    }


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str):
    """Mark a notification as read."""
    sb = _supabase_service()
    sb.table("intel_notifications").update({
        "is_read": True,
        "read_at": datetime.utcnow().isoformat(),
    }).eq("id", notif_id).execute()
    return {"status": "read"}
```

- [ ] 15.2. Register the intel router in `backend/app/main.py`. Add after the existing router includes:

```python
from app.api.v1.intel import router as intel_router
app.include_router(intel_router, prefix="/api/v1")
```

- [ ] 15.3. Commit:
```bash
git add backend/app/api/v1/intel.py backend/app/main.py
git commit -m "feat(intel): FastAPI routes — feed, item, timeline, calendar, stats, policies, subscriptions, notifications"
```

---

## Task 16: ImpactBadge Component

**Files:**
- Create: `frontend/src/components/intel/ImpactBadge.tsx`

- [ ] 16.1. Create the component:

```tsx
'use client';

import { cn } from '@/lib/utils';
import type { IntelImpactLevel } from '@/types/intel';

const impactConfig: Record<IntelImpactLevel, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'CRITICAL', color: 'text-red', bg: 'bg-red/15', border: 'border-red/30' },
  high: { label: 'HIGH', color: 'text-amber', bg: 'bg-amber/15', border: 'border-amber/30' },
  medium: { label: 'MEDIUM', color: 'text-blue', bg: 'bg-accent/15', border: 'border-accent/30' },
  low: { label: 'LOW', color: 'text-dim', bg: 'bg-s3', border: 'border-border' },
};

interface ImpactBadgeProps {
  level: IntelImpactLevel | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function ImpactBadge({ level, size = 'md', className }: ImpactBadgeProps) {
  if (!level) return null;
  const config = impactConfig[level];
  return (
    <span className={cn(
      'inline-flex items-center rounded border font-data font-semibold uppercase tracking-wider',
      size === 'sm' ? 'px-1 py-px text-[8px]' : 'px-1.5 py-0.5 text-[9px]',
      config.color, config.bg, config.border,
      level === 'critical' && 'animate-pulse',
      className
    )}>
      {config.label}
    </span>
  );
}
```

- [ ] 16.2. Commit:
```bash
git add frontend/src/components/intel/ImpactBadge.tsx
git commit -m "feat(intel): ImpactBadge component with critical/high/medium/low variants"
```

---

## Task 17: IntelCard Component

**Files:**
- Create: `frontend/src/components/intel/IntelCard.tsx`

- [ ] 17.1. Create the component:

```tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ImpactBadge } from './ImpactBadge';
import { cn, formatRelativeDate } from '@/lib/utils';
import type { IntelItem } from '@/types/intel';

const sourceCategoryColors: Record<string, string> = {
  government: 'cyan',
  legal: 'purple',
  news: 'blue',
  community: 'green',
};

const topicLabels: Record<string, string> = {
  rule_change: 'Rule Change',
  policy_update: 'Policy Update',
  court_decision: 'Court Decision',
  statistics: 'Statistics',
  opinion: 'Opinion',
  news: 'News',
  community: 'Community',
};

interface IntelCardProps {
  item: IntelItem;
  className?: string;
  isNew?: boolean;
}

export function IntelCard({ item, className, isNew }: IntelCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      interactive
      className={cn(
        'transition-all duration-300',
        isNew && 'border-cyan/40 shadow-[0_0_12px_-4px_rgba(0,229,255,0.15)]',
        className
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        {/* Header row */}
        <div className="flex items-start gap-2 mb-1.5">
          <ImpactBadge level={item.impact_level} size="sm" />
          {item.topic && (
            <Badge variant="default" size="sm">
              {topicLabels[item.topic] || item.topic}
            </Badge>
          )}
          <Badge
            variant={sourceCategoryColors[item.source_category] as any || 'default'}
            size="sm"
          >
            {item.source_name}
          </Badge>
          <span className="ml-auto text-[9px] font-data text-dim whitespace-nowrap">
            {item.published_at ? formatRelativeDate(item.published_at) : '--'}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-text leading-snug mb-1">
          {item.title}
        </h3>

        {/* Summary snippet */}
        {item.summary && !expanded && (
          <p className="text-xs text-dim line-clamp-2">{item.summary}</p>
        )}

        {/* Visa route tags */}
        {item.visa_routes_affected && item.visa_routes_affected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.visa_routes_affected.map((route) => (
              <span
                key={route}
                className="inline-flex items-center rounded bg-s3 px-1.5 py-px text-[8px] font-data text-dim border border-border"
              >
                {route}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border animate-slideInUp space-y-2">
          {item.summary && (
            <div>
              <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-0.5">Summary</p>
              <p className="text-xs text-text">{item.summary}</p>
            </div>
          )}
          {item.content_snippet && (
            <div>
              <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-0.5">Source Excerpt</p>
              <p className="text-xs text-dim">{item.content_snippet}</p>
            </div>
          )}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-cyan hover:text-cyan/80 font-data"
            >
              View source &rarr;
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
```

- [ ] 17.2. Commit:
```bash
git add frontend/src/components/intel/IntelCard.tsx
git commit -m "feat(intel): IntelCard component with expand/collapse, badges, route tags"
```

---

## Task 18: IntelFilters Component

**Files:**
- Create: `frontend/src/components/intel/IntelFilters.tsx`

- [ ] 18.1. Create the filter sidebar:

```tsx
'use client';

import { Button } from '@/components/ui/Button';
import type { IntelFeedFilters, IntelTopic, IntelImpactLevel } from '@/types/intel';

const TOPICS: { value: IntelTopic; label: string }[] = [
  { value: 'rule_change', label: 'Rule Changes' },
  { value: 'policy_update', label: 'Policy Updates' },
  { value: 'court_decision', label: 'Court Decisions' },
  { value: 'statistics', label: 'Statistics' },
  { value: 'opinion', label: 'Expert Opinion' },
  { value: 'news', label: 'News' },
  { value: 'community', label: 'Community' },
];

const IMPACTS: { value: IntelImpactLevel; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'text-red' },
  { value: 'high', label: 'High', color: 'text-amber' },
  { value: 'medium', label: 'Medium', color: 'text-blue' },
  { value: 'low', label: 'Low', color: 'text-dim' },
];

const VISA_ROUTES = [
  'Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder',
  'Family', 'Student', 'High Potential Individual', 'Scale-up', 'General',
];

interface IntelFiltersProps {
  filters: IntelFeedFilters;
  onChange: (filters: IntelFeedFilters) => void;
}

export function IntelFilters({ filters, onChange }: IntelFiltersProps) {
  const setFilter = (key: keyof IntelFeedFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value, page: 1 });
  };

  return (
    <div className="space-y-4">
      {/* Topic */}
      <div>
        <p className="text-[9px] font-data font-semibold uppercase tracking-[0.15em] text-dim mb-1.5">Topic</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('topic', undefined)}
            className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
              !filters.topic ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
            }`}
          >
            All Topics
          </button>
          {TOPICS.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter('topic', t.value)}
              className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                filters.topic === t.value ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Impact Level */}
      <div>
        <p className="text-[9px] font-data font-semibold uppercase tracking-[0.15em] text-dim mb-1.5">Impact</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('impact', undefined)}
            className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
              !filters.impact ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
            }`}
          >
            All Levels
          </button>
          {IMPACTS.map((i) => (
            <button
              key={i.value}
              onClick={() => setFilter('impact', i.value)}
              className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                filters.impact === i.value ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              <span className={i.color}>{i.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Visa Route */}
      <div>
        <p className="text-[9px] font-data font-semibold uppercase tracking-[0.15em] text-dim mb-1.5">Visa Route</p>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('visa_route', undefined)}
            className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
              !filters.visa_route ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
            }`}
          >
            All Routes
          </button>
          {VISA_ROUTES.map((route) => (
            <button
              key={route}
              onClick={() => setFilter('visa_route', route)}
              className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                filters.visa_route === route ? 'text-amber bg-amber/10' : 'text-dim hover:text-text hover:bg-s2'
              }`}
            >
              {route}
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ page: 1, per_page: 20 })}
        className="w-full"
      >
        Reset Filters
      </Button>
    </div>
  );
}
```

- [ ] 18.2. Commit:
```bash
git add frontend/src/components/intel/IntelFilters.tsx
git commit -m "feat(intel): IntelFilters sidebar — topic, impact, visa route filters"
```

---

## Task 19: IntelFeed Component with Supabase Realtime

**Files:**
- Create: `frontend/src/components/intel/IntelFeed.tsx`

- [ ] 19.1. Create the live feed component:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { IntelCard } from './IntelCard';
import type { IntelItem, IntelFeedFilters } from '@/types/intel';

interface IntelFeedProps {
  filters: IntelFeedFilters;
}

export function IntelFeed({ filters }: IntelFeedProps) {
  const [items, setItems] = useState<IntelItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('intel_items')
        .select('*', { count: 'exact' })
        .in('status', ['classified', 'analyzed'])
        .order('published_at', { ascending: false });

      if (filters.topic) query = query.eq('topic', filters.topic);
      if (filters.impact) query = query.eq('impact_level', filters.impact);
      if (filters.visa_route) query = query.contains('visa_routes_affected', [filters.visa_route]);
      if (filters.date_from) query = query.gte('published_at', filters.date_from);
      if (filters.date_to) query = query.lte('published_at', filters.date_to);

      const page = filters.page || 1;
      const perPage = filters.per_page || 20;
      const from = (page - 1) * perPage;
      query = query.range(from, from + perPage - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setItems(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error('Failed to fetch intel items:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial fetch + refetch on filter change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Supabase Realtime subscription for new analyzed items
  useEffect(() => {
    const channel = supabase
      .channel('intel-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'intel_items',
          filter: 'status=eq.analyzed',
        },
        (payload) => {
          const newItem = payload.new as IntelItem;
          // Prepend to feed if it matches current filters
          setItems((prev) => {
            if (prev.some((i) => i.id === newItem.id)) return prev;
            return [newItem, ...prev];
          });
          setNewIds((prev) => new Set(prev).add(newItem.id));
          // Remove "new" highlight after 5 seconds
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              next.delete(newItem.id);
              return next;
            });
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-s1 border border-border animate-shimmer rounded" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-dim text-sm">
        No intel items found matching your filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <IntelCard key={item.id} item={item} isNew={newIds.has(item.id)} />
      ))}

      {/* Pagination info */}
      <div className="flex items-center justify-between pt-2 text-[10px] font-data text-dim">
        <span>{total} items total</span>
        <span>Page {filters.page || 1} of {Math.ceil(total / (filters.per_page || 20))}</span>
      </div>
    </div>
  );
}
```

- [ ] 19.2. Commit:
```bash
git add frontend/src/components/intel/IntelFeed.tsx
git commit -m "feat(intel): IntelFeed component with Supabase Realtime subscription"
```

---

## Task 20: Intel Main Page (`/intel`)

**Files:**
- Create: `frontend/src/app/intel/page.tsx`

- [ ] 20.1. Create the main intel page:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { IntelFeed } from '@/components/intel/IntelFeed';
import { IntelFilters } from '@/components/intel/IntelFilters';
import type { IntelFeedFilters } from '@/types/intel';
import { Newspaper, Clock, Calendar, BarChart3, FileText, Scale } from 'lucide-react';
import Link from 'next/link';

const subPages = [
  { href: '/intel/timeline', label: 'Timeline', icon: Clock, desc: 'Rule change history' },
  { href: '/intel/calendar', label: 'Calendar', icon: Calendar, desc: 'Key dates' },
  { href: '/intel/stats', label: 'Statistics', icon: BarChart3, desc: 'Visa data' },
  { href: '/intel/policies', label: 'Policies', icon: FileText, desc: 'Track policies' },
  { href: '/intel/lawyers', label: 'Lawyers', icon: Scale, desc: 'Find a lawyer' },
];

export default function IntelPage() {
  const [filters, setFilters] = useState<IntelFeedFilters>({ page: 1, per_page: 20 });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-cyan" />
          <h1 className="text-sm font-semibold text-text">Immigration Intelligence</h1>
          <span className="flex items-center gap-1 ml-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
            <span className="font-data text-[8px] text-cyan uppercase tracking-wider">LIVE</span>
          </span>
        </div>
      </div>

      {/* Sub-page nav cards */}
      <div className="grid grid-cols-5 gap-2">
        {subPages.map((p) => (
          <Link key={p.href} href={p.href}>
            <Card interactive className="flex items-center gap-2 p-2">
              <p.icon size={13} className="text-dim shrink-0" />
              <div>
                <p className="text-[11px] font-medium text-text">{p.label}</p>
                <p className="text-[9px] text-dim">{p.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main content: filters + feed */}
      <div className="flex gap-4">
        {/* Sidebar filters */}
        <div className="w-48 shrink-0">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <IntelFilters filters={filters} onChange={setFilters} />
          </Card>
        </div>

        {/* Feed */}
        <div className="flex-1 min-w-0">
          <IntelFeed filters={filters} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] 20.2. Commit:
```bash
git add frontend/src/app/intel/page.tsx
git commit -m "feat(intel): main /intel page with live feed, filters, sub-page nav"
```

---

## Task 21: Add Intel to Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] 21.1. Add the Intel nav item to the INTEL section. In the `navSections` array, update the INTEL section:

```typescript
// Replace the existing INTEL section items with:
    {
      title: 'INTEL',
      items: [
        { href: '/intel', label: 'Intel Hub', icon: <Newspaper size={15} />, shortcut: 'G L', badge: 'live' },
        { href: '/trends', label: 'Trends', icon: <TrendingUp size={15} />, shortcut: 'G T' },
        { href: '/signals', label: 'Signals', icon: <Zap size={15} />, shortcut: 'G I' },
        { href: '/compare', label: 'Compare', icon: <GitCompareArrows size={15} />, shortcut: 'G C' },
      ],
    },
```

Also add the `Newspaper` import at the top:
```typescript
import { ..., Newspaper } from 'lucide-react';
```

- [ ] 21.2. Commit:
```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(intel): add Intel Hub to sidebar navigation with LIVE badge"
```

---

## Task 22: Timeline Page (`/intel/timeline`)

**Files:**
- Create: `frontend/src/components/intel/Timeline.tsx`
- Create: `frontend/src/app/intel/timeline/page.tsx`

- [ ] 22.1. Create `frontend/src/components/intel/Timeline.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { ImpactBadge } from './ImpactBadge';
import { formatDate } from '@/lib/utils';
import type { IntelTimelineNode } from '@/types/intel';

interface TimelineProps {
  visaRoute?: string;
}

export function Timeline({ visaRoute }: TimelineProps) {
  const [nodes, setNodes] = useState<IntelTimelineNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase
        .from('intel_items')
        .select('id, title, published_at, impact_level, visa_routes_affected, summary, before_after')
        .eq('topic', 'rule_change')
        .in('status', ['classified', 'analyzed'])
        .order('published_at', { ascending: false })
        .limit(50);

      if (visaRoute) {
        query = query.contains('visa_routes_affected', [visaRoute]);
      }

      const { data } = await query;
      setNodes(data || []);
      setLoading(false);
    }
    fetch();
  }, [visaRoute]);

  if (loading) return <div className="h-48 bg-s1 border border-border animate-shimmer rounded" />;

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-4 pl-10">
        {nodes.map((node) => (
          <div key={node.id} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-10 top-2 h-2.5 w-2.5 rounded-full border-2 border-bg ${
              node.impact_level === 'critical' ? 'bg-red' :
              node.impact_level === 'high' ? 'bg-amber' :
              node.impact_level === 'medium' ? 'bg-blue' : 'bg-dim'
            }`} />

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <ImpactBadge level={node.impact_level} size="sm" />
                <span className="text-[10px] font-data text-dim">
                  {node.published_at ? formatDate(node.published_at) : 'Date unknown'}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text mb-1">{node.title}</h3>
              {node.summary && <p className="text-xs text-dim mb-2">{node.summary}</p>}

              {node.before_after && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded bg-red/5 border border-red/10 p-2">
                    <p className="text-[9px] font-data uppercase text-red mb-0.5">Before</p>
                    <p className="text-[11px] text-dim">{node.before_after.before}</p>
                  </div>
                  <div className="rounded bg-green/5 border border-green/10 p-2">
                    <p className="text-[9px] font-data uppercase text-green mb-0.5">After</p>
                    <p className="text-[11px] text-dim">{node.before_after.after}</p>
                  </div>
                </div>
              )}

              {node.visa_routes_affected && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {node.visa_routes_affected.map((r) => (
                    <span key={r} className="text-[8px] font-data text-dim bg-s3 px-1.5 py-px rounded border border-border">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] 22.2. Create `frontend/src/app/intel/timeline/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Timeline } from '@/components/intel/Timeline';
import { Clock } from 'lucide-react';

const ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Family', 'Student'];

export default function TimelinePage() {
  const [selectedRoute, setSelectedRoute] = useState<string | undefined>();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Rule Change Timeline</h1>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setSelectedRoute(undefined)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            !selectedRoute ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
          }`}
        >
          All Routes
        </button>
        {ROUTES.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRoute(r)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              selectedRoute === r ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <Timeline visaRoute={selectedRoute} />
    </div>
  );
}
```

- [ ] 22.3. Commit:
```bash
git add frontend/src/components/intel/Timeline.tsx frontend/src/app/intel/timeline/page.tsx
git commit -m "feat(intel): timeline page with vertical rule-change visualization"
```

---

## Task 23: Calendar Page (`/intel/calendar`)

**Files:**
- Create: `frontend/src/components/intel/Calendar.tsx`
- Create: `frontend/src/app/intel/calendar/page.tsx`

- [ ] 23.1. Create `frontend/src/components/intel/Calendar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import type { IntelCalendarEvent } from '@/types/intel';

interface CalendarProps {
  month: number;
  year: number;
  visaRoute?: string;
}

export function CalendarView({ month, year, visaRoute }: CalendarProps) {
  const [events, setEvents] = useState<IntelCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      let query = supabase
        .from('intel_calendar')
        .select('*')
        .gte('event_date', start)
        .lt('event_date', end)
        .order('event_date');

      if (visaRoute) query = query.contains('visa_routes', [visaRoute]);

      const { data } = await query;
      setEvents(data || []);
      setLoading(false);
    }
    fetch();
  }, [month, year, visaRoute]);

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sun

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.event_date === dateStr);
  };

  if (loading) return <div className="h-64 bg-s1 border border-border animate-shimmer rounded" />;

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[9px] font-data uppercase text-dim py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, idx) => {
          const dayEvents = day ? getEventsForDay(day) : [];
          return (
            <div
              key={idx}
              className={`min-h-[80px] border border-border p-1 ${
                day ? 'bg-s1' : 'bg-bg'
              }`}
            >
              {day && (
                <>
                  <span className="text-[10px] font-data text-dim">{day}</span>
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="mt-0.5 rounded bg-cyan/10 border border-cyan/20 px-1 py-0.5 cursor-pointer hover:bg-cyan/15"
                      title={evt.description || evt.title}
                    >
                      <p className="text-[8px] font-data text-cyan truncate">{evt.title}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] 23.2. Create `frontend/src/app/intel/calendar/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CalendarView } from '@/components/intel/Calendar';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-cyan" />
          <h1 className="text-sm font-semibold text-text">Immigration Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prev}><ChevronLeft size={14} /></Button>
          <span className="text-sm font-data text-text min-w-[100px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="ghost" size="sm" onClick={next}><ChevronRight size={14} /></Button>
        </div>
      </div>

      <CalendarView month={month} year={year} />
    </div>
  );
}
```

- [ ] 23.3. Commit:
```bash
git add frontend/src/components/intel/Calendar.tsx frontend/src/app/intel/calendar/page.tsx
git commit -m "feat(intel): calendar page with monthly grid view and event display"
```

---

## Task 24: Statistics Dashboard Page (`/intel/stats`)

**Files:**
- Create: `frontend/src/components/intel/StatsPanel.tsx`
- Create: `frontend/src/app/intel/stats/page.tsx`

- [ ] 24.1. Create `frontend/src/components/intel/StatsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import type { IntelStatistic } from '@/types/intel';

interface StatsPanelProps {
  visaRoute?: string;
}

export function StatsPanel({ visaRoute }: StatsPanelProps) {
  const [stats, setStats] = useState<IntelStatistic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase.from('intel_statistics').select('*').order('published_at', { ascending: false }).limit(100);
      if (visaRoute) query = query.eq('visa_route', visaRoute);
      const { data } = await query;
      setStats(data || []);
      setLoading(false);
    }
    fetch();
  }, [visaRoute]);

  if (loading) return <div className="h-48 bg-s1 border border-border animate-shimmer rounded" />;

  // Group stats by type
  const grouped = stats.reduce<Record<string, IntelStatistic[]>>((acc, s) => {
    (acc[s.stat_type] = acc[s.stat_type] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, items]) => (
        <Card key={type}>
          <CardHeader>
            <CardTitle>{type.replace(/_/g, ' ')}</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 gap-2">
            {items.slice(0, 6).map((stat) => (
              <div key={stat.id} className="bg-s2 rounded p-2 border border-border">
                <p className="text-[9px] font-data text-dim uppercase">{stat.visa_route || 'All'} / {stat.period}</p>
                <p className="text-lg font-data font-bold text-text">{stat.value.toLocaleString()}</p>
                {stat.change_pct !== null && (
                  <p className={`text-[10px] font-data ${stat.change_pct >= 0 ? 'text-green' : 'text-red'}`}>
                    {stat.change_pct >= 0 ? '+' : ''}{stat.change_pct.toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {stats.length === 0 && (
        <div className="text-center text-dim text-sm py-8">No statistics available yet.</div>
      )}
    </div>
  );
}
```

- [ ] 24.2. Create `frontend/src/app/intel/stats/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { StatsPanel } from '@/components/intel/StatsPanel';
import { BarChart3 } from 'lucide-react';

const ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Family', 'Student'];

export default function StatsPage() {
  const [route, setRoute] = useState<string | undefined>();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Immigration Statistics</h1>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setRoute(undefined)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            !route ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
          }`}
        >
          All Routes
        </button>
        {ROUTES.map((r) => (
          <button key={r} onClick={() => setRoute(r)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              route === r ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <StatsPanel visaRoute={route} />
    </div>
  );
}
```

- [ ] 24.3. Commit:
```bash
git add frontend/src/components/intel/StatsPanel.tsx frontend/src/app/intel/stats/page.tsx
git commit -m "feat(intel): statistics dashboard page with grouped stat cards"
```

---

## Task 25: Policy Tracker Page (`/intel/policies`)

**Files:**
- Create: `frontend/src/components/intel/PolicyCard.tsx`
- Create: `frontend/src/app/intel/policies/page.tsx`

- [ ] 25.1. Create `frontend/src/components/intel/PolicyCard.tsx`:

```tsx
'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import type { IntelPolicy, IntelPolicyStage } from '@/types/intel';

const stageConfig: Record<IntelPolicyStage, { label: string; variant: 'default' | 'blue' | 'amber' | 'purple' | 'green' }> = {
  proposed: { label: 'Proposed', variant: 'default' },
  consultation: { label: 'Consultation', variant: 'blue' },
  parliamentary_debate: { label: 'In Parliament', variant: 'purple' },
  enacted: { label: 'Enacted', variant: 'amber' },
  effective: { label: 'In Effect', variant: 'green' },
};

interface PolicyCardProps {
  policy: IntelPolicy;
  onFollow?: (id: string) => void;
  onUnfollow?: (id: string) => void;
}

export function PolicyCard({ policy, onFollow, onUnfollow }: PolicyCardProps) {
  const stage = stageConfig[policy.stage] || stageConfig.proposed;

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <Badge variant={stage.variant} size="sm">{stage.label}</Badge>
        {policy.effective_date && (
          <span className="text-[9px] font-data text-dim">
            Effective: {formatDate(policy.effective_date)}
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium text-text mb-1">{policy.title}</h3>
      {policy.description && <p className="text-xs text-dim mb-2">{policy.description}</p>}

      {policy.last_update_summary && (
        <div className="bg-s2 rounded p-2 border border-border mb-2">
          <p className="text-[9px] font-data uppercase text-dim mb-0.5">Latest Update</p>
          <p className="text-[11px] text-text">{policy.last_update_summary}</p>
          {policy.last_updated_at && (
            <p className="text-[9px] font-data text-dim mt-0.5">{formatDate(policy.last_updated_at)}</p>
          )}
        </div>
      )}

      {policy.visa_routes_affected && (
        <div className="flex flex-wrap gap-1 mb-2">
          {policy.visa_routes_affected.map((r) => (
            <span key={r} className="text-[8px] font-data text-dim bg-s3 px-1.5 py-px rounded border border-border">{r}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        {policy.source_url && (
          <a href={policy.source_url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-cyan font-data hover:text-cyan/80">
            Source &rarr;
          </a>
        )}
        {policy.is_followed ? (
          <Button variant="ghost" size="sm" onClick={() => onUnfollow?.(policy.id)}>Unfollow</Button>
        ) : (
          <Button variant="amber" size="sm" onClick={() => onFollow?.(policy.id)}>Follow</Button>
        )}
      </div>
    </Card>
  );
}
```

- [ ] 25.2. Create `frontend/src/app/intel/policies/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PolicyCard } from '@/components/intel/PolicyCard';
import { FileText } from 'lucide-react';
import type { IntelPolicy } from '@/types/intel';

const STAGES = ['proposed', 'consultation', 'parliamentary_debate', 'enacted', 'effective'];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<IntelPolicy[]>([]);
  const [stage, setStage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase.from('intel_policies').select('*').order('last_updated_at', { ascending: false });
      if (stage) query = query.eq('stage', stage);
      const { data } = await query;
      setPolicies(data || []);
      setLoading(false);
    }
    fetch();
  }, [stage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Policy Tracker</h1>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setStage(undefined)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${!stage ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'}`}>
          All Stages
        </button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setStage(s)}
            className={`px-2 py-1 text-xs rounded border transition-colors capitalize ${stage === s ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-s1 border border-border animate-shimmer rounded" />)}
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center text-dim text-sm py-8">No policies tracked yet.</div>
      ) : (
        <div className="space-y-2">
          {policies.map((p) => <PolicyCard key={p.id} policy={p} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] 25.3. Commit:
```bash
git add frontend/src/components/intel/PolicyCard.tsx frontend/src/app/intel/policies/page.tsx
git commit -m "feat(intel): policy tracker page with stage badges, follow/unfollow"
```

---

## Task 26: Lawyer Tables — Supabase Migration

**Files:**
- Create: `supabase/migrations/20260323000004_intel_lawyers.sql`

- [ ] 26.1. Create the migration:

```sql
-- supabase/migrations/20260323000004_intel_lawyers.sql

CREATE TABLE intel_lawyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(300) NOT NULL,
    firm_name VARCHAR(500),
    registration_type VARCHAR(20) NOT NULL CHECK (registration_type IN ('oisc', 'sra')),
    registration_number VARCHAR(50) NOT NULL,
    oisc_level INTEGER CHECK (oisc_level IN (1, 2, 3)),
    practising_status VARCHAR(30) NOT NULL DEFAULT 'active',
    accreditations TEXT[],
    practice_areas TEXT[] NOT NULL,
    languages TEXT[],
    fee_initial_consultation VARCHAR(100),
    fee_hourly_range VARCHAR(100),
    fee_fixed_range VARCHAR(200),
    offers_legal_aid BOOLEAN DEFAULT FALSE,
    address TEXT,
    city VARCHAR(200),
    postcode VARCHAR(20),
    latitude FLOAT,
    longitude FLOAT,
    offers_remote BOOLEAN DEFAULT TRUE,
    google_rating FLOAT,
    google_review_count INTEGER DEFAULT 0,
    trustpilot_rating FLOAT,
    trustpilot_review_count INTEGER DEFAULT 0,
    combined_rating FLOAT,
    website VARCHAR(500),
    email VARCHAR(300),
    phone VARCHAR(50),
    bio TEXT,
    profile_photo_url VARCHAR(1000),
    disciplinary_history JSONB DEFAULT '[]',
    last_verified_at TIMESTAMPTZ,
    source_url VARCHAR(2000),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_lawyers_status ON intel_lawyers (is_active, practising_status);
CREATE INDEX idx_intel_lawyers_areas ON intel_lawyers USING gin (practice_areas);
CREATE INDEX idx_intel_lawyers_city ON intel_lawyers (city);
CREATE INDEX idx_intel_lawyers_rating ON intel_lawyers (combined_rating DESC NULLS LAST);
CREATE INDEX idx_intel_lawyers_type ON intel_lawyers (registration_type, oisc_level);
CREATE INDEX idx_intel_lawyers_geo ON intel_lawyers (latitude, longitude) WHERE latitude IS NOT NULL;

CREATE TABLE intel_lawyer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES intel_lawyers(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL CHECK (source IN ('google', 'trustpilot', 'user')),
    author_name VARCHAR(200),
    rating FLOAT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMPTZ,
    visa_route_mentioned VARCHAR(100),
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lawyer_reviews_lawyer ON intel_lawyer_reviews (lawyer_id, source, review_date DESC);
CREATE INDEX idx_lawyer_reviews_route ON intel_lawyer_reviews (visa_route_mentioned) WHERE visa_route_mentioned IS NOT NULL;

CREATE TABLE intel_lawyer_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    visa_route VARCHAR(100),
    nationality VARCHAR(100),
    location VARCHAR(200),
    case_complexity VARCHAR(30),
    budget_range VARCHAR(100),
    language_pref VARCHAR(100),
    results_returned INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lawyer_searches_user ON intel_lawyer_searches (user_id, created_at DESC);

-- RLS
ALTER TABLE intel_lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lawyers" ON intel_lawyers FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Service role manages lawyers" ON intel_lawyers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE intel_lawyer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lawyer reviews" ON intel_lawyer_reviews FOR SELECT USING (true);
CREATE POLICY "Service role manages lawyer reviews" ON intel_lawyer_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE intel_lawyer_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own searches" ON intel_lawyer_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages searches" ON intel_lawyer_searches FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] 26.2. Run migration in Supabase SQL Editor.

- [ ] 26.3. Commit:
```bash
git add supabase/migrations/20260323000004_intel_lawyers.sql
git commit -m "feat(intel): lawyer tables — intel_lawyers, reviews, searches + RLS"
```

---

## Task 27: Lawyer Scanner Task

**Files:**
- Create: `backend/app/scanners/intel_lawyers.py`

- [ ] 27.1. Create `backend/app/scanners/intel_lawyers.py`:

```python
"""
Intel scanner: OISC + SRA lawyer registers.

Scrapes official registers weekly, enriches with review data.
Stores/updates in intel_lawyers table.
"""

import logging
import re

import httpx

logger = logging.getLogger(__name__)

OISC_SEARCH_URL = "https://home.oisc.gov.uk/adviser_finder/finder.aspx"
SRA_SEARCH_URL = "https://www.sra.org.uk/consumers/register/organisation/"


async def scrape_oisc_register(http_client) -> list[dict]:
    """Scrape OISC adviser register for immigration advisers."""
    advisers = []
    try:
        # OISC has a search page; query for immigration advisers
        resp = await http_client.get(OISC_SEARCH_URL, timeout=30)
        resp.raise_for_status()
        html = resp.text

        # Parse results - OISC register has a simple table format
        # Look for adviser entries in the HTML
        rows = re.findall(
            r'<tr[^>]*>(.*?)</tr>',
            html, re.DOTALL
        )

        for row in rows:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if len(cells) >= 4:
                name = re.sub(r'<[^>]+>', '', cells[0]).strip()
                firm = re.sub(r'<[^>]+>', '', cells[1]).strip()
                reg_num = re.sub(r'<[^>]+>', '', cells[2]).strip()
                level_text = re.sub(r'<[^>]+>', '', cells[3]).strip()

                if not name or not reg_num:
                    continue

                # Parse OISC level
                level = None
                level_match = re.search(r'Level\s*(\d)', level_text)
                if level_match:
                    level = int(level_match.group(1))

                advisers.append({
                    "name": name,
                    "firm_name": firm or None,
                    "registration_type": "oisc",
                    "registration_number": reg_num,
                    "oisc_level": level,
                    "practising_status": "active",
                    "practice_areas": ["Immigration"],
                    "is_active": True,
                })

    except Exception as e:
        logger.error(f"OISC register scrape failed: {e}")

    return advisers


async def scrape_sra_register(http_client) -> list[dict]:
    """Scrape SRA solicitors register for immigration solicitors."""
    solicitors = []
    try:
        # SRA has an API-like search
        params = {"Type": "Immigration", "Page": 1, "PageSize": 50}
        resp = await http_client.get(
            "https://www.sra.org.uk/consumers/register/organisation/",
            params=params, timeout=30
        )
        resp.raise_for_status()
        html = resp.text

        # Parse SRA results
        blocks = re.findall(r'<div class="[^"]*result[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
        for block in blocks[:50]:
            name_match = re.search(r'<h[23][^>]*>(.*?)</h[23]>', block, re.DOTALL)
            if not name_match:
                continue
            name = re.sub(r'<[^>]+>', '', name_match.group(1)).strip()

            sra_match = re.search(r'SRA\s*(?:ID|Number)[:\s]*(\d+)', block)
            reg_num = sra_match.group(1) if sra_match else ""

            city_match = re.search(r'(?:City|Location)[:\s]*([^<]+)', block)
            city = city_match.group(1).strip() if city_match else None

            solicitors.append({
                "name": name,
                "firm_name": name,
                "registration_type": "sra",
                "registration_number": reg_num,
                "oisc_level": None,
                "practising_status": "active",
                "practice_areas": ["Immigration"],
                "city": city,
                "is_active": True,
            })

    except Exception as e:
        logger.error(f"SRA register scrape failed: {e}")

    return solicitors


async def scan_lawyer_registers(supabase_client) -> dict:
    """Scan OISC + SRA registers and upsert lawyers."""
    import time
    stats = {"items_fetched": 0, "items_new": 0, "items_updated": 0}
    start = time.time()

    async with httpx.AsyncClient(timeout=30) as client:
        # OISC
        oisc_lawyers = await scrape_oisc_register(client)
        stats["items_fetched"] += len(oisc_lawyers)

        for lawyer in oisc_lawyers:
            existing = supabase_client.table("intel_lawyers").select("id").eq(
                "registration_number", lawyer["registration_number"]
            ).eq("registration_type", "oisc").limit(1).execute()

            if existing.data:
                supabase_client.table("intel_lawyers").update({
                    "practising_status": lawyer["practising_status"],
                    "last_verified_at": "now()",
                }).eq("id", existing.data[0]["id"]).execute()
                stats["items_updated"] += 1
            else:
                supabase_client.table("intel_lawyers").insert(lawyer).execute()
                stats["items_new"] += 1

        # SRA
        sra_lawyers = await scrape_sra_register(client)
        stats["items_fetched"] += len(sra_lawyers)

        for lawyer in sra_lawyers:
            existing = supabase_client.table("intel_lawyers").select("id").eq(
                "registration_number", lawyer["registration_number"]
            ).eq("registration_type", "sra").limit(1).execute()

            if existing.data:
                supabase_client.table("intel_lawyers").update({
                    "practising_status": lawyer["practising_status"],
                    "last_verified_at": "now()",
                }).eq("id", existing.data[0]["id"]).execute()
                stats["items_updated"] += 1
            else:
                supabase_client.table("intel_lawyers").insert(lawyer).execute()
                stats["items_new"] += 1

    stats["duration_ms"] = int((time.time() - start) * 1000)
    return stats
```

- [ ] 27.2. Add the lawyer scan task to `backend/app/tasks/intel_tasks.py`:

```python
@celery_app.task(name="intel.scan_lawyers", bind=True, max_retries=2)
def intel_scan_lawyers(self):
    """Scan OISC + SRA registers for immigration lawyers (weekly)."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_lawyers import scan_lawyer_registers
            return await scan_lawyer_registers(supabase)

        stats = _run_async(_run())
        _log_health(supabase, "lawyer_registers", "intel_scan_lawyers", stats)
        logger.info(f"intel_scan_lawyers complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_scan_lawyers failed: {e}")
        raise self.retry(exc=e, countdown=300)
```

- [ ] 27.3. Add to schedule in `backend/app/tasks/schedule.py`:

```python
    "intel-scan-lawyers": {
        "task": "intel.scan_lawyers",
        "schedule": crontab(day_of_week="0", hour="3", minute="0"),  # Sunday 3 AM
    },
```

- [ ] 27.4. Commit:
```bash
git add backend/app/scanners/intel_lawyers.py backend/app/tasks/intel_tasks.py backend/app/tasks/schedule.py
git commit -m "feat(intel): lawyer register scanner — OISC + SRA weekly scrape"
```

---

## Task 28: Lawyer Matching Algorithm + API Routes

**Files:**
- Create: `backend/app/scanners/intel_lawyer_matcher.py`
- Modify: `backend/app/api/v1/intel.py`

- [ ] 28.1. Create `backend/app/scanners/intel_lawyer_matcher.py`:

```python
"""
Lawyer matching algorithm.

Scores candidates on: specialisation (40%), reviews (25%),
proximity (15%), accreditation (10%), transparency (10%).
"""

import logging
import math

logger = logging.getLogger(__name__)

ACCREDITATION_SCORES = {
    "Law Society Immigration Accreditation": 10,
    "LEXCEL": 8,
    "SQM": 7,
    "OISC Level 3": 10,
    "OISC Level 2": 6,
}


def compute_match_score(
    lawyer: dict,
    visa_route: str,
    location: str | None = None,
    case_complexity: str = "straightforward",
) -> float:
    """Compute 0-100 match score for a lawyer given user criteria."""
    score = 0.0

    # 1. Specialisation match (40%)
    practice_areas = lawyer.get("practice_areas") or []
    practice_lower = [p.lower() for p in practice_areas]
    route_lower = visa_route.lower()

    if any(route_lower in p for p in practice_lower):
        score += 40
    elif "immigration" in practice_lower or "general" in practice_lower:
        score += 20
    elif any("visa" in p or "work permit" in p for p in practice_lower):
        score += 15

    # Bonus for complexity match
    if case_complexity == "appeal" and any("appeal" in p for p in practice_lower):
        score += 5
    elif case_complexity == "complex":
        oisc_level = lawyer.get("oisc_level")
        if oisc_level and oisc_level >= 2:
            score += 3

    # 2. Review quality (25%)
    combined_rating = lawyer.get("combined_rating")
    google_count = lawyer.get("google_review_count") or 0
    trustpilot_count = lawyer.get("trustpilot_review_count") or 0
    total_reviews = google_count + trustpilot_count

    if combined_rating and combined_rating > 0:
        # Scale: 5.0 = 25pts, 4.0 = 20pts, 3.0 = 15pts
        rating_score = min((combined_rating / 5.0) * 25, 25)
        # Penalise if fewer than 10 reviews
        if total_reviews < 10:
            rating_score *= (total_reviews / 10)
        score += rating_score

    # 3. Proximity (15%) — skip if no location or remote
    if location and location.lower() != "remote":
        # Simplified: if same city, full points
        lawyer_city = (lawyer.get("city") or "").lower()
        if lawyer_city and location.lower() in lawyer_city:
            score += 15
        elif lawyer.get("offers_remote"):
            score += 10
        else:
            score += 5
    elif lawyer.get("offers_remote"):
        score += 15

    # 4. Accreditation (10%)
    accreditations = lawyer.get("accreditations") or []
    accred_score = 0
    for accred in accreditations:
        accred_score = max(accred_score, ACCREDITATION_SCORES.get(accred, 0))
    score += min(accred_score, 10)

    # 5. Transparency (10%)
    transparency = 0
    if lawyer.get("website"):
        transparency += 3
    if lawyer.get("fee_initial_consultation"):
        transparency += 3
    if lawyer.get("fee_hourly_range"):
        transparency += 2
    if lawyer.get("email") or lawyer.get("phone"):
        transparency += 2
    score += min(transparency, 10)

    return min(score, 100)


async def search_lawyers(
    supabase_client,
    llm_service,
    visa_route: str,
    nationality: str | None = None,
    location: str | None = None,
    case_complexity: str = "straightforward",
    budget_range: str | None = None,
    language_pref: str | None = None,
    page: int = 1,
    per_page: int = 10,
) -> dict:
    """Search and rank lawyers by match score."""
    # Base query: active, practicing, covers immigration
    query = supabase_client.table("intel_lawyers").select("*").eq(
        "is_active", True
    ).eq("practising_status", "active")

    # Filter by OISC Level 2+ or SRA
    # (Applied in scoring rather than filtering to keep results)

    if location and location.lower() != "remote":
        query = query.eq("city", location)  # Simplified; production would use geo

    if language_pref:
        query = query.contains("languages", [language_pref])

    result = query.limit(100).execute()
    lawyers = result.data or []

    # Score and sort
    scored = []
    for lawyer in lawyers:
        match_score = compute_match_score(lawyer, visa_route, location, case_complexity)
        lawyer["match_score"] = round(match_score, 1)
        scored.append(lawyer)

    scored.sort(key=lambda x: x["match_score"], reverse=True)

    # Paginate
    start = (page - 1) * per_page
    page_results = scored[start:start + per_page]

    # Generate AI blurbs for top results
    for lawyer in page_results:
        try:
            prompt = f"""Write a 2-sentence explanation of why this lawyer is a good match.

Lawyer: {lawyer['name']} at {lawyer.get('firm_name', 'Independent')}
Registration: {lawyer['registration_type'].upper()} {lawyer.get('registration_number', '')}
Practice areas: {', '.join(lawyer.get('practice_areas', []))}
Rating: {lawyer.get('combined_rating', 'N/A')}/5 ({(lawyer.get('google_review_count', 0) + lawyer.get('trustpilot_review_count', 0))} reviews)
City: {lawyer.get('city', 'Unknown')}

User needs: {visa_route} visa, complexity: {case_complexity}

Write 2 concise sentences. No disclaimers."""

            blurb = await llm_service.complete_with_provider(
                provider="groq", prompt=prompt,
                system="You write brief, factual lawyer match explanations. 2 sentences max.",
                timeout=10,
            )
            lawyer["why_matched"] = blurb or f"Specialises in {visa_route} applications with strong client reviews."
        except Exception:
            lawyer["why_matched"] = f"Specialises in {visa_route} applications with strong client reviews."

    # Log search
    import uuid
    search_id = str(uuid.uuid4())
    try:
        supabase_client.table("intel_lawyer_searches").insert({
            "id": search_id,
            "visa_route": visa_route,
            "nationality": nationality,
            "location": location,
            "case_complexity": case_complexity,
            "budget_range": budget_range,
            "language_pref": language_pref,
            "results_returned": len(page_results),
        }).execute()
    except Exception:
        pass

    return {
        "results": page_results,
        "total": len(scored),
        "page": page,
        "per_page": per_page,
        "search_id": search_id,
    }
```

- [ ] 28.2. Add lawyer API routes to `backend/app/api/v1/intel.py` (append to the file):

```python
# ---- Lawyer Finder ----

@router.post("/lawyers/search")
async def search_lawyers_endpoint(body: dict):
    """Search & match lawyers based on user criteria."""
    from app.scanners.intel_lawyer_matcher import search_lawyers

    sb = _supabase_service()
    from app.agents.llm_service import LLMService
    from app.core.config import get_settings
    s = get_settings()
    llm = LLMService(
        backend="groq",
        groq_api_key=s.groq_api_key,
        nvidia_nim_api_key=s.nvidia_nim_api_key,
    )

    async def _run():
        return await search_lawyers(
            sb, llm,
            visa_route=body.get("visa_route", ""),
            nationality=body.get("nationality"),
            location=body.get("location"),
            case_complexity=body.get("case_complexity", "straightforward"),
            budget_range=body.get("budget_range"),
            language_pref=body.get("language_pref"),
            page=body.get("page", 1),
            per_page=body.get("per_page", 10),
        )

    import asyncio
    result = await _run()
    return result


@router.get("/lawyers/{lawyer_id}")
async def get_lawyer_detail(lawyer_id: str):
    """Get full lawyer profile."""
    sb = _supabase_anon()
    result = sb.table("intel_lawyers").select("*").eq("id", lawyer_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return result.data[0]


@router.get("/lawyers/{lawyer_id}/reviews")
async def get_lawyer_reviews(
    lawyer_id: str,
    source: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    """Get paginated reviews for a lawyer."""
    sb = _supabase_anon()
    query = sb.table("intel_lawyer_reviews").select("*", count="exact").eq("lawyer_id", lawyer_id)
    if source:
        query = query.eq("source", source)

    offset = (page - 1) * per_page
    result = query.order("review_date", desc=True).range(offset, offset + per_page - 1).execute()

    # Avg rating
    all_ratings = sb.table("intel_lawyer_reviews").select("rating").eq("lawyer_id", lawyer_id).execute()
    ratings = [r["rating"] for r in (all_ratings.data or []) if r.get("rating")]
    avg = sum(ratings) / len(ratings) if ratings else None

    return {
        "reviews": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
        "avg_rating": round(avg, 2) if avg else None,
    }


@router.get("/lawyers/compare")
async def compare_lawyers(ids: str = Query(..., description="Comma-separated lawyer IDs")):
    """Compare 2-3 lawyers side by side."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if len(id_list) < 2 or len(id_list) > 3:
        raise HTTPException(status_code=400, detail="Provide 2 or 3 lawyer IDs")

    sb = _supabase_anon()
    result = sb.table("intel_lawyers").select("*").in_("id", id_list).execute()
    return {
        "lawyers": result.data or [],
        "comparison_dimensions": ["rating", "fees", "accreditations", "reviews", "experience"],
    }
```

- [ ] 28.3. Commit:
```bash
git add backend/app/scanners/intel_lawyer_matcher.py backend/app/api/v1/intel.py
git commit -m "feat(intel): lawyer matching algorithm + search/detail/compare API routes"
```

---

## Task 29: Lawyer Finder Frontend — Search Form + Results

**Files:**
- Create: `frontend/src/components/intel/LawyerFinder.tsx`
- Create: `frontend/src/components/intel/LawyerCard.tsx`

- [ ] 29.1. Create `frontend/src/components/intel/LawyerCard.tsx`:

```tsx
'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LawyerSummary } from '@/types/intel';

interface LawyerCardProps {
  lawyer: LawyerSummary;
  rank: number;
  onSelect?: (id: string) => void;
}

export function LawyerCard({ lawyer, rank, onSelect }: LawyerCardProps) {
  return (
    <Card interactive className="relative" onClick={() => onSelect?.(lawyer.id)}>
      {/* Rank badge */}
      <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-amber flex items-center justify-center">
        <span className="text-[10px] font-data font-bold text-bg">{rank}</span>
      </div>

      <div className="flex items-start gap-3 pl-4">
        <div className="flex-1 min-w-0">
          {/* Name + firm */}
          <h3 className="text-sm font-medium text-text">{lawyer.name}</h3>
          {lawyer.firm_name && <p className="text-[11px] text-dim">{lawyer.firm_name}</p>}

          {/* Registration */}
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant={lawyer.registration_type === 'oisc' ? 'cyan' : 'purple'} size="sm">
              {lawyer.registration_type.toUpperCase()}
              {lawyer.oisc_level ? ` L${lawyer.oisc_level}` : ''}
            </Badge>
            <span className="text-[9px] font-data text-dim">#{lawyer.registration_number}</span>
          </div>

          {/* Practice areas */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {lawyer.practice_areas.slice(0, 4).map((area) => (
              <span key={area} className="text-[8px] font-data text-dim bg-s3 px-1 py-px rounded border border-border">
                {area}
              </span>
            ))}
          </div>

          {/* AI blurb */}
          <p className="text-xs text-dim mt-2 italic">&ldquo;{lawyer.why_matched}&rdquo;</p>
        </div>

        {/* Right column: score + rating */}
        <div className="text-right shrink-0 space-y-1">
          <div className="bg-amber/10 border border-amber/20 rounded px-2 py-1">
            <p className="text-[8px] font-data text-amber uppercase">Match</p>
            <p className="text-lg font-data font-bold text-amber">{lawyer.match_score}</p>
          </div>

          {lawyer.combined_rating && (
            <div>
              <p className="text-[10px] font-data text-amber">
                {'★'.repeat(Math.round(lawyer.combined_rating))}
              </p>
              <p className="text-[9px] font-data text-dim">
                {(lawyer.google_review_count + lawyer.trustpilot_review_count)} reviews
              </p>
            </div>
          )}

          {lawyer.fee_initial_consultation && (
            <p className="text-[9px] font-data text-dim">{lawyer.fee_initial_consultation}</p>
          )}

          {lawyer.city && (
            <p className="text-[9px] font-data text-dim">{lawyer.city}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] 29.2. Create `frontend/src/components/intel/LawyerFinder.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { LawyerCard } from './LawyerCard';
import type { LawyerSummary, LawyerSearchParams, LawyerSearchResponse } from '@/types/intel';

const VISA_ROUTES = [
  'Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder',
  'Family', 'Student', 'Visitor', 'Asylum', 'Appeals',
];

const COMPLEXITIES = [
  { value: 'straightforward', label: 'Straightforward' },
  { value: 'complex', label: 'Complex' },
  { value: 'appeal', label: 'Appeal' },
];

export function LawyerFinder() {
  const [params, setParams] = useState<LawyerSearchParams>({
    visa_route: '',
    case_complexity: 'straightforward',
  });
  const [results, setResults] = useState<LawyerSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!params.visa_route) return;
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/v1/intel/lawyers/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data: LawyerSearchResponse = await resp.json();
      setResults(data);
    } catch (err) {
      console.error('Lawyer search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search form */}
      <Card>
        <CardHeader>
          <CardTitle>Find an Immigration Lawyer</CardTitle>
        </CardHeader>

        <div className="grid grid-cols-2 gap-3">
          {/* Visa route */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Visa Route *</label>
            <select
              value={params.visa_route}
              onChange={(e) => setParams({ ...params, visa_route: e.target.value })}
              className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-xs text-text focus:border-amber outline-none"
            >
              <option value="">Select route...</option>
              {VISA_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Location</label>
            <input
              type="text"
              placeholder="City or 'remote'"
              value={params.location || ''}
              onChange={(e) => setParams({ ...params, location: e.target.value || undefined })}
              className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-xs text-text focus:border-amber outline-none"
            />
          </div>

          {/* Complexity */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Case Complexity</label>
            <div className="flex gap-1.5">
              {COMPLEXITIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setParams({ ...params, case_complexity: c.value as any })}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    params.case_complexity === c.value
                      ? 'border-amber text-amber bg-amber/10'
                      : 'border-border text-dim hover:text-text'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="text-[9px] font-data uppercase tracking-wider text-dim mb-1 block">Language Preference</label>
            <input
              type="text"
              placeholder="e.g., Hindi, Mandarin"
              value={params.language_pref || ''}
              onChange={(e) => setParams({ ...params, language_pref: e.target.value || undefined })}
              className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-xs text-text focus:border-amber outline-none"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button variant="primary" size="md" onClick={handleSearch} disabled={!params.visa_route || loading}>
            {loading ? 'Searching...' : 'Find Lawyers'}
          </Button>
          <p className="text-[8px] text-dim italic">
            This is informational only. We do not endorse any specific lawyer. Verify credentials independently.
          </p>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-2">
          <p className="text-[10px] font-data text-dim">
            {results.total} lawyers found &middot; Showing top {results.results.length}
          </p>
          {results.results.map((lawyer, idx) => (
            <LawyerCard key={lawyer.id} lawyer={lawyer} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] 29.3. Commit:
```bash
git add frontend/src/components/intel/LawyerFinder.tsx frontend/src/components/intel/LawyerCard.tsx
git commit -m "feat(intel): LawyerFinder search form + LawyerCard result component"
```

---

## Task 30: Lawyer Finder Page (`/intel/lawyers`)

**Files:**
- Create: `frontend/src/app/intel/lawyers/page.tsx`

- [ ] 30.1. Create the page:

```tsx
'use client';

import { LawyerFinder } from '@/components/intel/LawyerFinder';
import { Scale } from 'lucide-react';

export default function LawyersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Scale size={16} className="text-cyan" />
        <h1 className="text-sm font-semibold text-text">Immigration Lawyer Finder</h1>
        <span className="text-[9px] font-data text-dim ml-2">AI-Powered Matching</span>
      </div>

      <LawyerFinder />
    </div>
  );
}
```

- [ ] 30.2. Commit:
```bash
git add frontend/src/app/intel/lawyers/page.tsx
git commit -m "feat(intel): lawyer finder page at /intel/lawyers"
```

---

## Task 31: Notification Matching Task

**Files:**
- Create: `backend/app/scanners/intel_notifications.py`
- Modify: `backend/app/tasks/intel_tasks.py`

- [ ] 31.1. Create `backend/app/scanners/intel_notifications.py`:

```python
"""
Notification matching: match analyzed intel items to user subscriptions.
"""

import logging

logger = logging.getLogger(__name__)

IMPACT_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


async def match_and_notify(supabase_client, item: dict) -> int:
    """Match a single analyzed item against all active subscriptions. Returns count of notifications created."""
    item_impact_rank = IMPACT_RANK.get(item.get("impact_level", "low"), 0)
    notifications_created = 0

    # Fetch all active subscriptions
    subs_result = supabase_client.table("intel_subscriptions").select(
        "id, user_id, channel, filter_topics, filter_visa_routes, filter_nationalities, filter_industries, filter_min_impact"
    ).eq("is_active", True).execute()

    for sub in (subs_result.data or []):
        # Impact threshold check
        sub_min_rank = IMPACT_RANK.get(sub.get("filter_min_impact", "medium"), 2)
        if item_impact_rank < sub_min_rank:
            continue

        # Topic filter
        filter_topics = sub.get("filter_topics")
        if filter_topics and item.get("topic") not in filter_topics:
            continue

        # Visa route filter (any overlap)
        filter_routes = sub.get("filter_visa_routes")
        item_routes = item.get("visa_routes_affected") or []
        if filter_routes and not set(filter_routes).intersection(set(item_routes)):
            continue

        # Nationality filter (any overlap)
        filter_nats = sub.get("filter_nationalities")
        item_nats = item.get("nationalities_affected") or []
        if filter_nats and not set(filter_nats).intersection(set(item_nats)):
            continue

        # Industry filter (any overlap)
        filter_inds = sub.get("filter_industries")
        item_inds = item.get("industries_affected") or []
        if filter_inds and not set(filter_inds).intersection(set(item_inds)):
            continue

        # Insert notification (ON CONFLICT ignore via unique index)
        try:
            supabase_client.table("intel_notifications").insert({
                "user_id": sub["user_id"],
                "intel_item_id": item["id"],
                "subscription_id": sub["id"],
                "title": item["title"],
                "body": item.get("summary"),
                "is_read": False,
            }).execute()
            notifications_created += 1
        except Exception:
            pass  # Duplicate, skip

    return notifications_created


async def process_notification_backlog(supabase_client) -> dict:
    """Process recently analyzed items that haven't been matched yet."""
    from datetime import datetime, timedelta

    stats = {"items_checked": 0, "notifications_created": 0}

    # Get recently analyzed items (last 30 min)
    cutoff = (datetime.utcnow() - timedelta(minutes=30)).isoformat()
    result = supabase_client.table("intel_items").select("*").eq(
        "status", "analyzed"
    ).gte("updated_at", cutoff).order("updated_at", desc=False).limit(50).execute()

    items = result.data or []
    stats["items_checked"] = len(items)

    for item in items:
        count = await match_and_notify(supabase_client, item)
        stats["notifications_created"] += count

    return stats
```

- [ ] 31.2. Add the notification task to `backend/app/tasks/intel_tasks.py`:

```python
@celery_app.task(name="intel.notify")
def intel_notify():
    """Match recently analyzed items to subscriptions and create notifications."""
    try:
        supabase = _get_supabase_service_client()

        async def _run():
            from app.scanners.intel_notifications import process_notification_backlog
            return await process_notification_backlog(supabase)

        stats = _run_async(_run())
        logger.info(f"intel_notify complete: {stats}")
        return stats
    except Exception as e:
        logger.error(f"intel_notify failed: {e}")
```

- [ ] 31.3. Add to beat schedule in `schedule.py`:

```python
    "intel-notify": {
        "task": "intel.notify",
        "schedule": crontab(minute="*/5"),  # every 5 min
    },
```

- [ ] 31.4. Commit:
```bash
git add backend/app/scanners/intel_notifications.py backend/app/tasks/intel_tasks.py backend/app/tasks/schedule.py
git commit -m "feat(intel): notification matching — match analyzed items to subscriptions"
```

---

## Task 32: SubscribeForm Component

**Files:**
- Create: `frontend/src/components/intel/SubscribeForm.tsx`

- [ ] 32.1. Create the subscription form:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { IntelSubscriptionCreate, IntelTopic, IntelImpactLevel, IntelNotifChannel } from '@/types/intel';

const TOPICS: { value: IntelTopic; label: string }[] = [
  { value: 'rule_change', label: 'Rule Changes' },
  { value: 'policy_update', label: 'Policy Updates' },
  { value: 'court_decision', label: 'Court Decisions' },
  { value: 'statistics', label: 'Statistics' },
];

const VISA_ROUTES = ['Skilled Worker', 'Global Talent', 'Graduate', 'Innovator Founder', 'Family', 'Student'];

interface SubscribeFormProps {
  onSuccess?: () => void;
}

export function SubscribeForm({ onSuccess }: SubscribeFormProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [minImpact, setMinImpact] = useState<IntelImpactLevel>('medium');
  const [channel, setChannel] = useState<IntelNotifChannel>('in_app');
  const [saving, setSaving] = useState(false);

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const body: IntelSubscriptionCreate = {
        filter_topics: topics.length > 0 ? topics : undefined,
        filter_visa_routes: routes.length > 0 ? routes : undefined,
        filter_min_impact: minImpact,
        channel,
      };
      await fetch(`${API_URL}/api/v1/intel/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSuccess?.();
    } catch (err) {
      console.error('Subscribe failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Subscribe to Alerts</CardTitle></CardHeader>

      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Topics (leave empty for all)</p>
          <div className="flex flex-wrap gap-1">
            {TOPICS.map((t) => (
              <button key={t.value} onClick={() => toggle(topics, t.value, setTopics)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  topics.includes(t.value) ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Visa Routes</p>
          <div className="flex flex-wrap gap-1">
            {VISA_ROUTES.map((r) => (
              <button key={r} onClick={() => toggle(routes, r, setRoutes)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  routes.includes(r) ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Minimum Impact</p>
          <div className="flex gap-1.5">
            {(['low', 'medium', 'high', 'critical'] as IntelImpactLevel[]).map((level) => (
              <button key={level} onClick={() => setMinImpact(level)}
                className={`px-2 py-0.5 text-[10px] rounded border capitalize transition-colors ${
                  minImpact === level ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-data uppercase tracking-wider text-dim mb-1">Notification Channel</p>
          <div className="flex gap-1.5">
            {[
              { value: 'in_app', label: 'In-App' },
              { value: 'email_instant', label: 'Email (Instant)' },
              { value: 'email_digest', label: 'Email (Weekly)' },
            ].map((ch) => (
              <button key={ch.value} onClick={() => setChannel(ch.value as IntelNotifChannel)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                  channel === ch.value ? 'border-amber text-amber bg-amber/10' : 'border-border text-dim hover:text-text'
                }`}>
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Create Subscription'}
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] 32.2. Commit:
```bash
git add frontend/src/components/intel/SubscribeForm.tsx
git commit -m "feat(intel): SubscribeForm component for alert subscriptions"
```

---

## Task 33: Weekly Digest Task

**Files:**
- Modify: `backend/app/tasks/intel_tasks.py`
- Modify: `backend/app/tasks/schedule.py`

- [ ] 33.1. Add digest task to `backend/app/tasks/intel_tasks.py`:

```python
DIGEST_SYSTEM_PROMPT = """Generate a weekly immigration intelligence briefing email for a UK immigration professional. The email should be concise, scannable, and actionable.

Structure your output as JSON:
{
  "subject_line": "string (email subject, max 80 chars)",
  "executive_summary": "string (2-3 sentences)",
  "top_items": [{"headline": "string", "one_liner": "string", "impact_badge": "critical|high|medium"}],
  "stats_highlight": "string or null",
  "calendar_preview": "string or null",
  "sign_off": "string"
}

Tone: professional but accessible. No emojis. No exclamation marks."""

DIGEST_USER_TEMPLATE = """Generate the weekly digest.

Top items this week (ranked by impact):
{top_items_json}

Statistics updates this week:
{stats_json}

Upcoming calendar events (next 14 days):
{calendar_json}

Return JSON only."""


@celery_app.task(name="intel.weekly_digest")
def intel_weekly_digest():
    """Generate and send weekly digest emails via Resend."""
    import json
    from datetime import datetime, timedelta

    try:
        supabase = _get_supabase_service_client()
        llm = _get_llm_service()

        # Fetch top items from last 7 days
        week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
        items_result = supabase.table("intel_items").select(
            "title, topic, impact_level, summary, visa_routes_affected"
        ).in_("status", ["classified", "analyzed"]).gte(
            "created_at", week_ago
        ).order("created_at", desc=True).limit(20).execute()

        # Fetch stats
        stats_result = supabase.table("intel_statistics").select("*").gte(
            "created_at", week_ago
        ).limit(10).execute()

        # Fetch upcoming calendar
        now = datetime.utcnow()
        two_weeks = (now + timedelta(days=14)).strftime("%Y-%m-%d")
        cal_result = supabase.table("intel_calendar").select("*").gte(
            "event_date", now.strftime("%Y-%m-%d")
        ).lte("event_date", two_weeks).order("event_date").execute()

        prompt = DIGEST_USER_TEMPLATE.format(
            top_items_json=json.dumps(items_result.data or [], default=str)[:3000],
            stats_json=json.dumps(stats_result.data or [], default=str)[:1000],
            calendar_json=json.dumps(cal_result.data or [], default=str)[:1000],
        )

        async def _gen():
            return await llm.structured_output_with_provider(
                provider="groq", prompt=prompt, system=DIGEST_SYSTEM_PROMPT,
            )

        digest = _run_async(_gen())
        logger.info(f"intel_weekly_digest generated: {digest.get('subject_line') if digest else 'failed'}")

        # TODO: Send via Resend to subscribed users (email_digest channel)

        return {"status": "generated", "subject": digest.get("subject_line") if digest else None}
    except Exception as e:
        logger.error(f"intel_weekly_digest failed: {e}")
```

- [ ] 33.2. Add to beat schedule:

```python
    "intel-weekly-digest": {
        "task": "intel.weekly_digest",
        "schedule": crontab(day_of_week="1", hour="6", minute="0"),  # Monday 6 AM
    },
```

- [ ] 33.3. Commit:
```bash
git add backend/app/tasks/intel_tasks.py backend/app/tasks/schedule.py
git commit -m "feat(intel): weekly digest generation task via Groq LLM"
```

---

## Task 34: Content Retention Cleanup Task

**Files:**
- Modify: `backend/app/tasks/intel_tasks.py`
- Modify: `backend/app/tasks/schedule.py`

- [ ] 34.1. Add cleanup task to `intel_tasks.py`:

```python
@celery_app.task(name="intel.cleanup_old_content")
def intel_cleanup_old_content():
    """Delete full content_text from items older than 90 days, keep snippets + summaries."""
    from datetime import datetime, timedelta

    try:
        supabase = _get_supabase_service_client()
        cutoff = (datetime.utcnow() - timedelta(days=90)).isoformat()

        # Null out content_text for old items
        result = supabase.table("intel_items").update({
            "content_text": None,
        }).lt("created_at", cutoff).not_.is_("content_text", "null").execute()

        count = len(result.data or [])
        logger.info(f"intel_cleanup_old_content: cleared {count} old content_text fields")
        return {"cleaned": count}
    except Exception as e:
        logger.error(f"intel_cleanup_old_content failed: {e}")
```

- [ ] 34.2. Add to schedule:

```python
    "intel-cleanup-old-content": {
        "task": "intel.cleanup_old_content",
        "schedule": crontab(day_of_week="0", hour="4", minute="0"),  # Sunday 4 AM
    },
```

- [ ] 34.3. Commit:
```bash
git add backend/app/tasks/intel_tasks.py backend/app/tasks/schedule.py
git commit -m "feat(intel): weekly content retention cleanup — nullify content_text after 90 days"
```

---

## Task 35: Seed Initial Calendar Events

**Files:**
- Create: `backend/app/scripts/seed_intel_calendar.py`

- [ ] 35.1. Create seed script:

```python
"""Seed initial immigration calendar events for 2026."""

from supabase import create_client
from app.core.config import get_settings

SEED_EVENTS = [
    {
        "title": "Home Office Immigration Statistics Q4 2025",
        "description": "Quarterly immigration statistics release covering October-December 2025.",
        "event_date": "2026-03-27",
        "event_type": "statistics_release",
        "visa_routes": ["General"],
        "source_url": "https://www.gov.uk/government/collections/immigration-statistics-quarterly-release",
        "is_confirmed": True,
    },
    {
        "title": "MAC Annual Report 2025-26",
        "description": "Migration Advisory Committee annual report on the labour market and immigration.",
        "event_date": "2026-04-15",
        "event_type": "mac_report",
        "visa_routes": ["Skilled Worker", "General"],
        "is_confirmed": False,
    },
    {
        "title": "Statement of Changes HC Spring 2026",
        "description": "Expected spring statement of changes to the Immigration Rules.",
        "event_date": "2026-04-01",
        "event_type": "rule_change",
        "visa_routes": ["General"],
        "is_confirmed": False,
    },
    {
        "title": "SOL Review Consultation Closes",
        "description": "Shortage Occupation List review consultation deadline.",
        "event_date": "2026-05-01",
        "event_type": "consultation",
        "visa_routes": ["Skilled Worker"],
        "is_confirmed": False,
    },
    {
        "title": "ONS Net Migration Estimate",
        "description": "Office for National Statistics releases updated net migration estimates.",
        "event_date": "2026-05-22",
        "event_type": "statistics_release",
        "visa_routes": ["General"],
        "source_url": "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration",
        "is_confirmed": True,
    },
    {
        "title": "Home Office Immigration Statistics Q1 2026",
        "description": "Quarterly immigration statistics release covering January-March 2026.",
        "event_date": "2026-06-26",
        "event_type": "statistics_release",
        "visa_routes": ["General"],
        "is_confirmed": True,
    },
]


def seed():
    s = get_settings()
    sb = create_client(s.supabase_url, s.supabase_service_key)

    for event in SEED_EVENTS:
        existing = sb.table("intel_calendar").select("id").eq(
            "title", event["title"]
        ).limit(1).execute()
        if not existing.data:
            sb.table("intel_calendar").insert(event).execute()
            print(f"  Seeded: {event['title']}")
        else:
            print(f"  Skipped (exists): {event['title']}")

    print("Done seeding calendar events.")


if __name__ == "__main__":
    seed()
```

- [ ] 35.2. Run: `cd backend && python -m app.scripts.seed_intel_calendar`

- [ ] 35.3. Commit:
```bash
git add backend/app/scripts/seed_intel_calendar.py
git commit -m "feat(intel): seed script for initial immigration calendar events"
```

---

## Task 36: Add `feedparser` and `supabase` to Requirements

**Files:**
- Modify: `backend/requirements.txt`

- [ ] 36.1. Add these dependencies (if not already present):

```
supabase>=2.0.0
feedparser>=6.0.0
selectolax>=0.3.0
redis>=5.0.0
```

- [ ] 36.2. Run: `cd backend && pip install -r requirements.txt`

- [ ] 36.3. Commit:
```bash
git add backend/requirements.txt
git commit -m "feat(intel): add supabase, feedparser, selectolax, redis to requirements"
```

---

## Task 37: Tailwind Animation for New Intel Items

**Files:**
- Modify: `frontend/tailwind.config.ts`

- [ ] 37.1. Add a `cyan-flash` animation to `tailwind.config.ts` keyframes:

```typescript
// Add to keyframes in tailwind.config.ts:
        'cyan-flash': {
          '0%': { borderColor: 'rgba(0, 229, 255, 0.6)', boxShadow: '0 0 16px -4px rgba(0, 229, 255, 0.3)' },
          '100%': { borderColor: 'rgba(42, 42, 42, 1)', boxShadow: '0 0 0 0 transparent' },
        },
```

```typescript
// Add to animation in tailwind.config.ts:
        'cyan-flash': 'cyan-flash 2s ease-out forwards',
```

- [ ] 37.2. Commit:
```bash
git add frontend/tailwind.config.ts
git commit -m "feat(intel): add cyan-flash animation for new realtime intel items"
```

---

## Task 38: LawyerCompare Component

**Files:**
- Create: `frontend/src/components/intel/LawyerCompare.tsx`

- [ ] 38.1. Create the comparison view:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LawyerDetail, LawyerCompareResponse } from '@/types/intel';

interface LawyerCompareProps {
  lawyerIds: string[];
}

export function LawyerCompare({ lawyerIds }: LawyerCompareProps) {
  const [data, setData] = useState<LawyerCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lawyerIds.length < 2) return;
    async function fetch() {
      setLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const resp = await globalThis.fetch(
          `${API_URL}/api/v1/intel/lawyers/compare?ids=${lawyerIds.join(',')}`
        );
        const json: LawyerCompareResponse = await resp.json();
        setData(json);
      } catch (err) {
        console.error('Compare fetch failed:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [lawyerIds]);

  if (loading) return <div className="h-48 bg-s1 border border-border animate-shimmer rounded" />;
  if (!data || data.lawyers.length < 2) return <p className="text-dim text-xs">Select 2-3 lawyers to compare.</p>;

  const rows = [
    { label: 'Registration', render: (l: LawyerDetail) => `${l.registration_type.toUpperCase()} ${l.oisc_level ? `L${l.oisc_level}` : ''} #${l.registration_number}` },
    { label: 'Rating', render: (l: LawyerDetail) => l.combined_rating ? `${l.combined_rating}/5` : 'N/A' },
    { label: 'Reviews', render: (l: LawyerDetail) => `${l.google_review_count + l.trustpilot_review_count}` },
    { label: 'Consultation Fee', render: (l: LawyerDetail) => l.fee_initial_consultation || 'Not listed' },
    { label: 'Hourly Rate', render: (l: LawyerDetail) => l.fee_hourly_range || 'Not listed' },
    { label: 'Location', render: (l: LawyerDetail) => l.city || 'Not listed' },
    { label: 'Remote', render: (l: LawyerDetail) => l.offers_remote ? 'Yes' : 'No' },
    { label: 'Legal Aid', render: (l: LawyerDetail) => l.offers_legal_aid ? 'Yes' : 'No' },
    { label: 'Accreditations', render: (l: LawyerDetail) => (l.accreditations || []).join(', ') || 'None listed' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Lawyer Comparison</CardTitle></CardHeader>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[9px] font-data uppercase text-dim px-2 py-1 border-b border-border w-32" />
            {data.lawyers.map((l) => (
              <th key={l.id} className="text-left text-xs font-medium text-text px-2 py-1 border-b border-border">
                {l.name}
                <br />
                <span className="text-[9px] text-dim font-normal">{l.firm_name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="text-[9px] font-data uppercase text-dim px-2 py-1.5 border-b border-border/50">{row.label}</td>
              {data.lawyers.map((l) => (
                <td key={l.id} className="text-xs text-text px-2 py-1.5 border-b border-border/50 font-data">
                  {row.render(l as any)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

- [ ] 38.2. Commit:
```bash
git add frontend/src/components/intel/LawyerCompare.tsx
git commit -m "feat(intel): LawyerCompare side-by-side comparison component"
```

---

## Task 39: DigestPreview Component

**Files:**
- Create: `frontend/src/components/intel/DigestPreview.tsx`

- [ ] 39.1. Create the digest preview component:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImpactBadge } from './ImpactBadge';
import { Mail } from 'lucide-react';

export function DigestPreview() {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const resp = await fetch(`${API_URL}/api/v1/intel/digest/preview`, { method: 'POST' });
      const data = await resp.json();
      setPreview(data);
    } catch (err) {
      console.error('Digest preview failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Digest Preview</CardTitle>
        <Button variant="ghost" size="sm" onClick={generatePreview} disabled={loading}>
          <Mail size={12} />
          {loading ? 'Generating...' : 'Preview'}
        </Button>
      </CardHeader>

      {preview ? (
        <div className="space-y-3">
          <div className="bg-s2 rounded p-3 border border-border">
            <p className="text-[9px] font-data uppercase text-dim mb-1">Subject</p>
            <p className="text-sm font-medium text-text">{preview.subject}</p>
          </div>
          {preview.top_items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-start gap-2">
              <ImpactBadge level={item.impact_level || item.impact_badge} size="sm" />
              <div>
                <p className="text-xs text-text">{item.title || item.headline}</p>
                {item.summary && <p className="text-[11px] text-dim">{item.summary || item.one_liner}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-dim">Click Preview to generate a sample weekly digest.</p>
      )}
    </Card>
  );
}
```

- [ ] 39.2. Commit:
```bash
git add frontend/src/components/intel/DigestPreview.tsx
git commit -m "feat(intel): DigestPreview component for weekly email preview"
```

---

## Task 40: Final Integration — Digest Preview API Route + Wire Everything

**Files:**
- Modify: `backend/app/api/v1/intel.py`

- [ ] 40.1. Add digest preview route to `backend/app/api/v1/intel.py`:

```python
@router.post("/digest/preview")
async def digest_preview():
    """Preview weekly digest content."""
    from datetime import datetime, timedelta
    import json

    sb = _supabase_anon()
    week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

    # Top items
    items = sb.table("intel_items").select(
        "id, title, topic, impact_level, summary, visa_routes_affected, published_at"
    ).in_("status", ["classified", "analyzed"]).gte(
        "created_at", week_ago
    ).order("created_at", desc=True).limit(10).execute()

    # Stats
    stats = sb.table("intel_statistics").select("*").gte(
        "created_at", week_ago
    ).limit(5).execute()

    # Calendar
    now = datetime.utcnow()
    two_weeks = (now + timedelta(days=14)).strftime("%Y-%m-%d")
    calendar = sb.table("intel_calendar").select("*").gte(
        "event_date", now.strftime("%Y-%m-%d")
    ).lte("event_date", two_weeks).order("event_date").execute()

    return {
        "subject": f"SponsorIntel Weekly: {len(items.data or [])} updates this week",
        "generated_at": datetime.utcnow().isoformat(),
        "top_items": items.data or [],
        "statistics_snapshot": stats.data or [],
        "upcoming_calendar": calendar.data or [],
        "personalized_items": [],
        "sections": [],
    }
```

- [ ] 40.2. Verify the intel router is registered in `main.py` (done in Task 15).

- [ ] 40.3. Run backend: `cd backend && uvicorn app.main:app --reload --port 8000`

- [ ] 40.4. Run frontend: `cd frontend && npm run dev`

- [ ] 40.5. Verify the following pages load:
  - `http://localhost:3333/intel` — Live feed
  - `http://localhost:3333/intel/timeline` — Timeline
  - `http://localhost:3333/intel/calendar` — Calendar
  - `http://localhost:3333/intel/stats` — Statistics
  - `http://localhost:3333/intel/policies` — Policy tracker
  - `http://localhost:3333/intel/lawyers` — Lawyer finder

- [ ] 40.6. Final commit:
```bash
git add backend/app/api/v1/intel.py
git commit -m "feat(intel): digest preview route + integration complete"
```

---

## Summary

| # | Task | Files | Est. Time |
|---|------|-------|-----------|
| 1 | Core SQL tables | 1 migration | 5 min |
| 2 | Notification + health tables | 1 migration | 4 min |
| 3 | RLS policies | 1 migration | 4 min |
| 4 | Config settings | 1 file modify | 2 min |
| 5 | LLM service Groq + NIM | 1 file modify | 5 min |
| 6 | Pydantic schemas | 1 file create | 5 min |
| 7 | GOV.UK scanner | 2 files create | 5 min |
| 8 | News scanner | 1 file create | 4 min |
| 9 | Legal scanner | 1 file create | 5 min |
| 10 | Reddit scanner | 1 file create | 4 min |
| 11 | Classifier + analyzer | 1 file create | 5 min |
| 12 | Celery tasks module | 2 files | 5 min |
| 13 | Beat schedule | 1 file modify | 3 min |
| 14 | TypeScript types | 1 file create | 4 min |
| 15 | FastAPI routes | 2 files | 5 min |
| 16 | ImpactBadge | 1 file create | 3 min |
| 17 | IntelCard | 1 file create | 4 min |
| 18 | IntelFilters | 1 file create | 4 min |
| 19 | IntelFeed + Realtime | 1 file create | 5 min |
| 20 | /intel page | 1 file create | 4 min |
| 21 | Sidebar nav update | 1 file modify | 2 min |
| 22 | Timeline page | 2 files create | 5 min |
| 23 | Calendar page | 2 files create | 5 min |
| 24 | Stats page | 2 files create | 4 min |
| 25 | Policy page | 2 files create | 5 min |
| 26 | Lawyer SQL tables | 1 migration | 4 min |
| 27 | Lawyer scanner task | 3 files | 5 min |
| 28 | Lawyer matcher + API | 2 files | 5 min |
| 29 | LawyerFinder + Card | 2 files create | 5 min |
| 30 | /intel/lawyers page | 1 file create | 2 min |
| 31 | Notification matching | 3 files | 5 min |
| 32 | SubscribeForm | 1 file create | 4 min |
| 33 | Weekly digest task | 2 files | 4 min |
| 34 | Content cleanup task | 2 files | 3 min |
| 35 | Seed calendar events | 1 file create | 3 min |
| 36 | Requirements update | 1 file modify | 2 min |
| 37 | Tailwind animation | 1 file modify | 2 min |
| 38 | LawyerCompare | 1 file create | 4 min |
| 39 | DigestPreview | 1 file create | 3 min |
| 40 | Final integration | 1 file modify | 5 min |
| **Total** | | **~55 files** | **~160 min** |
