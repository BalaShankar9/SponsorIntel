# Intel — Immigration Intelligence Hub

**Date:** 2026-03-22
**Status:** Approved
**Page Route:** `/intel`

## Purpose

A real-time immigration news and policy tracker. AI agents continuously scan every relevant source so users never miss a change that affects their visa route, industry, or nationality.

## Source Architecture

### Official Government Sources
| Source | URL Pattern | Scan Frequency | Method |
|--------|------------|----------------|--------|
| GOV.UK Immigration Rules | gov.uk/guidance/immigration-rules | 15 min | RSS + page diff |
| Home Office News | gov.uk/government/organisations/home-office | 15 min | RSS |
| UKVI Updates | gov.uk/government/organisations/uk-visas-and-immigration | 15 min | RSS |
| Parliament Hansard | hansard.parliament.uk (immigration debates) | 1 hour | API |
| MAC Reports | gov.uk/government/organisations/migration-advisory-committee | 1 hour | RSS |
| ONS Migration Stats | ons.gov.uk/peoplepopulationandcommunity/populationandmigration | 6 hours | RSS |
| Home Office Statistics | gov.uk/government/collections/immigration-statistics-quarterly-release | 6 hours | Page scrape |

### Legal & Expert Sources
| Source | Scan Frequency | Method |
|--------|----------------|--------|
| Free Movement Blog (freemovement.org.uk) | 30 min | RSS |
| ILPA Bulletins (ilpa.org.uk) | 1 hour | Page scrape |
| Colin Yeo / Immigration Barrister blogs | 1 hour | RSS |
| Upper Tribunal Decisions (judiciary.uk) | 1 hour | Page scrape |
| Law Society Immigration Updates | 2 hours | RSS |

### News Media
| Source | Keywords Filter | Scan Frequency | Notes |
|--------|----------------|----------------|-------|
| BBC News | immigration, visa, sponsor, home office, migration | 15 min | RSS feed |
| The Guardian | immigration, visa, skilled worker, points-based | 15 min | RSS feed |
| Reuters UK | UK immigration, visa policy | 30 min | RSS feed |
| Financial Times | UK visa, immigration policy, skilled worker | 30 min | **Headlines + snippets only** (paywalled — use FT RSS which provides title + 1-2 sentence summary) |
| The Times | immigration, visa, home office | 30 min | RSS feed |

### Community Sources
| Source | Method | Scan Frequency | Notes |
|--------|--------|----------------|-------|
| Reddit r/ukvisa | Reddit API (OAuth2) | 15 min | Requires `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` env vars |
| Reddit r/iwantout (UK-filtered) | Reddit API (OAuth2) | 30 min | Filter posts containing "UK" keywords |
| OISC registered advisors blogs | RSS aggregation | 2 hours | |

**Dropped source:** X/Twitter was originally planned but dropped due to API cost ($5,000/month for Pro tier search access). If a free/affordable alternative emerges, re-evaluate.

## Agent Architecture

### Deployment Model

Intel agents run as **Celery Beat scheduled tasks** within the existing Celery infrastructure (not separate Railway containers). This avoids 8 additional Railway container costs and leverages the existing beat scheduler at `backend/app/tasks/schedule.py`.

New Celery task module: `backend/app/tasks/intel_tasks.py`

Add to `celery_app.py` include list and define beat schedules.

### Scanner Tasks

```
intel_scan_gov()      — Scans all government sources (15 min beat)
intel_scan_legal()    — Scans legal blogs, tribunal decisions (30 min beat)
intel_scan_news()     — Scans BBC, Guardian, Reuters, FT, Times (15 min beat)
intel_scan_social()   — Scans Reddit, community forums (15 min beat)
```

Each scanner:
1. Fetches new content since last scan (tracked via `last_scan_at` in `source_health_log` table)
2. Filters for immigration relevance (keyword matching first, AI classification for ambiguous items)
3. Extracts: title, source, URL, published_at, full_text (or snippet for paywalled), category
4. Writes to `intel_items` table with status `raw`

### Classifier Task

`intel_classify()` — runs every 5 minutes on new `raw` items:
1. Categorizes by topic: `rule_change`, `policy_update`, `court_decision`, `statistics`, `opinion`, `news`, `community`
2. Tags visa routes affected: Skilled Worker, Innovator Founder, Graduate, Global Talent, Family, etc.
3. Tags nationalities affected (if specific)
4. Tags industries affected (if specific)
5. Assigns impact level: `critical`, `high`, `medium`, `low`
6. Updates status to `classified`

**LLM model:** Groq Llama 3.1 70B (fast, cheap — classification is a light task). Estimated ~500 tokens/item, ~100 items/day = ~50K tokens/day.

### Impact Analyzer Task

`intel_analyze()` — runs on `classified` items with impact >= `medium`:
1. Generates plain-English "What this means" summary (2-3 sentences)
2. Generates "Who is affected" list
3. Generates "Action required" (if any)
4. For rule changes: generates before/after diff summary
5. Updates status to `analyzed`

**LLM model:** NVIDIA NIM Llama 3.1 405B (needs deeper understanding for analysis). Estimated ~2000 tokens/item, ~30 medium+ items/day = ~60K tokens/day.

### Dedup Task

`intel_dedup()` — runs every 15 minutes:
1. Groups items by similarity using PostgreSQL `pg_trgm` extension: `similarity(a.title, b.title) > 0.6`
2. Only compares items within a 48-hour window (prevents O(n^2) on full table)
3. Merges duplicates: keeps earliest, aggregates sources into array
4. Updates `dedup_cluster_id` on merged items, sets merged items status to `deduped`

### Error Handling & Resilience

**Per-source circuit breaker:**
- Track consecutive failures per source in `source_health_log`
- After 3 consecutive failures: back off to 4x normal scan interval
- After 10 consecutive failures: disable source, alert admin
- On next success: reset failure count and restore normal interval

**Retry policy:**
- HTTP errors: retry 3 times with exponential backoff (2s, 4s, 8s)
- Parse errors (HTML structure changed): log error, skip item, alert admin to update parser
- LLM errors: retry with fallback provider (Groq → NIM → OpenRouter)

**Admin visibility:** Scanner health displayed in admin dashboard via existing `CircuitBreaker.tsx` component pattern.

## Database Schema

### Table: `intel_items`
```sql
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

-- Auto-update updated_at
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
```

**Data retention:** Delete `content_text` (full article body) after 90 days, keeping only `content_snippet` and AI-generated `summary`. Run weekly cleanup task. Estimated storage: ~50MB/month for raw content.

### Table: `intel_policies`
```sql
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

-- User follows for policies
CREATE TABLE intel_policy_follows (
    user_id UUID NOT NULL REFERENCES users(id),
    policy_id UUID NOT NULL REFERENCES intel_policies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, policy_id)
);
```

### Table: `intel_subscriptions`
```sql
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
```

### Table: `intel_notifications`
```sql
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
```

**Email delivery:** Use Resend (already in Vercel marketplace) for email notifications. `email_instant` sends within 5 minutes of a `critical` or `high` impact item matching the subscription. `email_digest` is a weekly Monday 6am batch.

### Table: `intel_calendar`
```sql
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
```

### Table: `intel_statistics`
```sql
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


### RLS Policies

```sql
-- intel_items: public read (analyzed items only), service role write
ALTER TABLE intel_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read analyzed items" ON intel_items FOR SELECT
    USING (status IN ('classified', 'analyzed'));
CREATE POLICY "Service role manages items" ON intel_items FOR ALL USING (true);

-- intel_policies: public read, service role write
ALTER TABLE intel_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read policies" ON intel_policies FOR SELECT USING (true);
CREATE POLICY "Service role manages policies" ON intel_policies FOR ALL USING (true);

-- intel_policy_follows: user-scoped
ALTER TABLE intel_policy_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON intel_policy_follows FOR ALL USING (auth.uid() = user_id);

-- intel_subscriptions: user-scoped
ALTER TABLE intel_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON intel_subscriptions FOR ALL USING (auth.uid() = user_id);

