# Implementation Plan: RAW -- Research & Analysis Wing

**Spec:** `docs/superpowers/specs/2026-03-22-raw-research-analysis-wing-design.md`
**Date:** 2026-03-23
**Estimated tasks:** 28
**Estimated time:** 90-120 minutes

---

## Dependencies & Environment

Before starting, ensure these are available:

```bash
# Backend (add to requirements.txt)
pip install groq openai  # groq SDK + openrouter via openai-compat
pip install weasyprint    # PDF export
pip install prometheus_client  # metrics

# Frontend (no new deps -- uses existing Leaflet, Recharts, Tailwind)
```

**Environment variables to add (Railway + .env):**
```
GROQ_API_KEY=gsk_...
NVIDIA_API_KEY=nvapi-...
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## Task 1 -- Database Migration: Core Tables

**Files:** `supabase/migrations/20260323_raw_tables.sql`

- [ ] 1. Create migration file with `raw_results` table

```sql
-- supabase/migrations/20260323_raw_tables.sql

-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Table: raw_results (user tool result storage)
-- ============================================
CREATE TABLE raw_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tool_name VARCHAR(50) NOT NULL,
    input JSONB NOT NULL,
    output JSONB NOT NULL,
    score INTEGER,
    processing_time_ms INTEGER,
    llm_provider VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_raw_results_user ON raw_results (user_id, created_at DESC);
CREATE INDEX idx_raw_results_tool ON raw_results (tool_name, created_at DESC);
```

- [ ] 2. Add `soc_codes` table

```sql
-- ============================================
-- Table: soc_codes (ONS SOC 2020 taxonomy)
-- ============================================
CREATE TABLE soc_codes (
    code VARCHAR(10) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    going_rate_annual INTEGER,
    is_shortage BOOLEAN DEFAULT FALSE,
    shortage_threshold INTEGER,
    standard_threshold INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_soc_codes_title ON soc_codes USING gin (title gin_trgm_ops);
```

- [ ] 3. Add `endorsing_bodies` table

```sql
-- ============================================
-- Table: endorsing_bodies (Innovator Founder visa)
-- ============================================
CREATE TABLE endorsing_bodies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(300) NOT NULL,
    website VARCHAR(500),
    focus_areas TEXT[],
    criteria JSONB,
    application_url VARCHAR(500),
    success_rate FLOAT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] 4. Add RLS policies for all three tables

```sql
-- ============================================
-- RLS Policies
-- ============================================

-- raw_results: users read own results only
ALTER TABLE raw_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own results" ON raw_results
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts results" ON raw_results
    FOR INSERT WITH CHECK (true);

-- soc_codes: public read, service role write
ALTER TABLE soc_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read SOC codes" ON soc_codes
    FOR SELECT USING (true);
CREATE POLICY "Service role manages SOC codes" ON soc_codes
    FOR ALL USING (true);

-- endorsing_bodies: public read, service role write
ALTER TABLE endorsing_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read endorsing bodies" ON endorsing_bodies
    FOR SELECT USING (true);
CREATE POLICY "Service role manages endorsing bodies" ON endorsing_bodies
    FOR ALL USING (true);
```

- [ ] 5. Run migration via Supabase dashboard SQL editor or CLI

```bash
supabase db push
```

- [ ] 6. Commit: `feat(raw): add core database tables (raw_results, soc_codes, endorsing_bodies)`

---

## Task 2 -- Database Migration: Lawyer Tables

**Files:** `supabase/migrations/20260323_raw_lawyers.sql`

- [ ] 1. Create `raw_lawyers` table

```sql
-- supabase/migrations/20260323_raw_lawyers.sql

CREATE TABLE raw_lawyers (
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

CREATE INDEX idx_raw_lawyers_status ON raw_lawyers (is_active, practising_status);
CREATE INDEX idx_raw_lawyers_areas ON raw_lawyers USING gin (practice_areas);
CREATE INDEX idx_raw_lawyers_city ON raw_lawyers (city);
CREATE INDEX idx_raw_lawyers_rating ON raw_lawyers (combined_rating DESC NULLS LAST);
CREATE INDEX idx_raw_lawyers_type ON raw_lawyers (registration_type, oisc_level);
CREATE INDEX idx_raw_lawyers_geo ON raw_lawyers (latitude, longitude) WHERE latitude IS NOT NULL;
```

- [ ] 2. Create `raw_lawyer_reviews` table

```sql
CREATE TABLE raw_lawyer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES raw_lawyers(id) ON DELETE CASCADE,
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

CREATE INDEX idx_raw_lawyer_reviews_lawyer ON raw_lawyer_reviews (lawyer_id, source, review_date DESC);
```

- [ ] 3. Add RLS policies for lawyer tables

```sql
-- raw_lawyers: public read active, service role write
ALTER TABLE raw_lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active lawyers" ON raw_lawyers
    FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Service role manages lawyers" ON raw_lawyers
    FOR ALL USING (true);

-- raw_lawyer_reviews: public read, service role write
ALTER TABLE raw_lawyer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lawyer reviews" ON raw_lawyer_reviews
    FOR SELECT USING (true);
CREATE POLICY "Service role manages lawyer reviews" ON raw_lawyer_reviews
    FOR ALL USING (true);
```

- [ ] 4. Run migration, verify in Supabase dashboard
- [ ] 5. Commit: `feat(raw): add lawyer database tables with RLS`

---

## Task 3 -- Extend LLM Service with Multi-Provider Routing

**Files:** `backend/app/agents/llm_service.py`, `backend/app/core/config.py`

- [ ] 1. Add new env vars to `config.py`

```python
# Add to Settings class in backend/app/core/config.py, after anthropic_api_key:

    # RAW LLM providers
    groq_api_key: str | None = None
    nvidia_api_key: str | None = None
    openrouter_api_key: str | None = None
```

- [ ] 2. Rewrite `llm_service.py` to support 5 providers with auto-cooldown rotation

