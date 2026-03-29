# UI/UX Overhaul — Addictive Intelligence Terminal

**Date:** 2026-03-22
**Status:** Approved

## Design Philosophy

"The Bloomberg of Immigration" — information density + real-time feedback + power-user shortcuts. Unique, addictive, doesn't scream AI. The tool should feel like a professional intelligence terminal that users can't stop checking.

## 1. Micro-interactions & Dopamine Loops

### Number Animations
- All metric values animate when they change (count-up from old → new)
- Use `requestAnimationFrame` for smooth 300ms transitions
- Applies to: StatCards, score badges, table cells with numerical values

### Real-time Feedback
- Score badges pulse briefly (amber glow, 400ms) when a company gets re-scored
- "NEW" micro-tag appears with a 200ms fade-in on freshly enriched companies (enriched in last 24h)
- Enrichment progress bars fill in real-time via Supabase Realtime subscriptions
- Table rows flash subtly (cyan highlight, 500ms fade) when data updates

**Supabase Realtime config:**
- Enable Realtime on tables: `sponsors`, `sponsor_scores`, `company_profiles`, `intel_items`
- Use `postgres_changes` channel type (not broadcast)
- Subscribe per-page: dashboard subscribes to sponsor changes, company profile subscribes to that sponsor's changes
- Unsubscribe on page navigation to avoid connection buildup
- Connection limit: max 1 Realtime connection per client (multiplex via single channel with filters)

### Optional Sound Effects
- User-configurable in settings (off by default)
- Subtle notification chime for critical alerts
- Soft tick for enrichment milestones (every 1000 companies)

### Loading States
- Replace generic spinners with contextual messages:
  - "Scanning 140,910 sponsors..." (with count-up animation)
  - "Cross-referencing Companies House filings..."
  - "Analyzing hiring patterns across 8,697 jobs..."
- Skeleton shimmer on cards/tables (already exists, keep)

## 2. Personal Mission Control Dashboard

Replace the generic dashboard with a personalized command center.

### User Profile Setup (first-time flow)
On first login, prompt user to set:
- Visa route of interest (Skilled Worker, Innovator, Graduate, etc.)
- Target industry/industries
- Target location(s) in UK
- Current status (outside UK / in UK on different visa / etc.)

### Dashboard Sections (personalized)

**Top Banner: Daily Briefing**
- Single card with today's key updates
- "3 new A-rated sponsors in your industry, 2 salary threshold changes, 1 watchlist company posted a job"
- Links to each item

**Row 1: Your Watchlist Activity**
- Horizontal card list of watched companies
- Each shows: name, score (with trend arrow), new jobs count, latest event
- "No activity" shown as green checkmark (= stable, no concerns)

**Row 2: Your Industry Intelligence**
- Industry-specific metrics: total sponsors, hiring trend, salary range
- Top 5 hiring companies in user's industry this week
- Industry growth chart (sparkline)

**Row 3: Your Route Stats**
- Visa route-specific: current processing times, grant rate, recent rule changes
- **Data source dependency:** This section requires the Intel feature (`intel_statistics` and `intel_items` tables). Until Intel is built, show static seed data from Home Office quarterly statistics with a "Last updated: {date}" label. After Intel is live, pull dynamically.
- "Key dates" upcoming for this route (from `intel_calendar` when available)

**Row 4: Market Overview**
- Total sponsors, A-rated count, active jobs, enrichment coverage
- Growth chart (all sponsors, 30d trend)
- Top events from Signals feed

### Sidebar Enhancement
- Show user's route badge next to avatar
- "Your Score" — research activity score (gamification)
- Quick access to watchlist with count badge

## 3. Power User Features

### Command Palette Enhancement

**Phase 1 (structured query builder):**
- Upgrade from basic text search to a structured filter builder
- User types keywords → palette suggests structured filters:
  - Type "London" → suggests "Location: London"
  - Type "A-rated" → suggests "Rating: A"
  - Type "software" → suggests "Industry: Technology" or "Job Title: Software..."
- Combine multiple filters: "Location: London + Rating: A + Industry: Technology"
- Parses structured input → constructs Supabase filter parameters → navigates to search with filters applied
- Recent searches history in palette dropdown
- Saved searches (pin to sidebar)

**Phase 3+ (natural language, if feasible):**
- Full natural language parsing ("A-rated sponsors in London hiring software engineers paying over 50K")
- Requires LLM call (adds 1-2s latency) or a fine-tuned classifier
- Only pursue if structured query builder proves insufficient

### Quick Actions (HoverPreview Enhancement)
- Hover any company name anywhere in the app → floating card appears:
  - Score badge, rating, location, industry
  - Active jobs count, latest event
  - One-click buttons: Watch | Compare | X-Ray | View Profile
- 200ms delay before showing (prevents accidental triggers)
- Click outside or press Escape to dismiss

### Saved Searches
- On Search page: "Save this search" button next to filters
- Name the search, it appears in sidebar under PERSONAL section
- Badge shows new results since last viewed
- Maximum 10 saved searches (free), unlimited (pro)

### Keyboard Shortcuts Overlay
- Press `?` anywhere → full-screen shortcut reference overlay
- Grouped by page: Global, Search, Company, Jobs, etc.
- Searchable within overlay

## 4. Data Storytelling

### Score Explanation ("Why this score?")
- Click any overall score → expandable breakdown panel
- Shows the actual 7-factor weighted breakdown from the scoring engine:
  ```
  Overall: 72/100

  Compliance (20%)        ███████████████░░░░░  78
  ├── A-rated                              ✓ (+40)
  ├── 2+ years consecutive A               ✓ (+15)
  └── No rating changes                    ✓ (+0)

  Financial Health (15%)  ██████████████░░░░░░  65
  ├── Active company status                ✓ (+15)
  ├── No insolvency history                ✓ (+0)
  └── Accounts overdue                     ✗ (-25)

  Hiring Activity (15%)   ████████████████░░░░  80
  ├── 5 active job postings                   (+25)
  └── 3 distinct role types                   (+9)

  Reputation (15%)        ██████████████░░░░░░  68
  ├── Glassdoor 4.1/5 (23 reviews)            (68)
  └── No Trustpilot data                      (—)

  Legitimacy (10%)        ████████████████░░░░  80
  ├── Has website                          ✓ (+15)
  ├── Has careers page                     ✓ (+15)
  └── Domain age > 3 years                 ✓ (+15)

  Track Record (15%)      █████████████░░░░░░░  65
  ├── On register 2.5 years                   (+12)
  └── Never had B rating                  ✓ (+20)

  Growth Signal (10%)     ██████████████░░░░░░  70
  ├── Employee growth 8% (12m)                (+8)
  └── Active job postings                  ✓ (+20)
  ```
- Factors sourced from `sponsor_scores` table (compliance_score, financial_health_score, hiring_activity_score, reputation_score, legitimacy_score, track_record_score, growth_signal_score)
- Weights: compliance 20%, financial 15%, hiring 15%, reputation 15%, legitimacy 10%, track_record 15%, growth 10%
- Sub-factor details derived by re-running the factor computation logic client-side or via a dedicated API endpoint
- Color-coded: green bars for high scores, amber for medium, red for low
- "What would improve this score?" suggestion at bottom based on lowest-scoring factors

### Company Timeline
- Horizontal timeline on company profile page (new tab or enhance existing TimelineTab)
- Events plotted: licence date, rating changes, job postings, enrichment events, news mentions
- Interactive: hover for details, click to expand
- Zoom: 1 month / 3 months / 1 year / all time

### Trend Arrows Everywhere
- Every numerical metric in the app shows a 7d/30d trend indicator
- Up arrow (green), down arrow (red), flat dash (gray)
- Tooltip on hover: "+12% vs 30 days ago"
- Applies to: scores, job counts, salary ranges, review ratings

## 5. Social & Community Layer

### Community Ratings
- Users can rate sponsors they've interacted with (1-5 stars + optional comment)
- Categories: Application Process, Interview Experience, Sponsorship Support, Work Culture
- **Interaction verification:** Self-attestation with dropdown selection ("I applied" / "I was interviewed" / "I was sponsored" / "I worked here"). No external verification — trust is managed through the approval workflow and the UNIQUE constraint (one rating per user per sponsor).
- Displayed on company profile alongside Glassdoor/Trustpilot

### Success Stories
- Badge on company profile: "X users got sponsored by this company"
- Users can submit success stories (anonymous or named)
- Approval workflow: admin reviews before publishing
- Displayed as cards on company profile

### Anonymous Salary Reports
- Users report actual sponsored salaries: role, salary, year, visa route
- Aggregated: "Users report median £45K for Software Engineer (3 reports)"
- Only shown when >= 3 reports (anonymity threshold)
- Displayed alongside job listing salary data

### Discussion Threads (Future — Phase 2)
- Per-company discussion threads
- Moderated (admin approval for first post, then auto-approve trusted users)
- Categories: Visa Experience, Work Culture, Interview Tips