-- intel_notifications: user-scoped read, service role write
ALTER TABLE intel_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON intel_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON intel_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts notifications" ON intel_notifications FOR INSERT WITH CHECK (true);

-- intel_calendar: public read, service role write
ALTER TABLE intel_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read calendar" ON intel_calendar FOR SELECT USING (true);
CREATE POLICY "Service role manages calendar" ON intel_calendar FOR ALL USING (true);

-- intel_statistics: public read, service role write
ALTER TABLE intel_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read statistics" ON intel_statistics FOR SELECT USING (true);
CREATE POLICY "Service role manages statistics" ON intel_statistics FOR ALL USING (true);

```

## Configuration Requirements

Add to `backend/app/core/config.py`:
```python
# Reddit API (for intel social scanner)
reddit_client_id: str = ""
reddit_client_secret: str = ""

# Resend (for email notifications)
resend_api_key: str = ""
```

Add to Railway environment variables for the main backend service.

## Frontend Features

### 1. Live Feed (`/intel`)
- Scrolling feed of analyzed intel items, loaded via paginated API
- **Real-time updates:** Supabase Realtime `postgres_changes` subscription on `intel_items` table (filter: `status=eq.analyzed`). New items prepend to feed with cyan flash animation.
- Filter sidebar: by topic, impact level, visa route, nationality, date range
- Each card shows: title, source badge, impact badge, timestamp, summary snippet
- Click to expand: full analysis, who affected, action required, source link

### 2. Impact Assessment
- When user has a profile set (visa route, nationality, industry from `user_profiles` table — defined in UI/UX spec), items get personalized relevance score
- "Relevant to you" filter shows only items matching user's profile
- Personalized daily briefing card at top of feed

### 3. Rule Change Timeline (`/intel/timeline`)
- Horizontal timeline visualization
- Nodes for each rule change with before/after diff
- Filter by visa route
- Click node to see full details

### 4. Alert Subscriptions
- Subscribe to specific topics/routes/nationalities
- Get notified via in-app notification (stored in `intel_notifications`) or email (via Resend)
- Configure minimum impact level for alerts
- **Access tiers:** Free users: 1 subscription (in-app only). Pro users: unlimited subscriptions, email notifications. Enterprise: API webhooks.

### 5. Weekly Digest
- AI-generated email every Monday 6am via Celery Beat task
- Top 5 most important changes
- Statistics updates
- Upcoming calendar events
- Personalized to user's profile
- Uses Resend for delivery

### 6. Immigration Calendar (`/intel/calendar`)
- Monthly calendar view
- Key dates: next rule changes, MAC reviews, SOL reviews, statistics releases
- Filterable by visa route
- Auto-populated by scanning official announcement dates

### 7. Statistics Dashboard (`/intel/stats`)
- Visa grant rates by route and nationality
- Processing times (current vs. historical)
- Refusal rates with trends
- Auto-updated when Home Office publishes quarterly data
- Charts: line trends, bar comparisons, tables

### 8. Policy Tracker (`/intel/policies`)
- Track specific policies through lifecycle stages (from `intel_policies` table)
- Stages: proposed, consultation, parliamentary_debate, enacted, effective
- Each policy card shows: status, timeline, affected routes, latest update
- Users can "follow" specific policies for notifications (via `intel_policy_follows`)


## Frontend Components

```
src/app/intel/page.tsx               — Main Intel page (Live Feed)
src/app/intel/timeline/page.tsx      — Rule Change Timeline
src/app/intel/calendar/page.tsx      — Immigration Calendar
src/app/intel/stats/page.tsx         — Statistics Dashboard
src/app/intel/policies/page.tsx      — Policy Tracker
src/components/intel/IntelFeed.tsx    — Live feed component
src/components/intel/IntelCard.tsx    — Individual intel item card
src/components/intel/IntelFilters.tsx — Filter sidebar
src/components/intel/ImpactBadge.tsx  — Impact level badge
src/components/intel/Timeline.tsx     — Horizontal timeline
src/components/intel/Calendar.tsx     — Calendar view
src/components/intel/StatsPanel.tsx   — Statistics charts
src/components/intel/PolicyCard.tsx   — Policy tracker card
src/components/intel/DigestPreview.tsx — Weekly digest preview
src/components/intel/SubscribeForm.tsx — Alert subscription form
```

## Backend Routes

```
GET  /api/v1/intel/feed                — Paginated feed with filters (query params: topic, impact, visa_route, nationality, date_from, date_to, page, per_page)
GET  /api/v1/intel/item/{id}           — Single item detail
GET  /api/v1/intel/timeline            — Rule changes for timeline (query: visa_route, date range)
GET  /api/v1/intel/calendar            — Calendar events (query: month, visa_route)
GET  /api/v1/intel/stats               — Statistics data
GET  /api/v1/intel/stats/{route}       — Stats for specific visa route
GET  /api/v1/intel/policies            — Active policies (query: stage, visa_route)
POST /api/v1/intel/policies/{id}/follow  — Follow a policy (auth required)
DELETE /api/v1/intel/policies/{id}/follow — Unfollow a policy (auth required)
POST /api/v1/intel/subscribe           — Create subscription (auth required)
GET  /api/v1/intel/subscriptions       — User's subscriptions (auth required)
DELETE /api/v1/intel/subscriptions/{id} — Delete subscription (auth required)
GET  /api/v1/intel/notifications       — User's notifications (auth required, query: is_read, page)
PATCH /api/v1/intel/notifications/{id}/read — Mark notification as read
POST /api/v1/intel/digest/preview      — Preview weekly digest (auth required)
```

## Build Order

1. Database tables (Supabase migration) + RLS policies + enable Realtime on `intel_items`
2. Add Reddit API credentials to config, Resend API key
3. Scanner task for GOV.UK (easiest, most important source) — add to Celery Beat schedule
4. Frontend: Intel feed page with basic cards + Supabase Realtime subscription
5. Classifier + Impact Analyzer tasks — add to Celery Beat schedule
6. Scanner tasks for remaining sources (legal, news, social)
7. Frontend: filters, impact badges, expand/collapse
8. Dedup task
9. Calendar page + seed initial calendar events from GOV.UK announcements
10. Statistics dashboard + auto-update task when Home Office publishes quarterly data
11. Policy tracker (intel_policies table + frontend)
12. Rule Change Timeline visualization
13. Notification system (intel_notifications table + in-app display)
14. Subscription system + notification matching logic
15. Email notifications via Resend (instant + digest)
16. Personalized relevance scoring (depends on user_profiles from UI/UX spec)

---

## Pydantic Schemas

All schemas use Pydantic V2 syntax (`model_validator`, `field_validator`, `ConfigDict`). File location: `backend/app/schemas/intel.py`.

```python
"""Intel feature Pydantic V2 schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

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


# ---- Intel Item ----

class IntelItemBase(BaseModel):
    """Shared fields for intel items."""
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
            raise ValueError(f"source_category must be one of: government, legal, news, community")
        return v


class IntelItemSummary(IntelItemBase):
    """Lightweight item returned in feed listings."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    topic: Optional[IntelTopic] = None
    impact_level: Optional[ImpactLevel] = None
    visa_routes_affected: Optional[list[str]] = None
    summary: Optional[str] = None
    status: str
    created_at: datetime


class IntelItemDetail(IntelItemSummary):
    """Full item returned on GET /intel/item/{id}."""
    content_text: Optional[str] = None
    nationalities_affected: Optional[list[str]] = None
    industries_affected: Optional[list[str]] = None
    who_affected: Optional[str] = None
    action_required: Optional[str] = None
    before_after: Optional[dict] = None
    dedup_cluster_id: Optional[uuid.UUID] = None
    scanner_agent: Optional[str] = None
    updated_at: datetime


# ---- Feed Response ----

