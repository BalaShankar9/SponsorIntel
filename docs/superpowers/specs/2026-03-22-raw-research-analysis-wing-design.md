# RAW — Research & Analysis Wing

**Date:** 2026-03-22
**Status:** Approved
**Page Route:** `/raw`

## Purpose

A tools laboratory for immigration seekers. Each tool is an AI-powered utility that leverages the 140K sponsor database, enrichment data, and live web intelligence to give users actionable research — not generic advice.

## Architecture

### Frontend
- **Page layout:** Grid of 11 tool cards at top. Clicking a card expands a full-width workspace below.
- **State management:** Each tool has its own workspace state. Results persist in user history.
- **Export:** Every result can be exported as PDF.
- **Auth:** Free users get 3 tool uses/day (total across all tools). Pro users unlimited. Enterprise gets API access.

### Backend
- **API routes:** `POST /api/v1/raw/{tool_name}` — accepts tool-specific input, returns task ID for polling.
- **Agent execution:** Each tool maps to one or more AI agents that orchestrate data gathering + LLM analysis.
- **Result storage:** Results saved to `raw_results` table in Supabase (created via SQL migration, not Alembic).
- **Rate limiting:** Redis counter keyed by `raw:{user_id}:{date}`. Increment on each tool use. Return HTTP 429 with `{"error": "daily_limit_reached", "limit": 3, "resets_at": "..."}` when exceeded.

### LLM Provider Strategy

All RAW tools use the existing multi-provider LLM routing already deployed on Railway workers:
- **Primary:** NVIDIA NIM (via `NVIDIA_API_KEY`) — used for all analysis/synthesis tasks
- **Fallback 1:** Groq (via `GROQ_API_KEY`) — fast inference, used when NIM is rate-limited
- **Fallback 2:** OpenRouter (via `OPENROUTER_API_KEY`) — final fallback

The existing `LLMService` in `backend/app/agents/llm_service.py` (currently supports ollama/anthropic) must be extended to add `nvidia_nim`, `groq`, and `openrouter` backends with auto-cooldown rotation. Each tool specifies a `complexity` tier that determines model selection:
- **Light** (classification, matching): Groq Llama 3.1 70B or NIM Llama 3.1 70B
- **Heavy** (synthesis, analysis, generation): NIM Llama 3.1 405B or OpenRouter Claude Haiku

### Execution Model

Tools are categorized by expected runtime:

| Category | Tools | Execution | Timeout |
|----------|-------|-----------|---------|
| **Fast** (< 5s) | Salary Calculator, SOC Matcher | Synchronous HTTP response | 10s |
| **Medium** (5-30s) | Red Flag Scanner, Comparator Pro, Market Heatmap, Endorsement Matcher, Lawyer Finder | Synchronous with streaming progress via SSE | 45s |
| **Slow** (30-120s) | Idea Forge, Sponsor X-Ray, Route Advisor, Cover Letter Lab | Celery background task with polling | 120s |

**Slow tool flow:**
1. `POST /api/v1/raw/{tool}` → returns `{"task_id": "...", "status": "processing"}`
2. `GET /api/v1/raw/status/{task_id}` → returns `{"status": "processing|completed|failed", "progress": 0-100, "result": ...}`
3. Frontend polls every 2 seconds, shows progress bar with step descriptions
4. On failure: return partial results if any agents completed, plus error message for failed step

**Degradation strategy:** If an agent in a pipeline fails (timeout, scrape blocked, LLM error), continue with remaining agents and mark the failed section as `"unavailable"` in the output. Never fail the entire tool due to a single agent failure.

## Tools

### 1. Idea Forge (Innovator Founder Visa)

**Input:** Business idea description (free text, 100-2000 chars), target industry, target location.

**Agent pipeline:**
1. **Market Researcher** — Searches web for UK market size, growth rate, existing players
2. **Competitor Scanner** — Finds direct competitors, analyzes their strengths/weaknesses
3. **Regulatory Checker** — Identifies UK-specific regulations, licensing requirements
4. **UK Demand Analyzer** — Cross-references with job market data, sponsor hiring patterns
5. **Synthesizer** — Combines all findings into a viability report

**Output:**
- Viability score (0-100) with breakdown
- Market size estimate and growth trajectory
- Top 5 competitors with brief analysis
- Regulatory requirements checklist
- Strengths, weaknesses, opportunities, threats
- Recommended endorsing bodies for this idea (from `endorsing_bodies` table)
- "Next steps" action list

**Complexity:** Heavy (uses 405B for synthesis)

### 2. Sponsor X-Ray

**Input:** Sponsor name or ID from database.

**Agent pipeline:**
1. Pull all existing enrichment data (profile, scores, jobs, aliases)
2. Run on-demand deep scrape: latest news, Glassdoor reviews mentioning visa/sponsorship, LinkedIn recent hires
3. Companies House filing analysis (recent filings, charges, PSCs)
4. Synthesize into a trust report

**Scraping fallback:** If Glassdoor/LinkedIn scraping is blocked (anti-bot), use cached enrichment data from `company_profiles` and `company_reviews` tables. Mark section as "based on cached data from {date}".

**Output:**
- Overall trust score with factor breakdown
- Visa sponsorship track record estimate
- Financial health summary (charges, insolvency flags, accounts status)
- Employee sentiment (Glassdoor/Trustpilot highlights)
- Recent hiring activity (job count trend, roles, salary ranges)
- Red flags (if any)
- Similar companies that also sponsor

### 3. Salary Threshold Calculator

**Input:** Job title, location (optional), visa route (Skilled Worker / Scale-up / Global Talent).

**Agent pipeline:**
1. Match job title to SOC code(s) via NLP (using `soc_codes` table — see Data Seeding)
2. Look up going rate from existing `salary_benchmarks` table
3. Look up visa-specific salary threshold from `soc_codes.standard_threshold` / `soc_codes.shortage_threshold`
4. Query `jobs` table for actual salaries at sponsors hiring this role
5. Cross-reference with existing `shortage_occupations` table

**Relationship to existing tables:** The new `soc_codes` table is a **reference/lookup table** that complements (not replaces) the existing `salary_benchmarks` and `shortage_occupations` tables. `salary_benchmarks` holds per-sponsor salary data from job scraping. `shortage_occupations` holds the official shortage list. `soc_codes` provides the canonical SOC taxonomy with official going rates and thresholds.

**Output:**
- Minimum salary threshold for selected visa route
- Going rate for matched SOC code
- Median actual salary from sponsor job listings
- Distribution chart (what sponsors actually pay)
- Sponsors currently hiring this role above threshold
- Whether role is on shortage occupation list

### 4. SOC Code Matcher

**Input:** Job description text OR CV/resume text (paste, max 5000 chars).

**Agent pipeline:**
1. NLP extraction of key skills, responsibilities, qualifications
2. Match against `soc_codes` table (fuzzy matching on title + description using pg_trgm)
3. Cross-reference matched codes with `shortage_occupations` table
4. Query database for sponsors hiring under matched SOC codes (join `jobs` on SOC code)

**Output:**
- Top 3 SOC code matches with confidence scores
- For each: shortage list status, salary threshold, going rate
- Sponsors in database hiring under each SOC code (count + top examples)
- Skills gap analysis (what the role needs vs. what was extracted)

### 5. Sponsor Comparator Pro

**Input:** 2-4 sponsor names/IDs.

This **extends the existing `/compare` page** (which covers 19 dimensions) with 11 additional dimensions. The existing compare page remains for quick comparisons; Comparator Pro is the deep-dive version in the RAW toolkit.

**Net-new dimensions** (beyond existing compare):
- **Financial:** Revenue band, charge count, PSC nationality breakdown
- **Workforce:** LinkedIn followers, employee growth 12m, Glassdoor CEO approval
- **Hiring:** Salary range per role, hiring velocity (jobs/month trend), seniority distribution
- **Community:** User ratings avg (future), success stories count (future)

**Output:** Side-by-side comparison across 30+ dimensions grouped by category.
Color-coded: best value in each row highlighted green.

### 6. Route Advisor

**Input:** User profile form:
- Nationality, age
- Highest qualification + field
- Years of experience + current role
- English language level (IELTS score if known)
- Savings/investment amount
- Business idea (if applicable)
- Current visa status (if in UK)

**Agent pipeline:**
1. Rule-based eligibility check for each route (Skilled Worker, Innovator Founder, Global Talent, Graduate, Scale-up, High Potential Individual)
2. AI analysis of best-fit routes based on profile strength
3. Timeline estimation for each eligible route

**Output:**
- Ranked list of eligible visa routes
- For each: eligibility status, strength score, estimated timeline, key requirements, pros/cons
- Recommended route with reasoning
- Action items to strengthen application
- Relevant sponsors in user's field (from database)

### 7. Cover Letter Lab

**Input:** Job listing URL **OR pasted job description text** + user's CV/resume text (paste) + any special circumstances.

If URL is provided, attempt to scrape. If scraping fails (anti-bot, paywall), prompt user to paste the job description text instead. Supported scrape domains: Reed, Indeed, CWJobs, GOV.UK Find a Job, TotalJobs, Guardian Jobs. LinkedIn/Glassdoor URLs will always prompt for paste.

**Agent pipeline:**
1. Parse job listing (from scrape or paste): title, requirements, company info
2. Pull sponsor data from database (enrichment, score, industry)
3. AI generates sponsorship-aware cover letter addressing employer concerns
4. Optimizes for ATS keywords

**Output:**
- Full cover letter (editable)
- Key points addressed (why they should sponsor you)
- ATS keyword match score
- Company-specific talking points from enrichment data
- Copy/download buttons

### 8. Red Flag Scanner

**Input:** Job listing URL (with paste fallback, same as Cover Letter Lab) OR sponsor name.

**Agent pipeline:**
1. If URL: scrape/parse listing, extract company name, match to database
2. Run checks: Companies House status, accounts overdue, insolvency flags, charges
3. Check: is this a recruitment agency (not direct employer)?
4. Check: salary below visa threshold?
5. Check: Glassdoor/Trustpilot red flag reviews
6. Check: website quality, domain age, social presence
7. Check: recently removed from sponsor register?

**Output:**
- Risk level: LOW / MEDIUM / HIGH / CRITICAL
- Individual flag items with severity and evidence
- "Safe signals" (positive indicators)
- Recommendation: proceed / proceed with caution / avoid
- Similar legitimate alternatives (if high risk)

### 9. Market Heatmap Builder

