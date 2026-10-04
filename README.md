![SponsorIntel — Make sponsor data easier to investigate.](.github/showcase/banner.svg)

**[Project guide](docs/SHOWCASE.md)** · [Source](https://github.com/BalaShankar9/SponsorIntel) · [Issues](https://github.com/BalaShankar9/SponsorIntel/issues) · [Bala's work](https://github.com/BalaShankar9)

> **Current stage: Cloudflare open beta.** [Try Sponsor Intel](https://sponsorintel.balashankarbollineni4.workers.dev). The redesigned app lives in [`cloudflare/`](cloudflare/README.md). The intended domain, **sponsorintel.london**, is awaiting registrar and Cloudflare dashboard access. [Release evidence and migration status](docs/CLOUDFLARE_LAUNCH.md).

# SponsorIntel

A welcoming workspace for international students and people building a career in the UK: discover licensed employers, compare a shortlist, and track applications. The Cloudflare beta uses a dated official GOV.UK register and clearly separates a sponsor licence from an advertised job offering sponsorship.

## Current Cloudflare app

- Responsive React interface with employer search, city/route/rating filters and employer profiles.
- 127,902 employer/location records from the 2 October 2026 register at initial release; live counts and dates appear in the app.
- Shortlists, comparisons, application stages, notes, follow-up dates and JSON/CSV exports.
- Device-local workspaces with backup import; no account or cross-device sync yet.
- Current Work Hub and NHS job searches, official UK guidance, and private feedback.
- Cloudflare Worker, static assets and D1 database with a scheduled register refresh.

See [`cloudflare/README.md`](cloudflare/README.md) for setup, maintenance and rollback. The older services below remain in the repository for reference and staged migration. Their accounts, alerts, billing, scrapers and scoring are **not** connected to the beta.

## Legacy application quick start

### Prerequisites
- Docker & Docker Compose
- Make (optional)

### Setup

1. Clone and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. Start all services:
   ```bash
   make up
   # or: docker compose up -d
   ```

3. Seed the database:
   ```bash
   make seed
   # or: docker compose exec backend python -m app.scripts.seed_data
   ```

4. Open in browser:
   - Frontend: http://localhost:3000
   - API docs: http://localhost:8000/docs
   - Admin: admin@sponsorintel.com / admin123changeme

### Architecture

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js React app |
| Backend | 8000 | FastAPI REST API |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache + Celery broker |
| Celery Worker | -- | Background scraping tasks |
| Celery Beat | -- | Scheduled task orchestrator |

### Key Commands

```bash
make up              # Start all services
make down            # Stop all services
make logs            # View logs
make migrate         # Run database migrations
make seed            # Import initial data
make test-backend    # Run backend tests
make test-frontend   # Run frontend tests
make shell           # Open Python shell
```

### Tech Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Celery
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts
- **Database:** PostgreSQL 16 (pg_trgm for fuzzy search)
- **Cache:** Redis 7
- **Scraping:** httpx, Playwright, selectolax, curl_cffi
- **Deployment:** Docker, Nginx

### Features

- Sponsor company search over imported datasets
- 17 website scrapers (pure scraping, no API keys)
- 7-factor company scoring engine
- Real-time change detection and alerts
- Job intelligence with sponsorship likelihood NLP
- Interactive UK map
- Application tracker (Kanban)
- Freemium model (Free / Pro / Enterprise)
