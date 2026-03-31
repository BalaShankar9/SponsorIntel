<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge" alt="Status: Live"/>
  <img src="https://img.shields.io/badge/Sponsors-140%2C000%2B-blue?style=for-the-badge" alt="140K+ Sponsors"/>
  <img src="https://img.shields.io/badge/Jobs-12%2C600%2B-orange?style=for-the-badge" alt="12K+ Jobs"/>
  <img src="https://img.shields.io/badge/Intel-92%2B%20Items-purple?style=for-the-badge" alt="92+ Intel Items"/>
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License"/>
</p>

# SponsorIntel

### The Bloomberg Terminal of UK Immigration Sponsor Intelligence

> **[sponsorintel.london](https://sponsorintel.london)** — Real-time monitoring of 140,000+ UK visa sponsor licence holders with AI-powered intelligence, 30+ data sources, and the world's first immigration intelligence agent army.

---

## What is SponsorIntel?

SponsorIntel is the most comprehensive UK immigration sponsor intelligence platform ever built. It monitors every company licensed to sponsor work visas in the UK, tracks their hiring patterns, analyses policy changes, and provides tools that no other platform offers.

**For job seekers:** Find which companies actually sponsor visas, see their hiring history, get salary benchmarks, and receive real-time alerts when new sponsors appear.

**For immigration lawyers:** Monitor client sponsors for rating changes, track policy shifts in Parliament, and generate compliance reports.

**For HR teams:** Benchmark your sponsorship programme against industry peers, track competitors' hiring, and stay ahead of regulatory changes.

---

## Features

### Core Intelligence
- **140,000+ UK Sponsor Companies** — Complete register with daily diff tracking
- **12,600+ Live Job Listings** — From Adzuna API + 13 free scrapers, matched to sponsors
- **Sponsorship Likelihood Scoring** — AI-powered 0-100% probability for every job
- **Company Risk Signals** — Companies House filings, charges, officer changes, insolvency history
- **Real-time Register Changes** — Detect new sponsors, downgrades, and revocations within 24 hours

### AI-Powered Tools
- **"Will They Sponsor Me?"** — Enter a company + role, get a personalised assessment with reasoning
- **Salary Threshold Calculator** — Compare job salary against visa thresholds by SOC code
- **Visa Route Finder** — Interactive quiz recommending the best visa route for your situation
- **Plain-English Visa Guide** — AI-generated, jargon-free immigration guidance
- **Research & Analysis Wing** — 11 AI-powered research tools for deep immigration analysis

### Immigration Intelligence
- **Parliamentary Monitoring** — Hansard debates and immigration policy tracking
- **GOV.UK Scanner** — Real-time Home Office policy change detection
- **Legal Updates** — Immigration law changes from legal publications
- **News Intelligence** — Guardian, BBC, and specialist immigration media monitoring
- **GROQ-Powered Classification** — Every intel item classified by impact, urgency, and relevance

### UK Immigration Ecosystem
- **UK Universities Hub** — 160+ universities with international student data
- **OISC Consultancies** — Regulated immigration advisor directory
- **SRA Solicitors** — Immigration solicitor lookup
- **Demographics & Statistics** — ONS data visualisations for immigration trends

### Platform Features
- **Interactive Dashboard** — Real-time stats, charts, and activity feeds
- **Advanced Search** — Full-text search across sponsors, jobs, and intel
- **Watchlist** — Track specific companies with personalised alerts
- **Application Tracker** — Kanban board for managing visa applications
- **Company Comparison** — Side-by-side sponsor analysis
- **UK Choropleth Map** — Geographic distribution of sponsors

---

## Architecture

```
                    +------------------+
                    |   Next.js 14     |
                    |   Frontend       |
                    |   (Netlify)      |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   FastAPI        |
                    |   Backend        |
                    |   (Railway)      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     |  Supabase  |  |   Redis     |  |   Celery    |
     |  Postgres  |  |   Cache +   |  |   Workers   |
     |  (Cloud)   |  |   Broker    |  |   (Railway) |
     +------------+  +-------------+  +-------------+
                                            |
                          +-----------------+------------------+
                          |                 |                  |
                    +-----v-----+   +------v------+   +------v------+
                    | Adzuna    |   | Gov.uk      |   | Companies   |
                    | Jobs API  |   | Register    |   | House API   |
                    +-----------+   +-------------+   +-------------+
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS | UI, SSR, responsive design |
| **Backend** | Python 3.12, FastAPI, Pydantic v2 | REST API, 50+ endpoints |
| **Database** | Supabase (PostgreSQL 16) | Primary data store, RLS policies |
| **Cache/Queue** | Redis 7 | Caching, Celery broker, signal bus |
| **Workers** | Celery 5.4 | Background scraping, enrichment, intel |
| **Scraping** | httpx, curl_cffi, selectolax, Playwright | 30+ data source scrapers |
| **AI/LLM** | GROQ (Llama 3.3 70B), 5-tier routing | Classification, enrichment, analysis |
| **Hosting** | Railway (backend), Netlify (frontend) | Production infrastructure |

### Agent Army (Phase 1 Complete)

SponsorIntel includes a military-structured AI agent framework:

- **6 Divisions** — Acquisition, Intelligence, Quality, Operations, Research, Command
- **5-Tier LLM Routing** — T0 (regex, $0) → T1 (8B) → T2 (70B) → T3 (405B) → T4 (Claude)
- **SIGINT Communication** — Redis Streams for inter-agent signals
- **Self-Learning** — Routing history logged for continuous optimisation
- **Fallback Chains** — Automatic provider failover per tier

---

## Data Sources

| Source | Type | Update Frequency |
|--------|------|-----------------|
| GOV.UK Sponsor Register | CSV | Daily |
| Adzuna Jobs API | REST API | Every 3 hours |
| Companies House API | REST API | On-demand enrichment |
| GOV.UK Policy Pages | Web scrape | Every 15 minutes |
| The Guardian | Web scrape | Every 15 minutes |
| BBC News | Web scrape | Every 15 minutes |
| Hansard (Parliament) | API | Daily |
| Free Job Board APIs | REST API | Every 2 hours |
| Legal Publications | Web scrape | Every 15 minutes |
| ONS Statistics | Excel/ODS | Monthly |
| Home Office Visa Stats | Excel/ODS | Quarterly |

---

## API

The backend exposes 50+ REST endpoints. Full interactive docs available at `/docs` (Swagger UI).

### Key Endpoints

```
GET  /api/sponsors                    # Search 140K+ sponsors
GET  /api/sponsors/{id}               # Sponsor detail + risk signals
GET  /api/sponsors/{id}/jobs          # Jobs from this sponsor
GET  /api/jobs                        # Search all jobs
GET  /api/jobs/{id}                   # Job detail + sponsorship score
GET  /api/intel                       # Immigration intelligence feed
GET  /api/intel/stats                 # Intel classification stats
GET  /api/analytics/dashboard         # Dashboard statistics
GET  /api/analytics/trends            # Hiring trends
POST /api/tools/will-they-sponsor     # AI sponsorship predictor
POST /api/tools/salary-threshold      # Visa salary calculator
GET  /api/ecosystem/universities      # UK universities data
GET  /api/watchlist                   # User watchlist
```

---

## Development

### Prerequisites
- Python 3.12+
- Node.js 20+
- Redis

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Redis
REDIS_URL=redis://localhost:6379/0

# APIs
GROQ_API_KEY=your_groq_key
COMPANIES_HOUSE_API_KEY=your_ch_key
ADZUNA_APP_ID=your_adzuna_id
ADZUNA_APP_KEY=your_adzuna_key

# Optional
ANTHROPIC_API_KEY=your_anthropic_key
NVIDIA_NIM_API_KEY=your_nvidia_key
```

### Running Tests
```bash
cd backend
python -m pytest tests/ -v
```

---

## Roadmap

- [x] Phase 1: Agent Army framework (6 divisions, 5-tier LLM routing)
- [x] Phase 2: Division migration (existing agents → army structure)
- [x] Data Foundation: Visa statistics, ISL occupations, ONS benchmarks
- [x] AI Tools: Will They Sponsor Me, Salary Calculator, Visa Guide
- [x] Immigration Intel: Parliamentary monitoring, policy tracking
- [x] UK Ecosystem: Universities, OISC, SRA directories
- [ ] Phase 3: Community features (reviews, salary reports, success stories)
- [ ] Phase 4: B2B tier (lawyer dashboard, compliance alerts, API access)
- [ ] Phase 5: Mobile PWA + push notifications
- [ ] Phase 6: Email digests + personalised weekly briefings

---

## Contributing

This is a proprietary platform. If you're interested in contributing or have feature requests, please open an issue.

---

## License

All rights reserved. This software is proprietary and confidential.

---

<p align="center">
  <strong>Built with relentless ambition by the SponsorIntel team</strong><br/>
  <a href="https://sponsorintel.london">sponsorintel.london</a>
</p>