```python
"""Unified LLM service with multi-provider routing and auto-cooldown."""

import json
import hashlib
import logging
import time
import httpx
from typing import Any, Literal

logger = logging.getLogger(__name__)

ComplexityTier = Literal["light", "heavy"]

# Provider priority order per complexity tier
PROVIDER_PRIORITY = {
    "light": ["groq", "nvidia_nim", "openrouter", "anthropic", "ollama"],
    "heavy": ["nvidia_nim", "openrouter", "anthropic", "groq", "ollama"],
}

# Model selection per provider+tier
MODEL_MAP = {
    ("groq", "light"): "llama-3.1-70b-versatile",
    ("groq", "heavy"): "llama-3.1-70b-versatile",
    ("nvidia_nim", "light"): "meta/llama-3.1-70b-instruct",
    ("nvidia_nim", "heavy"): "meta/llama-3.1-405b-instruct",
    ("openrouter", "light"): "anthropic/claude-3-haiku-20240307",
    ("openrouter", "heavy"): "anthropic/claude-3-haiku-20240307",
    ("anthropic", "light"): "claude-haiku-4-5-20251001",
    ("anthropic", "heavy"): "claude-haiku-4-5-20251001",
    ("ollama", "light"): "phi3:mini",
    ("ollama", "heavy"): "phi3:mini",
}


class ProviderState:
    """Tracks health of a single LLM provider."""

    def __init__(self):
        self.consecutive_failures = 0
        self.cooldown_until = 0.0  # Unix timestamp
        self.total_requests = 0
        self.total_failures = 0

    @property
    def is_available(self) -> bool:
        if self.cooldown_until > time.time():
            return False
        return True

    def record_success(self):
        self.consecutive_failures = 0
        self.total_requests += 1

    def record_failure(self):
        self.consecutive_failures += 1
        self.total_requests += 1
        self.total_failures += 1
        # Exponential backoff: 30s, 60s, 120s, max 300s
        cooldown = min(30 * (2 ** (self.consecutive_failures - 1)), 300)
        self.cooldown_until = time.time() + cooldown
        logger.warning(
            f"Provider cooldown: {cooldown}s after {self.consecutive_failures} consecutive failures"
        )


class LLMService:
    """Multi-provider LLM service with auto-failover and caching."""

    def __init__(
        self,
        backend: str = "ollama",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:mini",
        anthropic_key: str | None = None,
        groq_key: str | None = None,
        nvidia_key: str | None = None,
        openrouter_key: str | None = None,
        redis=None,
    ):
        self.backend = backend
        self.ollama_url = ollama_url
        self.ollama_model = ollama_model
        self.anthropic_key = anthropic_key
        self.groq_key = groq_key
        self.nvidia_key = nvidia_key
        self.openrouter_key = openrouter_key
        self.redis = redis

        # Legacy compat
        self._healthy = True
        self._consecutive_failures = 0

        # Per-provider health tracking
        self._provider_states: dict[str, ProviderState] = {
            "groq": ProviderState(),
            "nvidia_nim": ProviderState(),
            "openrouter": ProviderState(),
            "anthropic": ProviderState(),
            "ollama": ProviderState(),
        }

    def _provider_has_key(self, provider: str) -> bool:
        """Check if provider has credentials configured."""
        return {
            "groq": bool(self.groq_key),
            "nvidia_nim": bool(self.nvidia_key),
            "openrouter": bool(self.openrouter_key),
            "anthropic": bool(self.anthropic_key),
            "ollama": True,  # no key needed
        }.get(provider, False)

    def _get_available_providers(self, tier: ComplexityTier) -> list[str]:
        """Return providers in priority order, filtered by availability."""
        return [
            p for p in PROVIDER_PRIORITY[tier]
            if self._provider_has_key(p) and self._provider_states[p].is_available
        ]

    async def health_check(self) -> bool:
        """Check if any LLM backend is available."""
        if self.backend == "disabled":
            return False
        # Check if at least one provider is available
        for tier in ("light", "heavy"):
            if self._get_available_providers(tier):
                return True
        # Fallback to legacy check
        if self.backend == "ollama":
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    r = await client.get(f"{self.ollama_url}/api/tags")
                    self._healthy = r.status_code == 200
                    return self._healthy
            except Exception:
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
        tier: ComplexityTier = "light",
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str | None:
        """Single completion with caching, multi-provider failover."""
        if self.backend == "disabled":
            return None

        # Check cache first
        if cache_key and self.redis:
            cached = await self.redis.get(f"llm:{cache_key}")
            if cached:
                return cached.decode() if isinstance(cached, bytes) else cached

        # Try providers in priority order
        providers = self._get_available_providers(tier)

        # Fallback: if no RAW providers available, use legacy backend
        if not providers:
            providers = [self.backend] if self.backend != "disabled" else []

        result = None
        used_provider = None
        for provider in providers:
            try:
                model = MODEL_MAP.get(
                    (provider, tier),
                    MODEL_MAP.get((provider, "light"), ""),
                )
                result = await self._call_provider(
                    provider, model, prompt, system, timeout, temperature, max_tokens
                )
                self._provider_states[provider].record_success()
                used_provider = provider
                break
            except Exception as e:
                logger.error(f"LLM [{provider}] failed: {e}")
                self._provider_states[provider].record_failure()
                continue

        # Cache successful result
        if result and cache_key and self.redis:
            await self.redis.set(f"llm:{cache_key}", result, ex=86400)

        return result

    async def _call_provider(
        self,
        provider: str,
        model: str,
        prompt: str,
        system: str,
        timeout: int,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Dispatch to the appropriate provider backend."""
        if provider == "ollama":
            return await self._ollama_complete(prompt, system, timeout)
        elif provider == "anthropic":
            return await self._anthropic_complete(prompt, system, timeout)
        elif provider == "groq":
            return await self._groq_complete(model, prompt, system, timeout, temperature, max_tokens)
        elif provider == "nvidia_nim":
            return await self._nvidia_complete(model, prompt, system, timeout, temperature, max_tokens)
        elif provider == "openrouter":
            return await self._openrouter_complete(model, prompt, system, timeout, temperature, max_tokens)
        raise ValueError(f"Unknown provider: {provider}")

    async def _groq_complete(
        self, model: str, prompt: str, system: str,
        timeout: int, temperature: float, max_tokens: int,
    ) -> str:
        """Call Groq API (OpenAI-compatible)."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers={
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def _nvidia_complete(
        self, model: str, prompt: str, system: str,
        timeout: int, temperature: float, max_tokens: int,
    ) -> str:
        """Call NVIDIA NIM API (OpenAI-compatible)."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers={
                    "Authorization": f"Bearer {self.nvidia_key}",
                    "Content-Type": "application/json",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def _openrouter_complete(
        self, model: str, prompt: str, system: str,
        timeout: int, temperature: float, max_tokens: int,
    ) -> str:
        """Call OpenRouter API (OpenAI-compatible)."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://sponsorintel.london",
                    "X-Title": "SponsorIntel RAW",
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    # --- Legacy methods (unchanged) ---

    async def batch_complete(
        self,
        prompts: list[str],
        system: str = "",
        max_concurrent: int = 2,
        tier: ComplexityTier = "light",
    ) -> list[str | None]:
        """Process multiple prompts with concurrency limit."""
        import asyncio
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _one(p):
            async with semaphore:
                return await self.complete(p, system, tier=tier)

        return await asyncio.gather(*[_one(p) for p in prompts])

    async def structured_output(
        self,
        prompt: str,
        system: str = "Respond with valid JSON only. No markdown.",
        tier: ComplexityTier = "light",
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> dict | list | None:
        """Parse LLM output as JSON with retry on failure."""
        for attempt in range(2):
            raw = await self.complete(
                prompt, system, tier=tier,
                temperature=temperature, max_tokens=max_tokens,
            )
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

- [ ] 3. Verify existing callers of `LLMService` still work (constructor is backwards-compatible)
- [ ] 4. Commit: `feat(raw): extend LLMService with groq, nvidia_nim, openrouter providers`

---

## Task 4 -- Pydantic Schemas & Input Sanitizer

**Files:** `backend/app/schemas/raw.py`, `backend/app/agents/raw_sanitizer.py`

- [ ] 1. Create `backend/app/schemas/raw.py` with all shared schemas

```python
"""Pydantic schemas for RAW tool endpoints."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ToolName(str, Enum):
    IDEA_FORGE = "idea-forge"
    SPONSOR_XRAY = "sponsor-xray"
    SALARY_CALCULATOR = "salary-calculator"
    SOC_MATCHER = "soc-matcher"
    COMPARATOR = "comparator"
    ROUTE_ADVISOR = "route-advisor"
    COVER_LETTER = "cover-letter"
    RED_FLAG_SCANNER = "red-flag-scanner"
    MARKET_HEATMAP = "market-heatmap"
    ENDORSEMENT_MATCHER = "endorsement-matcher"
    LAWYER_FINDER = "lawyer-finder"


class VisaRoute(str, Enum):
    SKILLED_WORKER = "skilled_worker"
    SCALE_UP = "scale_up"
    GLOBAL_TALENT = "global_talent"
    INNOVATOR_FOUNDER = "innovator_founder"
    GRADUATE = "graduate"
    HIGH_POTENTIAL = "high_potential_individual"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TaskStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RawTaskResponse(BaseModel):
    task_id: str
    status: TaskStatus = TaskStatus.PROCESSING


class RawTaskStatusResponse(BaseModel):
    task_id: str
    status: TaskStatus
    progress: int = Field(0, ge=0, le=100)
    step_description: str | None = None
    result: dict | None = None
    error_message: str | None = None
    processing_time_ms: int | None = None


class UnavailableSection(BaseModel):
    status: Literal["unavailable"] = "unavailable"
    reason: str
    cached_data: dict | None = None
    cached_at: datetime | None = None


class RawResultHistoryItem(BaseModel):
    id: UUID
    tool_name: str
    input: dict
    score: int | None = None
    processing_time_ms: int | None = None
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class PaginatedRawResults(BaseModel):
    data: list[RawResultHistoryItem]
    total: int
    page: int
    pages: int


class RateLimitError(BaseModel):
    error: Literal["daily_limit_reached"] = "daily_limit_reached"
    limit: int = 3
    used: int = 3
    resets_at: str
    upgrade_url: str = "/pricing"


# ----- Tool: Salary Calculator -----

class SalaryCalcRequest(BaseModel):
    job_title: str = Field(..., min_length=2, max_length=200)
    location: str | None = Field(None, max_length=100)
    visa_route: VisaRoute = VisaRoute.SKILLED_WORKER


class SalaryDistributionBucket(BaseModel):
    range_label: str
    count: int
    percentage: float


class SponsorHiringAboveThreshold(BaseModel):
    sponsor_id: UUID
    sponsor_name: str
    job_title: str
    salary_min: float | None = None
    salary_max: float | None = None
    location: str | None = None


class SalaryCalcResponse(BaseModel):
    matched_soc_code: str
    matched_soc_title: str
    minimum_salary_threshold: int
    going_rate: int
    median_actual_salary: float | None = None
    salary_distribution: list[SalaryDistributionBucket]
    is_shortage_occupation: bool
    shortage_threshold: int | None = None
    sponsors_hiring_above_threshold: list[SponsorHiringAboveThreshold]
    total_sponsors_hiring: int
    data_freshness: str


# ----- Tool: SOC Matcher -----

class SocMatcherRequest(BaseModel):
    text: str = Field(..., min_length=20, max_length=5000)
    match_type: Literal["job_description", "cv"] = "job_description"


class SocCodeMatch(BaseModel):
    soc_code: str
    soc_title: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    is_shortage: bool
    salary_threshold: int | None = None
    going_rate: int | None = None
    sponsor_count: int
    top_sponsors: list[dict] = Field(default_factory=list)


class SkillsGap(BaseModel):
    extracted_skills: list[str]
    required_skills: list[str]
    matching_skills: list[str]
    missing_skills: list[str]


class SocMatcherResponse(BaseModel):
    matches: list[SocCodeMatch]
    skills_gap: SkillsGap
    extracted_role_summary: str


# ----- Tool: Red Flag Scanner -----

class RedFlagScannerRequest(BaseModel):
    job_url: str | None = Field(None, max_length=2000)
    job_description_text: str | None = Field(None, max_length=5000)
    sponsor_name: str | None = Field(None, max_length=300)

    @field_validator("sponsor_name")
    @classmethod
    def require_at_least_one_input(cls, v, info):
        if not v and not info.data.get("job_url") and not info.data.get("job_description_text"):
            raise ValueError("Provide job_url, job_description_text, or sponsor_name")
        return v


class RedFlag(BaseModel):
    flag: str
    severity: Literal["low", "medium", "high", "critical"]
    evidence: str
    source: str


class SafeSignal(BaseModel):
    signal: str
    evidence: str


class RedFlagScannerResponse(BaseModel):
    risk_level: RiskLevel
    risk_score: int = Field(..., ge=0, le=100)
    red_flags: list[RedFlag]
    safe_signals: list[SafeSignal]
    recommendation: Literal["proceed", "proceed_with_caution", "avoid"]
    recommendation_detail: str
    matched_sponsor: dict | None = None
    alternatives: list[dict] = Field(default_factory=list)
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)


# ----- Tool: Sponsor X-Ray -----

class SponsorXRayRequest(BaseModel):
    sponsor_id: UUID | None = None
    sponsor_name: str | None = Field(None, max_length=300)

    @field_validator("sponsor_name")
    @classmethod
    def at_least_one_identifier(cls, v, info):
        if not v and not info.data.get("sponsor_id"):
            raise ValueError("Provide either sponsor_id or sponsor_name")
        return v


class FinancialHealthSummary(BaseModel):
    estimated_revenue_band: str | None = None
    charge_count: int | None = None
    has_insolvency_history: bool | None = None
    accounts_status: str | None = None
    last_accounts_date: str | None = None
    psc_summary: list[dict] | None = None


class HiringActivity(BaseModel):
    active_job_count: int
    jobs_trend_3m: list[dict] = Field(default_factory=list)
    top_roles: list[str]
    salary_range: dict | None = None
    seniority_distribution: dict | None = None


class SponsorXRayResponse(BaseModel):
    sponsor_id: UUID
    sponsor_name: str
    overall_trust_score: int = Field(..., ge=0, le=100)
    trust_score_breakdown: dict[str, int]
    visa_track_record: str
    financial_health: FinancialHealthSummary
    employee_sentiment: dict | None = None
    hiring_activity: HiringActivity
    red_flags: list[str]
    positive_signals: list[str]
    similar_sponsors: list[dict] = Field(default_factory=list)
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)


# ----- Tool: Comparator Pro -----

class ComparatorRequest(BaseModel):
    sponsor_ids: list[UUID] = Field(..., min_length=2, max_length=4)

    @field_validator("sponsor_ids")
    @classmethod
    def unique_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("Duplicate sponsor IDs not allowed")
        return v


class DimensionValue(BaseModel):
    value: str | int | float | bool | None = None
    rank: int | None = None
    source: str | None = None


class ComparatorSponsor(BaseModel):
    sponsor_id: UUID
    sponsor_name: str
    dimensions: dict[str, DimensionValue]


class ComparatorResponse(BaseModel):
    sponsors: list[ComparatorSponsor]
    dimension_categories: dict[str, list[str]]
    winner_summary: str


# ----- Tool: Route Advisor -----

class RouteAdvisorRequest(BaseModel):
    nationality: str = Field(..., max_length=100)
    age: int = Field(..., ge=18, le=70)
    highest_qualification: str = Field(..., max_length=200)
    qualification_field: str = Field(..., max_length=200)
    years_experience: int = Field(..., ge=0, le=50)
    current_role: str = Field(..., max_length=200)
    english_level: str | None = Field(None)
    ielts_score: float | None = Field(None, ge=0, le=9)
    savings_gbp: float | None = Field(None, ge=0)
    business_idea: str | None = Field(None, max_length=1000)
    current_visa_status: str | None = Field(None, max_length=100)


class RouteEligibility(BaseModel):
    route_name: str
    eligible: bool
    strength_score: int = Field(..., ge=0, le=100)
    estimated_timeline_weeks: int | None = None
    key_requirements: list[str]
    requirements_met: list[str]
    requirements_missing: list[str]
    pros: list[str]
    cons: list[str]
    estimated_cost_gbp: int | None = None


class RouteAdvisorResponse(BaseModel):
    routes: list[RouteEligibility]
    recommended_route: str
    recommendation_reasoning: str
    action_items: list[str]
    relevant_sponsors: list[dict] = Field(default_factory=list)
    profile_strength: int = Field(..., ge=0, le=100)
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)


# ----- Tool: Cover Letter Lab -----

class CoverLetterRequest(BaseModel):
    job_url: str | None = Field(None, max_length=2000)
    job_description_text: str | None = Field(None, max_length=5000)
    cv_text: str = Field(..., min_length=50, max_length=8000)
    special_circumstances: str | None = Field(None, max_length=500)

    @field_validator("job_description_text")
    @classmethod
    def require_url_or_text(cls, v, info):
        if not v and not info.data.get("job_url"):
            raise ValueError("Provide either job_url or job_description_text")
        return v


class CoverLetterResponse(BaseModel):
    cover_letter: str
    key_points_addressed: list[str]
    ats_keyword_score: int = Field(..., ge=0, le=100)
    ats_keywords_matched: list[str]
    ats_keywords_missing: list[str]
    company_talking_points: list[str] = Field(default_factory=list)
    sponsor_match: dict | None = None
    scrape_failed: bool = False
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)


# ----- Tool: Market Heatmap -----

class MarketHeatmapRequest(BaseModel):
    industry: str = Field(..., max_length=100)
    job_role: str = Field(..., max_length=200)
    salary_min: int | None = Field(None, ge=0)
    salary_max: int | None = Field(None, ge=0)

    @field_validator("salary_max")
    @classmethod
    def salary_range_valid(cls, v, info):
        if v and info.data.get("salary_min") and v < info.data["salary_min"]:
            raise ValueError("salary_max must be >= salary_min")
        return v


class RegionStats(BaseModel):
    region_name: str
    sponsor_count: int
    job_count: int
    avg_salary: float | None = None
    median_salary: float | None = None
    competition_index: float = Field(..., ge=0, le=1)
    trend: Literal["growing", "stable", "declining"]
    top_sponsors: list[str] = Field(default_factory=list)


class MarketHeatmapResponse(BaseModel):
    geojson: dict
    regions: list[RegionStats]
    top_cities: list[dict]
    salary_comparison: list[dict] = Field(default_factory=list)
    total_matching_sponsors: int
    total_matching_jobs: int


# ----- Tool: Endorsement Matcher -----

class EndorsementMatcherRequest(BaseModel):
    business_concept: str = Field(..., min_length=50, max_length=2000)
    industry: str = Field(..., max_length=100)
    innovation_element: str = Field(..., max_length=500)


class EndorsingBodyMatch(BaseModel):
    id: UUID
    name: str
    website: str | None = None
    application_url: str | None = None
    focus_areas: list[str]
    alignment_score: int = Field(..., ge=0, le=100)
    criteria_summary: list[str]
    application_tips: list[str]
    common_rejection_reasons: list[str]
    success_rate: float | None = None


class EndorsementMatcherResponse(BaseModel):
    matches: list[EndorsingBodyMatch]
    preparation_steps: list[str]
    overall_readiness_score: int = Field(..., ge=0, le=100)
    readiness_gaps: list[str]


# ----- Tool: Idea Forge -----

class IdeaForgeRequest(BaseModel):
    idea_description: str = Field(..., min_length=100, max_length=2000)
    target_industry: str = Field(..., max_length=100)
    target_location: str = Field("London", max_length=100)

    @field_validator("idea_description")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class Competitor(BaseModel):
    name: str
    website: str | None = None
    strengths: list[str]
    weaknesses: list[str]
    estimated_market_share: str | None = None


class SWOTAnalysis(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]


class EndorsingBodyRecommendation(BaseModel):
    name: str
    alignment_score: int = Field(..., ge=0, le=100)
    focus_areas: list[str]
    reason: str


class IdeaForgeResponse(BaseModel):
    viability_score: int = Field(..., ge=0, le=100)
    score_breakdown: dict[str, int]
    market_size_estimate: str
    growth_trajectory: str
    top_competitors: list[Competitor]
    regulatory_requirements: list[str]
    swot: SWOTAnalysis
    endorsing_bodies: list[EndorsingBodyRecommendation]
    next_steps: list[str]
    sources: list[str] = Field(default_factory=list)
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)


# ----- Tool: Lawyer Finder -----

class LawyerFinderRequest(BaseModel):
    visa_route: VisaRoute
    nationality: str | None = Field(None, max_length=100)
    location: str | None = Field(None, max_length=200)
    remote_ok: bool = True
    case_complexity: Literal["straightforward", "complex", "appeal"] = "straightforward"
    budget_max: int | None = Field(None, ge=0)
    language: str | None = Field(None, max_length=50)


class LawyerResult(BaseModel):
    id: UUID
    name: str
    firm_name: str | None
    registration_type: str
    registration_number: str
    oisc_level: int | None
    combined_rating: float | None
    google_review_count: int
    trustpilot_review_count: int
    city: str | None
    offers_remote: bool
    practice_areas: list[str]
    fee_initial_consultation: str | None
    accreditations: list[str] | None
    why_this_lawyer: str  # AI-generated blurb


class LawyerFinderResponse(BaseModel):
    lawyers: list[LawyerResult]
    total_matching: int
    disclaimer: str = "This is informational only. We do not endorse any specific lawyer. Verify credentials independently."
```

- [ ] 2. Create `backend/app/agents/raw_sanitizer.py`

```python
"""Prompt injection prevention for RAW tool inputs."""

import re
import logging

logger = logging.getLogger("raw.security")

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)",
    r"you\s+are\s+now\s+a",
    r"system\s*:\s*",
    r"<\|?(system|assistant|user)\|?>",
    r"ADMIN\s+OVERRIDE",
    r"\\n\s*\\n\s*---",
    r"```\s*(system|prompt)",
]

INJECTION_REGEX = re.compile("|".join(INJECTION_PATTERNS), re.IGNORECASE)

MAX_FIELD_LENGTHS = {
    "idea_description": 2000,
    "text": 5000,
    "cv_text": 8000,
    "job_description_text": 5000,
    "business_concept": 2000,
    "special_circumstances": 500,
    "sponsor_name": 300,
    "job_title": 200,
    "nationality": 100,
    "current_role": 200,
}


def sanitize_for_llm(text: str, field_name: str = "default") -> str:
    """Sanitize user input before inserting into LLM prompts."""
    max_len = MAX_FIELD_LENGTHS.get(field_name, 2000)
    text = text[:max_len]

    # Strip null bytes and non-printable control chars (keep newlines/tabs)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Detect and neuter injection attempts
    if INJECTION_REGEX.search(text):
        logger.warning(f"Prompt injection attempt in field '{field_name}': {text[:100]}...")
        text = INJECTION_REGEX.sub("[FILTERED]", text)

    return text
```

- [ ] 3. Commit: `feat(raw): add Pydantic schemas and input sanitizer`

---

## Task 5 -- LLM Prompt Templates

**Files:** `backend/app/agents/raw_prompts.py`

- [ ] 1. Create prompt templates file with all agent prompts from the spec

```python
"""LLM prompt templates for RAW tools.

