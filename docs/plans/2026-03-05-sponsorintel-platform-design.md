# SponsorIntel Platform Design

**Date:** 2026-03-05
**Status:** Approved
**Vision:** The Bloomberg Terminal of UK Sponsorship Intelligence

## 1. Overview

SponsorIntel is a full-stack web platform that monitors, enriches, scores, and provides comprehensive intelligence on all ~140,000 UK sponsor licence holders. It combines real-time data from 30+ sources into a single intelligence platform for job seekers, immigration professionals, and recruiters.

**Goal:** Be the #1 irreplaceable platform in this space through data depth, historical tracking, cross-referencing, and real-time freshness that no competitor can replicate.

## 2. Strategic Moat

1. **Data depth** — 50+ fields per company vs competitors' 5 fields
2. **Historical data** — Every change recorded from day 1, compounding over time
3. **Cross-referencing** — Connections across directors, jobs, news, reviews
4. **Sponsorship intelligence** — NLP-detected sponsorship likelihood, visa grant rates
5. **Real-time** — Hourly updates vs competitors' monthly

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | FastAPI (Python) | Async, WebSocket support, auto OpenAPI docs |
| Frontend | Next.js + React | Component model for complex dashboards, SSR |
| Database | PostgreSQL | Time-series queries, full-text search, JSONB |
| Cache | Redis | Sessions, API response cache, Celery broker |
| Task Queue | Celery + Celery Beat | Scheduled scraping, alert evaluation |
| Charts | D3.js + Recharts | Bloomberg-grade data visualization |
| Maps | Mapbox or Leaflet | Interactive UK sponsor density maps |
| Search | PostgreSQL FTS + pg_trgm | Fuzzy company name search at scale |
| Payments | Stripe | Freemium billing |
| Auth | JWT + OAuth (Google/GitHub) | Secure, standard |
| Proxy | BrightData/Oxylabs | Residential proxy rotation for scraping |
| Deployment | Docker + VPS (Hetzner/AWS) | Containerised, scalable |
| Email | SendGrid/Resend | Alert notifications, digests |

## 4. Architecture

```
Clients (Browser, Email)
    |
Nginx/Caddy (SSL, rate limiting)
    |
FastAPI Backend
├── Auth Module (JWT + OAuth)
├── REST API /api/v1/*
├── WebSocket Server (real-time alerts/feed)
├── Enrichment Service
├── Scoring Engine (7-factor)
├── Diff Engine (historical tracking)
├── Job Scraper (multi-source)
├── Alert Engine (Celery)
└── Payment Module (Stripe)
    |
    ├── PostgreSQL (primary data)
    ├── Redis (cache + sessions + queues)
    └── Celery Beat (scheduled tasks)
```

## 5. Scraping Engine: "Hydra"

### Architecture
- **Orchestrator** (Celery Beat) — schedules all scraping jobs
- **API Workers** — fast HTTP for REST APIs (Companies House, Reed, Adzuna)
- **HTML Workers** — httpx + selectolax for static HTML (Indeed, TotalJobs, etc.)
- **Browser Workers** — Playwright headless for JS-heavy sites (LinkedIn, Glassdoor)
- **Proxy Manager** — residential + datacenter pools, per-domain rotation, auto-ban detection
- **Anti-Detection** — UA rotation (50+), TLS fingerprint matching, gaussian delays, cookie jars
- **Rate Limiter** — per-domain token bucket with adaptive backoff
- **Parser Registry** — versioned parsers per source, auto-healing on parse failure spikes

### Data Sources (30+)

**Tier 1: Authoritative (Government/Official)**
- GOV.UK Sponsor Register (CSV, auto-scraped every 6 hours)
- Companies House API (company profiles, officers, PSC, filings, charges)
- Immigration Stats (GOV.UK quarterly CSVs — visa grants, refusal rates)
- SOC Code Registry (occupational classification)
- Shortage Occupation List (GOV.UK)
- HMRC Employer PAYE Data

**Tier 2: Job Market Intelligence**
- Reed.co.uk API
- Adzuna API
- Indeed (scraper)
- LinkedIn Jobs (scraper)
- Glassdoor (scraper)
- TotalJobs (scraper)
- CWJobs (scraper)
- GOV.UK Find a Job (scraper)
- Guardian Jobs (scraper)
- NHS Jobs (API/scraper)
- Company Career Pages (top 500 sponsors, direct scraping)

**Tier 3: Company Intelligence**
- Glassdoor (company reviews, ratings, CEO approval)
- TrustPilot (customer reviews)
- Google Maps/Places API (business verification, ratings)
- LinkedIn Company Profiles (employee count, growth)
- Google News RSS (per-company news, sentiment)
- Charity Commission API (for charity sponsors)
- WHOIS (domain age)
- Website analysis (careers page detection, tech stack, SSL, social links)