**Input:** Industry selector + job type/role + optional salary range.

Uses the existing UK map infrastructure from `/map` page (`frontend/src/components/map/UKMap.tsx`). The existing map uses Leaflet with TopoJSON for UK regions. Market Heatmap reuses this component with different data overlays.

**Agent pipeline:**
1. Query sponsors by industry + active jobs matching role
2. Aggregate by geographic region (city/county) using `town_city` and `county` from sponsors table
3. Calculate: sponsor density, avg salary, competition level per region
4. Generate heatmap data as GeoJSON feature collection

**Output:**
- Interactive UK map with color-coded regions (reusing UKMap component)
- Per-region stats: sponsor count, avg salary, job count, competition index
- Top 5 cities for this industry+role
- Salary comparison across regions
- Trend: which regions are growing for this role

### 10. Endorsement Body Matcher

**Input:** Business concept description, industry, innovation element.

**Agent pipeline:**
1. Match concept against known endorsing body focus areas (from `endorsing_bodies` table)
2. Score alignment with each body's criteria using LLM
3. Pull success rate data (if available from community-sourced data)

**Output:**
- Ranked list of endorsing bodies
- For each: name, focus areas, alignment score, application tips
- Key criteria they look for
- Common rejection reasons to avoid
- Recommended preparation steps

### 11. Lawyer Finder

**Input:** Visa route, nationality (optional), location or "remote OK", case complexity (straightforward / complex / appeal), budget range (optional), language preference (optional).

**Data Sources:**
| Source | URL | Data | Refresh |
|--------|-----|------|---------|
| OISC Register | services.oisc.gov.uk/register | OISC-registered advisers (Level 1/2/3), practice areas, authorisation status | Weekly Celery Beat |
| SRA Solicitors Register | solicitors.lawsociety.org.uk | Solicitors, firm name, practising status, disciplinary history | Weekly Celery Beat |
| Law Society Find a Solicitor | solicitors.lawsociety.org.uk | Immigration-accredited solicitors, LEXCEL/SQM quality marks | Weekly Celery Beat |
| Google Maps / Places API | maps.googleapis.com/maps/api/place | Reviews, ratings, location, opening hours | Weekly Celery Beat |
| Trustpilot | trustpilot.com/categories/immigration_lawyer | Firm ratings, review text, response rate | Weekly Celery Beat |
| Firms' own websites | Varies | Fee ranges (if published), team bios, case studies, languages spoken | Monthly |

**Data Pipeline:** `raw_scan_lawyers()` Celery Beat task runs weekly. Scrapes OISC + SRA registers, enriches with Google/Trustpilot reviews. Stores/updates in `raw_lawyers` table. This is a background data-building task, not triggered per user request — the search endpoint queries pre-built data.

**Matching Algorithm:**
1. Filter by: OISC Level 2+ or SRA-registered, practising status = active, covers user's visa route
2. Score candidates on:
   - **Specialisation match** (40%) — visa route overlap with practice areas
   - **Review quality** (25%) — weighted avg of Google + Trustpilot ratings, penalise < 10 reviews
   - **Proximity** (15%) — distance from user's location (0 if remote OK)
   - **Accreditation** (10%) — Law Society Immigration Accreditation, LEXCEL, SQM, OISC Level 3
   - **Transparency** (10%) — published fees, clear website, responsive to reviews
3. AI generates a 2-sentence "Why this lawyer" blurb per result using LLM

**Output:**
- Ranked list of top 10 matched lawyers/firms
- For each: name, firm, OISC/SRA number, rating (stars), review count, distance, fee range (if known), "Why this lawyer" AI blurb
- Filter/sort: by distance, rating, fee range, accreditation level
- Click to expand: full profile with all reviews, practice areas, disciplinary history (if any), contact details, website link
- "Compare" mode: side-by-side comparison of 2-3 lawyers
- Disclaimer: "This is informational only. We do not endorse any specific lawyer. Verify credentials independently."

**Access tiers:** Free users: 2 searches/day, top 3 results. Pro users: unlimited searches, top 10, compare mode.

**Complexity:** Medium (search is fast DB query, AI blurb is light). SSE streaming for the AI blurb generation.

## Database Changes

All new tables are created via Supabase SQL migration (not Alembic). Use service role key for writes.

### New table: `raw_results`
```sql
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

### New table: `soc_codes`
```sql
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

**Data source:** ONS SOC 2020 taxonomy (~400 codes). Download from [ons.gov.uk SOC 2020](https://www.ons.gov.uk/methodology/classificationsandstandards/standardoccupationalclassificationsoc/soc2020). Going rates and thresholds from [Immigration Rules Appendix Skilled Occupations](https://www.gov.uk/government/publications/skilled-worker-visa-going-rates-for-eligible-occupations). Seeded via `scripts/seed_soc_codes.py` script.

### New table: `endorsing_bodies`
```sql
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

**Data source:** ~40 endorsing bodies listed on [GOV.UK Innovator Founder endorsing bodies](https://www.gov.uk/government/publications/endorsing-bodies-innovator-founder). Seeded via `scripts/seed_endorsing_bodies.py` with name, website, focus areas, and criteria extracted from each body's public application guidance.

### New table: `raw_lawyers`
```sql
CREATE TABLE raw_lawyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(300) NOT NULL,
    firm_name VARCHAR(500),

    -- Registration
    registration_type VARCHAR(20) NOT NULL CHECK (registration_type IN ('oisc', 'sra')),
    registration_number VARCHAR(50) NOT NULL,
    oisc_level INTEGER CHECK (oisc_level IN (1, 2, 3)),
    practising_status VARCHAR(30) NOT NULL DEFAULT 'active',
    accreditations TEXT[],

    -- Practice details
    practice_areas TEXT[] NOT NULL,
    languages TEXT[],
    fee_initial_consultation VARCHAR(100),
    fee_hourly_range VARCHAR(100),
    fee_fixed_range VARCHAR(200),
    offers_legal_aid BOOLEAN DEFAULT FALSE,

    -- Location
    address TEXT,
    city VARCHAR(200),
    postcode VARCHAR(20),
    latitude FLOAT,
    longitude FLOAT,
    offers_remote BOOLEAN DEFAULT TRUE,

    -- Reviews & ratings
    google_rating FLOAT,
    google_review_count INTEGER DEFAULT 0,
    trustpilot_rating FLOAT,
    trustpilot_review_count INTEGER DEFAULT 0,
    combined_rating FLOAT,

    -- Enrichment
    website VARCHAR(500),
    email VARCHAR(300),
    phone VARCHAR(50),
    bio TEXT,
    profile_photo_url VARCHAR(1000),
    disciplinary_history JSONB DEFAULT '[]',

    -- Metadata
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

### New table: `raw_lawyer_reviews`
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

### RLS Policies

```sql
-- raw_results: users can only read their own results
ALTER TABLE raw_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own results" ON raw_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts results" ON raw_results FOR INSERT WITH CHECK (true);

-- soc_codes: public read, service role write
ALTER TABLE soc_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read SOC codes" ON soc_codes FOR SELECT USING (true);
CREATE POLICY "Service role manages SOC codes" ON soc_codes FOR ALL USING (true);

-- endorsing_bodies: public read, service role write
ALTER TABLE endorsing_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read endorsing bodies" ON endorsing_bodies FOR SELECT USING (true);
CREATE POLICY "Service role manages endorsing bodies" ON endorsing_bodies FOR ALL USING (true);

-- raw_lawyers: public read active, service role write
ALTER TABLE raw_lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active lawyers" ON raw_lawyers FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Service role manages lawyers" ON raw_lawyers FOR ALL USING (true);

-- raw_lawyer_reviews: public read, service role write
ALTER TABLE raw_lawyer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lawyer reviews" ON raw_lawyer_reviews FOR SELECT USING (true);
CREATE POLICY "Service role manages lawyer reviews" ON raw_lawyer_reviews FOR ALL USING (true);
```

## Frontend Components

```
src/app/raw/page.tsx                    — Main RAW page
src/components/raw/ToolGrid.tsx         — Tool card grid
src/components/raw/ToolWorkspace.tsx    — Expanded tool workspace wrapper
src/components/raw/ToolProgress.tsx     — Progress indicator for slow tools
src/components/raw/IdeaForge.tsx        — Tool: Idea Forge
src/components/raw/SponsorXRay.tsx      — Tool: Sponsor X-Ray
src/components/raw/SalaryCalc.tsx       — Tool: Salary Threshold Calculator
src/components/raw/SocMatcher.tsx       — Tool: SOC Code Matcher
src/components/raw/ComparatorPro.tsx    — Tool: Sponsor Comparator Pro
src/components/raw/RouteAdvisor.tsx     — Tool: Route Advisor
src/components/raw/CoverLetterLab.tsx   — Tool: Cover Letter Lab
src/components/raw/RedFlagScanner.tsx   — Tool: Red Flag Scanner
src/components/raw/MarketHeatmap.tsx    — Tool: Market Heatmap Builder
src/components/raw/EndorsementMatch.tsx — Tool: Endorsement Body Matcher
src/components/raw/LawyerFinder.tsx    — Tool: Lawyer Finder
src/components/raw/LawyerCard.tsx      — Individual lawyer result card
src/components/raw/LawyerCompare.tsx   — Side-by-side lawyer comparison
src/components/raw/ResultHistory.tsx    — User's past results
```

## Backend Routes

```
POST /api/v1/raw/idea-forge           → Celery task, returns task_id
POST /api/v1/raw/sponsor-xray         → Celery task, returns task_id
POST /api/v1/raw/salary-calculator    → Synchronous response
POST /api/v1/raw/soc-matcher          → Synchronous response
POST /api/v1/raw/comparator           → SSE streaming
POST /api/v1/raw/route-advisor        → Celery task, returns task_id
POST /api/v1/raw/cover-letter         → Celery task, returns task_id
POST /api/v1/raw/red-flag-scanner     → SSE streaming
POST /api/v1/raw/market-heatmap       → SSE streaming
POST /api/v1/raw/endorsement-matcher  → SSE streaming
POST /api/v1/raw/lawyer-finder       → SSE streaming (search + AI blurb generation)
GET  /api/v1/raw/lawyers/{id}        → Single lawyer profile with reviews
GET  /api/v1/raw/lawyers/{id}/reviews → Paginated reviews for a lawyer
GET  /api/v1/raw/lawyers/compare     → Compare 2-3 lawyers (query: ids[])
GET  /api/v1/raw/status/{task_id}     → Poll background task status
GET  /api/v1/raw/history              → Paginated user results (from raw_results)
```

## Build Order

1. Database tables (Supabase migration) + RLS policies + API scaffold
2. **Seed SOC codes** from ONS data + **seed endorsing bodies** from GOV.UK
3. Frontend page + ToolGrid + ToolWorkspace shell + ToolProgress component
4. Salary Calculator (simplest — mostly database queries, synchronous)
5. SOC Matcher (NLP + database, synchronous)
6. Red Flag Scanner (multi-source checks, SSE streaming)
7. Sponsor X-Ray (leverages existing enrichment, Celery background)
8. Comparator Pro (extends existing compare, SSE streaming)
9. Route Advisor (rule engine + AI, Celery background)
10. Market Heatmap (geo aggregation, reuses UKMap, SSE streaming)
11. Idea Forge (most complex — multi-agent, Celery background)
12. Cover Letter Lab (AI generation, Celery background)
13. Endorsement Matcher (curated data + AI, SSE streaming)
14. Lawyer Finder: `raw_lawyers` + `raw_lawyer_reviews` tables, OISC/SRA scrapers, search + matching + AI blurbs
15. Result history + PDF export
16. Rate limiting (Redis counter) integration

---

## Pydantic Schemas

All schemas live in `backend/app/schemas/raw.py`. They follow the same conventions as existing schemas in `backend/app/schemas/sponsor.py` and `backend/app/schemas/job.py`: `model_config = {"from_attributes": True}`, `str | None` union syntax, UUID types from `uuid.UUID`.

### Shared / Base

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
    """Returned by all async (Celery) tool endpoints."""
    task_id: str = Field(..., examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"])
    status: TaskStatus = TaskStatus.PROCESSING


class RawTaskStatusResponse(BaseModel):
    """Returned by GET /api/v1/raw/status/{task_id}."""
    task_id: str
    status: TaskStatus
    progress: int = Field(0, ge=0, le=100, description="Percentage complete")
    step_description: str | None = Field(None, examples=["Analyzing competitors..."])
    result: dict | None = None
    error_message: str | None = None
    processing_time_ms: int | None = None


class UnavailableSection(BaseModel):
    """Marks a section that failed during pipeline execution."""
    status: Literal["unavailable"] = "unavailable"
    reason: str = Field(..., examples=["Glassdoor scraping blocked by anti-bot"])
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
    limit: int = Field(3, examples=[3])
    used: int = Field(3, examples=[3])
    resets_at: str = Field(..., examples=["2026-03-24T00:00:00Z"])
    upgrade_url: str = "/pricing"
```

### Tool 1: Idea Forge

```python
class IdeaForgeRequest(BaseModel):
    idea_description: str = Field(
        ...,
        min_length=100,
        max_length=2000,
        examples=["An AI-powered platform that matches international students with UK employers offering visa sponsorship, using NLP to parse CVs and job descriptions for skill alignment."],
    )
    target_industry: str = Field(
        ...,
        max_length=100,
        examples=["Technology / AI"],
    )
    target_location: str = Field(
        "London",
        max_length=100,
        examples=["London", "Manchester", "Nationwide"],
    )

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
    score_breakdown: dict[str, int] = Field(
        ...,
        examples=[{"market_size": 75, "innovation": 82, "feasibility": 68, "demand": 71, "regulatory_ease": 55}],
    )
    market_size_estimate: str = Field(..., examples=["GBP 2.4B (growing 12% YoY)"])
    growth_trajectory: str
    top_competitors: list[Competitor] = Field(..., max_length=5)
    regulatory_requirements: list[str]
    swot: SWOTAnalysis
    endorsing_bodies: list[EndorsingBodyRecommendation]
    next_steps: list[str]
    sources: list[str] = Field(default_factory=list, description="URLs/references used")
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)
```

### Tool 2: Sponsor X-Ray

```python
class SponsorXRayRequest(BaseModel):
    sponsor_id: UUID | None = Field(None, description="Sponsor UUID from database")
    sponsor_name: str | None = Field(None, max_length=300, examples=["Deloitte LLP"])

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
    accounts_status: str | None = Field(None, examples=["Filed on time", "Overdue by 3 months"])
    last_accounts_date: str | None = None
    psc_summary: list[dict] | None = None


class HiringActivity(BaseModel):
    active_job_count: int
    jobs_trend_3m: list[dict] = Field(
        default_factory=list,
        examples=[[{"month": "2026-01", "count": 12}, {"month": "2026-02", "count": 18}]],
    )
    top_roles: list[str]
    salary_range: dict | None = Field(None, examples=[{"min": 30000, "max": 85000, "currency": "GBP"}])
    seniority_distribution: dict | None = None


class SponsorXRayResponse(BaseModel):
    sponsor_id: UUID
    sponsor_name: str
    overall_trust_score: int = Field(..., ge=0, le=100)
    trust_score_breakdown: dict[str, int]
    visa_track_record: str = Field(..., examples=["Estimated 50-100 sponsored workers since 2020"])
    financial_health: FinancialHealthSummary
    employee_sentiment: dict | None = Field(
        None,
        examples=[{"glassdoor_rating": 3.8, "highlights": ["Good work-life balance"], "concerns": ["Slow promotion"]}],
    )
    hiring_activity: HiringActivity
    red_flags: list[str]
    positive_signals: list[str]
    similar_sponsors: list[dict] = Field(
        default_factory=list,
        examples=[[{"id": "...", "name": "PwC", "score": 85}]],
    )
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)
```

### Tool 3: Salary Threshold Calculator

```python
class SalaryCalcRequest(BaseModel):
    job_title: str = Field(..., min_length=2, max_length=200, examples=["Software Engineer"])
    location: str | None = Field(None, max_length=100, examples=["London", "Manchester"])
    visa_route: VisaRoute = VisaRoute.SKILLED_WORKER