Each tool has a SYSTEM prompt (defines role + output schema)
and a USER template (filled with tool-specific data).
"""

# === Idea Forge: Synthesizer ===
# Model: NIM 405B | Temp: 0.3 | MaxTokens: 4096

IDEA_FORGE_SYNTHESIZER_SYSTEM = """You are a UK business viability analyst for SponsorIntel, a platform helping immigration seekers evaluate opportunities in the United Kingdom.

You will receive structured research data about a business idea including market research, competitor analysis, regulatory findings, and UK demand signals. Your task is to synthesize this into a single viability report.

RULES:
- Base every claim on the provided data. If data is missing for a section, say "Insufficient data" rather than fabricating.
- Scores must reflect genuine assessment. A score of 70+ means strong evidence of viability. Below 40 means significant concerns.
- All monetary values in GBP.
- Focus on UK-specific factors: UK market size, UK regulations, UK competitors, UK demand.
- Consider the Innovator Founder visa requirements: innovation, viability, scalability.
- Never provide legal advice. Frame as "research findings" not "recommendations."

OUTPUT: Respond with valid JSON only matching this schema:
{
  "viability_score": <int 0-100>,
  "score_breakdown": {"market_size": <int>, "innovation": <int>, "feasibility": <int>, "demand": <int>, "regulatory_ease": <int>},
  "market_size_estimate": "<string>",
  "growth_trajectory": "<string>",
  "regulatory_requirements": ["<requirement>"],
  "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
  "next_steps": ["<actionable step>"]
}"""

IDEA_FORGE_SYNTHESIZER_USER = """Business idea: {idea_description}
Target industry: {target_industry}
Target location: {target_location}