**Tier 4: Real-Time Event Streams**
- Companies House Streaming API (WebSocket — filings, officer changes)
- GOV.UK change detection (polling every 6 hours)
- Job board polling (4-12 hour cycles per source)
- News monitoring (RSS + Google Alerts)

### Scraping Schedule

| Task | Frequency | Priority |
|------|-----------|----------|
| GOV.UK sponsor register | Every 6 hrs | CRITICAL |
| Companies House streaming | Real-time | HIGH |
| Reed/Adzuna API | Every 4 hrs | HIGH |
| Indeed/LinkedIn | Every 6-8 hrs | MEDIUM |
| TotalJobs/CWJobs | Every 8 hrs | MEDIUM |
| GOV.UK Find a Job | Every 12 hrs | LOW |
| NHS Jobs | Every 12 hrs | LOW |
| Google News | Every 12 hrs | MEDIUM |
| Glassdoor/TrustPilot | Every 7 days | LOW |
| LinkedIn company profiles | Every 7 days | LOW |
| Career page scrape (top 500) | Every 24 hrs | MEDIUM |
| Score recomputation | Every 6 hrs | HIGH |
| Alert evaluation | Every 1 hr | CRITICAL |
| Deduplication pass | Every 4 hrs | MEDIUM |

### Progressive Enrichment (140K Scale)

- **Level 0 (Base):** GOV.UK CSV — name, city, rating, route. 100% coverage day 1.
- **Level 1 (Companies House):** Company number, status, SIC codes, accounts, insolvency. ~19 hours for all 140K.
- **Level 2 (Officers & Ownership):** Directors, PSCs. ~38 hours for all 140K.
- **Level 3 (Jobs):** Active postings, sponsorship NLP. Continuous.
- **Level 4 (Reputation):** Glassdoor, TrustPilot, Google. Top 20K in 2 months.
- **Level 5 (Deep Intel):** News, LinkedIn, website analysis. Top 10K expanding.

Priority: companies with active jobs > user-searched companies > B-rated > London > rest.

## 6. Entity Resolution Engine: "Nexus"

Multi-stage pipeline for matching company names across 30+ sources:

1. **Exact match** — normalised (lowercase, strip Ltd/LLP/PLC/Inc) — 100% confidence
2. **Companies House number** — if enriched, match on CH number — 99% confidence
3. **Fuzzy match** — Levenshtein + token-based, 85% threshold — 85-95% confidence
4. **Alias table** — learned + curated known aliases (TCS = Tata Consultancy Services) — 90-99%
5. **Address + name combo** — similar name + same postcode — 80-90%
6. **Manual review queue** — low-confidence matches flagged for admin

## 7. Database Schema

### Core Tables
- `sponsors` — current state of all 140K sponsors (name, city, rating, route, score, first/last seen, active flag)
- `sponsor_snapshots` — historical state per CSV import
- `sponsor_changes` — the diff log (added, removed, rating_upgrade, rating_downgrade, route_change, etc.)
- `csv_imports` — metadata for each CSV import (filename, checksum, counts, auto vs manual)

### Company Intelligence
- `company_profiles` — aggregated from all sources (50+ fields: CH data, financials, workforce, reputation, online presence, legitimacy score)
- `company_officers` — directors, secretaries, with cross-reference to other sponsorships
- `company_psc` — persons of significant control (ownership)
- `company_news` — headlines, sentiment scores, risk signal flags
- `company_reviews_cache` — individual reviews with visa-mention NLP flags
- `company_aliases` — known name variations per source

### Job Intelligence
- `jobs` — all scraped jobs (title, salary, location, source, sponsorship likelihood score, skills extracted, SOC code, seniority, dedup cluster)
- `job_dedup_clusters` — groups same job across multiple boards
- `salary_benchmarks` — percentile salary data by SOC code + region
- `shortage_occupation_list` — current SOL with salary thresholds

### Scoring
- `sponsor_scores` — time-series composite scores with 7-factor breakdown (compliance, financial health, hiring activity, reputation, legitimacy, track record, growth signals) + risk flags

### Events
- `events` — unified event bus (sponsor_added, rating_change, new_job, news_detected, risk_flag, etc.) with severity and JSONB payload

### User Layer
- `users` — accounts (email, password_hash, OAuth, plan)
- `subscriptions` — Stripe billing state
- `watchlists` — tracked companies with priority, application status, follow-up dates
- `user_notes` — per-company notes
- `alerts` — alert configurations (type, filters, channel, frequency)
- `alert_history` — triggered alert log