### Database additions:
```sql
CREATE TABLE community_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('applied', 'interviewed', 'sponsored', 'worked_here')),
    rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
    rating_process INTEGER CHECK (rating_process BETWEEN 1 AND 5),
    rating_interview INTEGER CHECK (rating_interview BETWEEN 1 AND 5),
    rating_sponsorship INTEGER CHECK (rating_sponsorship BETWEEN 1 AND 5),
    rating_culture INTEGER CHECK (rating_culture BETWEEN 1 AND 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    UNIQUE (user_id, sponsor_id)
);

CREATE TABLE salary_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    role_title VARCHAR(300) NOT NULL,
    salary_annual INTEGER NOT NULL,
    visa_route VARCHAR(100),
    year INTEGER NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE success_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id),
    story_text TEXT NOT NULL,
    visa_route VARCHAR(100),
    year INTEGER,
    is_anonymous BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6. Gamification

### Research Score
- Users earn points for activity:
  - +5 Watch a company (first watch per company only — idempotent)
  - +10 Rate a sponsor (one rating per sponsor — enforced by UNIQUE constraint)
  - +15 Submit salary report
  - +20 Submit success story
  - +5 Use a RAW tool
  - +3 Daily check-in (max 1 per day)
  - +25 Report incorrect data (verified by admin)
- **Daily cap:** Maximum 50 points/day to prevent gaming
- **Idempotency:** Points only awarded for the first occurrence of each action per target (e.g., first watch of company X, not subsequent watch/unwatch cycles). Tracked via `user_activity.metadata` containing target IDs.
- Displayed in sidebar and profile

### Streaks
- "You've checked in X days in a row"
- Visual streak counter with flame icon
- Streak milestones: 7, 30, 100 days
- Subtle notification: "Don't break your 15-day streak!"

### Achievements
- Unlockable badges displayed on profile:
  - "First Watch" — watched first company
  - "Analyst" — used 5 RAW tools
  - "Researcher" — rated 10 sponsors
  - "Pioneer" — first to find a newly added sponsor
  - "Deep Diver" — viewed 50 company profiles
  - "Networker" — compared 20+ sponsors
  - "Intel Junkie" — read 100 intel items
  - "Contributor" — submitted 5 community ratings

### Database:
```sql
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_user_activity_user ON user_activity (user_id, created_at DESC);
CREATE INDEX idx_user_activity_daily ON user_activity (user_id, created_at::date);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    achievement_key VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, achievement_key)
);

CREATE TABLE user_streaks (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_check_in DATE,
    total_points INTEGER DEFAULT 0
);
```

## 7. User Profiles

### Database table: `user_profiles`
```sql
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    visa_route VARCHAR(100),
    target_industries TEXT[],
    target_locations TEXT[],
    current_status VARCHAR(100) CHECK (current_status IN ('outside_uk', 'uk_different_visa', 'uk_graduate', 'uk_sponsored', 'uk_citizen_pr', 'other')),
    nationality VARCHAR(100),
    setup_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

This table is referenced by:
- Dashboard personalization (industry intel, route stats, daily briefing)
- Intel personalized relevance scoring
- RAW Route Advisor (pre-fill from profile)
- Sidebar route badge display

## 8. Saved Searches

### Database table: `saved_searches`
```sql
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    filters JSONB NOT NULL,
    result_count_at_save INTEGER,
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON saved_searches (user_id, created_at DESC);
```

**New results detection:** When user opens a saved search, compare current result count (re-run query) with `result_count_at_save`. If higher, show badge with delta. Update `result_count_at_save` and `last_viewed_at` on view.

**Access tiers:** Free: max 10 saved searches. Pro: unlimited.

## 9. Visual Identity Refinement

### Background
- Subtle animated dot grid on main background (very faint, 3% opacity)
- Dots pulse outward slowly like a radar sweep (CSS animation, 60s cycle)
- Purely decorative, zero performance impact (CSS only)

### Cards
- Current: solid border cards
- Upgrade: 1px gradient border (amber→transparent at 45deg) on hover
- Subtle inner shadow for depth on active/focused cards
- Glass-morphism on modal overlays only (backdrop-blur-sm)

### Data Highlights
- Fresh data (< 24h old) gets a subtle cyan left-border
- Updated values flash briefly on change (data-flash animation, already exists)
- Critical alerts get amber glow halo (box-shadow animation)

### Contextual Empty States
- Replace "No results" with helpful guidance:
  - "No A-rated sponsors match this filter. Relax the rating filter — 23 B-rated sponsors match."
  - "No jobs found for this role. Try broadening the location or checking similar roles."
  - "This company hasn't been enriched yet. It's #4,521 in the queue."
- Each empty state includes a suggested action button

### Custom Scrollbars (already done)
- Keep thin dark scrollbars with amber hover
- No changes needed

## RLS Policies

All new tables created via Supabase SQL migration.

```sql
-- user_profiles: user-scoped
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON user_profiles FOR ALL USING (auth.uid() = user_id);

-- saved_searches: user-scoped
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);

-- community_ratings: public read approved, user write own
ALTER TABLE community_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved ratings" ON community_ratings FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users read own ratings" ON community_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own ratings" ON community_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ratings" ON community_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages ratings" ON community_ratings FOR ALL USING (true);

-- salary_reports: public read (aggregated only — enforce >= 3 threshold in app logic), user write own
ALTER TABLE salary_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read salary reports" ON salary_reports FOR SELECT USING (true);
CREATE POLICY "Users create own reports" ON salary_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages reports" ON salary_reports FOR ALL USING (true);

-- success_stories: public read approved, user write own
ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved stories" ON success_stories FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users read own stories" ON success_stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own stories" ON success_stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages stories" ON success_stories FOR ALL USING (true);

-- user_activity: user-scoped read, service role write
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own activity" ON user_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages activity" ON user_activity FOR ALL USING (true);

-- user_achievements: public read (badges visible on profiles), user insert via service role
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read achievements" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Service role manages achievements" ON user_achievements FOR ALL USING (true);

-- user_streaks: user-scoped read, service role write
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own streaks" ON user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages streaks" ON user_streaks FOR ALL USING (true);
```

## Backend API Endpoints

All endpoints below are FastAPI routes in `backend/app/api/v1/`. Community and gamification data is accessed via Supabase client from the frontend for reads. Backend endpoints handle writes (using service role key).

```
# User Profile
POST /api/v1/profile/setup              — Create/update user profile (auth required)
GET  /api/v1/profile                     — Get user profile (auth required)

# Dashboard
GET  /api/v1/dashboard/briefing          — Daily briefing data (auth required, uses profile)
GET  /api/v1/dashboard/watchlist          — Watchlist activity (auth required)
GET  /api/v1/dashboard/industry           — Industry intel for user's industries (auth required)

# Community
POST /api/v1/community/ratings           — Submit a rating (auth required)
GET  /api/v1/community/ratings/{sponsor_id} — Get ratings for a sponsor
POST /api/v1/community/salary-reports    — Submit salary report (auth required)
GET  /api/v1/community/salary-reports/{sponsor_id} — Aggregated salary data (>= 3 threshold)
POST /api/v1/community/success-stories   — Submit story (auth required)
GET  /api/v1/community/success-stories/{sponsor_id} — Approved stories for sponsor

# Admin Moderation
GET  /api/v1/admin/community/pending     — Pending ratings + stories (admin only)
POST /api/v1/admin/community/approve/{type}/{id} — Approve item (admin only)
POST /api/v1/admin/community/reject/{type}/{id}  — Reject item (admin only)

# Gamification
POST /api/v1/gamification/checkin        — Daily check-in (auth required)
GET  /api/v1/gamification/stats          — User's points, streak, achievements (auth required)
POST /api/v1/gamification/track          — Track activity for points (auth required, server validates)

# Saved Searches
POST /api/v1/searches/save               — Save a search (auth required)
GET  /api/v1/searches                    — List saved searches (auth required)
DELETE /api/v1/searches/{id}             — Delete saved search (auth required)

# Score Explanation
GET  /api/v1/sponsors/{id}/score-breakdown — Detailed score factor breakdown
```

## Implementation Phases

### Phase 1: Core UX (Week 1-3)
- User profile setup wizard + `user_profiles` table + RLS
- Personalized dashboard (4 sections: briefing, watchlist, industry, market overview)
- Score explanation panels ("Why this score?" — aligned with 7-factor engine)
- Trend arrows on all metrics (TrendArrow component)
- Contextual empty states (EmptyState component)
- Loading state messages

### Phase 2: Power User (Week 3-5)
- Command palette upgrade (structured query builder)
- HoverPreview quick action cards
- Saved searches (`saved_searches` table + sidebar integration)
- Keyboard shortcut overlay
- Number animations (count-up via NumberAnimation component)

### Phase 3: Real-time & Micro-interactions (Week 5-6)
- Supabase Realtime subscriptions (sponsors, scores, profiles)
- Data flash animations on live updates
- Score badge pulse animation

### Phase 4: Community (Week 6-8)
- Community ratings system (table + RLS + form + display)
- Success stories (table + RLS + form + approval workflow)
- Anonymous salary reports (table + RLS + aggregation with >= 3 threshold)
- Admin moderation panel

### Phase 5: Gamification (Week 8-9)
- Research score + point system (tables + RLS + tracking)
- Streak tracking
- Achievements
- Profile page with badges and stats

### Phase 6: Visual Polish (Week 9-10)
- Animated background grid
- Gradient borders
- Data highlight animations
- Sound effects (optional)
- Overall consistency pass

## Components to Create/Modify

### New Components
```
src/components/dashboard/DailyBriefing.tsx
src/components/dashboard/WatchlistActivity.tsx
src/components/dashboard/IndustryIntel.tsx
src/components/dashboard/RouteStats.tsx
src/components/ui/ScoreBreakdown.tsx
src/components/ui/TrendArrow.tsx
src/components/ui/EmptyState.tsx
src/components/ui/NumberAnimation.tsx
src/components/community/RatingForm.tsx
src/components/community/SalaryReport.tsx
src/components/community/SuccessStory.tsx
src/components/community/CommunityRatings.tsx
src/components/gamification/StreakCounter.tsx
src/components/gamification/AchievementBadge.tsx
src/components/gamification/PointsDisplay.tsx
src/components/profile/UserProfile.tsx
src/components/profile/SetupWizard.tsx
```

### Modified Components
```
src/app/dashboard/page.tsx          — Personalized sections
src/components/layout/Sidebar.tsx   — Saved searches, research score
src/components/layout/Topbar.tsx    — Streak indicator
src/components/ui/CommandPalette.tsx — Structured query builder
src/components/ui/HoverPreview.tsx  — Quick action buttons
src/components/ui/StatCard.tsx      — Number animation + trend arrow
src/components/company/ProfileHeader.tsx — Community rating display
src/components/company/OverviewTab.tsx   — Success stories section
src/components/jobs/JobTable.tsx     — Salary report data
src/styles/globals.css              — Animated background, gradient borders
```