=== MARKET RESEARCH ===
{market_research_data}

=== COMPETITOR ANALYSIS ===
{competitor_data}

=== REGULATORY FINDINGS ===
{regulatory_data}

=== UK DEMAND SIGNALS ===
{demand_data}

Synthesize a viability report."""


# === SOC Matcher: Classifier ===
# Model: Groq 70B | Temp: 0.1 | MaxTokens: 1024

SOC_MATCHER_CLASSIFIER_SYSTEM = """You are a UK Standard Occupational Classification (SOC 2020) expert. Given a job description or CV text, extract key occupational information and match to SOC codes.

RULES:
- Confidence scores must be between 0.0 and 1.0. Only assign > 0.8 if the match is near-exact.
- Extract concrete skills, not vague terms. "Python" yes, "good communication" no.
- If the text describes multiple roles, match the PRIMARY role only.
- SOC 2020 codes are 4-digit (e.g., 2134 for programmers).

OUTPUT: Respond with valid JSON only:
{
  "extracted_role_summary": "<1-2 sentence summary>",
  "extracted_skills": ["skill1", "skill2"],
  "matches": [{"soc_code": "<4-digit>", "confidence": <float>, "reasoning": "<why>"}]
}"""

SOC_MATCHER_CLASSIFIER_USER = """Input text ({match_type}):
---
{text}
---

Candidate SOC codes from database search:
{candidate_soc_codes}

Classify and rank the top 3 SOC code matches."""


# === Cover Letter Lab: Generator ===
# Model: NIM 405B | Temp: 0.6 | MaxTokens: 3072

COVER_LETTER_GENERATOR_SYSTEM = """You are an expert UK career advisor specialising in visa sponsorship applications. Generate a professional cover letter that addresses the employer's likely concerns about sponsoring an international worker.

RULES:
- Professional British English tone. Formal but not stiff.
- Address sponsorship proactively: emphasize stability, commitment to the UK, and how hiring costs are offset by the candidate's unique value.
- Weave in company-specific data naturally.
- Optimize for ATS: incorporate keywords from the job description naturally.
- Length: 350-500 words. Three to four paragraphs.
- Never fabricate qualifications not present in the CV.
- End with a strong call-to-action.

OUTPUT: Respond with valid JSON only:
{
  "cover_letter": "<full letter text>",
  "key_points_addressed": ["<point>"],
  "ats_keywords_matched": ["keyword"],
  "ats_keywords_missing": ["keyword"]
}"""

COVER_LETTER_GENERATOR_USER = """JOB LISTING:
Title: {job_title}
Company: {company_name}
Requirements: {requirements}
Description: {job_description}

COMPANY ENRICHMENT DATA:
{enrichment_data}

CANDIDATE CV:
{cv_text}

SPECIAL CIRCUMSTANCES:
{special_circumstances}

Generate a sponsorship-aware cover letter."""


# === Red Flag Scanner: Analyzer ===
# Model: Groq 70B | Temp: 0.2 | MaxTokens: 2048

RED_FLAG_ANALYZER_SYSTEM = """You are a UK visa sponsorship risk analyst. Given structured data about a company/job listing, assess the risk of applying.

RULES:
- Only flag genuine risks backed by provided evidence. Never speculate.
- Severity levels: low (minor), medium (investigate), high (significant risk), critical (likely fraudulent).
- Always include positive signals too.
- Risk score 0-100: 0 = perfectly safe, 100 = confirmed scam.
- "avoid" only for risk_score > 70 or any critical flags.

OUTPUT: Respond with valid JSON only:
{
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <int 0-100>,
  "red_flags": [{"flag": "<desc>", "severity": "low|medium|high|critical", "evidence": "<data>", "source": "<where>"}],
  "safe_signals": [{"signal": "<positive>", "evidence": "<data>"}],
  "recommendation": "proceed|proceed_with_caution|avoid",
  "recommendation_detail": "<2-3 sentences>"
}"""

RED_FLAG_ANALYZER_USER = """Company: {company_name}
Sponsor database match: {sponsor_match}

COMPANIES HOUSE DATA:
{companies_house_data}

JOB LISTING DATA:
{job_listing_data}

REVIEW DATA:
{review_data}

WEBSITE ANALYSIS:
{website_data}

SPONSOR REGISTER STATUS:
{register_status}

Analyze risk and provide recommendation."""


# === Route Advisor: Analyzer ===
# Model: NIM 405B | Temp: 0.2 | MaxTokens: 3072

ROUTE_ADVISOR_ANALYZER_SYSTEM = """You are a UK immigration route advisor. Given a user's profile and rule-based eligibility checks, provide detailed analysis of the best visa routes.

RULES:
- You are NOT a solicitor. Frame all output as informational analysis.
- Strength scores reflect how competitive the applicant is, not just eligibility.
- Timeline estimates should be realistic (include processing times as of 2026).
- Cost estimates should include visa fee + IHS + legal fees estimate.
- Action items must be specific ("Apply for IELTS test" not "Improve English").
- If a route is clearly ineligible, still list it with eligible=false and explain why.

OUTPUT: Respond with valid JSON only:
{
  "routes": [{"route_name": "<route>", "eligible": <bool>, "strength_score": <int 0-100>, "estimated_timeline_weeks": <int|null>, "key_requirements": [], "requirements_met": [], "requirements_missing": [], "pros": [], "cons": [], "estimated_cost_gbp": <int|null>}],
  "recommended_route": "<route name>",
  "recommendation_reasoning": "<2-3 sentences>",
  "action_items": ["<specific action>"],
  "profile_strength": <int 0-100>
}"""

ROUTE_ADVISOR_ANALYZER_USER = """USER PROFILE:
Nationality: {nationality}
Age: {age}
Qualification: {highest_qualification} in {qualification_field}
Experience: {years_experience} years as {current_role}
English: {english_level} (IELTS: {ielts_score})
Savings: GBP {savings_gbp}
Business idea: {business_idea}
Current visa: {current_visa_status}

RULE-BASED ELIGIBILITY RESULTS:
{eligibility_results}

RELEVANT SPONSORS IN DATABASE:
{relevant_sponsors}

Analyze and recommend the best route(s)."""


# === Endorsement Matcher: Scorer ===
# Model: NIM 405B | Temp: 0.3 | MaxTokens: 2048

ENDORSEMENT_MATCHER_SCORER_SYSTEM = """You are a UK Innovator Founder visa specialist focused on endorsing body matching. Given a business concept and a list of endorsing bodies with their criteria, score the alignment.