class SalaryDistributionBucket(BaseModel):
    range_label: str = Field(..., examples=["30k-40k"])
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
    matched_soc_code: str = Field(..., examples=["2134"])
    matched_soc_title: str = Field(..., examples=["Programmers and software development professionals"])
    minimum_salary_threshold: int = Field(..., examples=[38700])
    going_rate: int = Field(..., examples=[45000])
    median_actual_salary: float | None = Field(None, examples=[52000.0])
    salary_distribution: list[SalaryDistributionBucket]
    is_shortage_occupation: bool
    shortage_threshold: int | None = None
    sponsors_hiring_above_threshold: list[SponsorHiringAboveThreshold] = Field(
        ..., max_length=20,
    )
    total_sponsors_hiring: int
    data_freshness: str = Field(..., examples=["Based on 342 job listings from last 30 days"])
```

### Tool 4: SOC Code Matcher

```python
class SocMatcherRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=20,
        max_length=5000,
        description="Job description or CV/resume text",
        examples=["Experienced Python developer with 5 years building REST APIs, microservices, and data pipelines. Proficient in FastAPI, PostgreSQL, Redis, Docker, and AWS."],
    )
    match_type: Literal["job_description", "cv"] = "job_description"


class SocCodeMatch(BaseModel):
    soc_code: str
    soc_title: str
    confidence: float = Field(..., ge=0.0, le=1.0, examples=[0.87])
    is_shortage: bool
    salary_threshold: int | None = None
    going_rate: int | None = None
    sponsor_count: int = Field(..., description="Sponsors hiring under this SOC code")
    top_sponsors: list[dict] = Field(
        default_factory=list,
        examples=[[{"name": "Google UK", "job_count": 5}]],
    )


class SkillsGap(BaseModel):
    extracted_skills: list[str]
    required_skills: list[str]
    matching_skills: list[str]
    missing_skills: list[str]


class SocMatcherResponse(BaseModel):
    matches: list[SocCodeMatch] = Field(..., max_length=3)
    skills_gap: SkillsGap
    extracted_role_summary: str
```

### Tool 5: Sponsor Comparator Pro

```python
class ComparatorRequest(BaseModel):
    sponsor_ids: list[UUID] = Field(..., min_length=2, max_length=4)

    @field_validator("sponsor_ids")
    @classmethod
    def unique_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("Duplicate sponsor IDs not allowed")
        return v


class DimensionValue(BaseModel):
    value: str | int | float | bool | None
    rank: int | None = Field(None, description="1 = best in this dimension")
    source: str | None = None


class ComparatorSponsor(BaseModel):
    sponsor_id: UUID
    sponsor_name: str
    dimensions: dict[str, DimensionValue]


class ComparatorResponse(BaseModel):
    sponsors: list[ComparatorSponsor]
    dimension_categories: dict[str, list[str]] = Field(
        ...,
        examples=[{
            "compliance": ["rating", "consecutive_a_days", "route_count"],
            "financial": ["revenue_band", "charge_count", "accounts_status"],
            "workforce": ["employee_count", "growth_12m", "linkedin_followers"],
            "reputation": ["glassdoor_rating", "trustpilot_rating", "ceo_approval"],
            "hiring": ["active_jobs", "salary_range", "hiring_velocity"],
        }],
    )
    winner_summary: str = Field(
        ...,
        examples=["Deloitte leads in 18/30 dimensions. PwC is strongest in workforce growth."],
    )
```

### Tool 6: Route Advisor

```python
class RouteAdvisorRequest(BaseModel):
    nationality: str = Field(..., max_length=100, examples=["Indian"])
    age: int = Field(..., ge=18, le=70)
    highest_qualification: str = Field(..., max_length=200, examples=["MSc Computer Science"])
    qualification_field: str = Field(..., max_length=200, examples=["Computer Science"])
    years_experience: int = Field(..., ge=0, le=50)
    current_role: str = Field(..., max_length=200, examples=["Senior Software Engineer"])
    english_level: str | None = Field(None, examples=["IELTS 7.5", "Native", "B2"])
    ielts_score: float | None = Field(None, ge=0, le=9)
    savings_gbp: float | None = Field(None, ge=0, description="Available savings in GBP")
    business_idea: str | None = Field(None, max_length=1000)
    current_visa_status: str | None = Field(
        None,
        max_length=100,
        examples=["Student visa", "None (outside UK)", "Visitor"],
    )


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
    relevant_sponsors: list[dict] = Field(
        default_factory=list,
        examples=[[{"id": "...", "name": "NHS Trust", "jobs_in_field": 12}]],
    )
    profile_strength: int = Field(..., ge=0, le=100, description="Overall profile competitiveness")
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)
```

### Tool 7: Cover Letter Lab

```python
class CoverLetterRequest(BaseModel):
    job_url: str | None = Field(
        None,
        max_length=2000,
        examples=["https://www.reed.co.uk/jobs/software-engineer-visa-sponsorship/12345"],
    )
    job_description_text: str | None = Field(None, max_length=5000)
    cv_text: str = Field(
        ...,
        min_length=50,
        max_length=8000,
        description="Pasted CV/resume text",
    )
    special_circumstances: str | None = Field(
        None,
        max_length=500,
        examples=["Currently on Graduate visa expiring Dec 2026"],
    )

    @field_validator("job_description_text")
    @classmethod
    def require_url_or_text(cls, v, info):
        if not v and not info.data.get("job_url"):
            raise ValueError("Provide either job_url or job_description_text")
        return v