class IntelFeedResponse(BaseModel):
    """Paginated feed response."""
    data: list[IntelItemSummary]
    total: int
    page: int = Field(..., ge=1)
    pages: int = Field(..., ge=0)
    per_page: int = Field(20, ge=1, le=100)


class IntelFeedQuery(BaseModel):
    """Query params for GET /intel/feed."""
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


# ---- Timeline ----

class TimelineNode(BaseModel):
    """Single node on the rule-change timeline."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    published_at: Optional[datetime] = None
    impact_level: Optional[ImpactLevel] = None
    visa_routes_affected: Optional[list[str]] = None
    summary: Optional[str] = None
    before_after: Optional[dict] = None


class TimelineResponse(BaseModel):
    """Response for GET /intel/timeline."""
    nodes: list[TimelineNode]
    total: int


# ---- Calendar ----

class IntelCalendarEvent(BaseModel):
    """Single calendar event."""
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
    """Response for GET /intel/calendar."""
    events: list[IntelCalendarEvent]
    month: int = Field(..., ge=1, le=12)
    year: int


# ---- Statistics ----

class IntelStatistic(BaseModel):
    """Single statistic row."""
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
    """Response for GET /intel/stats."""
    statistics: list[IntelStatistic]
    total: int
    visa_route: Optional[str] = None


# ---- Policy Tracker ----

class PolicyResponse(BaseModel):
    """Single policy in the tracker."""
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
    is_followed: bool = False  # populated per-user in the API layer

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        if v not in VALID_STAGES:
            raise ValueError(f"stage must be one of: {VALID_STAGES}")
        return v


class PolicyListResponse(BaseModel):
    """Response for GET /intel/policies."""
    policies: list[PolicyResponse]
    total: int


# ---- Subscriptions ----

class SubscriptionCreate(BaseModel):
    """Request body for POST /intel/subscribe."""
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
    """Subscription as returned from the API."""
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


# ---- Notifications ----

class NotificationResponse(BaseModel):
    """Single notification."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    intel_item_id: Optional[uuid.UUID] = None
    subscription_id: Optional[uuid.UUID] = None
    title: str = Field(..., max_length=500)
    body: Optional[str] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime
    # Denormalized from intel_item for display without join
    item_impact_level: Optional[ImpactLevel] = None
    item_source_name: Optional[str] = None


class NotificationListResponse(BaseModel):
    """Paginated notifications."""
    notifications: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    pages: int


# ---- Digest ----

class DigestSection(BaseModel):
    """One section of the weekly digest."""
    heading: str
    items: list[IntelItemSummary]


class DigestPreviewResponse(BaseModel):
    """Response for POST /intel/digest/preview."""
    subject: str
    generated_at: datetime
    top_items: list[IntelItemSummary]
    statistics_snapshot: list[IntelStatistic]
    upcoming_calendar: list[IntelCalendarEvent]
    personalized_items: list[IntelItemSummary]
    sections: list[DigestSection]
```

---

## TypeScript Interfaces

Add to `frontend/src/types/index.ts` or a new `frontend/src/types/intel.ts` file.

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
  event_date: string; // ISO date "YYYY-MM-DD"
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

```

---

## Scanner Implementation Details

### GOV.UK Government Sources

**RSS Feed URLs:**
```
https://www.gov.uk/search/all.atom?organisations[]=uk-visas-and-immigration&order=updated-newest
https://www.gov.uk/search/all.atom?organisations[]=home-office&order=updated-newest
https://www.gov.uk/search/all.atom?organisations[]=migration-advisory-committee&order=updated-newest
https://www.gov.uk/search/all.atom?organisations[]=office-for-national-statistics&topics[]=population-and-migration
```

**RSS Parsing (Atom feed):**
```python
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime

ATOM_NS = "{http://www.w3.org/2005/Atom}"

def parse_govuk_atom(xml_text: str) -> list[dict]:
    """Parse GOV.UK Atom feed into raw intel items."""
    root = ET.fromstring(xml_text)
    items = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        title_el = entry.find(f"{ATOM_NS}title")
        link_el = entry.find(f"{ATOM_NS}link")
        updated_el = entry.find(f"{ATOM_NS}updated")
        summary_el = entry.find(f"{ATOM_NS}summary")

        items.append({
            "title": title_el.text.strip() if title_el is not None and title_el.text else "",
            "source_url": link_el.attrib.get("href", "") if link_el is not None else "",
            "published_at": updated_el.text if updated_el is not None else None,
            "content_snippet": (summary_el.text or "")[:500] if summary_el is not None else None,
            "source_name": "GOV.UK",
            "source_category": "government",
        })
    return items
```

**Page Diff Algorithm (for Immigration Rules pages without RSS):**

The Immigration Rules pages at `gov.uk/guidance/immigration-rules/*` do not have granular RSS feeds. Changes are detected by content hashing and section-level diffing.

```python
import hashlib
import difflib
from selectolax.parser import HTMLParser

# Stored in Redis: key = f"intel:page_hash:{url}", value = sha256 hex digest
# Stored in Redis: key = f"intel:page_sections:{url}", value = JSON dict of section_id -> text

async def check_page_diff(url: str, redis_client, http_client) -> dict | None:
    """
    Fetch page, compare hash with stored version, extract changed sections.
    Returns None if no change detected.
    """
    response = await http_client.get(url)
    html = response.text

    # 1. Quick hash check — skip parsing if no change
    current_hash = hashlib.sha256(html.encode()).hexdigest()
    stored_hash = await redis_client.get(f"intel:page_hash:{url}")
    if stored_hash and stored_hash.decode() == current_hash:
        return None  # No change

    # 2. Extract sections (each <h2> or <h3> heading + content until next heading)
    tree = HTMLParser(html)
    main_content = tree.css_first("div.govuk-govspeak, div#guide-content, main")
    if not main_content:
        return None

    sections: dict[str, str] = {}
    current_heading = "preamble"
    current_text: list[str] = []

    for node in main_content.iter():
        if node.tag in ("h2", "h3"):
            if current_text:
                sections[current_heading] = "\n".join(current_text)
            current_heading = node.text(strip=True)
            current_text = []
        elif node.tag in ("p", "li", "td"):
            text = node.text(strip=True)
            if text:
                current_text.append(text)
    if current_text:
        sections[current_heading] = "\n".join(current_text)

    # 3. Compare with stored sections
    stored_sections_raw = await redis_client.get(f"intel:page_sections:{url}")
    changed_sections: dict[str, dict] = {}

    if stored_sections_raw:
        import json
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
                    "diff_lines": diff[:50],  # Limit to 50 diff lines
                    "is_new_section": key not in stored_sections,
                    "is_removed_section": key not in sections,
                }

    # 4. Store new hash and sections
    await redis_client.set(f"intel:page_hash:{url}", current_hash, ex=86400 * 7)
    import json
    await redis_client.set(f"intel:page_sections:{url}", json.dumps(sections), ex=86400 * 7)

    if not changed_sections:
        return None

    return {
        "url": url,
        "changed_sections": changed_sections,
        "total_sections_changed": len(changed_sections),
    }
```

**Immigration Rules Pages to Monitor:**
```python
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
```

### BBC / Guardian / Reuters (News RSS)

**RSS Feed URLs:**
```python
NEWS_RSS_SOURCES = {
    "bbc": {
        "feed_url": "https://feeds.bbci.co.uk/news/uk/rss.xml",
        "source_name": "BBC News",
        "format": "rss2",
    },
    "guardian": {
        "feed_url": "https://www.theguardian.com/uk/immigration/rss",
        "source_name": "The Guardian",
        "format": "rss2",
    },
    "guardian_politics": {
        "feed_url": "https://www.theguardian.com/politics/immigration/rss",
        "source_name": "The Guardian",
        "format": "rss2",
    },
    "reuters": {
        "feed_url": "https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best",
        "source_name": "Reuters",
        "format": "rss2",
    },
    "ft": {
        "feed_url": "https://www.ft.com/immigration?format=rss",
        "source_name": "Financial Times",
        "format": "rss2",
    },
    "times": {
        "feed_url": "https://www.thetimes.co.uk/topic/immigration?format=rss",
        "source_name": "The Times",
        "format": "rss2",
    },
}
```