RULES:
- Alignment score 0-100: how well the concept fits the body's stated focus areas.
- Only score > 70 if there is clear overlap between concept sector and body focus.
- Application tips must be specific to each body.
- Rejection reasons should be based on known patterns.
- Preparation steps should be concrete actions.

OUTPUT: Respond with valid JSON only:
{
  "matches": [{"body_id": "<uuid>", "alignment_score": <int 0-100>, "reasoning": "<why>", "application_tips": [], "common_rejection_reasons": []}],
  "preparation_steps": ["<step>"],
  "overall_readiness_score": <int 0-100>,
  "readiness_gaps": ["<gap>"]
}"""

ENDORSEMENT_MATCHER_SCORER_USER = """BUSINESS CONCEPT:
{business_concept}

INDUSTRY: {industry}
INNOVATION ELEMENT: {innovation_element}

ENDORSING BODIES:
{endorsing_bodies_data}

Score alignment and provide recommendations."""
```

- [ ] 2. Commit: `feat(raw): add LLM prompt templates for all RAW tools`

---

## Task 6 -- Backend API Scaffold + Rate Limiting

**Files:** `backend/app/api/v1/raw.py`, `backend/app/main.py`

- [ ] 1. Create the RAW API router with rate limiting middleware and all route stubs

```python
"""RAW -- Research & Analysis Wing API routes."""

import hashlib
import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_auth, optional_auth
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.raw import (
    RawTaskResponse,
    RawTaskStatusResponse,
    RateLimitError,
    SalaryCalcRequest,
    SalaryCalcResponse,
    SocMatcherRequest,
    SocMatcherResponse,
    RedFlagScannerRequest,
    RedFlagScannerResponse,
    SponsorXRayRequest,
    SponsorXRayResponse,
    ComparatorRequest,
    ComparatorResponse,
    RouteAdvisorRequest,
    RouteAdvisorResponse,
    CoverLetterRequest,
    CoverLetterResponse,
    MarketHeatmapRequest,
    MarketHeatmapResponse,
    EndorsementMatcherRequest,
    EndorsementMatcherResponse,
    IdeaForgeRequest,
    IdeaForgeResponse,
    LawyerFinderRequest,
    LawyerFinderResponse,
    PaginatedRawResults,
    TaskStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/raw", tags=["raw"])

settings = get_settings()


# Rate Limiting Helper
# Uses Redis SCRIPT LOAD + EVALSHA for atomic check-and-increment.
# The Lua script atomically checks the counter, increments if under limit,
# and returns [allowed, current_count, ttl_seconds].

_RATE_LIMIT_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
    return {0, current, redis.call('TTL', key)}
end
current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, ttl)
end
return {1, current, redis.call('TTL', key)}
"""

_rate_limit_sha: str | None = None


async def _get_redis():
    """Get async Redis connection."""
    import redis.asyncio as aioredis
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def check_rate_limit(user: User) -> RateLimitError | None:
    """Check and increment daily usage. Returns error if limit exceeded."""
    # Pro and Enterprise users are unlimited
    if user.plan.value in ("pro", "enterprise"):
        return None

    redis_conn = await _get_redis()
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key = f"raw:{user.id}:{today}"
        limit = 3
        # Seconds until midnight UTC
        now = datetime.now(timezone.utc)
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        ttl = int((midnight - now).total_seconds())

        # Load script SHA if not cached
        global _rate_limit_sha
        if _rate_limit_sha is None:
            _rate_limit_sha = await redis_conn.execute_command("SCRIPT", "LOAD", _RATE_LIMIT_SCRIPT)

        result = await redis_conn.execute_command("EVALSHA", _rate_limit_sha, 1, key, limit, ttl)
        allowed, current, remaining_ttl = result

        if not allowed:
            resets_at = (now + timedelta(seconds=remaining_ttl)).isoformat()
            return RateLimitError(used=int(current), resets_at=resets_at)
        return None
    finally:
        await redis_conn.close()


def _raise_if_rate_limited(error: RateLimitError | None):
    if error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error.model_dump(),
        )


# Synchronous Tools (< 5s)

