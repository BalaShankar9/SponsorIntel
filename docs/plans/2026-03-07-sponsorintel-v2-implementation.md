# SponsorIntel v2.0 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Dispatch agents in parallel where tasks are independent.

**Goal:** Transform SponsorIntel from prototype to Bloomberg Terminal-grade UK sponsorship intelligence platform with 16 working scrapers, data-dense UI, and keyboard-first navigation.

**Architecture:** 3 parallel workstreams (Scraping, Frontend, Backend), 10 agents total. Each agent owns a self-contained module. No cross-agent file conflicts.

**Tech Stack:** FastAPI, Next.js 14, PostgreSQL 16, Redis, Celery, Playwright, httpx, selectolax, Tailwind CSS, Recharts, Zustand

---

## PHASE 1: Foundation (Agents F1 + B1) — Run First

These must complete before Phase 2 frontend agents, as they establish the design system and fix backend config.

---

### Task 1: Agent F1 — Bloomberg Design System + Layout Shell

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/layout/Topbar.tsx`
- Create: `frontend/src/components/layout/TickerBar.tsx`
- Modify: `frontend/src/lib/utils.ts`

**Prompt for Agent F1:**

```
You are rebuilding the SponsorIntel frontend design system to Bloomberg Terminal aesthetic.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST (understand current state):
- frontend/tailwind.config.ts
- frontend/src/styles/globals.css
- frontend/src/components/layout/AppShell.tsx
- frontend/src/components/layout/Sidebar.tsx
- frontend/src/components/layout/Topbar.tsx
- frontend/src/app/layout.tsx
- frontend/src/lib/utils.ts

DESIGN SPEC (Bloomberg Terminal Amber):

1. TAILWIND CONFIG — Replace the entire color palette:
   bg: '#0a0a0a' (true black, not grey)
   s1: '#111111' (card backgrounds)
   s2: '#1a1a1a' (hover states)
   s3: '#222222' (elevated elements)
   border: '#2a2a2a'
   text: '#e0e0e0' (readable white)
   dim: '#888888' (labels)
   muted: '#555555' (disabled)
   amber: '#f5a623' (Bloomberg accent — hero data, headings)
   green: '#00d4aa' (positive)
   red: '#ff4757' (negative)
   blue: '#4a9eff' (interactive)
   cyan: '#00e5ff' (sparklines, data highlights)
   purple: '#a78bfa' (enterprise features)

   Add font families:
   fontFamily: {
     data: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
     ui: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
   }