**RSS2 Entry Extraction Fields:**
```python
def parse_rss2_entry(item_el, source_name: str) -> dict:
    """Parse a single <item> from an RSS 2.0 feed."""
    def text_or_none(tag: str) -> str | None:
        el = item_el.find(tag)
        return el.text.strip() if el is not None and el.text else None

    return {
        "title": text_or_none("title") or "",
        "source_url": text_or_none("link"),
        "published_at": text_or_none("pubDate"),      # RFC 822 format
        "content_snippet": (text_or_none("description") or "")[:500],
        "source_name": source_name,
        "source_category": "news",
        "guid": text_or_none("guid"),                   # For dedup against same feed
    }
```

**Keyword Relevance Filter (pre-LLM):**
```python
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
```

### Reddit (OAuth2 + Listing Endpoint)

**OAuth2 Flow (script-type app, no user login needed):**
```python
import httpx

REDDIT_AUTH_URL = "https://www.reddit.com/api/v1/access_token"
REDDIT_API_BASE = "https://oauth.reddit.com"
USER_AGENT = "SponsorIntel/1.0 (by /u/sponsorintel)"

async def get_reddit_token(client_id: str, client_secret: str) -> str:
    """Get Reddit OAuth2 bearer token using client_credentials grant."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            REDDIT_AUTH_URL,
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        return response.json()["access_token"]
```

**Subreddit Listing Endpoint:**
```python
async def fetch_subreddit_new(
    token: str,
    subreddit: str,
    limit: int = 50,
    after: str | None = None,
) -> list[dict]:
    """
    Fetch new posts from a subreddit.
    Endpoint: GET /r/{subreddit}/new
    Rate limit: 60 requests/minute per OAuth2 token.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
    }
    params = {"limit": limit, "sort": "new"}
    if after:
        params["after"] = after  # Pagination cursor (fullname of last item)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{REDDIT_API_BASE}/r/{subreddit}/new",
            headers=headers,
            params=params,
        )
        response.raise_for_status()
        data = response.json()

    posts = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        posts.append({
            "title": post.get("title", ""),
            "source_url": f"https://reddit.com{post.get('permalink', '')}",
            "published_at": datetime.utcfromtimestamp(post.get("created_utc", 0)).isoformat(),
            "content_text": post.get("selftext", "")[:5000],
            "content_snippet": post.get("selftext", "")[:500],
            "source_name": f"Reddit r/{subreddit}",
            "source_category": "community",
            "reddit_score": post.get("score", 0),
            "reddit_num_comments": post.get("num_comments", 0),
            "reddit_fullname": post.get("name"),  # e.g. "t3_abc123" — used as pagination cursor
        })
    return posts
```

**Comment Extraction (for high-engagement posts):**
```python
async def fetch_post_comments(token: str, permalink: str, limit: int = 20) -> list[str]:
    """
    Fetch top-level comments for a post.
    Endpoint: GET /comments/{article_id}
    Only fetched for posts with num_comments > 10 and score > 5.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
    }
    url = f"{REDDIT_API_BASE}{permalink}"
    params = {"limit": limit, "sort": "top", "depth": 1}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        listings = response.json()

    comments = []
    if len(listings) > 1:
        for child in listings[1].get("data", {}).get("children", []):
            body = child.get("data", {}).get("body", "")
            if body and child.get("kind") == "t1":
                comments.append(body[:1000])
    return comments
```

### Legal Blogs

**RSS URLs:**
```python
LEGAL_RSS_SOURCES = {
    "free_movement": {
        "feed_url": "https://freemovement.org.uk/feed/",
        "source_name": "Free Movement Blog",
        "format": "rss2",
    },
    "colin_yeo": {
        "feed_url": "https://www.immigrationbarrister.co.uk/feed/",
        "source_name": "Immigration Barrister (Colin Yeo)",
        "format": "rss2",
    },
    "law_society": {
        "feed_url": "https://www.lawsociety.org.uk/campaigns/immigration/rss",
        "source_name": "Law Society Immigration",
        "format": "rss2",
    },
}
```

**Fallback Page Scrape (for sources without RSS, e.g. ILPA, Upper Tribunal):**
```python
from selectolax.parser import HTMLParser

# CSS selectors per source for page scraping
LEGAL_SCRAPE_SELECTORS = {
    "ilpa": {
        "url": "https://ilpa.org.uk/resources/",
        "list_selector": "div.resource-list article, div.post-list .post-item",
        "title_selector": "h2 a, h3 a, .post-title a",
        "date_selector": "time, .post-date, .date",
        "link_selector": "h2 a, h3 a, .post-title a",  # href attribute
        "snippet_selector": "p.excerpt, .post-excerpt, .summary",
    },
    "upper_tribunal": {
        "url": "https://www.judiciary.uk/judgments/?search=immigration&court=upper-tribunal-immigration-and-asylum-chamber",
        "list_selector": "ul.judgments-list li, div.judgments-listing article",
        "title_selector": "a.judgment-title, h3 a, .title a",
        "date_selector": "time, .judgment-date, .date",
        "link_selector": "a.judgment-title, h3 a, .title a",
        "snippet_selector": "p.summary, .judgment-summary, .excerpt",
    },
}

async def scrape_legal_page(source_key: str, http_client) -> list[dict]:
    """Scrape a legal source that lacks RSS using CSS selectors."""
    config = LEGAL_SCRAPE_SELECTORS[source_key]
    response = await http_client.get(config["url"])
    tree = HTMLParser(response.text)

    items = []
    for card in tree.css(config["list_selector"]):
        title_el = card.css_first(config["title_selector"])
        date_el = card.css_first(config["date_selector"])
        link_el = card.css_first(config["link_selector"])
        snippet_el = card.css_first(config["snippet_selector"])

        if not title_el:
            continue

        href = link_el.attributes.get("href", "") if link_el else ""
        if href and not href.startswith("http"):
            href = config["url"].rstrip("/") + "/" + href.lstrip("/")

        items.append({
            "title": title_el.text(strip=True),
            "source_url": href,
            "published_at": date_el.attributes.get("datetime", date_el.text(strip=True)) if date_el else None,
            "content_snippet": snippet_el.text(strip=True)[:500] if snippet_el else None,
            "source_name": source_key.replace("_", " ").title(),
            "source_category": "legal",
        })
    return items
```

### Hansard (Parliament API)

**API Endpoint:**
```python
HANSARD_API_BASE = "https://hansard-api.parliament.uk"

async def fetch_hansard_debates(http_client, date_from: str) -> list[dict]:
    """
    Fetch recent immigration-related parliamentary debates.
    Endpoint: GET /search.json
    Free, no auth required. Rate limit: be polite (1 req/sec).
    """
    params = {
        "q": "immigration OR visa OR migration OR \"home office\"",
        "startDate": date_from,  # YYYY-MM-DD
        "house": "Commons",
        "take": 20,
    }
    response = await http_client.get(f"{HANSARD_API_BASE}/search.json", params=params)
    response.raise_for_status()
    data = response.json()

    items = []
    for result in data.get("Results", []):
        items.append({
            "title": result.get("Title", ""),
            "source_url": f"https://hansard.parliament.uk{result.get('Url', '')}",
            "published_at": result.get("Date"),
            "content_snippet": result.get("SearchResultHighlights", [{}])[0].get("Value", "")[:500],
            "source_name": "Parliament Hansard",
            "source_category": "government",
        })
    return items
```

---

## LLM Prompt Templates

### Classifier Prompt

**Model:** Groq Llama 3.1 70B
**Temperature:** 0.1 (near-deterministic for classification)
**Max tokens:** 500