## 8. Scoring Engine (7-Factor Model)

Each company scored 0-100 overall, composed of:

| Factor | Weight | Signals |
|--------|--------|---------|
| Compliance | 20% | A/B rating, consecutive A days, rating stability |
| Financial Health | 15% | Accounts filed, no insolvency, no CCJs, active status |
| Hiring Activity | 15% | Open jobs count, posting frequency, role diversity |
| Reputation | 15% | Glassdoor + TrustPilot + Google ratings, review volume |
| Legitimacy | 10% | Domain age, website exists, careers page, social presence, office verified |
| Track Record | 15% | Years on register, visa grant data, no compliance actions |
| Growth Signals | 10% | Employee growth, new postings trend, positive news sentiment |

Risk flags (JSONB): B_rating, accounts_overdue, director_resigned_recently, negative_news, no_website, shell_company_risk, insolvency_history.

## 9. Frontend Pages

Built with Next.js + React, dark theme (Bloomberg-inspired):

1. **Dashboard** — Market pulse (stats cards), sponsor growth chart, rating changes, top hiring sponsors, live signal feed (WebSocket), industry breakdown
2. **Search & Explore** — Advanced filters (20+ criteria), sortable/paginated table, bulk watchlist add, CSV/XLSX export
3. **Interactive Map** — UK heatmap with density/score/industry layers, region drill-down, click-to-profile
4. **Company Profile** — Comprehensive page per company: overview, jobs, people, financials, reviews, news, timeline, similar companies
5. **Job Intelligence** — Aggregated job board with sponsorship likelihood scores, salary distribution charts, sector breakdown
6. **Trends & Analytics (Pro)** — Sponsor register growth, industry trends, salary trends, geographic shifts, custom chart builder
7. **Signals Feed** — Real-time event stream: rating changes, new sponsors, job spikes, news, risk flags
8. **Compare Tool (Pro)** — Side-by-side company comparison (up to 4)
9. **Application Tracker** — Kanban pipeline (watching > applied > interviewing > offered > rejected), follow-up reminders, response rate analytics
10. **Alerts** — Visual alert builder with conditions, channels, frequency
11. **Settings** — API keys, billing, profile, notification preferences
12. **Admin Panel** — Scraping engine health dashboard, enrichment progress, proxy pool status, parser health

## 10. Freemium Tiers

| Feature | Free | Pro (9.99/mo) | Enterprise (29.99/mo) |
|---------|------|---------------|----------------------|
| Search 140K companies | Yes | Yes | Yes |
| Basic filters | Yes | All filters | All filters |
| Score (number only) | Yes | 7-factor breakdown | Custom scoring |
| Results per search | 10 | Unlimited | Unlimited |
| Searches per day | 5 | Unlimited | Unlimited |
| Company profiles | No | Full deep profiles | Full + API access |
| Historical timeline | No | Yes | Yes |
| Trend analytics | No | Yes | Yes + custom reports |
| Job intel + sponsorship % | No | Yes | Yes |
| Export (CSV/XLSX/PDF) | No | Yes | Bulk unlimited |
| Alerts | No | 10 alerts | Unlimited |
| Application tracker | No | Yes | Multi-user |
| Watchlist | No | 50 companies | Unlimited |
| Map view | Basic | Full interactive | Full + embeds |
| Compare tool | No | Up to 4 | Unlimited |
| API access | No | No | REST API |
| Team seats | 1 | 1 | 5 included |

Enterprise target: immigration law firms, recruitment agencies (~3,000 OISC-regulated advisors in UK).

## 11. Deployment

- **Docker Compose** for local dev (FastAPI + Next.js + PostgreSQL + Redis + Celery)
- **Production:** VPS (Hetzner) or AWS ECS
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry (errors), Prometheus + Grafana (metrics), UptimeRobot
- **Backups:** Automated PostgreSQL daily backups to S3

## 12. Key Technical Decisions

1. **PostgreSQL over MongoDB** — relational queries for cross-referencing, time-series for trends, JSONB for flexible fields
2. **Celery over simple cron** — distributed task execution, retry logic, monitoring, priority queues
3. **Next.js over plain React** — SSR for SEO (company profile pages should be Google-indexed), API routes, image optimisation
4. **Playwright over Selenium** — faster, more reliable, better anti-detection for JS-heavy sites
5. **httpx over requests** — async HTTP client, connection pooling, HTTP/2 support
6. **selectolax over BeautifulSoup** — 10-30x faster HTML parsing at scale
7. **curl_cffi for TLS fingerprinting** — matches real browser TLS signatures to avoid detection