@router.post("/salary-calculator", response_model=SalaryCalcResponse)
async def salary_calculator(
    req: SalaryCalcRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Salary Threshold Calculator -- synchronous."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.salary_calc import run_salary_calculator
    return await run_salary_calculator(req, user, db)


@router.post("/soc-matcher", response_model=SocMatcherResponse)
async def soc_matcher(
    req: SocMatcherRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """SOC Code Matcher -- synchronous."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.soc_matcher import run_soc_matcher
    return await run_soc_matcher(req, user, db)


# SSE Streaming Tools (5-30s)

async def _sse_wrapper(generator: AsyncGenerator) -> StreamingResponse:
    """Wrap an async generator as an SSE response."""
    async def event_stream():
        try:
            async for event in generator:
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/red-flag-scanner")
async def red_flag_scanner(
    req: RedFlagScannerRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Red Flag Scanner -- SSE streaming."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.red_flag_scanner import run_red_flag_scanner_sse
    return await _sse_wrapper(run_red_flag_scanner_sse(req, user, db))


@router.post("/comparator")
async def comparator_pro(
    req: ComparatorRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Sponsor Comparator Pro -- SSE streaming."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.comparator import run_comparator_sse
    return await _sse_wrapper(run_comparator_sse(req, user, db))


@router.post("/market-heatmap")
async def market_heatmap(
    req: MarketHeatmapRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Market Heatmap -- SSE streaming."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.market_heatmap import run_market_heatmap_sse
    return await _sse_wrapper(run_market_heatmap_sse(req, user, db))


@router.post("/endorsement-matcher")
async def endorsement_matcher(
    req: EndorsementMatcherRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Endorsement Body Matcher -- SSE streaming."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.endorsement_matcher import run_endorsement_matcher_sse
    return await _sse_wrapper(run_endorsement_matcher_sse(req, user, db))


@router.post("/lawyer-finder")
async def lawyer_finder(
    req: LawyerFinderRequest,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Lawyer Finder -- SSE streaming."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.agents.raw_tools.lawyer_finder import run_lawyer_finder_sse
    return await _sse_wrapper(run_lawyer_finder_sse(req, user, db))


# Celery Background Tasks (30-120s)

@router.post("/idea-forge", response_model=RawTaskResponse)
async def idea_forge(
    req: IdeaForgeRequest,
    user: User = Depends(require_auth),
):
    """Idea Forge -- Celery background task."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.tasks.raw_tasks import run_idea_forge_task
    task = run_idea_forge_task.delay(req.model_dump(), str(user.id))
    return RawTaskResponse(task_id=task.id)


@router.post("/sponsor-xray", response_model=RawTaskResponse)
async def sponsor_xray(
    req: SponsorXRayRequest,
    user: User = Depends(require_auth),
):
    """Sponsor X-Ray -- Celery background task."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.tasks.raw_tasks import run_sponsor_xray_task
    task = run_sponsor_xray_task.delay(req.model_dump(mode="json"), str(user.id))
    return RawTaskResponse(task_id=task.id)


@router.post("/route-advisor", response_model=RawTaskResponse)
async def route_advisor(
    req: RouteAdvisorRequest,
    user: User = Depends(require_auth),
):
    """Route Advisor -- Celery background task."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.tasks.raw_tasks import run_route_advisor_task
    task = run_route_advisor_task.delay(req.model_dump(), str(user.id))
    return RawTaskResponse(task_id=task.id)


@router.post("/cover-letter", response_model=RawTaskResponse)
async def cover_letter(
    req: CoverLetterRequest,
    user: User = Depends(require_auth),
):
    """Cover Letter Lab -- Celery background task."""
    _raise_if_rate_limited(await check_rate_limit(user))
    from app.tasks.raw_tasks import run_cover_letter_task
    # Hash CV text before sending to Celery (PII handling)
    task_input = req.model_dump()
    cv_hash = hashlib.sha256(req.cv_text.encode()).hexdigest()
    task_input["cv_hash"] = f"sha256:{cv_hash}"
    task = run_cover_letter_task.delay(task_input, str(user.id))
    return RawTaskResponse(task_id=task.id)


# Task Status Polling

@router.get("/status/{task_id}", response_model=RawTaskStatusResponse)
async def poll_task_status(task_id: str, user: User = Depends(require_auth)):
    """Poll background task status."""
    from app.tasks.celery_app import celery_app
    result = celery_app.AsyncResult(task_id)

    if result.state == "PENDING":
        return RawTaskStatusResponse(task_id=task_id, status=TaskStatus.PROCESSING, progress=0)
    elif result.state == "PROGRESS":
        meta = result.info or {}
        return RawTaskStatusResponse(
            task_id=task_id,
            status=TaskStatus.PROCESSING,
            progress=meta.get("progress", 0),
            step_description=meta.get("step_description"),
        )
    elif result.state == "SUCCESS":
        return RawTaskStatusResponse(
            task_id=task_id,
            status=TaskStatus.COMPLETED,
            progress=100,
            result=result.result,
        )
    else:
        return RawTaskStatusResponse(
            task_id=task_id,
            status=TaskStatus.FAILED,
            error_message=str(result.info) if result.info else "Unknown error",
        )


# Result History

@router.get("/history", response_model=PaginatedRawResults)
async def get_result_history(
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Paginated result history for current user."""
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    offset = (page - 1) * page_size
    result = sb.table("raw_results").select("*", count="exact").eq(
        "user_id", str(user.id)
    ).order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

    total = result.count or 0
    pages = (total + page_size - 1) // page_size if total else 0

    return PaginatedRawResults(
        data=result.data,
        total=total,
        page=page,
        pages=pages,
    )


# Lawyer-specific endpoints

@router.get("/lawyers/{lawyer_id}")
async def get_lawyer(lawyer_id: UUID):
    """Get single lawyer profile with reviews."""
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    result = sb.table("raw_lawyers").select("*").eq("id", str(lawyer_id)).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    reviews = sb.table("raw_lawyer_reviews").select("*").eq(
        "lawyer_id", str(lawyer_id)
    ).order("review_date", desc=True).limit(20).execute()

    return {**result.data, "reviews": reviews.data}
```

- [ ] 2. Register the router in `backend/app/main.py`

```python
# Add after existing router imports in main.py:
from app.api.v1.raw import router as raw_router

# Add after existing app.include_router calls:
app.include_router(raw_router, prefix="/api/v1")
```

- [ ] 3. Commit: `feat(raw): add API scaffold with rate limiting and all route stubs`

---

## Task 7 -- Celery Task Scaffold

**Files:** `backend/app/tasks/raw_tasks.py`

- [ ] 1. Create Celery task file with task stubs for all background tools

```python
"""Celery tasks for RAW background tools (Idea Forge, Sponsor X-Ray, Route Advisor, Cover Letter Lab)."""

import asyncio
import logging
import time
from typing import Any

from celery import shared_task

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine inside a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _save_result(user_id: str, tool_name: str, input_data: dict, output_data: dict, score: int | None, processing_time_ms: int, llm_provider: str | None = None):
    """Persist tool result to Supabase raw_results table."""
    from app.core.config import get_settings
    from supabase import create_client
    settings = get_settings()
    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    sb.table("raw_results").insert({
        "user_id": user_id,
        "tool_name": tool_name,
        "input": input_data,
        "output": output_data,
        "score": score,
        "processing_time_ms": processing_time_ms,
        "llm_provider": llm_provider,
        "status": "completed",
    }).execute()


@shared_task(bind=True, name="raw.idea_forge", soft_time_limit=110, time_limit=120)
def run_idea_forge_task(self, input_data: dict, user_id: str) -> dict:
    """Idea Forge -- multi-agent pipeline."""
    start = time.time()

    def update(progress: int, step: str):
        self.update_state(state="PROGRESS", meta={"progress": progress, "step_description": step})

    update(10, "Researching market size and trends...")

    async def _run():
        from app.agents.raw_tools.idea_forge import run_idea_forge
        return await run_idea_forge(input_data, update)

    result = _run_async(_run())
    elapsed_ms = int((time.time() - start) * 1000)
    _save_result(user_id, "idea-forge", input_data, result, result.get("viability_score"), elapsed_ms)
    return result


@shared_task(bind=True, name="raw.sponsor_xray", soft_time_limit=110, time_limit=120)
def run_sponsor_xray_task(self, input_data: dict, user_id: str) -> dict:
    """Sponsor X-Ray -- deep analysis pipeline."""
    start = time.time()

    def update(progress: int, step: str):
        self.update_state(state="PROGRESS", meta={"progress": progress, "step_description": step})

    update(10, "Pulling enrichment data...")

    async def _run():
        from app.agents.raw_tools.sponsor_xray import run_sponsor_xray
        return await run_sponsor_xray(input_data, update)

    result = _run_async(_run())
    elapsed_ms = int((time.time() - start) * 1000)
    _save_result(user_id, "sponsor-xray", input_data, result, result.get("overall_trust_score"), elapsed_ms)
    return result


@shared_task(bind=True, name="raw.route_advisor", soft_time_limit=110, time_limit=120)
def run_route_advisor_task(self, input_data: dict, user_id: str) -> dict:
    """Route Advisor -- eligibility + AI analysis."""
    start = time.time()

    def update(progress: int, step: str):
        self.update_state(state="PROGRESS", meta={"progress": progress, "step_description": step})

    update(10, "Checking route eligibility requirements...")

    async def _run():
        from app.agents.raw_tools.route_advisor import run_route_advisor
        return await run_route_advisor(input_data, update)

    result = _run_async(_run())
    elapsed_ms = int((time.time() - start) * 1000)
    _save_result(user_id, "route-advisor", input_data, result, result.get("profile_strength"), elapsed_ms)
    return result


@shared_task(bind=True, name="raw.cover_letter", soft_time_limit=110, time_limit=120)
def run_cover_letter_task(self, input_data: dict, user_id: str) -> dict:
    """Cover Letter Lab -- parse job + generate letter."""
    start = time.time()

    def update(progress: int, step: str):
        self.update_state(state="PROGRESS", meta={"progress": progress, "step_description": step})

    update(10, "Parsing job listing...")

    async def _run():
        from app.agents.raw_tools.cover_letter import run_cover_letter
        return await run_cover_letter(input_data, update)

    result = _run_async(_run())
    elapsed_ms = int((time.time() - start) * 1000)
    # Store with CV hash, not raw CV text (PII)
    safe_input = {k: v for k, v in input_data.items() if k != "cv_text"}
    _save_result(user_id, "cover-letter", safe_input, result, result.get("ats_keyword_score"), elapsed_ms)
    return result
```

- [ ] 2. Register task routes in `backend/app/tasks/celery_app.py` (add `"raw.*"` to task routing)
- [ ] 3. Commit: `feat(raw): add Celery task scaffold for background tools`

---

## Task 8 -- TypeScript Types

**Files:** `frontend/src/types/raw.ts`

- [ ] 1. Create TypeScript interfaces matching all Pydantic schemas -- copy directly from spec section "TypeScript Interfaces" (lines 1108-1531 of the spec)

The full type file contains all interfaces from the spec: `ToolName`, `VisaRoute`, `RiskLevel`, `TaskStatus`, `RawTaskResponse`, `RawTaskStatusResponse`, `UnavailableSection`, `RawResultHistoryItem`, `PaginatedRawResults`, `RateLimitError`, and per-tool Input/Output types for all 10 tools plus `ToolIOMap`.

- [ ] 2. Add Lawyer types at the end of the file:

```typescript
// ---- Tool 11: Lawyer Finder ----

export interface LawyerFinderInput {
  visa_route: VisaRoute;
  nationality?: string;
  location?: string;
  remote_ok: boolean;
  case_complexity: 'straightforward' | 'complex' | 'appeal';
  budget_max?: number;
  language?: string;
}

export interface LawyerResult {
  id: string;
  name: string;
  firm_name: string | null;
  registration_type: string;
  registration_number: string;
  oisc_level: number | null;
  combined_rating: number | null;
  google_review_count: number;
  trustpilot_review_count: number;
  city: string | null;
  offers_remote: boolean;
  practice_areas: string[];
  fee_initial_consultation: string | null;
  accreditations: string[] | null;
  why_this_lawyer: string;
}

export interface LawyerFinderResult {
  lawyers: LawyerResult[];
  total_matching: number;
  disclaimer: string;
}
```

- [ ] 3. Commit: `feat(raw): add TypeScript type definitions for all RAW tools`

---

## Task 9 -- Frontend Hook: useRawTool

**Files:** `frontend/src/hooks/useRawTool.ts`

- [ ] 1. Create the generic hook that handles all three execution tiers

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { TaskStatus, RawTaskStatusResponse, RateLimitError } from '@/types/raw';

type ExecutionTier = 'sync' | 'sse' | 'celery';

interface UseRawToolOptions {
  tier: ExecutionTier;
  endpoint: string; // e.g., "/raw/salary-calculator"
}

interface UseRawToolReturn<TInput, TResult> {
  execute: (input: TInput) => Promise<void>;
  result: TResult | null;
  loading: boolean;
  progress: number;
  stepDescription: string | null;
  error: string | null;
  rateLimitError: RateLimitError | null;
  reset: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useRawTool<TInput, TResult>(
  options: UseRawToolOptions
): UseRawToolReturn<TInput, TResult> {
  const { tier, endpoint } = options;
  const [result, setResult] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepDescription, setStepDescription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setLoading(false);
    setProgress(0);
    setStepDescription(null);
    setError(null);
    setRateLimitError(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  const execute = useCallback(async (input: TInput) => {
    reset();
    setLoading(true);

    try {
      if (tier === 'sync') {
        // Direct synchronous response
        const data = await api.post<TResult>(`/api/v1${endpoint}`, input);
        setResult(data);
        setProgress(100);

      } else if (tier === 'sse') {
        // Server-Sent Events streaming
        const token = localStorage.getItem('auth-storage');
        const parsed = token ? JSON.parse(token) : null;
        const accessToken = parsed?.state?.token;

        const response = await fetch(`${API_BASE}/api/v1${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(input),
        });

        if (response.status === 429) {
          const rateErr = await response.json();
          setRateLimitError(rateErr.detail || rateErr);
          setLoading(false);
          return;
        }

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'progress') {
                  setProgress(event.progress || 0);
                  setStepDescription(event.step || null);
                } else if (event.type === 'result') {
                  setResult(event.data as TResult);
                  setProgress(100);
                } else if (event.type === 'error') {
                  setError(event.message);
                }
              }
            }
          }
        }

      } else if (tier === 'celery') {
        // Background task with polling
        const taskResp = await api.post<{ task_id: string }>(`/api/v1${endpoint}`, input);

        // Poll every 2 seconds
        pollingRef.current = setInterval(async () => {
          try {
            const taskStatus = await api.get<RawTaskStatusResponse>(
              `/api/v1/raw/status/${taskResp.task_id}`
            );
            setProgress(taskStatus.progress);
            setStepDescription(taskStatus.step_description);

            if (taskStatus.status === 'completed') {
              setResult(taskStatus.result as unknown as TResult);
              if (pollingRef.current) clearInterval(pollingRef.current);
              setLoading(false);
            } else if (taskStatus.status === 'failed') {
              setError(taskStatus.error_message || 'Task failed');
              if (pollingRef.current) clearInterval(pollingRef.current);
              setLoading(false);
            }
          } catch {
            // Keep polling on transient errors
          }
        }, 2000);

        return; // Don't set loading to false here
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('429')) {
        try {
          const parsed = JSON.parse(message.split(' ').slice(3).join(' '));
          setRateLimitError(parsed);
        } catch {
          setError('Daily usage limit reached. Upgrade to Pro for unlimited access.');
        }
      } else {
        setError(message);
      }
    } finally {
      if (tier !== 'celery') setLoading(false);
    }
  }, [tier, endpoint, reset]);

  return { execute, result, loading, progress, stepDescription, error, rateLimitError, reset };
}
```

- [ ] 2. Commit: `feat(raw): add useRawTool hook with sync/SSE/Celery support`

---

## Task 10 -- Frontend Shell: Page + ToolGrid + ToolWorkspace + ToolProgress

**Files:** `frontend/src/app/raw/page.tsx`, `frontend/src/components/raw/ToolGrid.tsx`, `frontend/src/components/raw/ToolWorkspace.tsx`, `frontend/src/components/raw/ToolProgress.tsx`

- [ ] 1. Create `frontend/src/app/raw/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import type { ToolName } from '@/types/raw';
import { ToolGrid } from '@/components/raw/ToolGrid';
import { ToolWorkspace } from '@/components/raw/ToolWorkspace';

export default function RAWPage() {
  const [activeTool, setActiveTool] = useState<ToolName | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Research & Analysis Wing</h1>
          <p className="text-xs text-dim">AI-powered tools for immigration research</p>
        </div>
      </div>

      <ToolGrid activeTool={activeTool} onSelectTool={setActiveTool} />

      {activeTool && (
        <ToolWorkspace tool={activeTool} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}
```

- [ ] 2. Create `frontend/src/components/raw/ToolGrid.tsx` -- grid of 11 tool cards with keyboard navigation (arrow keys, Enter/Space to select, Escape to deselect), tier badges (INSTANT/STREAMING/BACKGROUND), active state highlighting

- [ ] 3. Create `frontend/src/components/raw/ToolWorkspace.tsx` -- expanded workspace wrapper, focus management (auto-focus heading on open, Escape to close), dynamic component rendering based on active tool name

- [ ] 4. Create `frontend/src/components/raw/ToolProgress.tsx` -- progress bar with step description, error alert with `role="alert"`, screen reader announcements at 25%/50%/75%/100% via `aria-live`

- [ ] 5. Commit: `feat(raw): add frontend shell (page, ToolGrid, ToolWorkspace, ToolProgress)`

---

## Task 11 -- Seed Data: SOC Codes + Endorsing Bodies

**Files:** `backend/app/scripts/seed_soc_codes.py`, `backend/app/scripts/seed_endorsing_bodies.py`

- [ ] 1. Create `seed_soc_codes.py` with sample SOC codes (subset of ONS SOC 2020, ~20 codes covering IT, healthcare, education, finance)

- [ ] 2. Create `seed_endorsing_bodies.py` with ~10 endorsing bodies (Tech Nation, Bethnal Green Ventures, Seedcamp, Entrepreneur First, Wayra UK, etc.)

- [ ] 3. Run both seed scripts

```bash
cd backend
python -m app.scripts.seed_soc_codes
python -m app.scripts.seed_endorsing_bodies
```

- [ ] 4. Commit: `feat(raw): seed SOC codes and endorsing bodies reference data`

---

## Task 12 -- Tool Backend: Salary Calculator

**Files:** `backend/app/agents/raw_tools/__init__.py`, `backend/app/agents/raw_tools/salary_calc.py`

- [ ] 1. Create `backend/app/agents/raw_tools/__init__.py` (empty)

- [ ] 2. Create `salary_calc.py` -- fuzzy-matches job title to SOC code via `soc_codes` table, queries `jobs` table for actual salaries, computes distribution buckets, finds sponsors hiring above threshold, returns `SalaryCalcResponse`

Key logic:
- SOC matching: first try `pg_trgm` fuzzy search, fallback to ILIKE
- Salary distribution: 8 buckets from 0-20k to 100k+
- Threshold selection: use shortage_threshold if on shortage list and skilled_worker route
- Limit to 20 sponsors in response, ordered by salary desc

- [ ] 3. Commit: `feat(raw): implement Salary Calculator tool backend`

---

## Task 13 -- Tool Frontend: Salary Calculator

**Files:** `frontend/src/components/raw/SalaryCalc.tsx`

- [ ] 1. Create the Salary Calculator component with:
- Input form: job title (required), location (optional), visa route select
- Results: 4 metric cards (SOC code, threshold, going rate, median), salary distribution bar chart, sponsors table
- Rate limit banner with upgrade CTA
- Uses `useRawTool` with `tier: 'sync'`

- [ ] 2. Commit: `feat(raw): implement Salary Calculator frontend component`

---

## Task 14 -- Tool Backend: SOC Matcher

**Files:** `backend/app/agents/raw_tools/soc_matcher.py`

- [ ] 1. Create `soc_matcher.py`:
- Extract key terms from input text for DB fuzzy search
- Query `soc_codes` table via pg_trgm
- Send candidates + user text to LLM (Groq 70B, light tier) for classification
- Enrich each match with sponsor count from `jobs` table
- Return top 3 matches with confidence scores

- [ ] 2. Commit: `feat(raw): implement SOC Matcher tool backend`

---

## Task 15 -- Tool Frontend: SOC Matcher

**Files:** `frontend/src/components/raw/SocMatcher.tsx`

- [ ] 1. Create SOC Matcher component: textarea input with match_type toggle (job description / CV), results showing confidence bars per match, skills gap visualization, sponsor counts
- [ ] 2. Register in `ToolWorkspace.tsx` imports
- [ ] 3. Commit: `feat(raw): implement SOC Matcher frontend component`

---

## Task 16 -- Tool Backend: Red Flag Scanner (SSE Pattern)

**Files:** `backend/app/agents/raw_tools/red_flag_scanner.py`

- [ ] 1. Create `red_flag_scanner.py` as an async generator yielding SSE events:
- Step 1 (10%): Identify company from sponsor_name or job description
- Step 2 (30%): Pull Companies House data from company_profiles
- Step 3 (50%): Gather review data (Glassdoor, Trustpilot ratings)
- Step 4 (70%): LLM risk analysis (Groq 70B, light tier)
- Step 5 (90%): Find alternative sponsors if high risk
- Final: yield `{"type": "result", "data": {...}}`

- [ ] 2. Commit: `feat(raw): implement Red Flag Scanner tool backend (SSE)`

---

## Task 17 -- Tool Frontend: Red Flag Scanner

**Files:** `frontend/src/components/raw/RedFlagScanner.tsx`

- [ ] 1. Create Red Flag Scanner component:
- Input: job URL or sponsor name or job description paste
- Risk level badge (color-coded: green/amber/orange/red with icons)
- Red flags list with severity badges
- Safe signals list
- Recommendation callout
- Alternative sponsors if high risk
- [ ] 2. Register in `ToolWorkspace.tsx`
- [ ] 3. Commit: `feat(raw): implement Red Flag Scanner frontend component`

---

## Task 18 -- Tool Backend + Frontend: Sponsor X-Ray (Celery)

**Files:** `backend/app/agents/raw_tools/sponsor_xray.py`, `frontend/src/components/raw/SponsorXRay.tsx`

- [ ] 1. Create `sponsor_xray.py` -- pulls enrichment data, runs Companies House analysis, synthesizes trust report via LLM (NIM 405B, heavy tier)
- [ ] 2. Create `SponsorXRay.tsx` -- sponsor search input, uses `useRawTool` with `tier: 'celery'`, shows trust score gauge, financial summary, hiring activity chart, red flags/positive signals
- [ ] 3. Register Celery task and frontend component
- [ ] 4. Commit: `feat(raw): implement Sponsor X-Ray tool (backend + frontend)`

---

## Task 19 -- Tool Backend + Frontend: Comparator Pro (SSE)

**Files:** `backend/app/agents/raw_tools/comparator.py`, `frontend/src/components/raw/ComparatorPro.tsx`

- [ ] 1. Create `comparator.py` -- fetches profiles for 2-4 sponsors, computes 30+ dimensions with rankings, generates winner summary via LLM
- [ ] 2. Create `ComparatorPro.tsx` -- reuse existing compare page pattern (sponsor search + add, comparison table with color-coded best values), uses SSE tier
- [ ] 3. Register in ToolWorkspace
- [ ] 4. Commit: `feat(raw): implement Comparator Pro tool (backend + frontend)`

---

## Task 20 -- Tool Backend + Frontend: Route Advisor (Celery)

**Files:** `backend/app/agents/raw_tools/route_advisor.py`, `frontend/src/components/raw/RouteAdvisor.tsx`

- [ ] 1. Create `route_advisor.py` -- rule-based eligibility check for 6 visa routes + LLM analysis for strength scoring (NIM 405B, heavy tier)
- [ ] 2. Create `RouteAdvisor.tsx` -- multi-field profile form, uses Celery tier, shows ranked routes with strength bars, recommended route callout, action items checklist
- [ ] 3. Register in ToolWorkspace
- [ ] 4. Commit: `feat(raw): implement Route Advisor tool (backend + frontend)`

---

## Task 21 -- Tool Backend + Frontend: Market Heatmap (SSE)

**Files:** `backend/app/agents/raw_tools/market_heatmap.py`, `frontend/src/components/raw/MarketHeatmap.tsx`

- [ ] 1. Create `market_heatmap.py` -- queries sponsors by industry + jobs matching role, aggregates by city/county, computes region stats, generates GeoJSON
- [ ] 2. Create `MarketHeatmap.tsx` -- reuses `UKMap` component from `/map` page with different data overlays, adds industry/role inputs, top cities table, salary comparison bars
- [ ] 3. Register in ToolWorkspace
- [ ] 4. Commit: `feat(raw): implement Market Heatmap tool (backend + frontend)`

---

## Task 22 -- Tool Backend + Frontend: Idea Forge (Celery)

**Files:** `backend/app/agents/raw_tools/idea_forge.py`, `frontend/src/components/raw/IdeaForge.tsx`

- [ ] 1. Create `idea_forge.py` -- multi-agent pipeline (market researcher, competitor scanner, regulatory checker, demand analyzer, synthesizer), each agent reports progress
- [ ] 2. Create `IdeaForge.tsx` -- idea description textarea + industry/location inputs, uses Celery tier with progress steps, shows viability score gauge, SWOT grid, competitor table, endorsing bodies, next steps
- [ ] 3. Register in ToolWorkspace
- [ ] 4. Commit: `feat(raw): implement Idea Forge tool (backend + frontend)`

---

## Task 23 -- Tool Backend + Frontend: Cover Letter Lab (Celery)

**Files:** `backend/app/agents/raw_tools/cover_letter.py`, `frontend/src/components/raw/CoverLetterLab.tsx`

- [ ] 1. Create `cover_letter.py` -- parses job listing (scrape or paste), pulls sponsor data, generates sponsorship-aware cover letter via LLM (NIM 405B, heavy tier), computes ATS score
- [ ] 2. Create `CoverLetterLab.tsx` -- job URL or paste input, CV paste textarea, uses Celery tier, shows generated letter with copy/download buttons, ATS score, keyword analysis
- [ ] 3. PII handling: CV text hashed (SHA-256) before storage, only extracted skills persisted
- [ ] 4. Register in ToolWorkspace
- [ ] 5. Commit: `feat(raw): implement Cover Letter Lab tool (backend + frontend)`

---

## Task 24 -- Tool Backend + Frontend: Endorsement Matcher (SSE)

**Files:** `backend/app/agents/raw_tools/endorsement_matcher.py`, `frontend/src/components/raw/EndorsementMatch.tsx`

- [ ] 1. Create `endorsement_matcher.py` -- fetches endorsing bodies from DB, scores alignment via LLM (NIM 405B, heavy tier), generates tips per body
- [ ] 2. Create `EndorsementMatch.tsx` -- business concept textarea + industry/innovation inputs, uses SSE tier, shows ranked endorsing bodies with alignment bars, preparation steps
- [ ] 3. Register in ToolWorkspace
- [ ] 4. Commit: `feat(raw): implement Endorsement Matcher tool (backend + frontend)`

---

## Task 25 -- Tool Backend + Frontend: Lawyer Finder (SSE)

**Files:** `backend/app/agents/raw_tools/lawyer_finder.py`, `frontend/src/components/raw/LawyerFinder.tsx`, `frontend/src/components/raw/LawyerCard.tsx`

- [ ] 1. Create `lawyer_finder.py` -- queries `raw_lawyers` table with filters (route, city, accreditation), scores matches per spec algorithm (40% specialisation, 25% reviews, 15% proximity, 10% accreditation, 10% transparency), generates AI blurbs via SSE
- [ ] 2. Create `LawyerCard.tsx` -- individual lawyer result card with rating, practice areas, fee info, AI blurb
- [ ] 3. Create `LawyerFinder.tsx` -- visa route + location + complexity form, uses SSE tier, shows ranked lawyer cards with disclaimer
- [ ] 4. Register in ToolWorkspace
- [ ] 5. Commit: `feat(raw): implement Lawyer Finder tool (backend + frontend)`

---

## Task 26 -- Result History + PDF Export

**Files:** `frontend/src/components/raw/ResultHistory.tsx`, `backend/app/api/v1/raw.py` (add export endpoint)

- [ ] 1. Create `ResultHistory.tsx` -- paginated table of past tool results, clickable to expand, sortable columns with `aria-sort` attributes

- [ ] 2. Add PDF export endpoint to `raw.py`:

```python
@router.get("/export/{result_id}")
async def export_result(
    result_id: UUID,
    format: str = "pdf",
    user: User = Depends(require_auth),
):
    """Export a tool result as PDF."""
    from supabase import create_client
    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    result = sb.table("raw_results").select("*").eq("id", str(result_id)).eq(
        "user_id", str(user.id)
    ).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Result not found")

    # Generate PDF using weasyprint
    from weasyprint import HTML
    from fastapi.responses import Response

    html_content = _render_result_html(result.data)
    pdf_bytes = HTML(string=html_content).write_pdf()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=raw-{result.data['tool_name']}-{result_id}.pdf"},
    )
```

- [ ] 3. Add `_render_result_html()` helper function with common layout (header with SponsorIntel branding, tool name, timestamp, disclaimer footer) and tool-specific content sections per spec PDF layout
- [ ] 4. Commit: `feat(raw): add result history page and PDF export`

---

## Task 27 -- Add RAW to Sidebar Navigation

**Files:** `frontend/src/components/layout/Sidebar.tsx`

- [ ] 1. Add RAW nav item to the CORE section, after Jobs:

```tsx
// In the navSections array, CORE items, after Jobs:
{ href: '/raw', label: 'RAW Lab', icon: <FlaskConical size={15} />, shortcut: 'G R' },
```

- [ ] 2. Add `FlaskConical` to the lucide-react import
- [ ] 3. Commit: `feat(raw): add RAW Lab to sidebar navigation`

---

## Task 28 -- Prometheus Metrics + Admin Dashboard

**Files:** `backend/app/agents/raw_metrics.py`, `frontend/src/components/admin/RAWHealth.tsx`

- [ ] 1. Create `raw_metrics.py` with all Prometheus counters/histograms/gauges from the spec:
- `raw_tool_requests_total` (Counter: tool_name, status, user_plan)
- `raw_tool_duration_seconds` (Histogram: tool_name, buckets 0.5-120)
- `raw_llm_request_duration_seconds` (Histogram: provider, model, tool_name)
- `raw_llm_requests_total` (Counter: provider, model, status)
- `raw_llm_tokens_total` (Counter: provider, direction)
- `raw_llm_fallbacks_total` (Counter: from_provider, to_provider, reason)
- `raw_rate_limit_hits_total` (Counter: user_plan)
- `raw_cache_hits_total` / `raw_cache_misses_total` (Counter: tool_name)
- `raw_active_celery_tasks` (Gauge: tool_name)

- [ ] 2. Add admin API endpoints to `backend/app/api/v1/admin.py`:
    - `GET /api/v1/admin/raw/metrics` -- aggregated metrics as JSON
    - `GET /api/v1/admin/raw/errors` -- recent errors
    - `GET /api/v1/admin/raw/usage-stats` -- daily/weekly breakdown by tool and plan

- [ ] 3. Create `RAWHealth.tsx` -- admin panel showing:
    - Tool usage bar chart (last 24h by tool name)
    - LLM provider status indicators (green/amber/red based on error rate)
    - Latency sparklines (reusing existing Sparkline component)
    - Rate limit pressure percentage
    - Cost tracker (estimated daily LLM spend)
    - Error log (last 20 errors)

- [ ] 4. Register `RAWHealth` in the admin page

- [ ] 5. Commit: `feat(raw): add Prometheus metrics and admin health dashboard`

---

## Smoke Test Checklist

After all tasks are complete, verify:

- [ ] `POST /api/v1/raw/salary-calculator` returns SalaryCalcResponse for "Software Engineer"
- [ ] `POST /api/v1/raw/soc-matcher` returns SocMatcherResponse for a pasted job description
- [ ] `POST /api/v1/raw/red-flag-scanner` streams SSE events with progress + final result
- [ ] `POST /api/v1/raw/idea-forge` returns task_id, polling shows progress, eventually completes
- [ ] Rate limiting: free user gets 429 after 3 uses, pro user is unlimited
- [ ] `/raw` page renders tool grid, clicking a card expands workspace
- [ ] Result history shows past results
- [ ] PDF export downloads a valid PDF
- [ ] Sidebar shows "RAW Lab" link
- [ ] LLM multi-provider failover works (disable primary, verify fallback)