```python
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
- "critical": Changes that immediately affect current visa holders or pending applications (e.g., route closure, salary threshold change effective now, emergency rule change).
- "high": Confirmed changes with a future effective date, major court rulings that set precedent, significant policy shifts.
- "medium": Proposed changes under consultation, notable statistics releases, MAC recommendations not yet adopted.
- "low": Opinion pieces, community discussions, minor news coverage of existing policies.
- "rule_change": Official Statement of Changes to the Immigration Rules laid before Parliament.
- "policy_update": Home Office guidance updates, UKVI procedural changes, policy statements.
- "court_decision": Upper Tribunal or higher court immigration judgments.
- "statistics": ONS migration data, Home Office quarterly stats, visa grant/refusal rates.
- "opinion": Blog posts, expert commentary, editorials.
- "news": General news coverage of immigration topics.
- "community": Reddit posts, forum discussions, user experiences.
- visa_routes_affected: Only include routes specifically mentioned or clearly affected. Use "General" if it affects the overall system.
- nationalities_affected: Only include if specific nationalities are mentioned. Leave empty for general items.
- industries_affected: Only include if specific industries are mentioned (e.g., "Healthcare", "Technology", "Education").
"""

CLASSIFIER_USER_TEMPLATE = """Classify this item:

Title: {title}
Source: {source_name} ({source_category})
Published: {published_at}
Content: {content_text_or_snippet}

Return JSON only."""
```

### Impact Analyzer Prompt

**Model:** NVIDIA NIM Llama 3.1 405B (deeper analysis needs larger model)
**Temperature:** 0.3 (slightly creative for natural language summaries)
**Max tokens:** 1500

```python
ANALYZER_SYSTEM_PROMPT = """You are an immigration policy analyst specialising in the UK immigration system. You receive classified immigration news items and produce detailed impact analysis for people navigating the UK visa system.

Your audience includes: visa applicants, employers who sponsor workers, immigration lawyers, HR professionals, and recruiters.

You must return valid JSON only, with no additional text.

Output JSON schema:
{
  "summary": "string (2-3 sentences: what happened, in plain English, avoiding jargon)",
  "who_affected": "string (specific groups: e.g., 'Skilled Worker visa holders in healthcare earning below the new threshold')",
  "action_required": "string or null (what should affected people do NOW, if anything. null if no action needed)",
  "before_after": {
    "before": "string (how things were before this change)",
    "after": "string (how things are after this change)"
  } or null,
  "key_dates": [
    {"date": "YYYY-MM-DD", "description": "string"}
  ],
  "severity_reasoning": "string (1 sentence: why this impact level was assigned)"
}

Analysis guidelines:
- Write for a non-expert audience. Avoid legal jargon.
- Be specific about WHO is affected. "Everyone" is almost never correct.
- For rule changes: always provide before_after if the old and new rules are discernible.
- For statistics: highlight the trend direction and what it means practically.
- For court decisions: explain what the ruling means for future cases.
- action_required should be concrete: "Check your CoS expiry date", "No action needed", "Consult your immigration lawyer if you applied after [date]".
- Never speculate beyond what the source material states. If uncertain, say so.
"""

ANALYZER_USER_TEMPLATE = """Analyze this classified item:

Title: {title}
Source: {source_name}
Topic: {topic}
Impact Level: {impact_level}
Visa Routes Affected: {visa_routes_affected}
Content:
{content_text}

Return JSON only."""
```

### Digest Generator Prompt

**Model:** Groq Llama 3.1 70B
**Temperature:** 0.4 (slightly creative for engaging email copy)
**Max tokens:** 2000

```python
DIGEST_SYSTEM_PROMPT = """Generate a weekly immigration intelligence briefing email for a UK immigration professional. The email should be concise, scannable, and actionable.

Structure your output as JSON:
{
  "subject_line": "string (email subject, max 80 chars, include most important item)",
  "greeting": "string (personalized if user_name provided, otherwise generic)",
  "executive_summary": "string (2-3 sentences: the single most important thing this week)",
  "top_items": [
    {
      "headline": "string",
      "one_liner": "string (one sentence summary)",
      "impact_badge": "critical" | "high" | "medium"
    }
  ],
  "stats_highlight": "string (one sentence about any notable statistics this week, or null)",
  "calendar_preview": "string (upcoming key dates in next 2 weeks, or null)",
  "personalized_note": "string (based on user's visa route / industry interest, or null)",
  "sign_off": "string"
}

Tone: professional but accessible. Think Bloomberg briefing meets immigration explainer. No emojis. No exclamation marks."""

DIGEST_USER_TEMPLATE = """Generate the weekly digest for this week.

User profile:
- Name: {user_name}
- Visa route interest: {visa_route}
- Industry: {industry}
- Nationality: {nationality}

Top items this week (ranked by impact):
{top_items_json}

Statistics updates this week:
{stats_json}

Upcoming calendar events (next 14 days):
{calendar_json}

Return JSON only."""
```

---

## Cost Projections

### Token Usage Estimates

| Stage | Items/Day | Tokens/Item | Total Tokens/Day | Model | Cost/1M Tokens |
|-------|-----------|-------------|-------------------|-------|----------------|
| Classification | ~100 | ~500 input + ~200 output | ~70K | Groq Llama 3.1 70B | Free (30 req/min) |
| Impact Analysis | ~30 (medium+) | ~2000 input + ~800 output | ~84K | NVIDIA NIM 405B | ~$0.90/1M input, $0.90/1M output |
| Digest Generation | ~50 users/week | ~3000 input + ~1000 output | ~28K/week | Groq Llama 3.1 70B | Free |
| Re-classification (retries) | ~5 | ~700 | ~3.5K | Groq | Free |

### Monthly Cost Projection

| Component | Monthly Volume | Unit Cost | Monthly Cost |
|-----------|---------------|-----------|-------------|
| Groq API (classifier + digest) | ~2.5M tokens | Free tier (30 req/min, 14,400 req/day) | $0.00 |
| NVIDIA NIM (impact analysis) | ~2.5M tokens | $0.90/1M (input) + $0.90/1M (output) | ~$2.25 |
| Fallback: OpenRouter Llama 3.1 70B | ~100K tokens (error retries) | $0.50/1M | ~$0.05 |
| Reddit API | ~2,880 requests/month | Free (script app) | $0.00 |
| Resend (email) | ~200 emails/month (digests) + ~50 instant | Free tier (100/day) | $0.00 |
| **Total** | | | **~$2.30/month** |

### Scaling Thresholds

| Milestone | Trigger | Action |
|-----------|---------|--------|
| 500 items/day | Groq rate limit pressure | Switch classifier to Groq paid ($0.05/1M) or batch requests |
| 1,000 users | Digest generation exceeds free tier | Add Groq paid plan (~$10/month) |
| 5,000 users | Email volume exceeds Resend free tier | Resend Pro plan ($20/month) |
| 10,000 items/day | NIM costs reach ~$25/month | Evaluate self-hosted Llama on Railway GPU |

### Groq Free Tier Limits

- 30 requests/minute, 14,400 requests/day, 500,000 tokens/day (varies by model)
- Classification: ~100 items/day = ~100 requests = well within limits
- Digest: ~50 users/week = ~7/day = negligible
- Buffer: ~99% headroom on request limits at launch scale

---

## Notification Matching Algorithm

When a new intel item reaches `analyzed` status, the notification matcher runs to find all subscriptions that should be notified.

### Pseudocode

