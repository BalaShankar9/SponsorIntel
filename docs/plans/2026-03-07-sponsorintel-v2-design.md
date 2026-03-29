# SponsorIntel v2.0 — Bloomberg Terminal Rebuild Design

**Date:** 2026-03-07
**Status:** Approved
**Approach:** Parallel agent swarm (10+ agents across 3 workstreams)

---

## 1. Vision

Transform SponsorIntel from a functional prototype into the #1 UK sponsorship intelligence platform. Bloomberg Terminal aesthetic. Maximum data density. Keyboard-first navigation. Real-time feeds. All 140K+ sponsors monitored with deep enrichment from 16+ scraped sources.

## 2. Current State Assessment

| Layer | Score | Status |
|-------|-------|--------|
| Frontend | 6.5/10 | Generic Supabase template. Sparse data. No keyboard nav. |
| Backend Services | 8.5/10 | Entity resolution, scoring, NLP, diff engine — production-ready. |
| Scrapers | 1.5/10 | Only GOV.UK works. 20/21 scrapers are skeleton code. |
| API Endpoints | 8/10 | 30+ endpoints, pagination, plan gating, fuzzy search. |
| Database | 9/10 | 22 models, GIN trigram, JSONB. 124K sponsors loaded. |
| Celery Tasks | 3/10 | Schedule defined, task bodies are stubs. |

## 3. Architecture

```
WORKSTREAM 1: HYDRA SCRAPING SWARM (4 agents)
  Agent S1: Tier 1 job scrapers (Reed, GOV Find a Job, TotalJobs, CWJobs, Guardian)
  Agent S2: Tier 2 browser scrapers (Indeed, LinkedIn Jobs, Glassdoor Jobs, NHS Jobs)
  Agent S3: Company intelligence scrapers (Companies House, Trustpilot, Google Maps, LinkedIn Company, Google News, Website Analyser, Glassdoor Company)
  Agent S4: Celery task completion + orchestration wiring

WORKSTREAM 2: BLOOMBERG FRONTEND (4 agents)
  Agent F1: Design system + layout (tailwind config, globals.css, AppShell, Sidebar, Topbar, Ticker)
  Agent F2: Command palette + keyboard shortcuts + core UI components
  Agent F3: Dashboard + Search + Company Detail pages (data-dense rebuild)
  Agent F4: Jobs + Map + Trends + Signals + Compare + Tracker + Alerts + Admin pages

WORKSTREAM 3: BACKEND HARDENING (2 agents)
  Agent B1: Config security + Alembic migrations + error handling
  Agent B2: API gap fixes + WebSocket completion + analytics endpoints
```

## 4. Scraping Engine — "Hydra Swarm"

### 4.1 Design Philosophy
- Each scraper is an autonomous "head" — if one gets blocked, others keep feeding
- Adaptive retry with exponential backoff
- Per-domain rate limiting (token bucket)
- Rotating fingerprints (33 UAs, TLS rotation, proxy rotation)
- Gaussian-distributed delays (2-8s, not fixed intervals)

### 4.2 Tier 1 — HTTP Scrapers (httpx + selectolax)

**Reed.co.uk**
- Search URL: /jobs/{keyword}-jobs?proximity=30
- Parse: job cards with title, company, salary, location, description snippet
- Detail page: full description, posted date, application URL
- Rate: 10 req/min

**GOV.UK Find a Job**
- Search URL: /find-a-job/search?keywords={kw}
- Parse: structured job cards, clean HTML
- Rate: 15 req/min

**TotalJobs**
- Search URL: /jobs/{keyword}?radius=30
- Parse: job listing cards, salary bands, location
- Rate: 8 req/min

**CWJobs**
- Search URL: /jobs/{keyword}
- Parse: IT/tech job listings, skills tags
- Rate: 8 req/min

**Guardian Jobs**
- Search URL: /jobs/{keyword}
- Parse: professional roles, structured data
- Rate: 10 req/min

### 4.3 Tier 2 — Browser Scrapers (Playwright + stealth)

**Indeed.co.uk**
- Playwright headless with stealth
- Search: /jobs?q={keyword}&l=United+Kingdom
- Parse: job cards, salary estimates, company ratings
- Pagination: scroll-to-load or next page
- Rate: 5 req/min (aggressive anti-bot)

**LinkedIn Jobs**
- curl_cffi for TLS fingerprint + Playwright fallback
- Search: /jobs/search?keywords={kw}&location=United+Kingdom
- Parse: title, company, location, seniority, skills
- Rate: 3 req/min (strictest anti-bot)

