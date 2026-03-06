# SponsorIntel

The Bloomberg Terminal of UK Sponsorship Intelligence. Monitor 140,000+ UK sponsor licence holders with comprehensive data from 30+ sources.

## Quick Start

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

- 140K+ UK sponsor companies monitored
- 17 website scrapers (pure scraping, no API keys)
- 7-factor company scoring engine
- Real-time change detection and alerts
- Job intelligence with sponsorship likelihood NLP
- Interactive UK map
- Application tracker (Kanban)
- Freemium model (Free / Pro / Enterprise)