```python
async def match_item_to_subscriptions(item: IntelItem, db_session) -> list[IntelNotification]:
    """
    Match a newly analyzed intel item against all active subscriptions.
    Returns list of notifications to insert.
    """
    # 1. Map impact levels to numeric values for >= comparison
    IMPACT_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    item_impact_rank = IMPACT_RANK.get(item.impact_level, 0)

    # 2. Batch query: find all matching subscriptions in one SQL call
    #    This avoids N+1 by pushing all filter logic into PostgreSQL.
    query = text("""
        SELECT id, user_id, channel
        FROM intel_subscriptions
        WHERE is_active = TRUE
          -- Impact threshold: subscription's min_impact must be <= item's impact
          AND CASE filter_min_impact
                WHEN 'low' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'high' THEN 3
                WHEN 'critical' THEN 4
                ELSE 0
              END <= :item_impact_rank
          -- Topic filter: NULL means "all topics", otherwise item topic must be in the array
          AND (filter_topics IS NULL OR :item_topic = ANY(filter_topics))
          -- Visa route filter: NULL means "all routes", otherwise ANY overlap
          AND (filter_visa_routes IS NULL OR filter_visa_routes && :item_visa_routes)
          -- Nationality filter: NULL means "all", otherwise ANY overlap
          AND (filter_nationalities IS NULL OR filter_nationalities && :item_nationalities)
          -- Industry filter: NULL means "all", otherwise ANY overlap
          AND (filter_industries IS NULL OR filter_industries && :item_industries)
    """)

    result = await db_session.execute(query, {
        "item_impact_rank": item_impact_rank,
        "item_topic": item.topic,
        "item_visa_routes": item.visa_routes_affected or [],
        "item_nationalities": item.nationalities_affected or [],
        "item_industries": item.industries_affected or [],
    })

    matching_subs = result.fetchall()

    # 3. Build notification objects
    notifications = []
    for sub_id, user_id, channel in matching_subs:
        notification = {
            "user_id": user_id,
            "intel_item_id": item.id,
            "subscription_id": sub_id,
            "title": item.title,
            "body": item.summary,
            "is_read": False,
        }
        notifications.append(notification)

        # 4. Side-effect: queue email for email_instant subscriptions
        if channel == "email_instant" and item.impact_level in ("critical", "high"):
            await queue_instant_email.delay(user_id=str(user_id), item_id=str(item.id))

    # 5. Bulk insert notifications
    if notifications:
        await db_session.execute(
            insert(IntelNotification).values(notifications)
        )
        await db_session.commit()

    return notifications
```

### SQL Index Optimization

The matching query benefits from these existing indexes plus one composite:

```sql
-- Already defined in schema:
CREATE INDEX idx_intel_subs_user ON intel_subscriptions (user_id);

-- Add for matching performance:
CREATE INDEX idx_intel_subs_active ON intel_subscriptions (is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_intel_subs_impact ON intel_subscriptions (filter_min_impact)
    WHERE is_active = TRUE;
```

### Dedup Within Notifications

Before inserting, check that the same user has not already been notified for the same `intel_item_id` (can happen if user has multiple matching subscriptions):

```sql
-- Only one notification per user per item
CREATE UNIQUE INDEX idx_intel_notif_user_item
    ON intel_notifications (user_id, intel_item_id);
```

If the insert conflicts, skip silently (`ON CONFLICT DO NOTHING`).

---

## Dedup Algorithm Detail

The dedup system uses PostgreSQL's `pg_trgm` extension for fuzzy title matching, with a windowed approach to keep performance bounded.

### Prerequisites

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_intel_items_title_trgm ON intel_items USING gin (title gin_trgm_ops);
```

### Full Pseudocode

```python
async def run_dedup(db_session, window_hours: int = 48, similarity_threshold: float = 0.6):
    """
    Deduplicate intel items within a time window.

    Algorithm:
    1. Select all non-deduped items from the last `window_hours`.
    2. For each item, find similar items using pg_trgm similarity.
    3. Group similar items into clusters.
    4. For each cluster, pick the canonical item (earliest published_at).
    5. Mark non-canonical items as 'deduped', aggregate their sources.
    """

    # Step 1: Find all similar pairs within the time window
    pairs_query = text("""
        WITH recent AS (
            SELECT id, title, source_name, published_at, created_at
            FROM intel_items
            WHERE status IN ('classified', 'analyzed')
              AND dedup_cluster_id IS NULL
              AND created_at > now() - interval ':window_hours hours'
        )
        SELECT
            a.id AS id_a,
            b.id AS id_b,
            similarity(a.title, b.title) AS sim_score
        FROM recent a
        JOIN recent b ON a.id < b.id   -- avoid self-join and duplicate pairs
        WHERE similarity(a.title, b.title) > :threshold
        ORDER BY sim_score DESC
    """)

    pairs = await db_session.execute(pairs_query, {
        "window_hours": window_hours,
        "threshold": similarity_threshold,
    })
    pair_rows = pairs.fetchall()

    if not pair_rows:
        return {"clusters_created": 0, "items_deduped": 0}

    # Step 2: Build clusters using Union-Find
    parent: dict[uuid.UUID, uuid.UUID] = {}

    def find(x: uuid.UUID) -> uuid.UUID:
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent[x], parent[x])  # path compression
            x = parent[x]
        return x

    def union(a: uuid.UUID, b: uuid.UUID):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for id_a, id_b, sim_score in pair_rows:
        union(id_a, id_b)

    # Step 3: Group items by cluster root
    clusters: dict[uuid.UUID, set[uuid.UUID]] = {}
    all_ids = set()
    for id_a, id_b, _ in pair_rows:
        all_ids.add(id_a)
        all_ids.add(id_b)

    for item_id in all_ids:
        root = find(item_id)
        clusters.setdefault(root, set()).add(item_id)

    # Step 4: For each cluster, pick canonical and mark others
    total_deduped = 0
    for cluster_items in clusters.values():
        if len(cluster_items) < 2:
            continue

        # Fetch metadata for all items in cluster
        items_query = text("""
            SELECT id, source_name, published_at, created_at
            FROM intel_items
            WHERE id = ANY(:ids)
            ORDER BY published_at ASC NULLS LAST, created_at ASC
        """)
        items_result = await db_session.execute(items_query, {"ids": list(cluster_items)})
        items = items_result.fetchall()

        # Canonical = earliest published item
        canonical_id = items[0].id
        cluster_id = uuid.uuid4()
        all_sources = list({item.source_name for item in items})

        # Update canonical item: set cluster_id, aggregate sources
        await db_session.execute(text("""
            UPDATE intel_items
            SET dedup_cluster_id = :cluster_id
            WHERE id = :canonical_id
        """), {"cluster_id": cluster_id, "canonical_id": canonical_id})

        # Mark non-canonical items as deduped
        non_canonical_ids = [item.id for item in items if item.id != canonical_id]
        if non_canonical_ids:
            await db_session.execute(text("""
                UPDATE intel_items
                SET status = 'deduped',
                    dedup_cluster_id = :cluster_id
                WHERE id = ANY(:ids)
            """), {"cluster_id": cluster_id, "ids": non_canonical_ids})
            total_deduped += len(non_canonical_ids)

    await db_session.commit()

    return {
        "clusters_created": len(clusters),
        "items_deduped": total_deduped,
    }
```

### Performance Characteristics

- **Window bound:** Only compares items from the last 48 hours, limiting the cross-join to ~200 items max (at 100 items/day).
- **GIN index:** The `gin_trgm_ops` index makes `similarity()` comparisons efficient without sequential scan.
- **Typical volume:** At 100 items/day, the 48-hour window contains ~200 items. The self-join produces ~20,000 pairs, but the `similarity > 0.6` filter reduces this to typically 5-20 actual duplicate pairs.
- **Union-Find:** O(n * alpha(n)) for clustering, effectively O(n).

---

## Monitoring & Alerting

### Per-Scanner Health Metrics

Each scanner task logs to the `source_health_log` table after every run:

```sql
CREATE TABLE intel_source_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(50) NOT NULL,          -- e.g. "gov_uk_rss", "bbc_rss", "reddit_ukvisa"
    scanner_task VARCHAR(100) NOT NULL,       -- e.g. "intel_scan_gov"
    ran_at TIMESTAMPTZ DEFAULT now(),
    duration_ms INTEGER,
    items_fetched INTEGER DEFAULT 0,
    items_new INTEGER DEFAULT 0,              -- items that passed dedup and were inserted
    items_filtered INTEGER DEFAULT 0,         -- items rejected by keyword filter
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
    error_message TEXT,
    http_status_code INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    is_circuit_open BOOLEAN DEFAULT FALSE,    -- true = source is disabled
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_health_source ON intel_source_health_log (source_key, ran_at DESC);
CREATE INDEX idx_intel_health_errors ON intel_source_health_log (status, ran_at DESC)
    WHERE status != 'success';