**Glassdoor Jobs**
- Playwright headless
- Search: /Job/jobs.htm?sc.keyword={kw}
- Parse: jobs + company ratings + reviews inline
- Rate: 4 req/min

**NHS Jobs**
- HTTP first, Playwright fallback
- Search: /candidate/search/results?keyword={kw}
- Parse: healthcare roles, band/grade, trust name
- Rate: 10 req/min

### 4.4 Tier 3 — Company Intelligence Scrapers

**Companies House (Web Scrape)**
- Search: /search/companies?q={name}
- Profile: /company/{number} — status, incorporation, SIC codes, officers, PSCs, filing history
- Financials: charges, insolvency, accounts overdue flags
- Rate: 12 req/min

**Trustpilot**
- Search: /review/{domain}
- Parse: overall rating, review count, recent reviews with text + sentiment
- Rate: 8 req/min

**Google Maps**
- Playwright: search "{company name} UK"
- Parse: rating, review count, address, phone, website, opening hours
- Rate: 3 req/min

**LinkedIn Company**
- Playwright + stealth
- Parse: employee count, follower count, industry, headquarters, growth signals
- Rate: 2 req/min

**Google News**
- HTTP: /search?q={company}+UK&tbm=nws
- Parse: headlines, source, date, snippet
- Sentiment: positive/negative/neutral classification per headline
- Rate: 8 req/min

**Website Analyser**
- HTTP HEAD + GET for homepage
- Parse: domain age (WHOIS), tech stack (meta tags, scripts), careers page detection, social links
- Rate: 15 req/min

**Glassdoor Company**
- Playwright: /Reviews/{company}-Reviews
- Parse: CEO approval %, recommend %, work-life rating, culture rating
- Rate: 3 req/min

### 4.5 Anti-Detection Stack
- 33 User-Agent strings (Chrome 120-125, Firefox 121-124, Safari 17, Edge 120-123)
- Gaussian delay distribution: mean=4s, std=1.5s, min=1.5s, max=10s
- TLS fingerprint rotation via curl_cffi (Chrome, Firefox, Safari profiles)
- Per-domain token-bucket rate limiter (configurable per scraper)
- Proxy rotation with health scoring (skip proxies with >20% failure)
- Referer chain: Google search -> site -> page (realistic flow)
- Cookie jar management per session
- Playwright stealth: navigator.webdriver=false, plugins array, languages

## 5. Bloomberg Frontend Design System

### 5.1 Color Palette — "Terminal Amber"
```css
--bg:           #0a0a0a;   /* True black */
--surface-1:    #111111;   /* Card backgrounds */
--surface-2:    #1a1a1a;   /* Hover states */
--surface-3:    #222222;   /* Elevated elements */
--border:       #2a2a2a;   /* Subtle borders */

--text-primary: #f5a623;   /* Bloomberg amber — hero data */
--text-white:   #e0e0e0;   /* Readable white */
--text-dim:     #888888;   /* Labels, metadata */
--text-muted:   #555555;   /* Disabled, tertiary */

--green:        #00d4aa;   /* Positive, A-rating, up */
--red:          #ff4757;   /* Negative, B-rating, down */
--amber:        #f5a623;   /* Warning, watch, pending */
--blue:         #4a9eff;   /* Interactive, links, selected */
--cyan:         #00e5ff;   /* Data highlights, sparklines */
--purple:       #a78bfa;   /* Enterprise features */
```

### 5.2 Typography
```css
--font-data:    'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
--font-ui:      'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

--text-xs:      11px;  /* Table cells, dense data */
--text-sm:      12px;  /* Labels, metadata */
--text-base:    13px;  /* Body text */
--text-lg:      16px;  /* Section headers */
--text-xl:      20px;  /* Page titles */
```

### 5.3 Layout Rules
- Sidebar: 200px expanded, 48px collapsed (icon-only). Toggle with `[` key.
- Ticker bar: 28px fixed top. WebSocket-powered. Auto-scrolling latest events.
- Content area: Full remaining width. No max-width constraint (data density).
- Card padding: 12px (not 16-24px like consumer apps).
- Table row height: 28-32px (not 48px).
- Border radius: 4px (sharp, not rounded-lg).

### 5.4 Key Components

**Command Palette (Cmd+K)**
- Fuzzy search across: companies (124K), jobs, pages, actions
- Categories: Sponsors, Jobs, Navigation, Actions
- Recent searches memory
- Keyboard navigable (arrow keys + enter)

**Real-Time Ticker Bar**
- Fixed 28px bar below topbar
- WebSocket-connected to event stream
- Shows: "ACME Corp added | XYZ Ltd A->B | 47 new jobs | NHS Trust removed"
- Color-coded by severity (green=add, red=remove, amber=change)
- Click to navigate to entity