class CoverLetterResponse(BaseModel):
    cover_letter: str = Field(..., description="Full generated cover letter text")
    key_points_addressed: list[str]
    ats_keyword_score: int = Field(..., ge=0, le=100)
    ats_keywords_matched: list[str]
    ats_keywords_missing: list[str]
    company_talking_points: list[str] = Field(
        default_factory=list,
        description="Company-specific insights from enrichment data",
    )
    sponsor_match: dict | None = Field(
        None,
        description="Matched sponsor info from database",
        examples=[{"sponsor_id": "...", "name": "Acme Ltd", "score": 72, "rating": "A"}],
    )
    scrape_failed: bool = Field(False, description="True if URL scraping failed and pasted text was used instead")
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)
```

### Tool 8: Red Flag Scanner

```python
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
    flag: str = Field(..., examples=["Salary below visa threshold"])
    severity: Literal["low", "medium", "high", "critical"]
    evidence: str = Field(..., examples=["Listed salary GBP 25,000 vs. threshold GBP 38,700"])
    source: str = Field(..., examples=["Job listing", "Companies House", "Glassdoor"])


class SafeSignal(BaseModel):
    signal: str = Field(..., examples=["A-rated sponsor for 5+ years"])
    evidence: str


class RedFlagScannerResponse(BaseModel):
    risk_level: RiskLevel
    risk_score: int = Field(..., ge=0, le=100, description="0 = no risk, 100 = extreme risk")
    red_flags: list[RedFlag]
    safe_signals: list[SafeSignal]
    recommendation: Literal["proceed", "proceed_with_caution", "avoid"]
    recommendation_detail: str
    matched_sponsor: dict | None = None
    alternatives: list[dict] = Field(
        default_factory=list,
        description="Similar legitimate sponsors if risk is HIGH/CRITICAL",
        examples=[[{"id": "...", "name": "Legitimate Corp", "score": 88}]],
    )
    sections_unavailable: list[UnavailableSection] = Field(default_factory=list)
```

### Tool 9: Market Heatmap Builder

```python
class MarketHeatmapRequest(BaseModel):
    industry: str = Field(..., max_length=100, examples=["Technology"])
    job_role: str = Field(..., max_length=200, examples=["Software Engineer"])
    salary_min: int | None = Field(None, ge=0, examples=[30000])
    salary_max: int | None = Field(None, ge=0, examples=[80000])

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
    competition_index: float = Field(
        ..., ge=0, le=1,
        description="0 = low competition, 1 = saturated",
    )
    trend: Literal["growing", "stable", "declining"]
    top_sponsors: list[str] = Field(default_factory=list, max_length=5)


class GeoFeature(BaseModel):
    """GeoJSON Feature for map rendering."""
    type: Literal["Feature"] = "Feature"
    properties: dict
    geometry: dict


class MarketHeatmapResponse(BaseModel):
    geojson: dict = Field(..., description="GeoJSON FeatureCollection for UKMap overlay")
    regions: list[RegionStats]
    top_cities: list[dict] = Field(
        ..., max_length=5,
        examples=[[{"city": "London", "sponsor_count": 1200, "avg_salary": 65000}]],
    )
    salary_comparison: list[dict] = Field(
        default_factory=list,
        examples=[[{"region": "London", "median": 62000}, {"region": "Manchester", "median": 48000}]],
    )
    total_matching_sponsors: int
    total_matching_jobs: int
```

### Tool 10: Endorsement Body Matcher

```python
class EndorsementMatcherRequest(BaseModel):
    business_concept: str = Field(
        ...,
        min_length=50,
        max_length=2000,
        examples=["A SaaS platform using computer vision to automate quality control in UK food manufacturing, reducing waste by 30%."],
    )
    industry: str = Field(..., max_length=100, examples=["Food Technology / AI"])
    innovation_element: str = Field(
        ...,
        max_length=500,
        examples=["Novel application of computer vision to food safety inspection"],
    )


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
    success_rate: float | None = Field(None, description="Historical success rate if known")


class EndorsementMatcherResponse(BaseModel):
    matches: list[EndorsingBodyMatch]
    preparation_steps: list[str]
    overall_readiness_score: int = Field(..., ge=0, le=100)
    readiness_gaps: list[str]
```

---

## TypeScript Interfaces

All types live in `frontend/src/types/raw.ts`. They follow the same conventions as `frontend/src/types/index.ts`: string IDs, `string | null` for optional fields, date strings as ISO format.

```typescript
// frontend/src/types/raw.ts

// ---- Shared ----

export type ToolName =
  | 'idea-forge'
  | 'sponsor-xray'
  | 'salary-calculator'
  | 'soc-matcher'
  | 'comparator'
  | 'route-advisor'
  | 'cover-letter'
  | 'red-flag-scanner'
  | 'market-heatmap'
  | 'endorsement-matcher';

export type VisaRoute =
  | 'skilled_worker'
  | 'scale_up'
  | 'global_talent'
  | 'innovator_founder'
  | 'graduate'
  | 'high_potential_individual';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'processing' | 'completed' | 'failed';
export type Recommendation = 'proceed' | 'proceed_with_caution' | 'avoid';
export type TrendDirection = 'growing' | 'stable' | 'declining';

export interface RawTaskResponse {
  task_id: string;
  status: TaskStatus;
}

export interface RawTaskStatusResponse {
  task_id: string;
  status: TaskStatus;
  progress: number;
  step_description: string | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  processing_time_ms: number | null;
}

export interface UnavailableSection {
  status: 'unavailable';
  reason: string;
  cached_data: Record<string, unknown> | null;
  cached_at: string | null;
}

export interface RawResultHistoryItem {
  id: string;
  tool_name: ToolName;
  input: Record<string, unknown>;
  score: number | null;
  processing_time_ms: number | null;
  status: string;
  created_at: string;
}

export interface PaginatedRawResults {
  data: RawResultHistoryItem[];
  total: number;
  page: number;
  pages: number;
}

export interface RateLimitError {
  error: 'daily_limit_reached';
  limit: number;
  used: number;
  resets_at: string;
  upgrade_url: string;
}

// ---- Tool 1: Idea Forge ----

export interface IdeaForgeInput {
  idea_description: string;
  target_industry: string;
  target_location: string;
}

export interface Competitor {
  name: string;
  website: string | null;
  strengths: string[];
  weaknesses: string[];
  estimated_market_share: string | null;
}

export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface EndorsingBodyRecommendation {
  name: string;
  alignment_score: number;
  focus_areas: string[];
  reason: string;
}

export interface IdeaForgeResult {
  viability_score: number;
  score_breakdown: Record<string, number>;
  market_size_estimate: string;
  growth_trajectory: string;
  top_competitors: Competitor[];
  regulatory_requirements: string[];
  swot: SWOTAnalysis;
  endorsing_bodies: EndorsingBodyRecommendation[];
  next_steps: string[];
  sources: string[];
  sections_unavailable: UnavailableSection[];
}

// ---- Tool 2: Sponsor X-Ray ----

export interface SponsorXRayInput {
  sponsor_id?: string;
  sponsor_name?: string;
}

export interface FinancialHealthSummary {
  estimated_revenue_band: string | null;
  charge_count: number | null;
  has_insolvency_history: boolean | null;
  accounts_status: string | null;
  last_accounts_date: string | null;
  psc_summary: Record<string, unknown>[] | null;
}

export interface HiringActivity {
  active_job_count: number;
  jobs_trend_3m: Array<{ month: string; count: number }>;
  top_roles: string[];
  salary_range: { min: number; max: number; currency: string } | null;
  seniority_distribution: Record<string, number> | null;
}

export interface SponsorXRayResult {
  sponsor_id: string;
  sponsor_name: string;
  overall_trust_score: number;
  trust_score_breakdown: Record<string, number>;
  visa_track_record: string;
  financial_health: FinancialHealthSummary;
  employee_sentiment: {
    glassdoor_rating: number | null;
    highlights: string[];
    concerns: string[];
  } | null;
  hiring_activity: HiringActivity;
  red_flags: string[];
  positive_signals: string[];
  similar_sponsors: Array<{ id: string; name: string; score: number }>;
  sections_unavailable: UnavailableSection[];
}

// ---- Tool 3: Salary Threshold Calculator ----

export interface SalaryCalcInput {
  job_title: string;
  location?: string;
  visa_route: VisaRoute;
}

export interface SalaryDistributionBucket {
  range_label: string;
  count: number;
  percentage: number;
}

export interface SponsorHiringAboveThreshold {
  sponsor_id: string;
  sponsor_name: string;
  job_title: string;
  salary_min: number | null;
  salary_max: number | null;
  location: string | null;
}

export interface SalaryCalcResult {
  matched_soc_code: string;
  matched_soc_title: string;
  minimum_salary_threshold: number;
  going_rate: number;
  median_actual_salary: number | null;
  salary_distribution: SalaryDistributionBucket[];
  is_shortage_occupation: boolean;
  shortage_threshold: number | null;
  sponsors_hiring_above_threshold: SponsorHiringAboveThreshold[];
  total_sponsors_hiring: number;
  data_freshness: string;
}

// ---- Tool 4: SOC Code Matcher ----

export interface SocMatcherInput {
  text: string;
  match_type: 'job_description' | 'cv';
}

export interface SocCodeMatch {
  soc_code: string;
  soc_title: string;
  confidence: number;
  is_shortage: boolean;
  salary_threshold: number | null;
  going_rate: number | null;
  sponsor_count: number;
  top_sponsors: Array<{ name: string; job_count: number }>;
}

export interface SkillsGap {
  extracted_skills: string[];
  required_skills: string[];
  matching_skills: string[];
  missing_skills: string[];
}