```

### Metrics Tracked Per Run

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `items_fetched` | Raw items from source before filtering | 0 for 3 consecutive runs = warning |
| `items_new` | Items that passed keyword filter and dedup | Informational only |
| `duration_ms` | Scan wall-clock time | > 30,000ms = warning |
| `http_status_code` | HTTP response code from source | 4xx/5xx = increment failure counter |
| `consecutive_failures` | Running count of sequential errors | 3 = back off, 10 = circuit open + admin alert |

### LLM Classification Accuracy Tracking

```python
# Sample 1% of classified items for human review
# Store in intel_quality_samples table

async def sample_for_review(item: IntelItem, sample_rate: float = 0.01):
    """Randomly sample classified items for quality review."""
    import random
    if random.random() < sample_rate:
        await db_session.execute(text("""
            INSERT INTO intel_quality_samples (intel_item_id, llm_topic, llm_impact, llm_confidence, reviewed)
            VALUES (:item_id, :topic, :impact, :confidence, FALSE)
        """), {
            "item_id": item.id,
            "topic": item.topic,
            "impact": item.impact_level,
            "confidence": item.classification_confidence,  # From classifier output
        })
```

```sql
CREATE TABLE intel_quality_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_item_id UUID REFERENCES intel_items(id),
    llm_topic VARCHAR(50),
    llm_impact VARCHAR(20),
    llm_confidence FLOAT,
    human_topic VARCHAR(50),          -- Filled during manual review
    human_impact VARCHAR(20),         -- Filled during manual review
    is_correct BOOLEAN,               -- Set during review
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Accuracy dashboard:** Show in admin panel: weekly accuracy rate (% of reviewed samples where `is_correct = TRUE`), confusion matrix by topic, average confidence score for correct vs. incorrect classifications.

### Source Availability SLA

| Source Category | Target Availability | Acceptable Downtime/Week |
|-----------------|--------------------|-----------------------|
| GOV.UK (government) | 99.5% | ~30 minutes |
| News RSS (BBC, Guardian) | 99.0% | ~1 hour |
| Legal blogs | 95.0% | ~8 hours |
| Reddit API | 98.0% | ~3 hours |
| Hansard API | 95.0% | ~8 hours |

### Admin Alerts

Alerts are dispatched via the existing `discord_webhook_url` setting in `config.py`, plus optionally to an admin email via Resend.

**Alert conditions:**

| Condition | Severity | Channel |
|-----------|----------|---------|
| Scanner circuit breaker opened (10 consecutive failures) | Critical | Discord + Admin email |
| Scanner returned 0 items for 6 hours (for 15-min sources) | Warning | Discord |
| LLM classification accuracy drops below 85% (weekly) | Warning | Discord |
| LLM provider unreachable for 15 minutes | Critical | Discord + Admin email |
| Dedup cluster of 10+ items (unusual — possible parsing issue) | Warning | Discord |
| Database `intel_items` table > 500K rows (storage check) | Info | Discord |

---

## Realtime Subscription

### Supabase Realtime Channel Setup (Frontend)

```typescript
// frontend/src/hooks/useIntelRealtime.ts

import { useEffect, useRef, useCallback } from "react";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import type { IntelItem } from "@/types/intel";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UseIntelRealtimeOptions {
  /** Called when a new analyzed item arrives */
  onNewItem: (item: IntelItem) => void;
  /** Called when an existing item is updated (e.g., re-classified) */
  onItemUpdated?: (item: IntelItem) => void;
  /** Filter to only receive items matching specific criteria */
  filter?: {
    impact_level?: string;
    topic?: string;
  };
  /** Whether the subscription is active */
  enabled?: boolean;
}

export function useIntelRealtime({
  onNewItem,
  onItemUpdated,
  filter,
  enabled = true,
}: UseIntelRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY_MS = 1000;

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    reconnectAttempts.current = 0;
  }, []);

  const subscribe = useCallback(() => {
    cleanup();

    if (!enabled) return;

    // Build the channel with postgres_changes filter
    // Only listen for items that have reached 'analyzed' status
    const channel = supabase
      .channel("intel-feed-realtime", {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intel_items",
          filter: "status=eq.analyzed",
        },
        (payload) => {
          const item = payload.new as IntelItem;

          // Client-side filter (Supabase Realtime only supports one filter column)
          if (filter?.impact_level && item.impact_level !== filter.impact_level) return;
          if (filter?.topic && item.topic !== filter.topic) return;

          onNewItem(item);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "intel_items",
          filter: "status=eq.analyzed",
        },
        (payload) => {
          if (onItemUpdated) {
            onItemUpdated(payload.new as IntelItem);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          reconnectAttempts.current = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[Intel Realtime] Channel error:", err);
          handleReconnect();
        } else if (status === "CLOSED") {
          handleReconnect();
        }
      });

    channelRef.current = channel;
  }, [enabled, filter?.impact_level, filter?.topic, onNewItem, onItemUpdated, cleanup]);

  const handleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[Intel Realtime] Max reconnect attempts reached. Giving up.");
      return;
    }

    // Exponential backoff with jitter
    const delay =
      BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts.current) +
      Math.random() * 1000;

    reconnectAttempts.current += 1;
    console.warn(
      `[Intel Realtime] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      subscribe();
    }, delay);
  }, [subscribe]);

  useEffect(() => {
    subscribe();
    return cleanup;
  }, [subscribe, cleanup]);

  return {
    /** Force reconnect (e.g., after network recovery) */
    reconnect: subscribe,
    /** Check if currently connected */
    isConnected: channelRef.current?.state === "joined",
  };
}
```

### Usage in IntelFeed Component

```typescript
// Inside src/components/intel/IntelFeed.tsx

const [feedItems, setFeedItems] = useState<IntelItem[]>([]);

useIntelRealtime({
  onNewItem: (item) => {
    // Prepend new item to feed, trigger CSS animation
    setFeedItems((prev) => [{ ...item, _isNew: true }, ...prev]);

    // Announce to screen readers via live region
    announceToScreenReader(`New intel item: ${item.title}`);
  },
  onItemUpdated: (item) => {
    setFeedItems((prev) =>
      prev.map((existing) => (existing.id === item.id ? item : existing))
    );
  },
  filter: activeFilters,
  enabled: true,
});
```

### Supabase Realtime Configuration

Enable Realtime on the `intel_items` table via Supabase dashboard or migration:

```sql
-- Enable Realtime for intel_items (run in Supabase SQL editor)
ALTER PUBLICATION supabase_realtime ADD TABLE intel_items;
```

---

## Email Template Structure

### Weekly Digest Email (Resend + React Email)

**Delivery:** Every Monday at 06:00 UTC via Celery Beat task `intel_send_weekly_digest`.
**Provider:** Resend (already in Vercel marketplace). Sends via `noreply@sponsorintel.london`.

**React Email Template Structure:**

```typescript
// backend would call Resend API with pre-rendered HTML,
// but the template is authored as React Email for maintainability.
// File: frontend/src/emails/IntelWeeklyDigest.tsx
// (or a shared emails/ directory if using a monorepo email package)

import {
  Html, Head, Body, Container, Section, Heading,
  Text, Link, Hr, Img, Row, Column, Preview,
} from "@react-email/components";

interface DigestEmailProps {
  userName: string | null;
  subject: string;
  executiveSummary: string;
  topItems: Array<{
    title: string;
    impactLevel: "critical" | "high" | "medium";
    oneLiner: string;
    url: string;
  }>;
  statsHighlight: string | null;
  calendarPreview: Array<{
    date: string;
    title: string;
  }>;
  personalizedNote: string | null;
  unsubscribeUrl: string;
}
```

**Email Layout (section by section):**

```
+----------------------------------------------------------+
| [SponsorIntel Logo]                                      |
| Immigration Intelligence Weekly                          |
| Week of March 17 — March 23, 2026                       |
+----------------------------------------------------------+