**Compact Data Tables**
- 28px row height, monospace numbers
- Sortable columns (click header)
- Keyboard navigation (j/k up/down, enter to open)
- Sparkline column for score trends (60px wide, cyan line)
- Hover preview card (score, rating, jobs, city)

**Score Badges**
- Pill format: "87" with background color
- 80-100: green background
- 60-79: amber background
- 0-59: red background
- Trend arrow (up/down/neutral) appended

**Keyboard Shortcuts System**
- Global: Cmd+K (search), Esc (back/close), [ (toggle sidebar)
- Navigation: G then D (dashboard), G then S (search), G then J (jobs), G then M (map), G then T (trends)
- Actions: W (add to watchlist), N (add note), E (export), R (refresh)
- Tables: j/k (navigate rows), Enter (open), Space (select/toggle)

### 5.5 Page Designs

**Dashboard** — 10-15 stat cards in 2 rows, sparklines in each card, market pulse heatmap (industry x region), top movers table (score changes), growth chart with annotation markers, live feed panel

**Search** — Instant fuzzy search bar (amber glow on focus), filterable column headers, inline sparklines, hover preview cards, bulk export button, keyboard navigable results

**Company Detail** — Dense header (name, score badge, rating, city, industry, active jobs count all in one line), tabbed content (Overview, Jobs, People, Financials, Reviews, News, Timeline), score radar with factor explanations on hover, similar companies sidebar

**Jobs** — Sponsorship likelihood as hero column (color-coded 0-100), shortage list flag, salary vs threshold indicator, source badges, filter panel with instant apply

**Map** — Heatmap intensity by sponsor density, cluster markers with drill-down, region statistics overlay panel, filter by industry/rating/score

**Trends** — Global time range selector (7d/30d/90d/1y/all), industry growth heatmap, salary trend lines, geographic shift visualization, annotation markers for policy changes

**Signals** — Real-time WebSocket feed, severity color coding, type filters (sponsor changes, new jobs, score changes, alerts), auto-scroll with pause on hover

**Compare** — Up to 6 companies side-by-side, metrics comparison table (every data point), overlay radar charts, winner highlighting per metric

**Tracker** — Kanban board (Watching, Applied, Interview, Offered, Rejected), drag-drop cards, inline note editing, follow-up date badges, status color coding

**Alerts** — Visual alert builder (type + conditions + channel), test-fire button, history timeline with payloads, active/paused toggle

**Admin** — Scraper health dashboard (last run, success rate, records per source), enrichment progress bars, import history table, manual trigger buttons

## 6. Backend Hardening

### 6.1 Config Security
- Move all secrets to environment variables
- Remove hardcoded "change-me-in-production"
- CORS origins from environment (not hardcoded)

### 6.2 Alembic Migrations
- Generate initial migration from current models
- Set up autogenerate workflow

### 6.3 Celery Task Completion
- Complete all 8 task bodies (scrape_register, scrape_jobs, enrich_companies, recompute_scores, evaluate_alerts, deduplicate_jobs, scrape_news, scrape_reviews)
- Wire async session factory correctly
- Add error handling and retry decorators

### 6.4 API Gaps
- Complete analytics/trends endpoint
- Add CSV upload endpoint for manual imports
- Complete WebSocket event broadcasting
- Add proper error responses with detail messages

## 7. Execution Plan — Agent Swarm Deployment

### Phase 1: Foundation (Agents F1 + B1)
- Bloomberg design system (tailwind, globals, fonts)
- AppShell + Sidebar + Topbar + Ticker bar
- Config security + Alembic migrations

### Phase 2: Scraping Core (Agents S1 + S2 + S3)
- All 9 job board scrapers with real HTML parsing
- All 7 company intelligence scrapers
- Anti-detection stack verified

### Phase 3: Frontend Pages (Agents F2 + F3 + F4)
- Command palette + keyboard shortcuts
- Dashboard + Search + Company Detail (data-dense rebuild)
- All remaining pages

### Phase 4: Orchestration (Agents S4 + B2)
- Celery tasks fully wired
- WebSocket broadcasting
- API gap fixes
- End-to-end data flow verification

## 8. Success Criteria
- All 16 scrapers produce real data
- Frontend passes "Bloomberg test" — data density, keyboard nav, monospace data, amber accent
- 124K sponsors searchable in <100ms (pg_trgm)
- Real-time ticker updates via WebSocket
- Cmd+K command palette with fuzzy search
- Score badges with trend sparklines on search results
- All Celery tasks execute on schedule