export interface SocMatcherResult {
  matches: SocCodeMatch[];
  skills_gap: SkillsGap;
  extracted_role_summary: string;
}

// ---- Tool 5: Comparator Pro ----

export interface ComparatorInput {
  sponsor_ids: string[];
}

export interface DimensionValue {
  value: string | number | boolean | null;
  rank: number | null;
  source: string | null;
}

export interface ComparatorSponsor {
  sponsor_id: string;
  sponsor_name: string;
  dimensions: Record<string, DimensionValue>;
}

export interface ComparatorResult {
  sponsors: ComparatorSponsor[];
  dimension_categories: Record<string, string[]>;
  winner_summary: string;
}

// ---- Tool 6: Route Advisor ----

export interface RouteAdvisorInput {
  nationality: string;
  age: number;
  highest_qualification: string;
  qualification_field: string;
  years_experience: number;
  current_role: string;
  english_level?: string;
  ielts_score?: number;
  savings_gbp?: number;
  business_idea?: string;
  current_visa_status?: string;
}

export interface RouteEligibility {
  route_name: string;
  eligible: boolean;
  strength_score: number;
  estimated_timeline_weeks: number | null;
  key_requirements: string[];
  requirements_met: string[];
  requirements_missing: string[];
  pros: string[];
  cons: string[];
  estimated_cost_gbp: number | null;
}

export interface RouteAdvisorResult {
  routes: RouteEligibility[];
  recommended_route: string;
  recommendation_reasoning: string;
  action_items: string[];
  relevant_sponsors: Array<{ id: string; name: string; jobs_in_field: number }>;
  profile_strength: number;
  sections_unavailable: UnavailableSection[];
}

// ---- Tool 7: Cover Letter Lab ----

export interface CoverLetterInput {
  job_url?: string;
  job_description_text?: string;
  cv_text: string;
  special_circumstances?: string;
}

export interface CoverLetterResult {
  cover_letter: string;
  key_points_addressed: string[];
  ats_keyword_score: number;
  ats_keywords_matched: string[];
  ats_keywords_missing: string[];
  company_talking_points: string[];
  sponsor_match: {
    sponsor_id: string;
    name: string;
    score: number;
    rating: string;
  } | null;
  scrape_failed: boolean;
  sections_unavailable: UnavailableSection[];
}

// ---- Tool 8: Red Flag Scanner ----

export interface RedFlagScannerInput {
  job_url?: string;
  job_description_text?: string;
  sponsor_name?: string;
}

export interface RedFlag {
  flag: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  source: string;
}

export interface SafeSignal {
  signal: string;
  evidence: string;
}

export interface RedFlagScannerResult {
  risk_level: RiskLevel;
  risk_score: number;
  red_flags: RedFlag[];
  safe_signals: SafeSignal[];
  recommendation: Recommendation;
  recommendation_detail: string;
  matched_sponsor: Record<string, unknown> | null;
  alternatives: Array<{ id: string; name: string; score: number }>;
  sections_unavailable: UnavailableSection[];
}

// ---- Tool 9: Market Heatmap ----

export interface MarketHeatmapInput {
  industry: string;
  job_role: string;
  salary_min?: number;
  salary_max?: number;
}

export interface RegionStats {
  region_name: string;
  sponsor_count: number;
  job_count: number;
  avg_salary: number | null;
  median_salary: number | null;
  competition_index: number;
  trend: TrendDirection;
  top_sponsors: string[];
}

export interface MarketHeatmapResult {
  geojson: Record<string, unknown>;
  regions: RegionStats[];
  top_cities: Array<{ city: string; sponsor_count: number; avg_salary: number }>;
  salary_comparison: Array<{ region: string; median: number }>;
  total_matching_sponsors: number;
  total_matching_jobs: number;
}

// ---- Tool 10: Endorsement Matcher ----

export interface EndorsementMatcherInput {
  business_concept: string;
  industry: string;
  innovation_element: string;
}

export interface EndorsingBodyMatch {
  id: string;
  name: string;
  website: string | null;
  application_url: string | null;
  focus_areas: string[];
  alignment_score: number;
  criteria_summary: string[];
  application_tips: string[];
  common_rejection_reasons: string[];
  success_rate: number | null;
}

export interface EndorsementMatcherResult {
  matches: EndorsingBodyMatch[];
  preparation_steps: string[];
  overall_readiness_score: number;
  readiness_gaps: string[];
}

// ---- Unified Tool Input/Output Map (for generic components) ----

export interface ToolIOMap {
  'idea-forge': { input: IdeaForgeInput; output: IdeaForgeResult };
  'sponsor-xray': { input: SponsorXRayInput; output: SponsorXRayResult };
  'salary-calculator': { input: SalaryCalcInput; output: SalaryCalcResult };
  'soc-matcher': { input: SocMatcherInput; output: SocMatcherResult };
  'comparator': { input: ComparatorInput; output: ComparatorResult };
  'route-advisor': { input: RouteAdvisorInput; output: RouteAdvisorResult };
  'cover-letter': { input: CoverLetterInput; output: CoverLetterResult };
  'red-flag-scanner': { input: RedFlagScannerInput; output: RedFlagScannerResult };
  'market-heatmap': { input: MarketHeatmapInput; output: MarketHeatmapResult };
  'endorsement-matcher': { input: EndorsementMatcherInput; output: EndorsementMatcherResult };
}
```

---

## LLM Prompt Templates

All prompts live in `backend/app/agents/raw_prompts.py` as string constants. Each prompt is paired with a JSON output schema that the LLM must conform to. The `LLMService.structured_output()` method handles JSON parsing and retry.

### Synthesizer Agent (Idea Forge)

```
TOOL: Idea Forge — Synthesizer
MODEL: NIM Llama 3.1 405B
TEMPERATURE: 0.3
MAX_TOKENS: 4096
```

```python
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
  "score_breakdown": {
    "market_size": <int 0-100>,
    "innovation": <int 0-100>,
    "feasibility": <int 0-100>,
    "demand": <int 0-100>,
    "regulatory_ease": <int 0-100>
  },
  "market_size_estimate": "<string, e.g. GBP 2.4B (growing 12% YoY)>",
  "growth_trajectory": "<string, 2-3 sentences>",
  "regulatory_requirements": ["<requirement 1>", ...],
  "swot": {
    "strengths": ["..."], "weaknesses": ["..."],
    "opportunities": ["..."], "threats": ["..."]
  },
  "next_steps": ["<actionable step 1>", "<actionable step 2>", ...]
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
```

### Classifier Agent (SOC Matcher)

```
TOOL: SOC Code Matcher — Classifier
MODEL: Groq Llama 3.1 70B (Light complexity)
TEMPERATURE: 0.1
MAX_TOKENS: 1024
```

```python
SOC_MATCHER_CLASSIFIER_SYSTEM = """You are a UK Standard Occupational Classification (SOC 2020) expert. Given a job description or CV text, extract the key occupational information and match it to SOC codes.

You will also receive a list of candidate SOC codes from a database fuzzy search. Your task is to rank the top 3 matches by confidence.

RULES:
- Confidence scores must be between 0.0 and 1.0. Only assign > 0.8 if the match is near-exact.
- Extract concrete skills, not vague terms. "Python" yes, "good communication" no.
- If the text describes multiple roles, match the PRIMARY role only.
- SOC 2020 codes are 4-digit (e.g., 2134 for programmers).

OUTPUT: Respond with valid JSON only:
{
  "extracted_role_summary": "<1-2 sentence summary of the role>",
  "extracted_skills": ["skill1", "skill2", ...],
  "matches": [
    {
      "soc_code": "<4-digit code>",
      "confidence": <float 0.0-1.0>,
      "reasoning": "<why this matches>"
    }
  ]
}"""

SOC_MATCHER_CLASSIFIER_USER = """Input text ({match_type}):
---
{text}
---

Candidate SOC codes from database search:
{candidate_soc_codes}

Classify and rank the top 3 SOC code matches."""
```

### Cover Letter Generator

```
TOOL: Cover Letter Lab — Generator
MODEL: NIM Llama 3.1 405B
TEMPERATURE: 0.6
MAX_TOKENS: 3072
```

```python
COVER_LETTER_GENERATOR_SYSTEM = """You are an expert UK career advisor specialising in visa sponsorship applications. Generate a professional cover letter that addresses the employer's likely concerns about sponsoring an international worker.

RULES:
- Professional British English tone. Formal but not stiff.
- Address sponsorship proactively: emphasize stability, commitment to the UK, and how hiring costs are offset by the candidate's unique value.
- Weave in company-specific data (enrichment facts) naturally — do not just list them.
- Optimize for ATS: incorporate keywords from the job description naturally.
- Length: 350-500 words. Three to four paragraphs.
- Never fabricate qualifications or experience not present in the CV.
- Do not include the candidate's address or date header — just the letter body.
- End with a strong call-to-action.

OUTPUT: Respond with valid JSON only:
{
  "cover_letter": "<full letter text>",
  "key_points_addressed": ["<point 1>", "<point 2>", ...],
  "ats_keywords_matched": ["keyword1", "keyword2", ...],
  "ats_keywords_missing": ["keyword1", ...]
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
```

### Red Flag Analyzer

```
TOOL: Red Flag Scanner — Analyzer
MODEL: Groq Llama 3.1 70B (Light complexity)
TEMPERATURE: 0.2
MAX_TOKENS: 2048
```

```python
RED_FLAG_ANALYZER_SYSTEM = """You are a UK visa sponsorship risk analyst. Given structured data about a company/job listing, assess the risk of applying.

RULES:
- Only flag genuine risks backed by the provided evidence. Never speculate.
- Severity levels: low (minor concern), medium (investigate further), high (significant risk), critical (likely fraudulent or harmful).
- Always include positive signals too — no company is 100% red flags.
- Risk score 0-100: 0 = perfectly safe, 100 = confirmed scam.
- recommendation must be one of: proceed, proceed_with_caution, avoid.
- "avoid" only for risk_score > 70 or any critical flags.