### New Database Tables
- `user_profiles` (visa route, industry, location preferences)
- `saved_searches` (user's pinned search filters)
- `community_ratings`
- `salary_reports`
- `success_stories`
- `user_activity`
- `user_achievements`
- `user_streaks`

---

## 10. Design Token System

All tokens are defined as CSS custom properties on `:root` and mapped into Tailwind via `tailwind.config.ts`. The app is dark-only; there is no light mode.

### 10.1 Color Palette

| Token | CSS Variable | Hex | Usage |
|---|---|---|---|
| **Backgrounds** | | | |
| `--color-bg` | `--color-bg` | `#0a0a0a` | Page background |
| `--color-s1` | `--color-s1` | `#111111` | Card / panel surface |
| `--color-s2` | `--color-s2` | `#1a1a1a` | Elevated surface (dropdown, hover bg) |
| `--color-s3` | `--color-s3` | `#222222` | Inset / well surface |
| `--color-s4` | `--color-s4` | `#2a2a2a` | Deep inset / active state |
| **Borders** | | | |
| `--color-border` | `--color-border` | `#2a2a2a` / `rgba(255,255,255,0.10)` | Default border |
| `--color-border-hover` | `--color-border-hover` | `rgba(255,255,255,0.20)` | Hover border |
| `--color-border-focus` | `--color-border-focus` | `#00e5ff` | Focus ring border (cyan) |
| **Text** | | | |
| `--color-text` | `--color-text` | `#e0e0e0` / `rgba(255,255,255,0.95)` | Primary text |
| `--color-dim` | `--color-dim` | `#888888` / `rgba(255,255,255,0.55)` | Secondary text |
| `--color-muted` | `--color-muted` | `#555555` / `rgba(255,255,255,0.30)` | Muted / placeholder text |
| `--color-faint` | `--color-faint` | `rgba(255,255,255,0.10)` | Disabled text |
| **Accent — Primary (Amber)** | | | |
| `--color-amber` | `--color-amber` | `#f5a623` | Primary accent: active nav, CTAs, brand |
| `--color-amber-dim` | `--color-amber-dim` | `rgba(245,166,35,0.15)` | Amber background tint |
| `--color-amber-glow` | `--color-amber-glow` | `rgba(245,166,35,0.30)` | Amber glow effects |
| **Accent — Cyan (Data/Live)** | | | |
| `--color-cyan` | `--color-cyan` | `#00e5ff` | Live indicators, fresh data, focus ring |
| `--color-cyan-dim` | `--color-cyan-dim` | `rgba(0,229,255,0.15)` | Cyan background tint |
| `--color-cyan-glow` | `--color-cyan-glow` | `rgba(0,229,255,0.30)` | Cyan glow effects |
| **Semantic — Status** | | | |
| `--color-green` | `--color-green` | `#00d4aa` | Positive: A-rated, score >= 80, up trend |
| `--color-red` | `--color-red` | `#ff4757` | Negative: B-rated, score < 60, down trend, critical |
| `--color-blue` | `--color-blue` | `#4a9eff` | Informational, links, accent secondary |
| `--color-purple` | `--color-purple` | `#a78bfa` | Tags, categories, tertiary accent |
| **Semantic — Impact Levels** | | | |
| `--color-impact-critical` | | `#ff4757` | Critical alerts, B-rating, revoked |
| `--color-impact-high` | | `#f5a623` | High importance, warnings |
| `--color-impact-medium` | | `#4a9eff` | Medium importance, informational |
| `--color-impact-low` | | `#888888` | Low importance, background info |

### 10.2 Typography Scale

Base font size: `16px` on `:root`. All sizes in `rem`.

| Token | Size | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|
| `text-4xl` | `2.25rem` (36px) | 1.1 | `-0.02em` | Hero numbers on dashboard |
| `text-3xl` | `1.875rem` (30px) | 1.15 | `-0.015em` | Page titles |
| `text-2xl` | `1.5rem` (24px) | 1.2 | `-0.01em` | Section headings |
| `text-xl` | `1.25rem` (20px) | 1.3 | `-0.005em` | Card headlines |
| `text-lg` | `1.125rem` (18px) | 1.4 | `0` | StatCard values |
| `text-base` | `1rem` (16px) | 1.5 | `0` | Body text (rare in terminal UI) |
| `text-sm` | `0.875rem` (14px) | 1.4 | `0` | Default UI text, table cells |
| `text-xs` | `0.75rem` (12px) | 1.3 | `0` | Labels, badges, metadata |
| `text-2xs` | `0.625rem` (10px) | 1.2 | `0.05em` | Micro labels, timestamps |
| `text-3xs` | `0.5625rem` (9px) | 1.2 | `0.15em` | Section headers (uppercase), key hints |
| `text-4xs` | `0.5rem` (8px) | 1.2 | `0.2em` | Version labels, subtle metadata |

**Font weights:**
- `400` — Regular (body text, descriptions)
- `500` — Medium (nav labels, form labels)
- `600` — Semibold (card titles, section headers)
- `700` — Bold (metric values, score badges, logo)

**Font stacks:**
- `font-ui`: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- `font-data`: `'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace`

### 10.3 Spacing Scale

All values in `rem`, mapped as Tailwind spacing utilities (`p-{n}`, `m-{n}`, `gap-{n}`).

| Token | Value | Pixels (at 16px base) | Usage |
|---|---|---|---|
| `0.5` | `0.125rem` | 2px | Micro gaps (inline badge padding) |
| `1` | `0.25rem` | 4px | Tight gaps (icon-text in badges) |
| `1.5` | `0.375rem` | 6px | Small inner padding |
| `2` | `0.5rem` | 8px | Default inner padding, small gaps |
| `2.5` | `0.625rem` | 10px | StatCard internal padding |
| `3` | `0.75rem` | 12px | Card padding, section gaps |
| `4` | `1rem` | 16px | Medium gaps, page gutters (mobile) |
| `5` | `1.25rem` | 20px | Section divider spacing |
| `6` | `1.5rem` | 24px | Card-to-card gaps |
| `8` | `2rem` | 32px | Large section spacing |
| `10` | `2.5rem` | 40px | Sidebar header height, topbar height |
| `12` | `3rem` | 48px | Sidebar collapsed width |
| `16` | `4rem` | 64px | Page section top padding |

### 10.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | `2px` | Badges, small chips |
| `rounded` / `rounded-md` | `4px` | Cards, buttons, inputs (default) |
| `rounded-lg` | `6px` | Modals, command palette |
| `rounded-xl` | `8px` | Large containers, onboarding cards |
| `rounded-full` | `9999px` | Avatars, status dots, pill badges |

> **Note:** The current codebase uses very few rounded corners (terminal aesthetic). Most cards and panels use `rounded-none` or minimal rounding. Do not add rounding where it doesn't exist.

### 10.5 Shadow System

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle depth on elevated elements |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Dropdowns, hover previews |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, command palette |
| `shadow-xl` | `0 12px 40px rgba(0,0,0,0.6)` | Full-screen overlays |
| `shadow-glow-amber` | `0 0 20px rgba(245,166,35,0.08)` | Interactive card hover glow |
| `shadow-glow-cyan` | `0 0 15px rgba(0,229,255,0.10)` | Fresh data / live indicator glow |
| `shadow-glow-green` | `0 0 12px rgba(0,212,170,0.10)` | Positive state glow |
| `shadow-glow-red` | `0 0 12px rgba(255,71,87,0.10)` | Critical alert glow |

### 10.6 Animation Tokens

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `duration-fast` | `100ms` | `ease-out` | Hover color changes, toggle states |
| `duration-normal` | `200ms` | `ease-out` | Most transitions: slide, fade, hover lift |
| `duration-slow` | `300ms` | `ease-out` | Number count-up, complex transitions |
| `duration-slower` | `500ms` | `ease-in-out` | Progress bar fills, chart draws |
| `duration-slowest` | `1000ms` | `ease-in-out` | Score radar draw, page transitions |

**Easing curves:**
- `ease-out` — `cubic-bezier(0.16, 1, 0.3, 1)` — Primary easing for enter animations
- `ease-in-out` — `cubic-bezier(0.45, 0, 0.55, 1)` — Looping animations (pulse, shimmer)
- `ease-in` — `cubic-bezier(0.55, 0.055, 0.675, 0.19)` — Exit animations
- `spring` — `cubic-bezier(0.34, 1.56, 0.64, 1)` — Bouncy entrance (achievement popups)

### 10.7 Z-Index Scale

| Token | Value | Usage |
|---|---|---|
| `z-base` | `0` | Default page content |
| `z-elevated` | `10` | Ticker bar, sticky elements |
| `z-dropdown` | `20` | Topbar, dropdown menus |
| `z-sidebar` | `30` | Sidebar (fixed) |
| `z-overlay` | `40` | Page overlay / backdrop |
| `z-modal` | `50` | Modals, dialogs |
| `z-hover-preview` | `90` | HoverPreview floating cards |
| `z-command-palette` | `100` | Command palette (highest interactive) |
| `z-toast` | `110` | Toast notifications (always on top) |
| `z-tooltip` | `120` | Tooltips (absolute top) |

---

## 11. Tailwind Config Additions

The following is the complete `extend` object for `tailwind.config.ts`. This replaces the existing `extend` block and adds all design token mappings.

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // --- Color Tokens ---
      colors: {
        // Backgrounds
        bg: '#0a0a0a',
        s1: '#111111',
        s2: '#1a1a1a',
        s3: '#222222',
        s4: '#2a2a2a',

        // Borders
        border: '#2a2a2a',
        'border-hover': 'rgba(255,255,255,0.20)',
        'border-focus': '#00e5ff',

        // Text
        text: '#e0e0e0',
        dim: '#888888',
        muted: '#555555',
        faint: 'rgba(255,255,255,0.10)',

        // Accent — Primary
        amber: {
          DEFAULT: '#f5a623',
          dim: 'rgba(245,166,35,0.15)',
          glow: 'rgba(245,166,35,0.30)',
        },

        // Accent — Cyan
        cyan: {
          DEFAULT: '#00e5ff',
          dim: 'rgba(0,229,255,0.15)',
          glow: 'rgba(0,229,255,0.30)',
        },

        // Semantic
        green: '#00d4aa',
        red: '#ff4757',
        blue: '#4a9eff',
        purple: '#a78bfa',

        // Aliases (backward compat)
        accent: '#4a9eff',
        accent2: '#f5a623',
        orange: '#f5a623',
        yellow: '#f5a623',
        pink: '#a78bfa',
      },

      // --- Typography ---
      fontSize: {
        '4xs': ['0.5rem', { lineHeight: '1.2', letterSpacing: '0.2em' }],
        '3xs': ['0.5625rem', { lineHeight: '1.2', letterSpacing: '0.15em' }],
        '2xs': ['0.625rem', { lineHeight: '1.2', letterSpacing: '0.05em' }],
      },

      fontFamily: {
        data: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', '"Cascadia Code"', 'monospace'],
        ui: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },

      // --- Spacing (Tailwind already provides 0.5-16, these are custom aliases) ---
      spacing: {
        'sidebar-collapsed': '48px',
        'sidebar-expanded': '200px',
        'topbar-h': '40px',
        'ticker-h': '28px',
      },

      // --- Shadows ---
      boxShadow: {
        'glow-amber': '0 0 20px rgba(245,166,35,0.08)',
        'glow-cyan': '0 0 15px rgba(0,229,255,0.10)',
        'glow-green': '0 0 12px rgba(0,212,170,0.10)',
        'glow-red': '0 0 12px rgba(255,71,87,0.10)',
      },

      // --- Z-Index ---
      zIndex: {
        'base': '0',
        'elevated': '10',
        'dropdown': '20',
        'sidebar': '30',
        'overlay': '40',
        'modal': '50',
        'hover-preview': '90',
        'command-palette': '100',
        'toast': '110',
        'tooltip': '120',
      },

      // --- Transitions ---
      transitionDuration: {
        'fast': '100ms',
        'normal': '200ms',
        'slow': '300ms',
        'slower': '500ms',
        'slowest': '1000ms',
      },

      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-smooth': 'cubic-bezier(0.45, 0, 0.55, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // --- Keyframes ---
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'ticker-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.2)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(245, 166, 35, 0.15)' },
        },
        'pulse-glow-cyan': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 229, 255, 0.2)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(0, 229, 255, 0.15)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'data-flash': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'card-hover-lift': {
          '0%': { transform: 'translateY(0)', boxShadow: '0 0 0 rgba(0,0,0,0)' },
          '100%': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' },
        },
        'new-item-flash': {
          '0%': { boxShadow: '0 0 0 0 rgba(0,229,255,0.4)' },
          '50%': { boxShadow: '0 0 16px 4px rgba(0,229,255,0.15)' },
          '100%': { boxShadow: '0 0 0 0 rgba(0,229,255,0)' },
        },
        'radar-draw': {
          '0%': { strokeDashoffset: '300', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { strokeDashoffset: '0', opacity: '1' },
        },
        'number-counter': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.95)' },
          '60%': { opacity: '1', transform: 'translateY(-1px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'page-exit': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-4px)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.04' },
          '50%': { opacity: '0.08' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'background-radar': {
          '0%': { transform: 'scale(0)', opacity: '0.03' },
          '50%': { opacity: '0.015' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },

      // --- Animations ---
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        fadeOut: 'fadeOut 200ms ease-out',
        slideInUp: 'slideInUp 200ms ease-out',
        slideInDown: 'slideInDown 200ms ease-out',
        slideInLeft: 'slideInLeft 200ms ease-out',
        slideInRight: 'slideInRight 200ms ease-out',
        'ticker-scroll': 'ticker-scroll 40s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'pulse-glow-cyan': 'pulse-glow-cyan 2s ease-in-out infinite',
        'count-up': 'count-up 300ms ease-out',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        'data-flash': 'data-flash 0.4s ease-out',
        'card-hover-lift': 'card-hover-lift 200ms ease-out forwards',
        'new-item-flash': 'new-item-flash 1s ease-out',
        'radar-draw': 'radar-draw 1000ms ease-out forwards',
        'number-counter': 'number-counter 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'stagger-in': 'stagger-in 300ms ease-out both',
        'page-enter': 'page-enter 300ms ease-out',
        'page-exit': 'page-exit 200ms ease-in',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'background-radar': 'background-radar 60s ease-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
```

---

## 12. Component Specifications

### 12.1 Sidebar

**Dimensions:**
- Collapsed width: `48px` (`w-[48px]`)
- Expanded width: `200px` (`w-[200px]`)
- Height: `100vh` (fixed, `h-screen`)
- Position: `fixed left-0 top-0`

**Transition:**
- Width: `transition-all duration-200 ease-out`
- All child elements crossfade via `opacity` with `duration-fast`

**Sections (top to bottom):**

1. **Logo bar** — Height `40px`. Amber `SI` monogram (font-data, bold). Expanded shows "SponsorIntel" + "TERMINAL v2" sublabel.

2. **Team Status** (expanded only) — Shows agent personas (Aria, Marcus, Priya, Raj, Alex) with green dot indicators. Collapsed: single pulsing green dot. Border bottom separator.

3. **Navigation sections** — Four groups with divider labels:

| Section | Items | Icons (lucide-react) |
|---|---|---|
| **CORE** | Dashboard, Companies, Search, Map, Jobs | `LayoutDashboard`, `Building2`, `Search`, `MapPin`, `Briefcase` |
| **INTEL** | Trends, Signals, Compare | `TrendingUp`, `Zap`, `GitCompareArrows` |
| **PERSONAL** | Watchlist, Tracker, Alerts, Notes | `Star`, `KanbanSquare`, `Bell`, `StickyNote` |
| **SYSTEM** | Engine (admin only) | `Settings` |

**Navigation item anatomy:**
```
┌─────────────────────────────────────┐
│ ▌ [icon] Label        [LIVE] [G D] │  <- expanded
│   [icon]                            │  <- collapsed (centered)
└─────────────────────────────────────┘
```

**States:**
- Default: `text-dim`, `border-l-2 border-transparent`
- Hover: `text-text`, `bg-s2/30`
- Active: `text-amber`, `border-l-2 border-amber`, `bg-amber/5`
- Collapsed active: `text-amber`, `bg-amber/10`, `rounded`

**Badge types:**
- `live` badge: green pulsing dot + "LIVE" text (8px, uppercase, green, tracking-wider)
- `count` badge: cyan pill (`bg-cyan/15 text-cyan`, 8px font-data bold, rounded-full, min-width 14px)

**Section dividers:**
- Label: `text-[9px]`, `font-medium`, `uppercase`, `tracking-[0.2em]`, `text-muted`
- Spacing: `mb-0.5 px-3`
- Margin: `mb-2` between sections

**Collapsed tooltip:**
- Appears on hover, positioned `left-full ml-2`
- Style: `bg-s3 border border-border shadow-lg`, `text-[11px] text-text`

4. **Footer** — Collapse/expand toggle (`PanelLeftClose`/`PanelLeftOpen`, 13px). Version label: `text-[8px] text-muted font-data`.

### 12.2 Topbar

**Dimensions:**
- Height: `40px` (`h-10`)
- Position: `sticky top-0 z-20`
- Background: `bg-s1`, border-bottom `border-border`

**Layout (3-column):**
```
┌──────────┬─────────────────────────────┬──────────────┐
│  spacer  │  [Search command trigger]   │ [Bell] [User]│
└──────────┴─────────────────────────────┴──────────────┘
```

**Command trigger button:**
- Height: `28px` (`h-7`), `max-w-md flex-1`
- Style: `border border-border bg-s2 text-xs text-dim`
- Hover: `border-muted text-text`
- Shows: placeholder text + `Cmd+K` kbd badge
- Kbd style: `border border-border bg-s3 text-[10px] text-muted rounded px-1.5 py-0.5`

**Notification bell:**
- `Bell` icon (15px), amber dot indicator (1.5px, absolute positioned)
- Hover: `bg-s2 text-text`

**User menu:**
- Plan badge: PRO = `bg-amber/20 text-amber`, FREE = `bg-s3 text-muted` (`text-[9px]`, uppercase, tracking-wider)
- Avatar circle: `h-6 w-6 bg-s3 text-[10px] font-bold text-text rounded-full`
- Dropdown: `w-48 border border-border bg-s1 shadow-xl animate-fadeIn rounded`

### 12.3 TickerBar

**Dimensions:**
- Height: `28px` (`h-7`)
- Position: `sticky top-10 z-10` (below topbar)
- Background: `bg-s1/80 backdrop-blur-sm`

**Layout:**
```
┌─────────┬────────────────────────────────────────────┐
│  LIVE ● │  [scrolling ticker content ...]            │
└─────────┴────────────────────────────────────────────┘
```

**LIVE badge (left):**
- Fixed, non-scrolling: `border-r border-border bg-amber/10 px-2`
- Text: `font-data text-[10px] font-bold text-amber tracking-wider`
- Green pulsing dot: `h-1.5 w-1.5 rounded-full bg-green animate-pulse`

**Ticker scroll:**
- CSS animation: `ticker-scroll 40s linear infinite`
- Content duplicated (array spread: `[...events, ...events]`) for seamless loop
- Pauses on `mouseEnter`, resumes on `mouseLeave` (`animationPlayState: 'paused'`)
- Items separated by `│` character (`text-border text-[10px] mx-4`)

**Color coding:**
- `sponsor` type: `text-green`
- `enriched` type: `text-cyan`
- `stat` type: `text-amber`

**Data sources:**
- Recent 10 sponsors (ordered by `created_at DESC`)
- Aggregate stats: total sponsors count, A-rated count, Companies House matched count
- Future: live Supabase Realtime events

### 12.4 Card Variants

All cards use the base `Card` component. Variants are applied via `className` props or wrapper components.

**Base Card:**
```
border border-border bg-s1 p-3 transition-all duration-200
```

**Variant: Interactive (hover lift)**
```css
/* Adds on top of base */
hover:border-amber/20
hover:shadow-glow-amber
cursor-pointer
/* Optional translateY on hover: */
hover:-translate-y-0.5
```
Usage: Sponsor list items, clickable dashboard cards.

**Variant: Highlighted (accent border)**
```css
/* Left accent border */
border-l-2 border-l-cyan
/* or for fresh data: */
border-l-2 border-l-cyan bg-cyan/[0.02]
```
Usage: Fresh data cards (< 24h), selected items.

**Variant: Metric (StatCard with sparkline)**
```
border-l-2 border-l-{color} !p-2.5 group relative overflow-hidden
```
- Icon slot: top-right, `text-dim`
- Value: `font-data text-lg font-bold tabular-nums`
- Trend: `TrendIndicator` component (green up, red down, gray flat, 10px icon + 10px text)
- Sparkline: bottom-right, `opacity-60 group-hover:opacity-100`, 56x18px SVG
- Hover glow: `bg-gradient-to-br from-amber/[0.02] to-transparent opacity-0 group-hover:opacity-100`

**Variant: Loading Skeleton**
```css
/* Replace content with animated placeholders */
.animate-pulse {
  /* Label placeholder: h-2.5 bg-s2 rounded w-16 */
  /* Value placeholder: h-5 bg-s2 rounded w-12 */
}
```

**Variant: Glass (modals only)**
```css
bg-s1/80 backdrop-blur-sm border border-border
```

### 12.5 StatCard

**Props:**
```typescript
interface StatCardProps {
  label: string;          // Uppercase micro label
  value: string | number; // Main metric value
  subtitle?: string;      // Contextual subtitle
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan' | 'amber';
  icon?: React.ReactNode; // Top-right icon (lucide-react, 14-16px)
  sparklineData?: number[];    // Array of numeric values for sparkline
  sparklineColor?: string;     // Hex color for sparkline stroke
  trend?: { value: number; suffix?: string }; // Trend indicator
  compact?: boolean;      // Reduced padding mode (default: true)
  loading?: boolean;      // Show skeleton state
}
```

**Layout:**
```
┌──────────────────────────────┐
│ LABEL                 [icon] │  <- 9px uppercase tracking dim
│ 140,910              ╱╲╱╲╱  │  <- 18px bold tabular-nums + sparkline
│ enriched: 54%  ▲ +3.2%      │  <- 10px dim + trend indicator
└──────────────────────────────┘
```

**Value formatting rules:**
- Numbers >= 1,000,000: `X.XM` (e.g., `1.2M`)
- Numbers >= 1,000: `X.XK` (e.g., `140.9K`)
- Percentages: `X.X%`
- Currency: `$XX,XXX` or `$X.XK`
- All numeric values use `font-data` + `tabular-nums` for alignment

**Trend arrow colors:**
- Positive (`> 0`): `text-green`, `TrendingUp` icon
- Neutral (`=== 0`): `text-dim`, `Minus` icon
- Negative (`< 0`): `text-red`, `TrendingDown` icon
- Format: `+X.X%` or `-X.X%` (always show sign)

### 12.6 Table

**Structure:**
```html
<div class="overflow-x-auto">  <!-- horizontal scroll on mobile -->
  <table class="data-table w-full">
    <thead>
      <tr>
        <th class="sticky top-0 ...">Column</th>  <!-- sticky header -->
      </tr>
    </thead>
    <tbody>
      <tr class="h-7 cursor-pointer hover:bg-s2">
        <td class="px-3 text-sm font-data border-t border-border/50">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Header cells (`th`):**
- `sticky top-0 bg-s1` (stays visible during scroll)
- `text-[10px] font-semibold uppercase tracking-widest text-dim`
- `cursor-pointer select-none` (sortable)
- `height: 28px; line-height: 28px`
- Sort indicator: `ChevronUp`/`ChevronDown` icon (10px) next to sorted column header text, `text-amber` when active

**Body cells (`td`):**
- `text-sm font-data` for numeric data
- `height: 28px; line-height: 28px` (compact rows)
- `font-variant-numeric: tabular-nums` for number alignment
- `border-t border-border/50`

**Row states:**
- Default: transparent background
- Hover: `bg-s2/50`
- Selected (keyboard nav): `bg-s2`
- Updated (live): `animate-data-flash` (0.4s cyan flash)

**Empty state:**
```
┌──────────────────────────────────────────┐
│                                          │
│           [SearchX icon, 32px]           │
│                                          │
│     No sponsors match your filters       │
│                                          │
│   Try broadening your search criteria    │
│                                          │
│         [ Adjust Filters ]               │
│                                          │
└──────────────────────────────────────────┘
```

**Loading skeleton rows:**
- 8 rows of animated `bg-s2 rounded` blocks
- Column widths match actual content proportions
- Uses `animate-pulse` or custom `skeleton-shimmer` class
- Staggered animation delay: each row +30ms

### 12.7 Badge

**Size variants:**

| Size | Font Size | Padding | Height |
|---|---|---|---|
| `sm` | `9px` | `px-1 py-0.5` | auto (~16px) |
| `md` | `10px` | `px-1.5 py-0.5` | auto (~18px) |

**Color variants:**

| Variant | Background | Text | Border |
|---|---|---|---|
| `default` | `bg-s3` | `text-dim` | `border border-border` |
| `green` | `bg-green/15` | `text-green` | `border border-green/20` |
| `red` | `bg-red/15` | `text-red` | `border border-red/20` |
| `amber` | `bg-amber/15` | `text-amber` | `border border-amber/20` |
| `blue` | `bg-accent/15` | `text-accent` | `border border-accent/20` |
| `cyan` | `bg-cyan/15` | `text-cyan` | `border border-cyan/20` |
| `purple` | `bg-purple/15` | `text-purple` | `border border-purple/20` |

**Semantic badge presets:**

| Use Case | Variant | Label Examples |
|---|---|---|
| Impact: Critical | `red` | `CRITICAL`, `REVOKED` |
| Impact: High | `amber` | `HIGH`, `WARNING` |
| Impact: Medium | `blue` | `MEDIUM`, `INFO` |
| Impact: Low | `default` | `LOW`, `MINOR` |
| Status: Active | `green` | `ACTIVE`, `A-Rated` |
| Status: Revoked | `red` | `REVOKED`, `B-Rated` |
| Status: Pending | `amber` | `PENDING`, `IN REVIEW` |
| Data freshness | `cyan` | `NEW`, `LIVE`, `UPDATED` |

**RatingBadge:**
- A-rated: `badge-a` → `bg-green/15 text-green border border-green/20`, content: "A-Rated"
- B-rated: `badge-b` → `bg-red/15 text-red border border-red/20`, content: "B-Rated"

**ScoreBadge:**
- Score >= 80: `bg-green/20 text-green`
- Score >= 60: `bg-amber/20 text-amber`
- Score < 60: `bg-red/20 text-red`
- Font: `font-data text-[11px] font-bold tabular-nums`
- Optional trend icon: `TrendingUp`/`TrendingDown`/`Minus`

### 12.8 CommandPalette

**Trigger:**
- Keyboard: `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux)
- Click: Topbar search bar
- State managed in `AppShell` via `useState<boolean>`

**Layout:**
```
┌──────────────────────────────────────────┐
│  🔍  Search sponsors, pages, actions... │ESC│
├──────────────────────────────────────────┤
│ SPONSORS                                 │
│ > Deloitte LLP · London · Technology   A │
│   KPMG UK · Manchester                 A │
│                                          │
│ PAGES                                    │
│   Dashboard                              │
│   Search                                 │
│                                          │
│ ACTIONS                                  │
│   Toggle Sidebar                         │
│   Export Data                            │
├──────────────────────────────────────────┤
│ ↑↓ navigate   ↵ select   esc close      │
└──────────────────────────────────────────┘
```

**Overlay:**
- Backdrop: `bg-black/70 backdrop-blur-sm fixed inset-0`
- Palette: `max-w-xl w-full`, positioned `pt-[12vh]` from top
- Entrance: `animate-slideInUp`
- Shadow: `shadow-2xl shadow-amber/5`
- Border: `border border-border bg-s1`

**Search input:**
- `Search` icon (16px), pulses amber when searching
- Input: `bg-transparent text-sm text-text placeholder-dim outline-none`
- Debounce: 200ms before Supabase query fires
- ESC kbd badge: `border border-border bg-s2 font-data text-[10px] text-dim`

**Result sections:**
- Category headers: `text-[10px] font-semibold uppercase tracking-widest text-dim`
- Category order: Sponsors > Pages > Actions
- Max results per category: 8

**Result item anatomy:**
```
┌──────────────────────────────────────┐
│ [icon]  Label   · subtitle    [badge]│
└──────────────────────────────────────┘
```
- Selected: `bg-s2 text-amber` + `ArrowRight` indicator (12px, amber)
- Default: `text-text hover:bg-s2`
- Icon: 14px, `text-dim` default, `text-amber` when selected

**Keyboard navigation:**
- `ArrowDown` / `ArrowUp`: move selection
- `Enter`: execute selected action
- `Escape`: close palette
- Auto-scroll selected item into view (`scrollIntoView({ block: 'nearest' })`)

**Recent items (future Phase 2):**
- Show last 5 searches when query is empty
- Stored in `localStorage` key: `si-recent-searches`
- Format: `{ query: string, timestamp: number, resultCount: number }[]`

**Mobile behavior:**
- Full screen (`inset-0`) instead of centered modal
- No backdrop blur (performance)
- Input auto-focused with virtual keyboard

---

## 13. Animation Specifications

### 13.1 Page Transitions

```css
@keyframes page-enter {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes page-exit {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}
```
- Duration: `300ms` enter, `200ms` exit
- Easing: `ease-out` enter, `ease-in` exit
- Applied via wrapper `<div>` in page components
- Implementation: CSS class toggled on mount/unmount, or `framer-motion` `AnimatePresence` if already in deps

### 13.2 Card Hover (Lift + Shadow)

```css
@keyframes card-hover-lift {
  0% { transform: translateY(0); box-shadow: 0 0 0 rgba(0,0,0,0); }
  100% { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
}
```
- Trigger: `:hover` on `interactive` Card variant
- Duration: `200ms ease-out`
- Reset: `200ms` return to origin on mouse leave
- **Preferred approach:** Use Tailwind `hover:-translate-y-0.5 hover:shadow-lg` classes rather than keyframe animation for simplicity. Reserve keyframe for coordinated multi-property animations.

### 13.3 Skeleton Pulse

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.04; }
  50% { opacity: 0.08; }
}
/* Shimmer variant (horizontal sweep): */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```
- Duration: `1.5s ease-in-out infinite`
- Shimmer gradient: `linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.03) 50%, transparent 75%)`
- Background-size: `200% 100%`
- Applied to: placeholder blocks matching content layout dimensions

### 13.4 Ticker Scroll

```css
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```
- Duration: `40s linear infinite`
- Content: duplicated array for seamless loop
- Pause: `animation-play-state: paused` on `:hover`
- Performance: `will-change: transform` on the scrolling container
- **Reduced motion:** Replace with static display (no scroll), show first 3 items with "..." overflow

### 13.5 New Item Flash (Cyan Glow Pulse)

```css
@keyframes new-item-flash {
  0% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.4); }
  50% { box-shadow: 0 0 16px 4px rgba(0, 229, 255, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
}
```
- Duration: `1s ease-out` (one-shot, not infinite)
- Trigger: applied when a new row/card appears via Realtime subscription
- Accompaniment: `border-l-2 border-l-cyan` on the element
- Remove class after animation completes (via `animationend` event or 1s timeout)

### 13.6 Score Radar Draw

```css
@keyframes radar-draw {
  0% { stroke-dashoffset: 300; opacity: 0; }
  50% { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
```
- Duration: `1000ms ease-out`
- Applied to: SVG `<polygon>` or `<path>` elements in `ScoreRadar` component
- Requires: `stroke-dasharray: 300` set on the element
- Trigger: on component mount (first render of company profile)
- Each axis line draws sequentially with stagger (7 axes = 7 x 100ms delay)

### 13.7 Number Counter (Count-Up from 0)

```css
@keyframes number-counter {
  0% { opacity: 0; transform: translateY(8px) scale(0.95); }
  60% { opacity: 1; transform: translateY(-1px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
```
- Duration: `400ms` with spring easing `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Implementation: `NumberAnimation` component uses `requestAnimationFrame` loop
  - Interpolates from `previousValue` to `newValue` over `300ms`
  - Uses `Math.round()` for integer display
  - Formats via `formatNumber()` utility at each frame
- Trigger: on value change (prop comparison via `useEffect`)
- **Reduced motion:** Skip animation, show final value immediately

### 13.8 Stagger Entrance (Cards Appearing One by One)

```css
.stagger-item {
  animation: stagger-in 300ms ease-out both;
}
.stagger-item:nth-child(1)  { animation-delay: 0ms; }
.stagger-item:nth-child(2)  { animation-delay: 30ms; }
.stagger-item:nth-child(3)  { animation-delay: 60ms; }
/* ... continues +30ms per child, up to 10 */
.stagger-item:nth-child(10) { animation-delay: 270ms; }
```
- Base delay increment: `30ms` per item
- Max stagger: 10 items (300ms total). Items beyond 10 use `animation-delay: 270ms` (no further stagger).
- Used on: dashboard cards, search results, feed items
- **Reduced motion:** All items appear simultaneously with `animation: none`

---

## 14. Responsive Breakpoints

### Breakpoint Definitions

| Name | Min Width | Tailwind Prefix |
|---|---|---|
| Mobile | `0px` | (default) |
| Tablet | `768px` | `md:` |
| Desktop | `1024px` | `lg:` |
| Wide | `1280px` | `xl:` |
| Ultra | `1536px` | `2xl:` |

### 14.1 Sidebar Responsiveness

| Breakpoint | Behavior |
|---|---|
| Mobile (`< 768px`) | Hidden by default. Hamburger menu in topbar opens as overlay (full-height, `z-40`). Tap outside or X button closes. No collapsed state. |
| Tablet (`768px - 1023px`) | Collapsed by default (`48px`). Toggle expands to `200px` as overlay (push content or overlap). |
| Desktop (`>= 1024px`) | Expanded by default (`200px`). Toggle collapses to `48px`. Content area adjusts `marginLeft`. |

**Mobile overlay sidebar:**
- Backdrop: `bg-black/50 fixed inset-0 z-35`
- Sidebar: `fixed left-0 top-0 z-40 w-[240px]` (slightly wider for touch targets)
- Entrance: `animate-slideInLeft`
- All nav items have larger touch targets: `min-h-[44px]` (WCAG touch target minimum)

### 14.2 Dashboard Grid

| Breakpoint | Stat Row | Chart Area | Feed |
|---|---|---|---|
| Mobile | 2-col grid | 1-col stacked | Full width |
| Tablet | 2-col grid | 2-col grid | Full width |
| Desktop | 4-col grid | 2-col grid | Full width |
| Wide+ | 4-col grid | 3-col grid | Full width |

```html
<!-- Stat row -->
<div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">

<!-- Chart area -->
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

<!-- Feed -->
<div class="w-full">
```

### 14.3 Table Responsiveness

| Breakpoint | Behavior |
|---|---|
| Mobile (`< 768px`) | Horizontal scroll (`overflow-x-auto`). First column (company name) sticky (`sticky left-0 bg-s1 z-10`). Minimum column widths enforced. |
| Tablet | Full table visible if <= 6 columns. Otherwise horizontal scroll. |
| Desktop | Full width, all columns visible. Keyboard navigation enabled. |

**Mobile table enhancements:**
- Fade gradient on right edge to indicate scrollability: `after:absolute after:right-0 after:top-0 after:h-full after:w-8 after:bg-gradient-to-l after:from-bg after:to-transparent`
- Scroll snap on columns: `scroll-snap-type: x proximity`

### 14.4 Command Palette Responsiveness

| Breakpoint | Behavior |
|---|---|
| Mobile (`< 768px`) | Full screen: `fixed inset-0 z-command-palette`. No backdrop blur. Input at top with larger font (16px to prevent iOS zoom). Results fill remaining height. |
| Tablet+ | Centered modal: `max-w-xl`, positioned `pt-[12vh]`. Backdrop blur. |

### 14.5 Company Profile

| Breakpoint | Behavior |
|---|---|
| Mobile | Stacked: header (full width) -> tabs (horizontal scroll) -> content (full width). Score radar smaller (200px). |
| Tablet | Header with side-by-side layout (info left, score right). Tabs horizontal. Content full width. |
| Desktop | Full layout with sidebar for quick actions. Tabs as designed. |

---

## 15. Accessibility Requirements (WCAG 2.1 AA)

### 15.1 Focus Visible Ring

All interactive elements must show a visible focus indicator when focused via keyboard:

```css
*:focus-visible {
  outline: 2px solid #00e5ff;   /* cyan, high contrast against dark bg */
  outline-offset: 2px;
}
```

- Ring color: `--color-cyan` (`#00e5ff`) — 8.59:1 contrast against `#0a0a0a`
- Ring width: `2px solid`
- Offset: `2px`
- Do NOT use `outline: none` on any interactive element
- Custom focus styles allowed if they meet contrast requirements

### 15.2 Skip Navigation Link

Add a visually-hidden skip link as the first focusable element in `AppShell`:

```html
<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-amber focus:text-bg focus:px-4 focus:py-2 focus:rounded focus:font-semibold"
>
  Skip to main content
</a>
<!-- ... -->
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

### 15.3 Reduced Motion

Respect the `prefers-reduced-motion: reduce` media query:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .animate-ticker-scroll {
    animation: none !important;
  }

  .animate-pulse {
    animation: none !important;
  }

  .stagger-item {
    animation: none !important;
    opacity: 1 !important;
  }
}
```

**Component-level behavior:**
- `NumberAnimation`: show final value immediately (no interpolation)
- `Sparkline`: render static (no draw animation)
- `ScoreRadar`: render fully drawn (no stroke-dashoffset animation)
- `TickerBar`: display first 3 items statically, no scroll
- All hover transitions: instant state change
- Page transitions: instant swap (no fade/slide)

### 15.4 Color Contrast

All text must meet WCAG AA contrast ratios against their backgrounds:

| Text Element | Foreground | Background | Ratio | Passes AA? |
|---|---|---|---|---|
| Primary text | `#e0e0e0` | `#0a0a0a` | 14.7:1 | Yes (normal+large) |
| Primary text on card | `#e0e0e0` | `#111111` | 12.7:1 | Yes |
| Secondary text (dim) | `#888888` | `#0a0a0a` | 5.6:1 | Yes (normal+large) |
| Secondary text on card | `#888888` | `#111111` | 4.84:1 | Yes (normal+large) |
| Muted text | `#555555` | `#0a0a0a` | 2.6:1 | NO — only for decorative/non-essential text |
| Amber accent | `#f5a623` | `#0a0a0a` | 8.2:1 | Yes |
| Cyan accent | `#00e5ff` | `#0a0a0a` | 10.3:1 | Yes |
| Green | `#00d4aa` | `#0a0a0a` | 8.6:1 | Yes |
| Red | `#ff4757` | `#0a0a0a` | 5.0:1 | Yes (normal+large) |

**Rules:**
- `text-muted` (`#555555`): ONLY for decorative elements, version labels, and non-essential metadata. Never for content the user needs to read.
- All essential information must use `text-dim` (`#888888`) minimum.
- Badge text against badge backgrounds must meet 4.5:1.

### 15.5 Screen Reader Support

**Icon-only buttons:** Every button that contains only an icon must have an `aria-label`:
```tsx
<button aria-label="Notifications" className="...">
  <Bell size={15} />
</button>

<button aria-label="Collapse sidebar" className="...">
  <PanelLeftClose size={13} />
</button>
```

**Live regions:** Dynamic content areas must use ARIA live regions:
```tsx
{/* Live feed updates */}
<div role="log" aria-live="polite" aria-label="Live sponsor updates">
  {feedItems.map(...)}
</div>

{/* Score changes */}
<div role="status" aria-live="polite" aria-atomic="true">
  Score: {score}
</div>

{/* Loading states */}
<div role="status" aria-live="polite">
  {loading ? 'Loading sponsors...' : `${count} sponsors found`}
</div>
```

**Data tables:**
- Use `<caption>` element (can be visually hidden with `sr-only`)
- Sortable columns: `aria-sort="ascending"` / `"descending"` / `"none"`
- Selected row: `aria-selected="true"`

**Score badges:**
- `aria-label="Overall score: 72 out of 100"` (not just "72")

**Ticker bar:**
- `role="marquee"` with `aria-label="Live sponsor updates ticker"`
- Or `aria-hidden="true"` if content is duplicated elsewhere on the page

### 15.6 Keyboard Navigation

**Global shortcuts:**
| Key | Action |
|---|---|
| `Cmd+K` / `Ctrl+K` | Open command palette |
| `Escape` | Close any open modal, palette, or dropdown |
| `?` | Open keyboard shortcut reference overlay |
| `Ctrl+B` | Toggle sidebar |

**Navigation shortcuts (two-key sequences):**
| Keys | Action |
|---|---|
| `G` then `D` | Go to Dashboard |
| `G` then `S` | Go to Search |
| `G` then `B` | Go to Companies |
| `G` then `M` | Go to Map |
| `G` then `J` | Go to Jobs |
| `G` then `T` | Go to Trends |
| `G` then `I` | Go to Signals |
| `G` then `C` | Go to Compare |
| `G` then `W` | Go to Watchlist |
| `G` then `K` | Go to Tracker |
| `G` then `A` | Go to Alerts |
| `G` then `N` | Go to Notes |
| `G` then `E` | Go to Engine (admin) |

**Table navigation (when a table is focused):**
| Key | Action |
|---|---|
| `j` / `ArrowDown` | Next row |
| `k` / `ArrowUp` | Previous row |
| `Enter` | Open selected row |
| `x` | Toggle selection (future: bulk actions) |

**Command palette navigation:**
| Key | Action |
|---|---|
| `ArrowDown` / `ArrowUp` | Move selection |
| `Enter` | Execute selected action |
| `Escape` | Close palette |

**Tab order:**
1. Skip navigation link
2. Sidebar navigation items (top to bottom)
3. Topbar: search trigger, notification bell, user menu
4. Main content area (natural DOM order)
5. Focus trap in modals (Tab cycles within modal content)

**Focus trap implementation (modals and command palette):**
- Trap focus within the modal when open
- `Tab` and `Shift+Tab` cycle through focusable elements inside
- `Escape` closes and returns focus to the trigger element
- Use `inert` attribute on background content when modal is open

---

## 16. Dark Mode Implementation

The app is exclusively dark-themed. There is no light mode toggle.

### 16.1 CSS Custom Properties on `:root`

```css
:root {
  /* Background hierarchy (darkest to lightest) */
  --bg-page: #0a0a0a;          /* Page background */
  --bg-card: #111111;          /* Card/panel surface (s1) */
  --bg-elevated: #1a1a1a;     /* Dropdown, hover state (s2) */
  --bg-inset: #222222;        /* Wells, inset areas (s3) */
  --bg-active: #2a2a2a;       /* Active state, deep inset (s4) */

  /* Text hierarchy (brightest to dimmest) */
  --text-primary: rgba(255, 255, 255, 0.95);    /* #e0e0e0 approx */
  --text-secondary: rgba(255, 255, 255, 0.55);  /* #888888 approx */
  --text-muted: rgba(255, 255, 255, 0.30);      /* #555555 approx */
  --text-faint: rgba(255, 255, 255, 0.10);      /* Disabled state */

  /* Border hierarchy */
  --border-default: rgba(255, 255, 255, 0.10);  /* #2a2a2a approx */
  --border-hover: rgba(255, 255, 255, 0.20);    /* Hover state */
  --border-focus: #00e5ff;                        /* Keyboard focus */
  --border-accent: rgba(245, 166, 35, 0.30);    /* Amber accent border */

  /* Accent colors */
  --accent-primary: #f5a623;    /* Amber */
  --accent-secondary: #00e5ff;  /* Cyan */
  --accent-positive: #00d4aa;   /* Green */
  --accent-negative: #ff4757;   /* Red */
  --accent-info: #4a9eff;       /* Blue */
  --accent-tertiary: #a78bfa;   /* Purple */
}
```

### 16.2 Background Hierarchy Usage

| Level | Variable | Tailwind | When to Use |
|---|---|---|---|
| 0 | `--bg-page` | `bg-bg` | Page body, main container |
| 1 | `--bg-card` | `bg-s1` | Cards, sidebar, topbar, panels |
| 2 | `--bg-elevated` | `bg-s2` | Dropdowns, hover backgrounds, command palette input |
| 3 | `--bg-inset` | `bg-s3` | Kbd badges, avatar circles, progress track, inset wells |
| 4 | `--bg-active` | `bg-s4` | Active/pressed state, deep inset |

**Rule:** Never skip more than one level. A card (`s1`) can contain `s2` or `s3` elements, but the page (`bg`) should not directly contain `s3` without a card wrapper.

### 16.3 Text Hierarchy Usage

| Level | Variable | Tailwind | When to Use |
|---|---|---|---|
| Primary | `--text-primary` | `text-text` | Headings, body copy, metric values, user-facing content |
| Secondary | `--text-secondary` | `text-dim` | Labels, descriptions, metadata, table secondary columns |
| Muted | `--text-muted` | `text-muted` | Placeholders, version labels, disabled items, non-essential decoration |
| Faint | `--text-faint` | `text-faint` | Separator characters, ghost text |

### 16.4 Border Usage

| State | Variable | Tailwind | Example |
|---|---|---|---|
| Default | `--border-default` | `border-border` | Card borders, table cell borders, sidebar border |
| Hover | `--border-hover` | `border-border-hover` | Card hover state, input hover |
| Focus | `--border-focus` | `border-border-focus` | Keyboard focus ring (outline, not border) |
| Accent | `--border-accent` | `border-amber/30` | Interactive card hover, highlighted items |
| Subtle | `border-border/50` | `border-border/50` | Table row borders (less prominent) |

---

## 17. Loading & Error States

Every page and dynamic section must handle four states: loading, loaded, error, and empty.

### 17.1 Skeleton Loading

Skeleton placeholders must match the exact layout dimensions of the loaded content to prevent CLS (Cumulative Layout Shift).

**Dashboard page skeleton:**
```
┌─────────┬─────────┬─────────┬─────────┐
│ ▓▓▓▓    │ ▓▓▓▓    │ ▓▓▓▓    │ ▓▓▓▓    │  <- 4 StatCard skeletons
│ ▓▓▓     │ ▓▓▓     │ ▓▓▓     │ ▓▓▓     │     (h-2.5, h-5 blocks)
└─────────┴─────────┴─────────┴─────────┘
┌──────────────────────┬────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  <- 2 chart skeletons
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │     (h-48 blocks)
└──────────────────────┴────────────────────┘
```

**Skeleton block styles:**
```css
.skeleton-block {
  @apply bg-s2 rounded animate-pulse;
}

/* Or shimmer variant: */
.skeleton-shimmer {
  background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.03) 50%, transparent 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

**Rules:**
- Skeleton must have the same height as the real content
- Use staggered animation delays on skeleton rows (same as stagger-item)
- Transition from skeleton to content: crossfade with `animate-fadeIn` (200ms)

### 17.2 Error State

```
┌──────────────────────────────────────────┐
│                                          │
│          [AlertTriangle icon, 32px]      │
│              text-red                    │
│                                          │
│       Something went wrong               │
│       text-text text-sm                  │
│                                          │
│   Unable to load sponsor data.           │
│   text-dim text-xs                       │
│                                          │
│          [ Try Again ]                   │
│          Button variant="amber"          │
│                                          │
└──────────────────────────────────────────┘
```

**Error component props:**
```typescript
interface ErrorStateProps {
  title?: string;       // Default: "Something went wrong"
  message?: string;     // Specific error description
  onRetry?: () => void; // Retry callback
  icon?: React.ReactNode; // Custom icon (default: AlertTriangle)
}
```

### 17.3 Empty State

Contextual empty states with actionable suggestions (see section 9 of original spec for specific messages).

```
┌──────────────────────────────────────────┐
│                                          │
│          [SearchX icon, 32px]            │
│              text-dim                    │
│                                          │
│     No A-rated sponsors match            │
│     this filter                          │
│     text-text text-sm                    │
│                                          │
│   23 B-rated sponsors match.             │
│   Try relaxing the rating filter.        │
│   text-dim text-xs                       │
│                                          │
│       [ Adjust Filters ]                 │
│       Button variant="secondary"         │
│                                          │
└──────────────────────────────────────────┘
```

**Empty state component props:**
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;     // Contextual icon
  title: string;              // Primary message
  description?: string;       // Helpful guidance
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Per-page empty states:**

| Page | Icon | Title | Description | Action |
|---|---|---|---|---|
| Search | `SearchX` | No sponsors match your filters | Try broadening location or relaxing the rating filter. X sponsors match with fewer filters. | Adjust Filters |
| Jobs | `Briefcase` | No jobs found | Try broadening the location or checking similar roles. | Clear Filters |
| Watchlist | `Star` | Your watchlist is empty | Start watching companies to track their activity and changes. | Browse Companies |
| Signals | `Zap` | No signals yet | Signals appear when sponsors change ratings, post jobs, or trigger alerts. | Set Up Alerts |
| Company Jobs Tab | `Briefcase` | No jobs found for this company | This company hasn't posted jobs recently, or they aren't on tracked job boards. | -- |
| Company Reviews Tab | `MessageCircle` | No reviews yet | Be the first to share your experience with this company. | Write Review |

### 17.4 Partial Error

When a page has multiple sections and one fails:

```
┌──────────────────────────────────────────┐
│ Working Section                          │
│ [normal content renders]                 │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ ⚠ Failed to load industry trends         │
│                               [ Retry ]  │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Another Working Section                  │
│ [normal content renders]                 │
└──────────────────────────────────────────┘
```

- Partial error: contained within a single card, amber border-left
- Icon: `AlertTriangle` (14px, `text-amber`)
- Message: one line, `text-sm text-dim`
- Retry button: `Button variant="ghost" size="sm"`
- Rest of page remains fully functional

---

## 18. Page Layout Specifications

### 18.1 Dashboard

```
┌──────────────────────────────────────────────────┐
│ Daily Briefing Banner                            │  <- Full width, bg-s1
│ "3 new A-rated sponsors, 2 salary changes..."    │     border-l-2 border-l-cyan
└──────────────────────────────────────────────────┘

┌────────┬────────┬────────┬────────┐
│ Total  │ A-Rated│ Active │ Enrichd│              <- 4-col stat row
│140,910 │ 98,234 │ 8,697  │ 54.2%  │                 StatCard with sparklines
│▲ +1.2% │▲ +0.8% │▲ +3.1% │▲ +2.4% │
└────────┴────────┴────────┴────────┘

┌─────────────────────┬──────────────────────┐
│ Growth Chart        │ Industry Breakdown   │     <- 2-col chart area
│ [30d sponsor trend] │ [pie/bar chart]      │
│                     │                      │
└─────────────────────┴──────────────────────┘

┌──────────────────────────────────────────────────┐
│ Live Feed                                        │  <- Full width, scrolling
│ [event] [event] [event] ...                      │     max-h with overflow-y
│                                                  │     Supabase Realtime
└──────────────────────────────────────────────────┘
```

**Grid implementation:**
```tsx
<div className="space-y-3">
  {/* Briefing */}
  <DailyBriefing />

  {/* Stats row */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <StatCard ... />
    <StatCard ... />
    <StatCard ... />
    <StatCard ... />
  </div>

  {/* Charts */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <GrowthChart />
    <IndustryBreakdown />
  </div>

  {/* Feed */}
  <LiveFeed />
</div>
```

### 18.2 Search

```
┌───────────────────────────────────────────────────────┐
│ Filter Bar (full width)                               │
│ [Rating ▾] [City ▾] [Industry ▾] [Route ▾] [Reset]  │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ Results: 23,456 sponsors     Sort: Score ▾  Export ↗  │
├───────────────────────────────────────────────────────┤
│ Name          │ City     │ Rating │ Score │ Jobs │ ... │
│ Deloitte LLP  │ London   │ A      │  87   │  12  │     │
│ KPMG UK       │ Manches  │ A      │  82   │   8  │     │
│ ...           │ ...      │ ...    │  ...  │  ... │     │
└───────────────────────────────────────────────────────┘
```

**Layout:** Single column. Filter bar at top, results table below.

**Mobile:** Filters collapse into a "Filters" button that opens a slide-in panel from the right.

### 18.3 Company Profile

```
┌───────────────────────────────────────────────────────┐
│ Profile Header                                        │
│ [Logo] Company Name         Score: 72  Rating: A      │
│        London · Technology · Since 2019               │
│        [Watch] [Compare] [Share]                      │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ [Overview] [Jobs] [Financials] [People] [Reviews] ... │  <- TabNav
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ Tab Content Area                                      │
│                                                       │
│ (varies by selected tab)                              │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Tab navigation:**
- Horizontal scrollable on mobile (`overflow-x-auto`)
- Active tab: `border-b-2 border-amber text-amber`
- Inactive tab: `text-dim hover:text-text`
- Tab height: `40px`

### 18.4 Intel Feed (Signals Page)

```
┌───────────────────────────────────────────────────────┐
│ Filter Pills: [All] [Rating Changes] [New Sponsors]  │
│               [Jobs] [Compliance] [Financial]         │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│                                                       │
│ Signal Card                                           │
│ ● RATING CHANGE  ·  2 hours ago                       │
│ Acme Corp downgraded from A to B rating               │
│ [View Company →]                                      │
│                                                       │
│ Signal Card                                           │
│ ● NEW SPONSOR  ·  5 hours ago                         │
│ TechStartup Ltd added as A-rated sponsor              │
│ [View Company →]                                      │
│                                                       │
│ ...                                                   │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│          ↑ 3 new signals since you started viewing    │  <- Floating button
└───────────────────────────────────────────────────────┘
```

**Floating "new items" button:**
- Position: `fixed bottom-6 left-1/2 -translate-x-1/2 z-20`
- Style: `bg-cyan/20 text-cyan border border-cyan/30 rounded-full px-4 py-2 text-sm`
- Animation: `animate-slideInUp` when new items arrive
- Click: smooth-scrolls to top and loads new items
- Auto-hides if user scrolls to top

---

## 19. Performance Targets

### 19.1 Core Web Vitals

| Metric | Target | Measurement |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | Dashboard stat cards (largest visible elements) |
| **FID** (First Input Delay) | < 100ms | Command palette open, filter interaction |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Skeleton loading preventing layout shift |
| **INP** (Interaction to Next Paint) | < 200ms | Any button click or navigation |
| **TTFB** (Time to First Byte) | < 800ms | Vercel edge network |

### 19.2 Bundle Size Targets

| Bundle | Target (gzipped) | Strategy |
|---|---|---|
| Initial JS | < 150KB | Code split pages, dynamic imports for heavy components |
| Per-page JS | < 50KB | Lazy load charts (Recharts), maps, complex UIs |
| CSS | < 30KB | Tailwind purge, minimal custom CSS |
| Font (Inter) | < 40KB | `next/font` subsetting, `display: swap` |
| Font (JetBrains Mono) | < 30KB | `next/font` subsetting, only 400/500/700 weights |

**Code splitting strategy:**
```tsx
// Heavy components loaded dynamically
const ScoreRadar = dynamic(() => import('@/components/company/ScoreRadar'), {
  loading: () => <SkeletonBlock className="h-48 w-48" />,
  ssr: false,
});

const UKMap = dynamic(() => import('@/components/map/UKMap'), {
  loading: () => <SkeletonBlock className="h-96" />,
  ssr: false,
});

const GrowthChart = dynamic(() => import('@/components/dashboard/GrowthChart'), {
  loading: () => <SkeletonBlock className="h-64" />,
  ssr: false,
});
```

### 19.3 Image Optimization

- All images via `next/image` component
- Blur placeholder: generate at build time with `playholder="blur"`
- Formats: WebP primary, AVIF secondary (auto via Next.js)
- Lazy loading: default `loading="lazy"` for below-fold images
- Sizes attribute: always specify to prevent downloading oversized images
- Company logos (future): 64x64 max, served from Supabase Storage with CDN

### 19.4 Font Loading

Already implemented in `layout.tsx` using `next/font`:

```tsx
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
  display: 'swap',  // Ensure text visible during font load
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-data',
  weight: ['400', '500', '700'],
  display: 'swap',
});
```

- `display: swap` ensures text is visible immediately with fallback font
- Font files self-hosted by Next.js (no external Google Fonts request at runtime)
- Remove the `@import url('https://fonts.googleapis.com/...')` from `globals.css` — it is redundant since `next/font` already handles font loading

### 19.5 Data Fetching Optimization

- **Supabase queries:** Always use `.select()` with explicit column lists (never `select('*')`)
- **Pagination:** All list views use server-side pagination (50 items/page default)
- **Caching:** Use React Query or SWR with `staleTime: 30_000` (30s) for frequently accessed data
- **Realtime:** Single multiplexed Supabase Realtime channel per page (unsubscribe on unmount)
- **Prefetching:** Prefetch company profile data on hover (via `HoverPreview` cache)
- **Static generation:** Marketing pages (`/pricing`, `/login`, `/register`) use `generateStaticParams` where possible

### 19.6 Runtime Performance

- **Virtual scrolling:** For lists > 100 items, use `@tanstack/react-virtual` (jobs table, sponsor list)
- **Debouncing:** All search inputs debounced at 200ms
- **Memoization:** Heavy computations wrapped in `useMemo`, callback handlers in `useCallback`
- **CSS animations only:** All animations use CSS (no JS-driven animation loops except `NumberAnimation` counter)
- **`will-change`:** Apply only to actively animating elements (ticker, modals), remove after animation completes
- **No layout thrashing:** Batch DOM reads and writes; avoid measuring DOM in render cycles