2. GLOBALS.CSS — Complete overhaul:
   - Import Google Fonts: Inter (400,500,600,700) and JetBrains Mono (400,500,700)
   - Body: bg-bg, font-ui, text-text, antialiased
   - Custom scrollbar: thin, dark track (#111), dark thumb (#333)
   - Selection color: amber with dark text
   - Focus ring: amber outline
   - Data table base styles: compact rows (28px height), monospace numbers
   - Animations: fadeIn, slideIn, pulse-amber (for ticker)
   - Utility classes: .data-value (font-data, tabular-nums), .amber-glow (text-shadow)

3. LAYOUT.TSX — Add JetBrains Mono and Inter fonts via next/font/google. Set metadata title to "SponsorIntel | UK Sponsorship Intelligence Terminal"

4. APPSHELL.TSX — Add TickerBar between Topbar and main content area. Sidebar should support collapsed state (48px width, icon-only mode).

5. SIDEBAR.TSX — Bloomberg-style nav:
   - Width: 200px expanded, 48px collapsed
   - Toggle with [ key (keyboard shortcut)
   - Dark bg (#0a0a0a), amber active indicator (left 2px border)
   - Section labels: uppercase, 10px, dim color, tracking-widest
   - Nav items: 13px font-ui, dim color, hover:text-white, active:text-amber
   - Icons: 16px, same color as text
   - Bottom: version label "v2.0 terminal" in muted

6. TOPBAR.TSX — Bloomberg-style top bar:
   - Height: 40px (compact)
   - Left: "SI" logo in amber monospace, bold
   - Center: Search trigger button (Cmd+K hint) — NOT a full search bar, just a clickable trigger
   - Right: notification bell (amber dot if unread), user avatar with plan badge

7. TICKER BAR — Create new component:
   - Fixed 28px height bar below topbar
   - Background: #111111 with bottom border #2a2a2a
   - Content: horizontally scrolling event text
   - Events: "ACME Corp added to register" (green), "XYZ Ltd A->B downgrade" (red), "47 new jobs detected" (cyan)
   - Connect to WebSocket at ws://localhost:8000/api/v1/ws/feed (fallback to static demo data)
   - CSS animation: smooth horizontal scroll, pause on hover
   - Clicking an event navigates to the entity

8. UTILS.TS — Add helper functions:
   - scoreColor(score: number): returns green/amber/red based on 80+/60-79/<60
   - ratingColor(rating: string): green for A, amber for B
   - formatNumber(n: number): compact format (1.2K, 4.5M)
   - formatDate(date: string): relative format ("2h ago", "3d ago")
   - cn() already exists — keep it

DO NOT modify any page files or non-layout components. Only touch the files listed above.
After completing all changes, verify the dev server still compiles by checking http://localhost:3333.
```

---

### Task 2: Agent B1 — Backend Config Security + Alembic Migrations

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Create: `backend/alembic/versions/001_initial_schema.py` (auto-generated)
- Modify: `backend/alembic/env.py`
- Modify: `backend/requirements.txt` (pin bcrypt==4.0.1)

**Prompt for Agent B1:**

```
You are hardening the SponsorIntel backend for production readiness.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST:
- backend/app/core/config.py
- backend/app/main.py
- backend/app/core/database.py
- backend/alembic/env.py
- backend/alembic.ini
- backend/requirements.txt

TASKS:

1. CONFIG.PY — Fix security:
   - Change default secret_key from "change-me-in-production" to require environment variable (no default, raise error if missing in production)
   - Add: cors_origins: str = "http://localhost:3333,http://127.0.0.1:3333"
   - Parse cors_origins as comma-separated list in a property method
   - Keep development defaults working (env=development should not require secret_key to be set, use a dev default only when env=development)

2. MAIN.PY — Dynamic CORS:
   - Replace hardcoded allow_origins list with settings.cors_origins parsed list
   - Add /api/v1 prefix redirect (307 trailing slash) fix by setting redirect_slashes=False on FastAPI app

3. REQUIREMENTS.TXT — Pin bcrypt==4.0.1 (passlib compatibility fix we discovered during setup)

4. ALEMBIC ENV.PY — Fix to use async engine:
   - Import Base from app.core.database
   - Import all models from app.models (so metadata has all tables)
   - Set target_metadata = Base.metadata
   - Configure async engine for run_migrations_online()
   - Use DATABASE_URL_SYNC for offline migrations

5. Generate initial Alembic migration:
   - Run: cd backend && source venv/bin/activate && DATABASE_URL_SYNC="postgresql+psycopg2://sponsor_user:sponsor_pass@localhost:5432/sponsorintel" alembic revision --autogenerate -m "initial schema"
   - Verify migration file was created
   - Run: alembic upgrade head (should be no-op since tables exist)

6. Verify backend starts cleanly:
   - Run: DATABASE_URL="postgresql+asyncpg://sponsor_user:sponsor_pass@localhost:5432/sponsorintel" REDIS_URL="redis://localhost:6379/0" uvicorn app.main:app --port 8000
   - Test: curl http://localhost:8000/api/health
```

---

## PHASE 2: Parallel Agent Swarm (8 agents simultaneously)

All Phase 2 tasks are independent. Deploy all 8 agents in parallel.

---

### Task 3: Agent S1 — Tier 1 HTTP Job Scrapers (Reed, Find a Job, TotalJobs, CWJobs, Guardian)

**Files:**
- Modify: `backend/app/scrapers/reed.py`
- Modify: `backend/app/scrapers/gov_findajob.py`
- Modify: `backend/app/scrapers/totaljobs.py`
- Modify: `backend/app/scrapers/cwjobs.py`
- Modify: `backend/app/scrapers/guardian_jobs.py`

**Prompt for Agent S1:**

```
You are implementing 5 HTTP-based job board scrapers for the SponsorIntel platform.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST (understand the base class and existing skeleton):
- backend/app/scrapers/base.py (BaseScraper with fetch(), retry, rate limiting)
- backend/app/scrapers/rate_limiter.py
- backend/app/scrapers/anti_detection.py
- backend/app/scrapers/reed.py (existing skeleton)
- backend/app/scrapers/gov_findajob.py
- backend/app/scrapers/totaljobs.py
- backend/app/scrapers/cwjobs.py
- backend/app/scrapers/guardian_jobs.py
- backend/app/models/job.py (Job model — understand all fields)
- backend/app/models/enums.py (JobSource enum values)
- backend/app/services/sponsorship_detector.py (call after parsing)

REQUIREMENTS FOR EACH SCRAPER:
1. Extend BaseScraper (already done in skeleton)
2. Implement scrape(keyword: str, location: str = "United Kingdom") -> list[dict]
3. Implement _parse_listing_page(html: str) -> list[dict] — extract job cards from search results
4. Implement _parse_detail_page(html: str, url: str) -> dict — extract full job details
5. Handle pagination (at least 5 pages per keyword)
6. Return dicts matching Job model fields:
   - source (JobSource enum value), source_job_id, source_url
   - title_raw, company_name_raw, location_raw
   - salary_min, salary_max, salary_text_raw, salary_currency ("GBP"), salary_period
   - description_full, description_snippet (first 500 chars)
   - posted_date (parse relative dates like "2 days ago")
   - contract_type, seniority (extract from title/description)
   - is_remote (detect from location/title)
7. Use selectolax (HTMLParser) for HTML parsing — it's faster than BeautifulSoup
8. Use self.fetch(url) for HTTP requests (inherits rate limiting + anti-detection)
9. Parse salary strings: "£30,000 - £45,000 per annum" -> salary_min=30000, salary_max=45000, salary_period="ANNUAL"
10. Extract posted_date from relative strings: "Posted 2 days ago" -> datetime

SCRAPER-SPECIFIC DETAILS:

REED.CO.UK:
- Search URL: https://www.reed.co.uk/jobs/{keyword}-jobs?pageno={page}
- Job cards: article elements or div.job-result
- Detail: follow link to /jobs/{id}/{slug}
- Salary: in job card header area
- Source enum: JobSource.REED

GOV.UK FIND A JOB:
- Search URL: https://findajob.dwp.gov.uk/search?q={keyword}&p={page}
- Clean HTML, well-structured
- Source enum: JobSource.GOV_FIND_A_JOB

TOTALJOBS:
- Search URL: https://www.totaljobs.com/jobs/{keyword}?page={page}
- Similar structure to Reed
- Source enum: JobSource.TOTALJOBS

CWJOBS:
- Search URL: https://www.cwjobs.co.uk/jobs/{keyword}?page={page}
- IT/tech focused, same parent company as TotalJobs
- Source enum: JobSource.CWJOBS

GUARDIAN JOBS:
- Search URL: https://jobs.theguardian.com/jobs/{keyword}/?page={page}
- Professional roles
- Source enum: JobSource.GUARDIAN

IMPORTANT:
- Use try/except around all parsing — if a field can't be extracted, set to None
- Log warnings for parsing failures but don't crash
- Each scraper should be testable standalone: `python -c "import asyncio; from app.scrapers.reed import ReedScraper; s = ReedScraper(); print(asyncio.run(s.scrape('software engineer'))[:2])"`
- DO NOT modify base.py, rate_limiter.py, anti_detection.py, or any model files
```

---

### Task 4: Agent S2 — Tier 2 Browser Job Scrapers (Indeed, LinkedIn, Glassdoor, NHS)

**Files:**
- Modify: `backend/app/scrapers/indeed.py`
- Modify: `backend/app/scrapers/linkedin_jobs.py`
- Modify: `backend/app/scrapers/glassdoor_jobs.py`
- Modify: `backend/app/scrapers/nhs_jobs.py`

**Prompt for Agent S2:**

```
You are implementing 4 browser-based job scrapers using Playwright for JS-heavy sites.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST:
- backend/app/scrapers/base.py (BaseScraper — especially fetch_with_browser() method)
- backend/app/scrapers/anti_detection.py (stealth headers, delays)
- backend/app/scrapers/indeed.py (existing skeleton)
- backend/app/scrapers/linkedin_jobs.py
- backend/app/scrapers/glassdoor_jobs.py
- backend/app/scrapers/nhs_jobs.py
- backend/app/models/job.py
- backend/app/models/enums.py

REQUIREMENTS:
Same as Tier 1 scrapers (return dicts matching Job model fields) but:
1. Use self.fetch_with_browser(url) for pages requiring JavaScript rendering
2. Implement Playwright stealth: set navigator.webdriver=false, add plugin arrays
3. Wait for content selectors before parsing (page.wait_for_selector)
4. Handle infinite scroll (Indeed) or click-to-load pagination
5. Gaussian delays between page loads (use self.anti_detection.random_delay())
6. Close browser context after each scrape session

SCRAPER-SPECIFIC:

INDEED.CO.UK:
- URL: https://uk.indeed.com/jobs?q={keyword}&l=United+Kingdom&start={offset}
- Pagination: offset increments by 10 (start=0, 10, 20...)
- Job cards: div.job_seen_beacon or div[data-jk]
- Must click into job card to get full description (right panel or new page)
- Source enum: JobSource.INDEED

LINKEDIN JOBS:
- URL: https://www.linkedin.com/jobs/search/?keywords={keyword}&location=United+Kingdom&start={offset}
- MOST AGGRESSIVE anti-bot — use curl_cffi TLS fingerprinting first, Playwright fallback
- Job cards: li elements in jobs-search__results-list
- Pagination: offset by 25
- Source enum: JobSource.LINKEDIN
- NOTE: May get blocked — implement graceful degradation (return partial results)

GLASSDOOR JOBS:
- URL: https://www.glassdoor.co.uk/Job/united-kingdom-{keyword}-jobs-SRCH_IL.0,14_IN2_KO15,{len}.htm
- Playwright required for cookie consent + dynamic content
- Job cards: li.react-job-listing
- Source enum: JobSource.GLASSDOOR

NHS JOBS:
- URL: https://www.jobs.nhs.uk/candidate/search/results?keyword={keyword}&page={page}
- Try HTTP first (self.fetch), fallback to Playwright if content missing
- Well-structured pages, NHS band/grade in salary field
- Source enum: JobSource.NHS_JOBS

DO NOT modify base.py or any files not listed above.
```

---

### Task 5: Agent S3 — Company Intelligence Scrapers (7 sources)

**Files:**
- Modify: `backend/app/scrapers/companies_house.py`
- Modify: `backend/app/scrapers/trustpilot.py`
- Modify: `backend/app/scrapers/google_maps.py`
- Modify: `backend/app/scrapers/linkedin_company.py`
- Modify: `backend/app/scrapers/google_news.py`
- Modify: `backend/app/scrapers/website_analyser.py`
- Modify: `backend/app/scrapers/glassdoor_company.py`

**Prompt for Agent S3:**

```
You are implementing 7 company intelligence scrapers that enrich sponsor profiles.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST:
- backend/app/scrapers/base.py
- backend/app/scrapers/companies_house.py (existing skeleton)
- backend/app/scrapers/trustpilot.py
- backend/app/scrapers/google_maps.py
- backend/app/scrapers/linkedin_company.py
- backend/app/scrapers/google_news.py
- backend/app/scrapers/website_analyser.py
- backend/app/scrapers/glassdoor_company.py
- backend/app/models/company.py (CompanyProfile, CompanyOfficer, CompanyPSC, CompanyNews, CompanyReview)

Each scraper enriches a different aspect of CompanyProfile. Return dicts matching the model fields.

COMPANIES HOUSE (HTTP):
- Search: https://find-and-update.company-information.service.gov.uk/search/companies?q={name}
- Profile: https://find-and-update.company-information.service.gov.uk/company/{number}
- Officers: /company/{number}/officers
- Filing history: /company/{number}/filing-history
- Extract: company_number, company_status, incorporation_date, company_type, sic_codes, registered_address, has_charges, has_insolvency_history, officer list
- Rate: 12 req/min

TRUSTPILOT (HTTP):
- URL: https://www.trustpilot.com/review/{domain}
- Extract: trustpilot_rating, trustpilot_review_count, recent review snippets
- Rate: 8 req/min

GOOGLE MAPS (Playwright):
- Search: https://www.google.com/maps/search/{company+name}+UK
- Extract: google_rating, google_review_count, address, phone
- Rate: 3 req/min

LINKEDIN COMPANY (Playwright + stealth):
- URL: https://www.linkedin.com/company/{slug}/
- Extract: employee_count_estimate, linkedin_follower_count, industry, headquarters
- Rate: 2 req/min (very aggressive anti-bot)

GOOGLE NEWS (HTTP):
- URL: https://news.google.com/search?q={company}+UK
- Extract: headlines, source, published date, snippet
- Run sentiment analysis: count positive/negative words, score -1 to +1
- Rate: 8 req/min

WEBSITE ANALYSER (HTTP):
- Fetch homepage of company website
- Extract: website_url, has_careers_page (check /careers, /jobs, /work-with-us), social_links (find linkedin/twitter/facebook URLs), tech_stack_detected (check meta tags, script src for React/Angular/WordPress etc)
- Check domain age via WHOIS or HTTP date headers
- Rate: 15 req/min

GLASSDOOR COMPANY (Playwright):
- URL: https://www.glassdoor.co.uk/Reviews/{company}-Reviews
- Extract: glassdoor_rating, glassdoor_review_count, glassdoor_ceo_approval, glassdoor_recommend_pct
- Rate: 3 req/min

DO NOT modify base.py, models, or any non-scraper files.
```

---

### Task 6: Agent S4 — Celery Task Completion + Orchestration

**Files:**
- Modify: `backend/app/tasks/celery_app.py`
- Modify: `backend/app/tasks/scraping.py`
- Modify: `backend/app/tasks/schedule.py`

**Prompt for Agent S4:**

```
You are completing the Celery task implementations that orchestrate scraping and data processing.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST:
- backend/app/tasks/celery_app.py
- backend/app/tasks/scraping.py (existing stubs)
- backend/app/tasks/schedule.py
- backend/app/core/database.py (async_session)
- backend/app/services/csv_import.py
- backend/app/services/diff_engine.py
- backend/app/services/scoring.py
- backend/app/services/entity_resolution.py
- backend/app/services/sponsorship_detector.py
- backend/app/services/job_dedup.py
- backend/app/scrapers/reed.py (to understand scraper interface)

CELERY APP CONFIG:
- Broker: redis://localhost:6379/0
- Result backend: redis://localhost:6379/1
- Task serializer: json
- Accept content: ['json']
- Timezone: Europe/London
- Task routes: all tasks to 'default' queue

TASKS TO IMPLEMENT (8 total):

1. scrape_register — Download GOV.UK CSV, import via csv_import service, run diff_engine
2. scrape_jobs(source: str) — Instantiate correct scraper class, scrape with DEFAULT_KEYWORDS, save to Job table, run sponsorship_detector on each, link to sponsors via entity_resolution
3. enrich_companies — Query sponsors ordered by enrichment_priority (highest first, limit 50 per run), run Companies House + Website Analyser scrapers, update CompanyProfile
4. recompute_scores — Query all sponsors with stale scores (>24h old or never scored), run scoring service, save to SponsorScore table
5. evaluate_alerts — Query active alerts, check conditions against recent events, create AlertHistory entries, mark last_triggered
6. deduplicate_jobs — Run job_dedup service on recent jobs (last 7 days)
7. scrape_news — Run google_news scraper for top 100 sponsors (by score), save to CompanyNews
8. scrape_reviews — Run trustpilot + glassdoor_company scrapers for top 200 sponsors, save to CompanyReview

CRITICAL PATTERNS:
- Each task needs _run_async() wrapper: create new event loop, run async code, close loop
- Get async session: `async with async_session() as session:`
- Error handling: log exceptions, don't crash the worker
- Add @celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
- Save results to database within the async session

SCHEDULE (verify matches schedule.py):
- scrape_register: every 6 hours
- scrape_jobs (per source): every 4-12 hours depending on source
- enrich_companies: every 30 minutes
- recompute_scores: every 6 hours
- evaluate_alerts: every hour
- deduplicate_jobs: every 4 hours
- scrape_news: every 12 hours
- scrape_reviews: weekly (Sunday 3am)

DO NOT modify any scraper files, service files, or model files.
```

---

### Task 7: Agent F2 — Command Palette + Keyboard Shortcuts + Core UI Components

**Files:**
- Create: `frontend/src/components/ui/CommandPalette.tsx`
- Create: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Create: `frontend/src/hooks/useDataFetch.ts`
- Modify: `frontend/src/components/ui/Badge.tsx`
- Modify: `frontend/src/components/ui/StatCard.tsx`
- Modify: `frontend/src/components/ui/Table.tsx`
- Modify: `frontend/src/components/ui/Button.tsx`
- Modify: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/Sparkline.tsx`
- Create: `frontend/src/components/ui/ScoreBadge.tsx`
- Create: `frontend/src/components/ui/HoverPreview.tsx`

**Prompt for Agent F2:**

```
You are building the Bloomberg Terminal power-user features: command palette, keyboard shortcuts, and upgraded UI primitives.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST:
- frontend/src/components/ui/ (all existing UI components)
- frontend/src/lib/api.ts
- frontend/src/lib/auth.ts
- frontend/src/lib/utils.ts
- frontend/src/types/index.ts
- frontend/tailwind.config.ts (after Agent F1 updates — check for new colors)

DESIGN: Bloomberg Terminal Amber theme. Colors: amber (#f5a623) for hero data, green (#00d4aa) positive, red (#ff4757) negative, cyan (#00e5ff) sparklines, monospace font-data for numbers.

COMPONENTS TO BUILD:

1. COMMAND PALETTE (CommandPalette.tsx):
   - Trigger: Cmd+K (Mac) / Ctrl+K (Windows)
   - Full-screen overlay with backdrop blur
   - Search input with amber border glow on focus
   - Fuzzy search across: sponsors (fetch /api/v1/sponsors/search?q=), pages (hardcoded list), actions
   - Categories: "Sponsors", "Pages", "Actions" with section headers
   - Results: max 8 per category, keyboard navigable (arrow keys + enter)
   - Selected item: bg-s2 highlight
   - Actions: "Add to Watchlist", "Export Data", "Toggle Sidebar"
   - Pages: Dashboard, Search, Jobs, Map, Trends, Signals, Compare, Tracker, Alerts, Admin
   - Dismiss: Esc or click outside
   - Debounce search: 200ms
   - Use next/navigation router.push() to navigate

2. KEYBOARD SHORTCUTS (useKeyboardShortcuts.ts):
   - Global hook, register in AppShell
   - Shortcuts map:
     Cmd+K: open command palette
     Esc: close modal/palette, or navigate back
     [: toggle sidebar collapsed
     G then D: go to /dashboard
     G then S: go to /search
     G then J: go to /jobs
     G then M: go to /map
     G then T: go to /trends
     G then I: go to /signals
     G then C: go to /compare
     G then W: go to /tracker
     G then A: go to /alerts
   - Two-key combos: track "pending" key (G), wait 500ms for second key
   - Don't trigger when user is typing in input/textarea
   - Show keyboard shortcut hints in sidebar nav items (dim text, e.g., "G D")

3. DATA FETCH HOOK (useDataFetch.ts):
   - Generic hook: useDataFetch<T>(url: string, options?)
   - Returns: { data, loading, error, refetch }
   - Auto-fetch on mount
   - Caching: store in Map<string, {data, timestamp}>, stale after 60s
   - Error retry: 1 retry after 2s delay

4. SPARKLINE COMPONENT (Sparkline.tsx):
   - Props: data: number[], width?: number (default 60), height?: number (default 20), color?: string (default cyan)
   - SVG polyline, no axes, no labels — just the line
   - Optionally show last value as small text

5. SCORE BADGE (ScoreBadge.tsx):
   - Props: score: number, trend?: 'up' | 'down' | 'neutral', size?: 'sm' | 'md'
   - Pill shape: score number + optional trend arrow
   - Colors: 80+: green bg, 60-79: amber bg, <60: red bg
   - Monospace font for the number

6. HOVER PREVIEW (HoverPreview.tsx):
   - Props: sponsorId: string, children: ReactNode
   - On hover (300ms delay), show floating card with:
     Company name, score badge, rating, city, active jobs count
   - Fetch from /api/v1/sponsors/{id} (cache result)
   - Position: below the trigger element
   - Dismiss on mouse leave

7. UPDATE EXISTING COMPONENTS:
   - Badge.tsx: Add amber variant, use monospace for numeric badges
   - StatCard.tsx: Make compact (reduce padding to p-3), add optional sparkline prop, amber accent for value text
   - Table.tsx: Compact rows (h-7), monospace for number columns, add keyboard nav (j/k/enter), hover:bg-s2
   - Button.tsx: Add amber variant, reduce padding, sharp corners (rounded instead of rounded-lg)
   - Card.tsx: Reduce border-radius to rounded (4px), reduce padding to p-3, border-border color

DO NOT modify any page files, layout files, or non-UI component files.
```

---

### Task 8: Agent F3 — Dashboard + Search + Company Detail Pages

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/components/dashboard/MarketPulse.tsx`
- Modify: `frontend/src/components/dashboard/GrowthChart.tsx`
- Modify: `frontend/src/components/dashboard/LiveFeed.tsx`
- Modify: `frontend/src/components/dashboard/TopHiring.tsx`
- Modify: `frontend/src/components/dashboard/IndustryBreakdown.tsx`
- Modify: `frontend/src/app/search/page.tsx`
- Modify: `frontend/src/components/search/ResultsTable.tsx`
- Modify: `frontend/src/components/search/FilterBar.tsx`
- Modify: `frontend/src/app/company/[id]/page.tsx`
- Modify: `frontend/src/app/company/[id]/CompanyProfileClient.tsx`
- Modify: `frontend/src/components/company/ProfileHeader.tsx`
- Modify: `frontend/src/components/company/ScoreRadar.tsx`
- Modify: `frontend/src/components/company/OverviewTab.tsx`

**Prompt for Agent F3:**

```
You are rebuilding the 3 most important pages to Bloomberg Terminal data density.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST (all files listed above + types + api):
- frontend/src/types/index.ts
- frontend/src/lib/api.ts
- All dashboard, search, and company component files listed above

DESIGN: Bloomberg Terminal Amber. True black bg (#0a0a0a), amber (#f5a623) for hero numbers, monospace (font-data) for all data values, compact spacing (p-3 cards, h-7 table rows), green/red for positive/negative.

DASHBOARD PAGE — Data Command Center:
- Top row: 2 rows of stat cards, 5 per row (10 total):
  Row 1: Total Sponsors (amber), A-Rated, B-Rated, Added (30d, green), Removed (30d, red)
  Row 2: Total Jobs, Sponsorship Likely, Enriched Companies, Avg Score, Active Alerts
- Each stat card: compact, value in amber monospace 20px, label in dim 11px, sparkline showing 30-day trend
- Middle: 2/3 width GrowthChart (dark chart, amber line, grid #1a1a1a, annotations), 1/3 LiveFeed (scrolling events, color-coded severity)
- Bottom: TopHiring (compact table with score badge + sparkline columns) + IndustryBreakdown (horizontal bar chart, amber bars)
- All Recharts: dark theme — bg transparent, grid stroke #1a1a1a, axis labels dim, tooltip bg #111111 border #2a2a2a

SEARCH PAGE — Data Terminal:
- Search input: large, amber border on focus, monospace placeholder "Search 124,755 sponsors..."
- FilterBar: compact single row of dropdowns (City, Rating, Industry, Score Range, Route) — no labels, just placeholder text
- ResultsTable:
  - Columns: Name, City, Rating (badge), Score (ScoreBadge), Active Jobs, Route, First Seen
  - 28px row height, monospace numbers
  - Score column has inline Sparkline showing trend
  - Name column has HoverPreview on hover
  - Keyboard navigable (j/k/enter)
  - Sort by clicking column headers (amber underline on active sort)
  - Show total count: "124,755 sponsors" in amber monospace

COMPANY DETAIL PAGE — Deep Profile:
- ProfileHeader: Single dense line — company name (white, 18px), score badge, rating badge, city, industry tag, "X active jobs" in cyan
- Below header: 2-column layout:
  - Left (2/3): Tabbed content (Overview, Jobs, People, Financials, Reviews, News, Timeline)
  - Right (1/3): Score radar chart + Similar Companies list
- ScoreRadar: Dark bg, amber/cyan lines, factor labels at each vertex, hover to see factor explanation
- OverviewTab: Dense grid of key facts — Companies House data, financial flags (red for insolvency/CCJs), workforce stats, online presence links
- Use amber for section headers, dim for labels, white for values, monospace for numbers

API endpoints to use:
- Dashboard: /api/v1/analytics/dashboard, /api/v1/analytics/trends
- Search: /api/v1/sponsors/?page=X&size=25&city=X&rating=X...
- Company: /api/v1/sponsors/{id}

DO NOT modify any layout, UI primitive, or non-page/component files.
```

---

### Task 9: Agent F4 — All Remaining Pages (Jobs, Map, Trends, Signals, Compare, Tracker, Alerts, Admin)

**Files:**
- Modify: `frontend/src/app/jobs/page.tsx` + components
- Modify: `frontend/src/app/map/page.tsx` + components
- Modify: `frontend/src/app/trends/page.tsx` + components
- Modify: `frontend/src/app/signals/page.tsx` + components
- Modify: `frontend/src/app/compare/page.tsx`
- Modify: `frontend/src/app/tracker/page.tsx` + components
- Modify: `frontend/src/app/alerts/page.tsx` + components
- Modify: `frontend/src/app/admin/page.tsx` + components
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/register/page.tsx`
- Modify: `frontend/src/app/pricing/page.tsx`

**Prompt for Agent F4:**

```
You are rebuilding all remaining pages to Bloomberg Terminal aesthetic.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST: All page files and their component files listed above, plus:
- frontend/src/types/index.ts
- frontend/src/lib/api.ts
- frontend/src/lib/utils.ts

DESIGN: Bloomberg Terminal Amber. True black bg, amber accents, monospace data, compact spacing. Apply consistently across all pages.

JOBS PAGE:
- Hero stat bar: Total Jobs (amber), Sponsorship Likely (green), Avg Salary (cyan), New 7d (white)
- JobTable: sponsorship_likelihood as color-coded progress bar (green 70+, amber 50-69, red <50), salary column with threshold indicator (green check if meets visa threshold), source badge (color per source), shortage list flag icon
- JobFilters: compact row — keyword input, source dropdown, salary range, sponsorship min %, remote toggle

MAP PAGE:
- Full-width dark map (dark tile layer from CartoDB dark_all or Mapbox dark-v11)
- Heatmap layer for sponsor density by postcode/city
- Click cluster to drill into list
- Right panel: region stats overlay (top 10 cities by sponsor count)
- Filter controls: industry, rating, score range

TRENDS PAGE:
- Global time range selector at top: 7d | 30d | 90d | 1y | All (amber active, dim inactive)
- 2x2 grid of charts:
  - Sponsor growth (line, amber)
  - Industry distribution (horizontal bars, top 15)
  - Salary trends (multi-line by sector)
  - Geographic shifts (top cities over time)
- All charts: dark theme, amber/cyan/green lines, grid #1a1a1a

SIGNALS PAGE:
- Real-time WebSocket feed (ws://localhost:8000/api/v1/ws/feed)
- Each signal: severity badge (green INFO, amber WARNING, red CRITICAL), timestamp (monospace, dim), title (white), description (dim), click to navigate
- Filter bar: type checkboxes (Sponsor Added, Removed, Rating Change, New Job, Score Change)
- Auto-scroll, pause on hover

COMPARE PAGE:
- Select up to 6 companies via search inputs
- Side-by-side metrics table: every data point from CompanyProfile
- Overlay radar chart (all companies on one radar)
- Winner highlight per row (green text for best value)

TRACKER PAGE:
- Kanban board: 5 columns (Watching, Applied, Interview, Offered, Rejected)
- Cards: company name, score badge, date added, note snippet
- Drag-drop between columns
- Inline note editing (click to edit)
- Status color: amber watching, blue applied, cyan interview, green offered, red rejected

ALERTS PAGE:
- Alert builder: type dropdown, condition fields (dynamic based on type), channel selector
- Active alerts list: toggle on/off, last triggered timestamp, trigger count
- History timeline: chronological list of triggered alerts with payload details

ADMIN PAGE:
- Scraper health grid: card per scraper showing last run time, success rate %, records collected
- Green/amber/red status indicator per scraper
- Enrichment progress: bar charts showing L0-L5 distribution
- Import history: table of CSV imports with timestamps, record counts
- Manual trigger buttons: "Run Scraper" per source

LOGIN/REGISTER:
- Dark, centered card, amber accent on inputs/buttons
- "SponsorIntel Terminal" branding, monospace tagline

PRICING PAGE:
- 3 cards side by side, amber border on recommended (Pro)
- Feature comparison matrix below
- Monospace pricing numbers

DO NOT modify layout files, UI primitives, or any backend files.
```

---

### Task 10: Agent B2 — API Gaps + WebSocket + Analytics Completion

**Files:**
- Modify: `backend/app/api/v1/analytics.py`
- Modify: `backend/app/api/v1/websocket.py`
- Modify: `backend/app/api/v1/sponsors.py`
- Modify: `backend/app/api/v1/admin.py`

**Prompt for Agent B2:**

```
You are completing backend API gaps and WebSocket functionality.

WORKING DIRECTORY: /Users/balabollineni/Sponsorship DOG

READ FIRST:
- backend/app/api/v1/analytics.py
- backend/app/api/v1/websocket.py
- backend/app/api/v1/sponsors.py
- backend/app/api/v1/admin.py
- backend/app/models/ (all model files)
- backend/app/schemas/ (all schema files)
- backend/app/core/database.py
- backend/app/core/redis.py

TASKS:

1. ANALYTICS.PY — Complete all endpoints:
   - GET /dashboard — Return DashboardOverview with counts (total_sponsors, a_rated, b_rated, added_30d, removed_30d, changed_30d, total_jobs, total_enriched)
   - GET /trends — Return sponsor_growth (daily counts for last 90 days), rating_changes, top_cities (top 20), top_industries (top 20), top_hiring (top 20 sponsors by job count with score)
   - GET /filters — Return FilterOptions (distinct cities, counties, routes, industries for dropdown population)
   - GET /events — Return recent events with pagination, filterable by event_type and severity

2. WEBSOCKET.PY — Complete real-time feed:
   - WebSocket endpoint at /ws/feed
   - ConnectionManager class: connect(), disconnect(), broadcast()
   - On connect: send last 20 events as initial batch
   - Subscribe to Redis pub/sub channel "events"
   - When new event published to Redis, broadcast to all connected clients
   - Event format: {id, event_type, severity, title, description, sponsor_id, sponsor_name, created_at}
   - Handle disconnections gracefully

3. SPONSORS.PY — Add missing features:
   - Ensure /sponsors/ list endpoint supports all filter params: city, county, rating, industry, score_min, score_max, route, is_active, sort_by, sort_order
   - Add GET /sponsors/{id}/timeline — Return chronological list of all changes + events for a sponsor
   - Add GET /sponsors/{id}/similar — Return top 10 similar sponsors (same industry + city, ordered by score similarity)

4. ADMIN.PY — Complete admin endpoints:
   - GET /admin/engine-status — Scraper health (last run per scraper from CsvImport/Event table, success rate)
   - GET /admin/enrichment-progress — Count sponsors at each enrichment level (0-5)
   - GET /admin/import-history — Paginated list of CsvImport records
   - POST /admin/trigger-scrape/{source} — Queue a Celery task for the specified scraper (requires admin auth)
   - POST /admin/import-csv — Accept CSV file upload, trigger csv_import service

Add proper Pydantic schemas in backend/app/schemas/ for any new response models needed.

DO NOT modify model files, service files, or scraper files.
```

---

## PHASE 3: Integration + Verification

After all Phase 2 agents complete, run integration checks.

### Task 11: End-to-End Verification

```
Verify the complete system:
1. Backend starts cleanly on port 8000
2. Frontend starts cleanly on port 3333
3. Dashboard loads with real data from 124K sponsors
4. Search returns results with fuzzy matching
5. Company detail page shows all tabs
6. Cmd+K command palette opens and searches sponsors
7. Keyboard shortcuts navigate between pages
8. Ticker bar shows events
9. At least 1 scraper (Reed) successfully scrapes real jobs
10. WebSocket connection established on signals page
```

---

## Execution Summary

| Phase | Agents | Dependencies | Parallel? |
|-------|--------|-------------|-----------|
| Phase 1 | F1, B1 | None | Yes (parallel with each other) |
| Phase 2 | S1, S2, S3, S4, F2, F3, F4, B2 | F1 for frontend agents, B1 for backend agents | Yes (all 8 parallel) |
| Phase 3 | Verification | All Phase 2 | Sequential |

**Total: 10 agent tasks + 1 verification = 11 tasks**