OUTPUT: Respond with valid JSON only:
{
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "risk_score": <int 0-100>,
  "red_flags": [
    {"flag": "<description>", "severity": "low|medium|high|critical", "evidence": "<specific data point>", "source": "<where this was found>"}
  ],
  "safe_signals": [
    {"signal": "<positive indicator>", "evidence": "<data point>"}
  ],
  "recommendation": "proceed|proceed_with_caution|avoid",
  "recommendation_detail": "<2-3 sentences explaining the recommendation>"
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
```

### Route Advisor — Eligibility Analyzer

```
TOOL: Route Advisor — Analyzer
MODEL: NIM Llama 3.1 405B
TEMPERATURE: 0.2
MAX_TOKENS: 3072
```

```python
ROUTE_ADVISOR_ANALYZER_SYSTEM = """You are a UK immigration route advisor. Given a user's profile and the results of rule-based eligibility checks, provide detailed analysis of the best visa routes.

RULES:
- You are NOT a solicitor. Frame all output as informational analysis, not legal advice.
- Strength scores reflect how competitive the applicant is for each route, not just eligibility.
- Timeline estimates should be realistic (include processing times as of 2026).
- Cost estimates should include visa fee + IHS + legal fees estimate.
- Action items must be specific and actionable ("Apply for IELTS test" not "Improve English").
- Routes to consider: Skilled Worker, Innovator Founder, Global Talent, Graduate, Scale-up, High Potential Individual.
- If a route is clearly ineligible, still list it with eligible=false and explain why.

OUTPUT: Respond with valid JSON only:
{
  "routes": [
    {
      "route_name": "<route>",
      "eligible": <bool>,
      "strength_score": <int 0-100>,
      "estimated_timeline_weeks": <int|null>,
      "key_requirements": ["..."],
      "requirements_met": ["..."],
      "requirements_missing": ["..."],
      "pros": ["..."],
      "cons": ["..."],
      "estimated_cost_gbp": <int|null>
    }
  ],
  "recommended_route": "<route name>",
  "recommendation_reasoning": "<2-3 sentences>",
  "action_items": ["<specific action 1>", ...],
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
```

### Endorsement Matcher — Alignment Scorer

```
TOOL: Endorsement Body Matcher — Scorer
MODEL: NIM Llama 3.1 405B
TEMPERATURE: 0.3
MAX_TOKENS: 2048
```

```python
ENDORSEMENT_MATCHER_SCORER_SYSTEM = """You are a UK Innovator Founder visa specialist focused on endorsing body matching. Given a business concept and a list of endorsing bodies with their criteria, score the alignment.

RULES:
- Alignment score 0-100: how well the concept fits the body's stated focus areas and criteria.
- Only score > 70 if there is clear overlap between the concept's sector and the body's focus.
- Application tips must be specific to each body, not generic advice.
- Rejection reasons should be based on known patterns (too early stage, wrong sector, lack of innovation).
- Preparation steps should be concrete actions the applicant can take.

OUTPUT: Respond with valid JSON only:
{
  "matches": [
    {
      "body_id": "<uuid>",
      "alignment_score": <int 0-100>,
      "reasoning": "<why this score>",
      "application_tips": ["..."],
      "common_rejection_reasons": ["..."]
    }
  ],
  "preparation_steps": ["<step 1>", ...],
  "overall_readiness_score": <int 0-100>,
  "readiness_gaps": ["<gap 1>", ...]
}"""

ENDORSEMENT_MATCHER_SCORER_USER = """BUSINESS CONCEPT:
{business_concept}

INDUSTRY: {industry}
INNOVATION ELEMENT: {innovation_element}

ENDORSING BODIES:
{endorsing_bodies_data}

Score alignment and provide recommendations."""
```

---

## Cost Projections

### Assumptions

- **Free tier:** ~500 DAU, 3 uses/day/user = 1,500 tool uses/day
- **Pro tier:** ~100 DAU, 20 uses/day/user = 2,000 tool uses/day
- **Total daily tool uses:** ~3,500
- **Tool distribution** (estimated from user research): Salary Calc 25%, SOC Matcher 15%, Red Flag 15%, Sponsor X-Ray 12%, Cover Letter 10%, Route Advisor 8%, Comparator 5%, Market Heatmap 5%, Idea Forge 3%, Endorsement 2%

### Token Usage Per Tool Call

| Tool | Input Tokens (avg) | Output Tokens (avg) | LLM Calls/Use | Complexity |
|------|-------------------|---------------------|---------------|------------|
| Salary Calculator | 200 | 100 | 1 (SOC matching) | Light |
| SOC Matcher | 800 | 400 | 1 | Light |
| Red Flag Scanner | 2,000 | 800 | 1 | Light |
| Sponsor X-Ray | 3,000 | 1,500 | 2 (scrape + synthesize) | Heavy |
| Cover Letter Lab | 2,500 | 1,200 | 2 (parse + generate) | Heavy |
| Route Advisor | 1,500 | 1,500 | 2 (rules + AI analysis) | Heavy |
| Comparator Pro | 1,200 | 600 | 1 (summary generation) | Light |
| Market Heatmap | 500 | 300 | 0-1 (mostly DB) | Light |
| Idea Forge | 4,000 | 2,500 | 5 (multi-agent) | Heavy |
| Endorsement Matcher | 1,500 | 800 | 1 | Heavy |

### Daily Token Consumption

| Tool | Daily Uses | Input Tokens/Day | Output Tokens/Day | Total Tokens/Day |
|------|-----------|-------------------|--------------------|--------------------|
| Salary Calculator | 875 | 175,000 | 87,500 | 262,500 |
| SOC Matcher | 525 | 420,000 | 210,000 | 630,000 |
| Red Flag Scanner | 525 | 1,050,000 | 420,000 | 1,470,000 |
| Sponsor X-Ray | 420 | 1,260,000 | 630,000 | 1,890,000 |
| Cover Letter Lab | 350 | 875,000 | 420,000 | 1,295,000 |
| Route Advisor | 280 | 420,000 | 420,000 | 840,000 |
| Comparator Pro | 175 | 210,000 | 105,000 | 315,000 |
| Market Heatmap | 175 | 87,500 | 52,500 | 140,000 |
| Idea Forge | 105 | 420,000 | 262,500 | 682,500 |
| Endorsement Matcher | 70 | 105,000 | 56,000 | 161,000 |
| **TOTAL** | **3,500** | **5,022,500** | **2,663,500** | **7,686,000** |

### Monthly Cost Estimates (30 days)

| Provider | Rate (per 1M tokens) | Light Tokens/Month | Heavy Tokens/Month | Monthly Cost |
|----------|---------------------|--------------------|--------------------|--------------|
| **Groq** (free tier) | $0.00 | ~84M (Light tools) | 0 | **$0.00** |
| **Groq** (paid, if free exceeded) | $0.05 input / $0.08 output | ~84M | 0 | **~$5.50** |
| **NVIDIA NIM** | ~$0.30 / 1M tokens | 0 | ~147M (Heavy tools) | **~$44.00** |
| **OpenRouter** (Claude Haiku fallback) | $0.25 input / $1.25 output | 0 | ~10M (fallback 7%) | **~$8.50** |

**Estimated total monthly LLM cost: $44-58**

### Cost Optimization Strategies

1. **Redis caching:** Cache identical tool inputs for 24h. Expected cache hit rate ~15% for Salary Calc and SOC Matcher (common job titles). Saves ~$5/month.
2. **Groq first for Light tools:** Groq free tier covers 14,400 requests/day at 6,000 tokens/min. Our Light tool volume (~2,275/day) fits within free tier.
3. **Prompt compression:** Strip redundant whitespace, use abbreviated field names in system prompts. Target 10% reduction.
4. **Batch SOC matching:** For SOC Matcher, pre-compute embeddings for all ~400 SOC codes and do vector similarity before LLM. Reduces LLM calls by ~40% when confidence > 0.9 from embedding alone.
5. **Progressive LLM usage:** Market Heatmap and Salary Calculator need zero LLM calls in most cases (pure DB aggregation). Only invoke LLM for fuzzy title matching.

---

## Security

### Prompt Injection Prevention

All user-provided text is sanitized before inclusion in LLM prompts:

```python
# backend/app/agents/raw_sanitizer.py

import re

# Patterns that attempt to override system instructions
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)",
    r"you\s+are\s+now\s+a",
    r"system\s*:\s*",
    r"<\|?(system|assistant|user)\|?>",
    r"ADMIN\s+OVERRIDE",
    r"\\n\s*\\n\s*---",
    r"```\s*(system|prompt)",
]

INJECTION_REGEX = re.compile(
    "|".join(INJECTION_PATTERNS), re.IGNORECASE
)

MAX_FIELD_LENGTHS = {
    "idea_description": 2000,
    "text": 5000,           # SOC Matcher / CV text
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
    """Sanitize user input before inserting into LLM prompts.

    1. Enforce max length.
    2. Strip null bytes and control characters (except newlines).
    3. Detect and neuter injection patterns.
    4. Escape any remaining delimiter-like sequences.
    """
    max_len = MAX_FIELD_LENGTHS.get(field_name, 2000)
    text = text[:max_len]

    # Strip null bytes and non-printable control chars (keep \n \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Detect injection attempts — replace with safe placeholder
    if INJECTION_REGEX.search(text):
        # Log the attempt for monitoring
        import logging
        logging.getLogger("raw.security").warning(
            f"Prompt injection attempt detected in field '{field_name}': {text[:100]}..."
        )
        # Neuter the injection by wrapping in quotes (treated as user content)
        text = INJECTION_REGEX.sub("[FILTERED]", text)

    return text
```

### Rate Limiting Bypass Prevention

```python
# Defense-in-depth: rate limiting cannot be bypassed by:

# 1. Changing user-agent or IP — rate limit keyed to authenticated user_id, not IP
# 2. Creating multiple accounts — email verification required; rate limit on
#    account creation (3 per IP per day via Supabase)
# 3. Replaying task_id — task results are scoped to user_id via RLS
# 4. Direct Supabase access — raw_results INSERT policy requires service role;
#    anon/authenticated roles can only SELECT their own rows
# 5. Concurrent requests — Redis INCR is atomic; check-and-increment in a single
#    Lua script to prevent TOCTOU race:

RATE_LIMIT_LUA = """
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
```

### PII Handling

| Data Type | Storage Policy | Implementation |
|-----------|---------------|----------------|
| CV/resume text | **Never stored raw.** Hash after analysis, store only extracted skills and role summary. | `raw_results.input` stores `{"cv_hash": "sha256:...", "extracted_skills": [...]}` not the full CV text. |
| Job description text | Stored in `raw_results.input` (non-PII) | Acceptable — job descriptions are public data. |
| User profile (Route Advisor) | Stored in `raw_results.input` without name/email. | Only nationality, age, qualifications, experience stored. Never linked to real identity beyond user_id. |
| Business ideas | Stored in `raw_results.input` | User consents to storage via tool usage. Deleted on account deletion (GDPR). |
| Cover letters | Stored in `raw_results.output` | Contains user-provided info; deleted on account deletion. |

### Input Validation Rules

| Field | Max Length | Forbidden Patterns | Additional Rules |
|-------|-----------|-------------------|-----------------|
| `idea_description` | 2,000 chars | Injection patterns, URLs > 5 | Must be 100+ chars |
| `cv_text` | 8,000 chars | Injection patterns | Must be 50+ chars |
| `job_url` | 2,000 chars | Non-HTTP(S) schemes | Must match known job board domain regex or be rejected with hint |
| `sponsor_name` | 300 chars | `<script>`, HTML tags | Stripped to alphanumeric + spaces + basic punctuation |
| `salary_min/max` | N/A (int) | N/A | Must be 0-999,999; max >= min |
| `sponsor_ids` | 4 items max | N/A | Must be valid UUIDs; must exist in DB (checked before LLM call) |
| `age` | N/A (int) | N/A | Must be 18-70 |
| `ielts_score` | N/A (float) | N/A | Must be 0.0-9.0, in 0.5 increments |

---

## Monitoring & Alerting

### Prometheus Metrics

All metrics are exposed at `GET /metrics` (internal only, not public) using `prometheus_client`. The existing Railway deployment supports Prometheus scraping.

```python
# backend/app/agents/raw_metrics.py

from prometheus_client import Counter, Histogram, Gauge

# Tool usage counters
RAW_TOOL_REQUESTS = Counter(
    "raw_tool_requests_total",
    "Total RAW tool requests",
    ["tool_name", "status", "user_plan"],  # status: success, error, rate_limited
)

RAW_TOOL_DURATION = Histogram(
    "raw_tool_duration_seconds",
    "RAW tool end-to-end latency",
    ["tool_name"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60, 120],
)

# LLM provider metrics
LLM_REQUEST_DURATION = Histogram(
    "raw_llm_request_duration_seconds",
    "LLM API call latency",
    ["provider", "model", "tool_name"],
    buckets=[0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
)

LLM_REQUESTS = Counter(
    "raw_llm_requests_total",
    "Total LLM API calls",
    ["provider", "model", "status"],  # status: success, error, timeout, rate_limited
)

LLM_TOKENS = Counter(
    "raw_llm_tokens_total",
    "Total LLM tokens consumed",
    ["provider", "direction"],  # direction: input, output
)

LLM_FALLBACKS = Counter(
    "raw_llm_fallbacks_total",
    "LLM provider fallback events",
    ["from_provider", "to_provider", "reason"],
)

# Rate limiting
RATE_LIMIT_HITS = Counter(
    "raw_rate_limit_hits_total",
    "Rate limit 429 responses served",
    ["user_plan"],
)

# Cache metrics
CACHE_HITS = Counter(
    "raw_cache_hits_total",
    "Redis cache hits for tool results",
    ["tool_name"],
)

CACHE_MISSES = Counter(
    "raw_cache_misses_total",
    "Redis cache misses",
    ["tool_name"],
)

# Active tasks gauge
ACTIVE_CELERY_TASKS = Gauge(
    "raw_active_celery_tasks",
    "Currently processing background tasks",
    ["tool_name"],
)
```

### Key SLIs and Alert Thresholds

| Metric | SLI | Warning Threshold | Critical Threshold | Alert Channel |
|--------|-----|-------------------|-------------------|---------------|
| LLM p50 latency | `histogram_quantile(0.5, raw_llm_request_duration_seconds)` | > 2s | > 5s | Discord webhook |
| LLM p95 latency | `histogram_quantile(0.95, raw_llm_request_duration_seconds)` | > 8s | > 15s | Discord webhook |
| LLM p99 latency | `histogram_quantile(0.99, raw_llm_request_duration_seconds)` | > 15s | > 30s | Discord webhook |
| LLM error rate | `rate(raw_llm_requests_total{status="error"}[5m])` | > 5% | > 15% | Discord webhook |
| Tool error rate | `rate(raw_tool_requests_total{status="error"}[5m])` | > 3% | > 10% | Discord webhook |
| Fallback rate | `rate(raw_llm_fallbacks_total[5m])` | > 10% | > 30% | Discord webhook |
| Rate limit hits/min | `rate(raw_rate_limit_hits_total[1m])` | > 50/min | > 200/min | Log only |
| Active Celery tasks | `raw_active_celery_tasks` | > 20 | > 50 | Discord webhook |
| Tool completion time p95 | `histogram_quantile(0.95, raw_tool_duration_seconds)` | > 30s (fast tools) | > 120s (slow tools) | Discord webhook |

### Admin Dashboard Integration

The existing admin page at `/admin` (using components in `frontend/src/components/admin/`) is extended with a new `RAWHealth.tsx` component showing:

1. **Real-time tool usage** — Bar chart of tool invocations in last 24h, grouped by tool name
2. **LLM provider status** — Green/amber/red indicators for NIM, Groq, OpenRouter (based on error rate)
3. **Latency sparklines** — Inline sparklines (reusing `frontend/src/components/ui/Sparkline.tsx`) for p50 latency per tool over last 6h
4. **Rate limit pressure** — Percentage of free users hitting rate limit today
5. **Cost tracker** — Estimated daily LLM spend based on token counters (NIM tokens * $0.30/1M + OpenRouter tokens * rate)
6. **Error log** — Last 20 tool errors with tool name, error type, timestamp, and user plan

API endpoints for admin metrics:
```
GET /api/v1/admin/raw/metrics      → Aggregated Prometheus metrics as JSON
GET /api/v1/admin/raw/errors       → Recent errors (last 100)
GET /api/v1/admin/raw/usage-stats  → Daily/weekly usage breakdown by tool and plan
```

---

## PDF Export Layout

Every RAW tool result can be exported as a PDF via `GET /api/v1/raw/export/{result_id}?format=pdf`. PDFs are generated server-side using `weasyprint` (already in `requirements.txt` dependency chain) from an HTML template.

### Common Layout (all tools)

```
+------------------------------------------------------------------+
|  [SponsorIntel Logo]     RESEARCH & ANALYSIS WING                |
|  Tool: {tool_name}       Generated: {timestamp}                  |
|  User: {user_email}      Result ID: {result_id}                  |
+------------------------------------------------------------------+
|                                                                    |
|  {TOOL-SPECIFIC CONTENT — see below}                              |
|                                                                    |
+------------------------------------------------------------------+
|  DISCLAIMER: This report is generated by AI analysis and          |
|  should not be treated as legal or immigration advice.            |
|  Data accuracy depends on third-party sources. Always verify      |
|  critical information with official government resources at       |
|  gov.uk. SponsorIntel is not a law firm or immigration advisor.  |
|                                                                    |
|  Generated by SponsorIntel RAW | sponsorintel.london              |
|  Page {n} of {total}                                              |
+------------------------------------------------------------------+
```

### Tool-Specific Sections

**Idea Forge:**
- Page 1: Viability Score (large circular gauge), Score Breakdown (5-bar horizontal chart), Market Size callout
- Page 2: Competitor Table (5 rows, columns: Name, Strengths, Weaknesses, Est. Market Share)
- Page 3: SWOT 2x2 grid, Regulatory Requirements checklist
- Page 4: Endorsing Bodies ranked list, Next Steps numbered list

**Sponsor X-Ray:**
- Page 1: Trust Score (large gauge), Trust Breakdown (radar chart with 6 axes), Sponsor Header (name, location, rating)
- Page 2: Financial Health table, Visa Track Record callout
- Page 3: Hiring Activity (line chart for 3-month trend, top roles list, salary range bar)
- Page 4: Employee Sentiment highlights, Red Flags (red-bordered boxes), Positive Signals (green-bordered)

**Salary Calculator:**
- Page 1 (single page): SOC Code match callout, Threshold vs. Going Rate vs. Median (3-column comparison), Shortage status badge, Salary Distribution histogram, Top Sponsors table (up to 10 rows)

**SOC Matcher:**
- Page 1 (single page): Top 3 Matches (confidence bar for each), Skills Gap Venn diagram (matched / missing / extra), Sponsor counts per SOC code

**Comparator Pro:**
- Pages 1-2: Full comparison table with color-coded best values. Dimension categories as section headers. Winner summary at top.

**Route Advisor:**
- Page 1: Recommended Route (large callout with reasoning), Profile Strength gauge
- Page 2: Route comparison table (rows: requirements met/missing, timeline, cost, pros/cons)
- Page 3: Action Items checklist, Relevant Sponsors table

**Cover Letter Lab:**
- Page 1: Full cover letter text (print-optimized typography)
- Page 2: ATS Score gauge, Keywords matched/missing lists, Company talking points

**Red Flag Scanner:**
- Page 1: Risk Level badge (color-coded: green/amber/orange/red), Risk Score gauge, Recommendation callout
- Page 2: Red Flags table (columns: Flag, Severity, Evidence, Source), Safe Signals list
- Page 3: Alternative sponsors table (if applicable)

**Market Heatmap:**
- Page 1: Static rendered map image (Leaflet screenshot via Puppeteer or SVG fallback), Top 5 Cities table
- Page 2: Regional comparison table, Salary comparison bar chart

**Endorsement Matcher:**
- Page 1: Readiness Score gauge, Top Matches (ranked cards with alignment bars)
- Page 2: Per-body detail cards (focus areas, tips, rejection reasons)
- Page 3: Preparation Steps checklist, Readiness Gaps

---

## Error States

Each tool defines specific error messages with recovery guidance. Error responses follow the format:

```json
{
  "error_code": "string",
  "error_message": "Human-readable message",
  "recovery_hint": "What the user can do next",
  "partial_result": null | { ... }
}
```

### Tool 1: Idea Forge

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `IDEA_TOO_SHORT` | "Business idea must be at least 100 characters. Provide more detail about your concept." | "Describe what the business does, who it serves, and what makes it different." |
| `MARKET_RESEARCH_FAILED` | "Unable to gather market data for this industry." | "Try a more specific industry term, or provide additional context about your target market." |
| `COMPETITOR_SCAN_TIMEOUT` | "Competitor analysis timed out." | Partial result returned with market + regulatory data. "Competitor section will show as unavailable." |
| `ALL_AGENTS_FAILED` | "Analysis pipeline encountered multiple failures." | "Please try again in a few minutes. If the problem persists, simplify your idea description." |

### Tool 2: Sponsor X-Ray

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `SPONSOR_NOT_FOUND` | "'{name}' not found in our sponsor database." | "Check the spelling, or try the company's full legal name (e.g., 'Company Name Limited'). We will scan Companies House live for unregistered sponsors in a future update." |
| `COMPANIES_HOUSE_UNAVAILABLE` | "Companies House API is temporarily unavailable." | Partial result returned without financial data. "Financial health section based on cached data." |
| `SCRAPE_BLOCKED` | "Live review data unavailable (anti-bot protection)." | "Employee sentiment shown from cached enrichment data collected on {date}." |

### Tool 3: Salary Threshold Calculator

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `SOC_NOT_FOUND` | "Could not match '{title}' to a SOC code." | "Try broader terms (e.g., 'Software Developer' instead of 'Senior React Native Engineer'). Or use the SOC Matcher tool for a more detailed match." |
| `NO_SALARY_DATA` | "No salary data available for this SOC code in this location." | "Try removing the location filter to see national data, or check a nearby city." |
| `ROUTE_NOT_SUPPORTED` | "Salary thresholds are not applicable for the {route} visa route." | "Salary thresholds apply to Skilled Worker and Scale-up routes. Global Talent has no salary requirement." |

### Tool 4: SOC Code Matcher

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `TEXT_TOO_SHORT` | "Input text must be at least 20 characters." | "Paste a full job description or the relevant section of your CV." |
| `NO_MATCHES` | "Could not find relevant SOC codes for this text." | "The text may be too generic or describe a role not in the UK SOC 2020 taxonomy. Try including specific job responsibilities." |
| `LOW_CONFIDENCE` | "All matches have low confidence (< 0.5)." | "The role described may span multiple SOC codes. Consider narrowing the description to one primary function." |

### Tool 5: Comparator Pro

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `SPONSOR_NOT_FOUND` | "One or more sponsors not found: {names}." | "Check spelling or use the search page to find exact sponsor names." |
| `INSUFFICIENT_DATA` | "Comparison requires enrichment data. {name} has not been enriched yet." | "This sponsor has minimal data. The comparison will proceed with available fields, but some dimensions will show 'N/A'." |
| `TOO_FEW_SPONSORS` | "Comparison requires at least 2 sponsors." | "Add at least one more sponsor to compare." |

### Tool 6: Route Advisor

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `INVALID_PROFILE` | "Profile is incomplete. Required: nationality, age, qualification, experience, current role." | "Fill in all required fields. Optional fields improve accuracy but are not required." |
| `AGE_OUT_OF_RANGE` | "Age must be between 18 and 70." | "If you are under 18, most work visa routes are not available. Consider student visa routes." |
| `ANALYSIS_PARTIAL` | "AI analysis partially completed." | Partial result returned with rule-based checks only. "AI-powered strength scores and recommendations may be less detailed." |

### Tool 7: Cover Letter Lab

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `SCRAPE_FAILED` | "Could not scrape job listing from {domain}." | "Paste the job description text directly instead of providing a URL." |
| `URL_NOT_SUPPORTED` | "We cannot scrape listings from {domain}." | "LinkedIn and Glassdoor block automated access. Please copy the job description text and paste it." |
| `CV_TOO_SHORT` | "CV text must be at least 50 characters." | "Paste the relevant sections of your CV: summary, experience, skills, and education." |
| `NO_SPONSOR_MATCH` | "Company not found in sponsor database." | "The cover letter will be generated without sponsor-specific insights. Verify that this employer holds a sponsor licence." |

### Tool 8: Red Flag Scanner

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `NO_IDENTIFIABLE_COMPANY` | "Could not identify a company from the provided input." | "Provide a direct sponsor name, or paste a job listing that includes the employer name." |
| `RECENTLY_REMOVED` | "This sponsor was removed from the register on {date}." | "This is a critical red flag. The company can no longer sponsor new visas. See alternatives below." |
| `COMPANIES_HOUSE_NO_MATCH` | "No Companies House record found for '{name}'." | "The company may trade under a different legal name, or may not be UK-registered. This is a medium risk flag." |

### Tool 9: Market Heatmap

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `NO_MATCHING_SPONSORS` | "No sponsors found matching industry '{industry}' with role '{role}'." | "Try a broader industry category or a more common job title." |
| `INSUFFICIENT_GEO_DATA` | "Not enough geographic data to render a heatmap." | "Most sponsors in this niche lack location data. Try selecting 'Technology' or 'Healthcare' which have better coverage." |

### Tool 10: Endorsement Matcher

| Error Code | Message | Recovery Hint |
|-----------|---------|--------------|
| `CONCEPT_TOO_VAGUE` | "Business concept needs more specificity to match endorsing bodies." | "Include: what the product/service is, who it serves, what technology it uses, and what makes it innovative." |
| `NO_MATCHING_BODIES` | "No endorsing bodies found with strong alignment to this concept." | "Your concept may not fit the Innovator Founder visa criteria. Consider the Route Advisor tool for alternative visa routes." |

---

## Accessibility

All RAW components must meet WCAG 2.1 AA compliance. The existing component library (`frontend/src/components/ui/`) already supports dark/light themes. RAW extends these requirements.

### Keyboard Navigation

**Tool Grid (`ToolGrid.tsx`):**
- Tool cards are focusable (`tabIndex={0}`) and activated with Enter or Space.
- Arrow keys navigate between cards in the grid (left/right within row, up/down between rows).
- Focus wraps: pressing right on the last card in a row moves to the first card of the next row.
- `Escape` from a focused card returns focus to the grid container.

```typescript
// Keyboard handler for tool grid
const handleGridKeyDown = (e: React.KeyboardEvent, index: number) => {
  const cols = 5; // 5 columns in desktop grid, 2 in mobile
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      focusCard(Math.min(index + 1, tools.length - 1));
      break;
    case 'ArrowLeft':
      e.preventDefault();
      focusCard(Math.max(index - 1, 0));
      break;
    case 'ArrowDown':
      e.preventDefault();
      focusCard(Math.min(index + cols, tools.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusCard(Math.max(index - cols, 0));
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      selectTool(tools[index].name);
      break;
    case 'Escape':
      e.preventDefault();
      gridRef.current?.focus();
      break;
  }
};
```

**Tool Workspace (`ToolWorkspace.tsx`):**
- When a tool workspace expands, focus moves to the workspace heading (h2) via `useEffect` + `ref.focus()`.
- All form inputs have associated `<label>` elements (no placeholder-only labels).
- Submit button is reachable via Tab from the last form field.
- `Escape` closes the workspace and returns focus to the originating tool card.
- Tab trapping within modals (e.g., export dialog).

**Result History (`ResultHistory.tsx`):**
- Table rows are navigable with arrow keys.
- Enter on a row expands the result detail.
- Sort headers are buttons with `aria-sort` attributes.

### Screen Reader Announcements

**Progress Updates:**
- Tool progress uses `aria-live="polite"` region that announces step changes.
- Percentage is announced at 25%, 50%, 75%, and 100% completion (not every 2-second poll).
- Completion announced with `aria-live="assertive"`: "Idea Forge analysis complete. Viability score: 74 out of 100."

```tsx
{/* Progress announcer */}
<div aria-live="polite" className="sr-only">
  {progress >= 25 && prevProgress < 25 && `${toolName}: 25% complete. ${stepDescription}`}
  {progress >= 50 && prevProgress < 50 && `${toolName}: 50% complete. ${stepDescription}`}
  {progress >= 75 && prevProgress < 75 && `${toolName}: 75% complete. ${stepDescription}`}
</div>
<div aria-live="assertive" className="sr-only">
  {status === 'completed' && `${toolName} analysis complete. ${resultSummary}`}
  {status === 'failed' && `${toolName} analysis failed. ${errorMessage}`}
</div>
```

**Error States:**
- Error messages use `role="alert"` for immediate announcement.
- Recovery hints are associated via `aria-describedby`.

**Score Announcements:**
- All scores (viability, trust, risk, ATS) include text alternatives: `aria-label="Viability score 74 out of 100"`.
- Radar/gauge charts include a `<table>` fallback with `aria-hidden="true"` on the visual chart.

### Focus Management

| User Action | Focus Target |
|-------------|-------------|
| Click/Enter on tool card | Workspace heading (`<h2>`) |
| Close workspace (Escape or X button) | Original tool card |
| Tool result loads | First section heading of the result |
| Error occurs | Error message container (`role="alert"`) |
| Open PDF export dialog | Dialog heading, trap focus within dialog |
| Close PDF export dialog | Export button that triggered it |
| Navigate to result history | First result row |
| Rate limit reached | Rate limit message (`role="alert"`), with focus on upgrade link |

### Color Contrast

All RAW-specific UI elements meet WCAG 2.1 AA minimum contrast ratios (4.5:1 for normal text, 3:1 for large text):

| Element | Light Mode | Dark Mode | Contrast Ratio |
|---------|-----------|-----------|---------------|
| Risk: LOW badge | `#166534` on `#dcfce7` | `#86efac` on `#14532d` | 7.2:1 / 5.8:1 |
| Risk: MEDIUM badge | `#854d0e` on `#fef9c3` | `#fde047` on `#713f12` | 6.1:1 / 5.4:1 |
| Risk: HIGH badge | `#c2410c` on `#ffedd5` | `#fb923c` on `#7c2d12` | 5.5:1 / 4.8:1 |
| Risk: CRITICAL badge | `#991b1b` on `#fee2e2` | `#fca5a5` on `#7f1d1d` | 6.8:1 / 5.1:1 |
| Score gauge fill (positive) | `#2563eb` | `#60a5fa` | 4.6:1 / 4.5:1 |
| Score gauge fill (negative) | `#dc2626` | `#f87171` | 5.2:1 / 4.7:1 |
| Comparison "best" highlight | `#15803d` on `#f0fdf4` | `#86efac` on `#052e16` | 5.9:1 / 6.3:1 |
| Unavailable section | `#6b7280` on `#f3f4f6` | `#9ca3af` on `#1f2937` | 4.6:1 / 4.5:1 |

**Non-color indicators:** All color-coded elements also use secondary indicators:
- Risk badges include icons: checkmark (LOW), warning triangle (MEDIUM), exclamation (HIGH), skull-crossbones (CRITICAL).
- Comparison "best" cells include a small trophy icon alongside green highlighting.
- Unavailable sections use a dashed border pattern in addition to gray coloring.
- Score gauges include the numeric value as text, never relying solely on the fill color.