+----------------------------------------------------------+
| EXECUTIVE SUMMARY                                        |
| "The Home Office announced a 15% increase to the         |
|  Skilled Worker salary threshold, effective April 4.     |
|  This is the most significant change this week."         |
+----------------------------------------------------------+

+----------------------------------------------------------+
| TOP 5 THIS WEEK                                          |
|                                                          |
| [CRITICAL] Skilled Worker salary threshold raised to     |
|            £41,400 from £38,700                          |
|            > Affects all new CoS applications from       |
|              April 4. Existing visa holders unaffected.  |
|            [Read full analysis ->]                        |
|                                                          |
| [HIGH] Upper Tribunal: Sponsor duties clarified in       |
|        ABC Ltd v SSHD [2026] UKUT 142                   |
|        > Tribunal ruled that sponsors must demonstrate   |
|          genuine vacancy at time of CoS assignment.      |
|        [Read full analysis ->]                            |
|                                                          |
| [HIGH] MAC recommends adding 3 SOC codes to shortage    |
|        occupation list                                   |
|        > Healthcare assistants, data engineers, and      |
|          quantity surveyors recommended for addition.    |
|        [Read full analysis ->]                            |
|                                                          |
| [MEDIUM] Q4 2025 visa statistics released                |
|          > Skilled Worker grants up 8% QoQ, refusal     |
|            rate steady at 4.2%.                          |
|          [Read full analysis ->]                          |
|                                                          |
| [MEDIUM] Home Office updates sponsor management system  |
|          guidance for SMS users                          |
|          > New SMS portal features for compliance        |
|            reporting.                                    |
|          [Read full analysis ->]                          |
+----------------------------------------------------------+

+----------------------------------------------------------+
| STATISTICS SNAPSHOT                                      |
| Skilled Worker grants: 38,420 (Q4 2025, +8% QoQ)       |
| Average processing time: 4.2 weeks                      |
| Refusal rate: 4.2% (stable)                             |
+----------------------------------------------------------+

+----------------------------------------------------------+
| UPCOMING DATES                                           |
| Mar 25 — Statement of Changes laid in Parliament        |
| Apr 4  — New salary threshold effective                 |
| Apr 11 — MAC oral evidence session (health sector)      |
| Apr 15 — Q1 2026 statistics estimated release           |
+----------------------------------------------------------+

+----------------------------------------------------------+
| PERSONALIZED FOR YOU                                     |
| Based on your interest in Skilled Worker visa and the   |
| Technology industry:                                     |
| > The salary threshold increase particularly impacts     |
|   mid-level tech roles. 23% of current Skilled Worker   |
|   tech postings fall below the new £41,400 threshold.   |
+----------------------------------------------------------+

+----------------------------------------------------------+
| [View all intel on SponsorIntel ->]                      |
|                                                          |
| You received this because you subscribed to the weekly  |
| digest on SponsorIntel.                                 |
| [Manage preferences] | [Unsubscribe]                    |
+----------------------------------------------------------+
```

**Resend API Call (from Celery task):**
```python
import resend

resend.api_key = settings.resend_api_key

async def send_digest_email(to_email: str, html_content: str, subject: str):
    """Send weekly digest via Resend."""
    resend.Emails.send({
        "from": "SponsorIntel <noreply@sponsorintel.london>",
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "headers": {
            "List-Unsubscribe": f"<https://sponsorintel.london/unsubscribe?email={to_email}>",
        },
    })
```

---

## Accessibility

All Intel feature components must meet **WCAG 2.1 Level AA** compliance.

### Live Region Announcements for New Feed Items

When new items arrive via Supabase Realtime, visually they appear with a flash animation. For screen reader users, an ARIA live region announces the new item.

```typescript
// frontend/src/components/intel/IntelLiveRegion.tsx

/**
 * Hidden live region that announces new intel items to screen readers.
 * Placed once at the top of the IntelFeed component.
 */
export function IntelLiveRegion({ announcement }: { announcement: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"  // Tailwind: visually hidden but screen-reader accessible
    >
      {announcement}
    </div>
  );
}

// Usage helper:
function announceToScreenReader(message: string) {
  // Update the live region text. React state change triggers re-render,
  // which the screen reader picks up.
  setLiveAnnouncement(message);

  // Clear after 5 seconds to allow re-announcement of same text
  setTimeout(() => setLiveAnnouncement(""), 5000);
}
```

### Keyboard Navigation Through Feed Cards

```typescript
// IntelCard must be focusable and operable via keyboard

<article
  role="article"
  tabIndex={0}
  aria-label={`${item.impact_level} impact: ${item.title}. Source: ${item.source_name}`}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
    // Arrow key navigation between cards
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusNextCard();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusPreviousCard();
    }
  }}
  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
>
```

### Impact Badge: Color + Icon (Not Color-Only)

Impact level must not rely solely on color. Each level has a distinct icon and text label in addition to color.

```typescript
// frontend/src/components/intel/ImpactBadge.tsx

const IMPACT_CONFIG = {
  critical: {
    color: "bg-red-600 text-white",
    icon: "ExclamationTriangleIcon",   // Heroicons solid
    label: "Critical",
    srText: "Critical impact",
  },
  high: {
    color: "bg-orange-500 text-white",
    icon: "ArrowUpIcon",               // Heroicons solid
    label: "High",
    srText: "High impact",
  },
  medium: {
    color: "bg-yellow-400 text-gray-900",
    icon: "MinusCircleIcon",           // Heroicons solid
    label: "Medium",
    srText: "Medium impact",
  },
  low: {
    color: "bg-gray-300 text-gray-700",
    icon: "ArrowDownIcon",             // Heroicons solid
    label: "Low",
    srText: "Low impact",
  },
} as const;

export function ImpactBadge({ level }: { level: IntelImpactLevel }) {
  const config = IMPACT_CONFIG[level];
  const IconComponent = getHeroicon(config.icon);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.color}`}
      role="img"
      aria-label={config.srText}
    >
      <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
```

### Screen Reader Text for Timeline Visualization

The horizontal timeline is inherently visual. For screen reader users, provide an equivalent ordered list.

```typescript
// Inside Timeline.tsx

{/* Visual timeline (hidden from screen readers) */}
<div aria-hidden="true" className="timeline-visual">
  {/* SVG / canvas timeline nodes */}
</div>

{/* Screen-reader-accessible timeline as an ordered list */}
<ol className="sr-only" aria-label="Rule change timeline">
  {nodes.map((node, index) => (
    <li key={node.id}>
      <span>
        {index + 1}. {node.title}.
        {node.published_at && ` Date: ${formatDate(node.published_at)}.`}
        {node.impact_level && ` Impact: ${node.impact_level}.`}
        {node.summary && ` Summary: ${node.summary}`}
      </span>
    </li>
  ))}
</ol>
```

### Additional Accessibility Requirements

| Component | Requirement | Implementation |
|-----------|-------------|----------------|
| Filter sidebar | All filters operable by keyboard | Use native `<select>`, `<input>`, `<button>` elements |
| Calendar view | Dates navigable by arrow keys | `role="grid"` with `aria-colheader` for day names |
| Stats charts | Alt text or `aria-label` describing the trend | `<img role="img" aria-label="Skilled Worker grants trending up 8% over 4 quarters">` |
| Policy stage badges | Stage name in text, not color-only | Text label always visible: "Stage: Enacted" |
| Notification bell | Unread count announced | `aria-label={`Notifications, ${unreadCount} unread`}` |
| Source badges | Source category readable | `aria-label="Source: GOV.UK (government)"` |
| Expandable cards | Expand/collapse state announced | `aria-expanded={isExpanded}` on trigger button |
| Loading states | Skeleton screens have loading label | `aria-busy="true"` and `aria-label="Loading intel feed"` on container |
| Error states | Error message announced | `role="alert"` on error container |
