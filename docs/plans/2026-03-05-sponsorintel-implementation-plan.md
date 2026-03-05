# SponsorIntel Platform — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the definitive UK Sponsor Licence Intelligence Platform — monitoring 140K companies with 30+ data sources, real-time enrichment, 7-factor scoring, and a Bloomberg-inspired frontend.

**Architecture:** FastAPI backend + Next.js frontend + PostgreSQL + Redis + Celery. Dockerised for local dev and production. Scraping engine ("Hydra") with proxy rotation, anti-detection, and progressive enrichment. Entity resolution ("Nexus") for cross-source company matching.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Celery, Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, D3.js, Leaflet, PostgreSQL 16, Redis 7, Docker, Stripe, httpx, selectolax, Playwright, curl_cffi.

**Design doc:** `docs/plans/2026-03-05-sponsorintel-platform-design.md`

---

## Phase 1: Project Scaffolding & Infrastructure

### Task 1.1: Monorepo Structure & Docker

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.prod.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `Makefile`

**Step 1: Create project directory structure**

```bash
mkdir -p backend/{app/{api/v1,core,models,schemas,services,scrapers,tasks,utils},tests/{unit,integration},alembic/versions}
mkdir -p frontend/{src/{app,components,lib,hooks,types,styles},public}
mkdir -p docker/{nginx,postgres}
mkdir -p docs/plans
```

**Step 2: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sponsorintel
      POSTGRES_USER: ${DB_USER:-sponsorintel}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sponsorintel"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app
      - ./data:/data
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER:-sponsorintel}:${DB_PASSWORD:-devpassword}@db:5432/sponsorintel
      - REDIS_URL=redis://redis:6379/0
      - ENV=development
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env

  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    volumes:
      - ./backend:/app
      - ./data:/data
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER:-sponsorintel}:${DB_PASSWORD:-devpassword}@db:5432/sponsorintel
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app beat --loglevel=info
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER:-sponsorintel}:${DB_PASSWORD:-devpassword}@db:5432/sponsorintel
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - .env

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    command: npm run dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

volumes:
  postgres_data:
```

**Step 3: Create backend Dockerfile**

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 4: Create backend/requirements.txt**

```txt
# Core
fastapi==0.111.0
uvicorn[standard]==0.30.1
pydantic==2.7.4
pydantic-settings==2.3.4
python-multipart==0.0.9

# Database
sqlalchemy[asyncio]==2.0.31
asyncpg==0.29.0
alembic==1.13.1
psycopg2-binary==2.9.9

# Cache & Queue
redis==5.0.7
celery[redis]==5.4.0

# HTTP & Scraping
httpx==0.27.0
curl-cffi==0.7.1
selectolax==0.3.21
playwright==1.45.0

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
authlib==1.3.1

# Payments
stripe==10.1.0

# Utils
python-dotenv==1.0.1
orjson==3.10.5

# Email
resend==2.1.0

# NLP (lightweight)
rapidfuzz==3.9.4

# Testing
pytest==8.2.2
pytest-asyncio==0.23.7
pytest-cov==5.0.0
httpx-mock==0.30.0
factory-boy==3.3.0
```

**Step 5: Create frontend Dockerfile and package.json**

Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
```

Create `frontend/package.json`:
```json
{
  "name": "sponsorintel-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "recharts": "2.12.7",
    "leaflet": "1.9.4",
    "react-leaflet": "4.2.1",
    "@stripe/stripe-js": "4.1.0",
    "zustand": "4.5.4",
    "date-fns": "3.6.0",
    "clsx": "2.1.1",
    "tailwind-merge": "2.4.0",
    "@tanstack/react-query": "5.51.1",
    "@tanstack/react-table": "8.19.3",
    "lucide-react": "0.408.0",
    "sonner": "1.5.0"
  },
  "devDependencies": {
    "typescript": "5.5.3",
    "@types/react": "18.3.3",
    "@types/node": "20.14.10",
    "@types/leaflet": "1.9.12",
    "tailwindcss": "3.4.6",
    "autoprefixer": "10.4.19",
    "postcss": "8.4.39",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.5",
    "jest": "29.7.0",
    "@testing-library/react": "16.0.0",
    "@testing-library/jest-dom": "6.4.6"
  }
}
```

**Step 6: Create .env.example**

```env
# Database
DB_USER=sponsorintel
DB_PASSWORD=devpassword
DATABASE_URL=postgresql+asyncpg://sponsorintel:devpassword@db:5432/sponsorintel

# Redis
REDIS_URL=redis://redis:6379/0

# Auth
SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# API Keys (scraping)
COMPANIES_HOUSE_API_KEY=
REED_API_KEY=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=

# Email
RESEND_API_KEY=

# Proxy
PROXY_RESIDENTIAL_URL=
PROXY_DATACENTER_URL=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

**Step 7: Create Makefile**

```makefile
.PHONY: up down build logs migrate seed test

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

backend-logs:
	docker compose logs -f backend celery-worker celery-beat

migrate:
	docker compose exec backend alembic upgrade head

migrate-new:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

seed:
	docker compose exec backend python -m app.scripts.seed_data

test-backend:
	docker compose exec backend pytest tests/ -v --cov=app

test-frontend:
	docker compose exec frontend npm test

shell:
	docker compose exec backend python -c "import IPython; IPython.start_ipython()" 2>/dev/null || docker compose exec backend python
```

**Step 8: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/

# Node
node_modules/
.next/
out/

# Environment
.env
.env.local

# Database
*.db
postgres_data/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Data
data/*.csv
*.sqlite3

# Docker
docker/postgres/data/
```

**Step 9: Verify docker-compose builds**

Run: `cd "/Users/balabollineni/Sponsorship DOG" && docker compose build`
Expected: All 4 services build successfully.

**Step 10: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffolding with Docker Compose (FastAPI + Next.js + PostgreSQL + Redis + Celery)"
```

---

### Task 1.2: FastAPI App Skeleton & Config

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/redis.py`

**Step 1: Create config module**

`backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "SponsorIntel"
    env: str = "development"
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://sponsorintel:devpassword@db:5432/sponsorintel"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Auth
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # API Keys
    companies_house_api_key: str = ""
    reed_api_key: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""
    stripe_enterprise_price_id: str = ""

    # Email
    resend_api_key: str = ""

    # Proxy
    proxy_residential_url: str = ""
    proxy_datacenter_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

**Step 2: Create database module**

`backend/app/core/database.py`:
```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20,
    max_overflow=10,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

**Step 3: Create Redis module**

`backend/app/core/redis.py`:
```python
import redis.asyncio as aioredis
from app.core.config import get_settings

settings = get_settings()

redis_client = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)


async def get_redis():
    return redis_client
```

**Step 4: Create FastAPI main app**

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.core.database import engine, Base

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"[SponsorIntel] Starting in {settings.env} mode")
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="UK Sponsor Licence Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "sponsorintel"}
```

**Step 5: Create `__init__.py` files**

```bash
touch backend/app/__init__.py
touch backend/app/core/__init__.py
touch backend/app/api/__init__.py
touch backend/app/api/v1/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/services/__init__.py
touch backend/app/scrapers/__init__.py
touch backend/app/tasks/__init__.py
touch backend/app/utils/__init__.py
```

**Step 6: Verify backend starts**

Run: `docker compose up -d db redis backend && sleep 5 && curl http://localhost:8000/api/health`
Expected: `{"status":"ok","service":"sponsorintel"}`

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: FastAPI app skeleton with config, database, and Redis modules"
```

---

### Task 1.3: Alembic & Database Migrations Setup

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`

**Step 1: Create alembic.ini**

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+psycopg2://sponsorintel:devpassword@db:5432/sponsorintel

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
```

**Step 2: Create alembic/env.py**

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import Base
from app.models import *  # noqa: F403 — import all models for autogenerate

config = context.config
config.set_main_option("sqlalchemy.url", os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://sponsorintel:devpassword@db:5432/sponsorintel"
).replace("+asyncpg", "+psycopg2"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = config.get_main_option("sqlalchemy.url")
    connectable = async_engine_from_config(
        configuration, prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: Alembic migration setup for async PostgreSQL"
```

---

## Phase 2: Database Models & Core Data Layer

### Task 2.1: Sponsor Core Models

**Files:**
- Create: `backend/app/models/sponsor.py`
- Create: `backend/app/models/enums.py`
- Test: `backend/tests/unit/test_models_sponsor.py`

**Step 1: Create enums**

`backend/app/models/enums.py`:
```python
import enum


class SponsorRating(str, enum.Enum):
    A = "A"
    B = "B"


class SponsorType(str, enum.Enum):
    WORKER = "Worker"
    TEMPORARY_WORKER = "Temporary Worker"


class ChangeType(str, enum.Enum):
    ADDED = "added"
    REMOVED = "removed"
    RATING_UPGRADE = "rating_upgrade"
    RATING_DOWNGRADE = "rating_downgrade"
    ROUTE_ADDED = "route_added"
    ROUTE_REMOVED = "route_removed"
    LOCATION_CHANGE = "location_change"
    NAME_CHANGE = "name_change"
    REACTIVATED = "reactivated"


class EventType(str, enum.Enum):
    SPONSOR_ADDED = "sponsor_added"
    SPONSOR_REMOVED = "sponsor_removed"
    RATING_CHANGE = "rating_change"
    NEW_JOB_DETECTED = "new_job_detected"
    JOB_EXPIRED = "job_expired"
    COMPANY_ENRICHED = "company_enriched"
    NEWS_DETECTED = "news_detected"
    RISK_FLAG_RAISED = "risk_flag_raised"
    RISK_FLAG_CLEARED = "risk_flag_cleared"
    SCORE_CHANGED = "score_changed"
    CSV_IMPORTED = "csv_imported"
    FILING_DETECTED = "filing_detected"
    OFFICER_CHANGE = "officer_change"
    INSOLVENCY_EVENT = "insolvency_event"


class Severity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class JobSource(str, enum.Enum):
    REED = "reed"
    ADZUNA = "adzuna"
    INDEED = "indeed"
    LINKEDIN = "linkedin"
    GLASSDOOR = "glassdoor"
    TOTALJOBS = "totaljobs"
    CWJOBS = "cwjobs"
    GOV_FINDAJOB = "gov_findajob"
    GUARDIAN = "guardian"
    NHS_JOBS = "nhs_jobs"
    CAREER_PAGE = "career_page"


class ContractType(str, enum.Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    APPRENTICESHIP = "apprenticeship"


class Seniority(str, enum.Enum):
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    DIRECTOR = "director"
    EXECUTIVE = "executive"


class UserPlan(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    PAST_DUE = "past_due"
    TRIALING = "trialing"


class ApplicationStatus(str, enum.Enum):
    WATCHING = "watching"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class AlertType(str, enum.Enum):
    NEW_SPONSOR = "new_sponsor"
    RATING_CHANGE = "rating_change"
    NEW_JOB = "new_job"
    COMPANY_NEWS = "company_news"
    RISK_FLAG = "risk_flag"
    SPONSOR_REMOVED = "sponsor_removed"
    SCORE_CHANGE = "score_change"


class AlertChannel(str, enum.Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    BOTH = "both"


class ReviewSource(str, enum.Enum):
    GLASSDOOR = "glassdoor"
    TRUSTPILOT = "trustpilot"
    GOOGLE = "google"


class EnrichmentLevel(int, enum.Enum):
    BASE = 0
    COMPANIES_HOUSE = 1
    OFFICERS = 2
    JOBS = 3
    REPUTATION = 4
    DEEP = 5
```

**Step 2: Create sponsor models**

`backend/app/models/sponsor.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, Enum,
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from app.core.database import Base
from app.models.enums import SponsorRating, SponsorType, ChangeType


class Sponsor(Base):
    __tablename__ = "sponsors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organisation_name: Mapped[str] = mapped_column(String(500), nullable=False)
    organisation_name_normalised: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    town_city: Mapped[str | None] = mapped_column(String(200))
    county: Mapped[str | None] = mapped_column(String(200))
    type_and_rating: Mapped[str | None] = mapped_column(String(200))
    rating: Mapped[str | None] = mapped_column(Enum(SponsorRating), index=True)
    sponsor_type: Mapped[str | None] = mapped_column(Enum(SponsorType))
    route: Mapped[list | None] = mapped_column(ARRAY(String), default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    first_seen_date: Mapped[datetime | None] = mapped_column(DateTime)
    last_seen_date: Mapped[datetime | None] = mapped_column(DateTime)
    consecutive_a_rating_days: Mapped[int] = mapped_column(Integer, default=0)
    times_rating_changed: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    snapshots: Mapped[list["SponsorSnapshot"]] = relationship(back_populates="sponsor")
    changes: Mapped[list["SponsorChange"]] = relationship(back_populates="sponsor")
    profile: Mapped["CompanyProfile | None"] = relationship(back_populates="sponsor")
    scores: Mapped[list["SponsorScore"]] = relationship(back_populates="sponsor")
    aliases: Mapped[list["CompanyAlias"]] = relationship(back_populates="sponsor")

    __table_args__ = (
        Index("ix_sponsors_name_trgm", "organisation_name_normalised", postgresql_using="gin",
              postgresql_ops={"organisation_name_normalised": "gin_trgm_ops"}),
        Index("ix_sponsors_city", "town_city"),
        Index("ix_sponsors_county", "county"),
    )


class CsvImport(Base):
    __tablename__ = "csv_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(500))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    checksum_md5: Mapped[str] = mapped_column(String(32), unique=True)
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    added_count: Mapped[int] = mapped_column(Integer, default=0)
    removed_count: Mapped[int] = mapped_column(Integer, default=0)
    changed_count: Mapped[int] = mapped_column(Integer, default=0)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_auto: Mapped[bool] = mapped_column(Boolean, default=False)

    snapshots: Mapped[list["SponsorSnapshot"]] = relationship(back_populates="csv_import")
    changes: Mapped[list["SponsorChange"]] = relationship(back_populates="csv_import")


class SponsorSnapshot(Base):
    __tablename__ = "sponsor_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), index=True)
    csv_import_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("csv_imports.id"), index=True)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime)
    organisation_name: Mapped[str] = mapped_column(String(500))
    town_city: Mapped[str | None] = mapped_column(String(200))
    county: Mapped[str | None] = mapped_column(String(200))
    type_and_rating: Mapped[str | None] = mapped_column(String(200))
    route: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sponsor: Mapped["Sponsor"] = relationship(back_populates="snapshots")
    csv_import: Mapped["CsvImport"] = relationship(back_populates="snapshots")


class SponsorChange(Base):
    __tablename__ = "sponsor_changes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), index=True)
    csv_import_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("csv_imports.id"), index=True)
    change_type: Mapped[str] = mapped_column(Enum(ChangeType), index=True)
    field_changed: Mapped[str | None] = mapped_column(String(100))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    significance_score: Mapped[int] = mapped_column(Integer, default=5)

    sponsor: Mapped["Sponsor"] = relationship(back_populates="changes")
    csv_import: Mapped["CsvImport"] = relationship(back_populates="changes")

    __table_args__ = (
        Index("ix_sponsor_changes_detected", "detected_at"),
    )
```

**Step 3: Write a basic model test**

`backend/tests/unit/test_models_sponsor.py`:
```python
from app.models.sponsor import Sponsor, CsvImport, SponsorSnapshot, SponsorChange
from app.models.enums import SponsorRating, ChangeType


def test_sponsor_model_fields():
    s = Sponsor(
        organisation_name="Test Company Ltd",
        organisation_name_normalised="test company",
        town_city="London",
        rating=SponsorRating.A,
        is_active=True,
    )
    assert s.organisation_name == "Test Company Ltd"
    assert s.rating == SponsorRating.A
    assert s.is_active is True


def test_change_type_enum():
    assert ChangeType.RATING_DOWNGRADE.value == "rating_downgrade"
    assert ChangeType.ADDED.value == "added"
```

**Step 4: Run tests**

Run: `docker compose exec backend pytest tests/unit/test_models_sponsor.py -v`
Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: sponsor core models (Sponsor, CsvImport, SponsorSnapshot, SponsorChange)"
```

---

### Task 2.2: Company Intelligence Models

**Files:**
- Create: `backend/app/models/company.py`

**Step 1: Create company intelligence models**

`backend/app/models/company.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, Enum, ForeignKey, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from app.core.database import Base
from app.models.enums import ReviewSource, EnrichmentLevel


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), unique=True, index=True)

    # Companies House
    companies_house_number: Mapped[str | None] = mapped_column(String(20), index=True)
    company_status: Mapped[str | None] = mapped_column(String(50))
    incorporation_date: Mapped[datetime | None] = mapped_column(DateTime)
    company_type: Mapped[str | None] = mapped_column(String(50))
    sic_codes: Mapped[dict | None] = mapped_column(JSONB)
    industry_primary: Mapped[str | None] = mapped_column(String(200), index=True)
    industry_tags: Mapped[list | None] = mapped_column(ARRAY(String))
    registered_address: Mapped[dict | None] = mapped_column(JSONB)
    trading_address: Mapped[dict | None] = mapped_column(JSONB)

    # Financial health
    has_charges: Mapped[bool | None] = mapped_column(Boolean)
    charge_count: Mapped[int | None] = mapped_column(Integer)
    has_insolvency_history: Mapped[bool | None] = mapped_column(Boolean)
    has_ccjs: Mapped[bool | None] = mapped_column(Boolean)
    last_accounts_date: Mapped[datetime | None] = mapped_column(DateTime)
    next_accounts_due: Mapped[datetime | None] = mapped_column(DateTime)
    accounts_overdue: Mapped[bool | None] = mapped_column(Boolean)
    confirmation_statement_overdue: Mapped[bool | None] = mapped_column(Boolean)
    estimated_revenue_band: Mapped[str | None] = mapped_column(String(100))
    credit_risk_score: Mapped[int | None] = mapped_column(Integer)

    # Workforce
    employee_count_estimate: Mapped[int | None] = mapped_column(Integer)
    employee_count_source: Mapped[str | None] = mapped_column(String(50))
    employee_growth_6m: Mapped[float | None] = mapped_column(Float)
    employee_growth_12m: Mapped[float | None] = mapped_column(Float)
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    linkedin_follower_count: Mapped[int | None] = mapped_column(Integer)

    # Reputation
    glassdoor_rating: Mapped[float | None] = mapped_column(Float)
    glassdoor_review_count: Mapped[int | None] = mapped_column(Integer)
    glassdoor_ceo_approval: Mapped[float | None] = mapped_column(Float)
    glassdoor_recommend_pct: Mapped[float | None] = mapped_column(Float)
    trustpilot_rating: Mapped[float | None] = mapped_column(Float)
    trustpilot_review_count: Mapped[int | None] = mapped_column(Integer)
    google_rating: Mapped[float | None] = mapped_column(Float)
    google_review_count: Mapped[int | None] = mapped_column(Integer)

    # Online presence
    website_url: Mapped[str | None] = mapped_column(String(500))
    website_domain_age_days: Mapped[int | None] = mapped_column(Integer)
    has_careers_page: Mapped[bool | None] = mapped_column(Boolean)
    social_links: Mapped[dict | None] = mapped_column(JSONB)
    tech_stack_detected: Mapped[list | None] = mapped_column(ARRAY(String))

    # Meta
    legitimacy_score: Mapped[int | None] = mapped_column(Integer)
    enrichment_level: Mapped[int] = mapped_column(Integer, default=0)
    enrichment_priority: Mapped[int] = mapped_column(Integer, default=3)
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime)
    enrichment_version: Mapped[int] = mapped_column(Integer, default=1)
    next_enrichment_due: Mapped[datetime | None] = mapped_column(DateTime)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)

    # Relationships
    sponsor: Mapped["Sponsor"] = relationship(back_populates="profile")
    officers: Mapped[list["CompanyOfficer"]] = relationship(back_populates="profile")
    pscs: Mapped[list["CompanyPSC"]] = relationship(back_populates="profile")
    news: Mapped[list["CompanyNews"]] = relationship(back_populates="profile")
    reviews: Mapped[list["CompanyReview"]] = relationship(back_populates="profile")


class CompanyOfficer(Base):
    __tablename__ = "company_officers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id"), index=True)
    name: Mapped[str] = mapped_column(String(300))
    role: Mapped[str | None] = mapped_column(String(100))
    appointed_on: Mapped[datetime | None] = mapped_column(DateTime)
    resigned_on: Mapped[datetime | None] = mapped_column(DateTime)
    nationality: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    other_directorships_count: Mapped[int | None] = mapped_column(Integer)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="officers")


class CompanyPSC(Base):
    __tablename__ = "company_pscs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id"), index=True)
    name: Mapped[str] = mapped_column(String(300))
    nationality: Mapped[str | None] = mapped_column(String(100))
    country_of_residence: Mapped[str | None] = mapped_column(String(100))
    natures_of_control: Mapped[dict | None] = mapped_column(JSONB)
    notified_on: Mapped[datetime | None] = mapped_column(DateTime)
    ceased_on: Mapped[datetime | None] = mapped_column(DateTime)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="pscs")


class CompanyNews(Base):
    __tablename__ = "company_news"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id"), index=True)
    headline: Mapped[str] = mapped_column(String(1000))
    source: Mapped[str | None] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(String(2000))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    sentiment: Mapped[str | None] = mapped_column(String(20))
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    keywords: Mapped[list | None] = mapped_column(ARRAY(String))
    is_risk_signal: Mapped[bool] = mapped_column(Boolean, default=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="news")


class CompanyReview(Base):
    __tablename__ = "company_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id"), index=True)
    source: Mapped[str] = mapped_column(Enum(ReviewSource))
    rating: Mapped[float | None] = mapped_column(Float)
    title: Mapped[str | None] = mapped_column(String(500))
    text_snippet: Mapped[str | None] = mapped_column(String(1000))
    mentions_visa: Mapped[bool] = mapped_column(Boolean, default=False)
    mentions_sponsorship: Mapped[bool] = mapped_column(Boolean, default=False)
    sentiment: Mapped[float | None] = mapped_column(Float)
    review_date: Mapped[datetime | None] = mapped_column(DateTime)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    profile: Mapped["CompanyProfile"] = relationship(back_populates="reviews")


class CompanyAlias(Base):
    __tablename__ = "company_aliases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), index=True)
    alias_name: Mapped[str] = mapped_column(String(500), index=True)
    alias_source: Mapped[str | None] = mapped_column(String(50))
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    verified_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sponsor: Mapped["Sponsor"] = relationship(back_populates="aliases")
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: company intelligence models (Profile, Officers, PSC, News, Reviews, Aliases)"
```

---

### Task 2.3: Job Intelligence Models

**Files:**
- Create: `backend/app/models/job.py`

**Step 1: Create job models**

`backend/app/models/job.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, Enum, ForeignKey, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from app.core.database import Base
from app.models.enums import JobSource, ContractType, Seniority


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sponsors.id"), index=True)
    source: Mapped[str] = mapped_column(Enum(JobSource), index=True)
    source_job_id: Mapped[str | None] = mapped_column(String(200))

    # Title
    title_raw: Mapped[str] = mapped_column(String(500))
    title_normalised: Mapped[str | None] = mapped_column(String(500), index=True)
    soc_code: Mapped[str | None] = mapped_column(String(10), index=True)

    # Company
    company_name_raw: Mapped[str] = mapped_column(String(500))
    company_name_normalised: Mapped[str | None] = mapped_column(String(500), index=True)

    # Location
    location_raw: Mapped[str | None] = mapped_column(String(500))
    location_city: Mapped[str | None] = mapped_column(String(200), index=True)
    location_region: Mapped[str | None] = mapped_column(String(200))
    location_is_remote: Mapped[bool] = mapped_column(Boolean, default=False)

    # Salary
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    salary_currency: Mapped[str] = mapped_column(String(3), default="GBP")
    salary_period: Mapped[str | None] = mapped_column(String(20))
    salary_text_raw: Mapped[str | None] = mapped_column(String(200))

    # Classification
    contract_type: Mapped[str | None] = mapped_column(Enum(ContractType))
    seniority: Mapped[str | None] = mapped_column(Enum(Seniority))

    # Content
    description_full: Mapped[str | None] = mapped_column(Text)
    description_snippet: Mapped[str | None] = mapped_column(String(1000))

    # Sponsorship detection
    sponsorship_likelihood: Mapped[int | None] = mapped_column(Integer)
    sponsorship_signals: Mapped[dict | None] = mapped_column(JSONB)
    is_on_shortage_list: Mapped[bool] = mapped_column(Boolean, default=False)
    meets_salary_threshold: Mapped[bool] = mapped_column(Boolean, default=False)

    # Skills
    skills_extracted: Mapped[list | None] = mapped_column(ARRAY(String))
    experience_years_min: Mapped[int | None] = mapped_column(Integer)
    experience_years_max: Mapped[int | None] = mapped_column(Integer)

    # Lifecycle
    posted_date: Mapped[datetime | None] = mapped_column(DateTime)
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False)
    days_open: Mapped[int | None] = mapped_column(Integer)

    # Dedup
    dedup_cluster_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("job_dedup_clusters.id"))
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_jobs_sponsorship", "sponsorship_likelihood"),
        Index("ix_jobs_posted", "posted_date"),
        Index("ix_jobs_source_id", "source", "source_job_id", unique=True),
    )


class JobDedupCluster(Base):
    __tablename__ = "job_dedup_clusters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    source_count: Mapped[int] = mapped_column(Integer, default=1)
    sources: Mapped[list | None] = mapped_column(ARRAY(String))
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SalaryBenchmark(Base):
    __tablename__ = "salary_benchmarks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    soc_code: Mapped[str | None] = mapped_column(String(10), index=True)
    title_normalised: Mapped[str] = mapped_column(String(500), index=True)
    location_region: Mapped[str | None] = mapped_column(String(200))
    period: Mapped[str | None] = mapped_column(String(10))
    p10: Mapped[int | None] = mapped_column(Integer)
    p25: Mapped[int | None] = mapped_column(Integer)
    median: Mapped[int | None] = mapped_column(Integer)
    p75: Mapped[int | None] = mapped_column(Integer)
    p90: Mapped[int | None] = mapped_column(Integer)
    sample_size: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(String(50))
    meets_visa_threshold: Mapped[bool | None] = mapped_column(Boolean)
    visa_salary_threshold: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ShortageOccupation(Base):
    __tablename__ = "shortage_occupations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    soc_code: Mapped[str] = mapped_column(String(10), index=True)
    job_title: Mapped[str] = mapped_column(String(500))
    salary_threshold: Mapped[int | None] = mapped_column(Integer)
    standard_threshold: Mapped[int | None] = mapped_column(Integer)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: job intelligence models (Job, DedupCluster, SalaryBenchmark, ShortageOccupation)"
```

---

### Task 2.4: Scoring, Events, and User Models

**Files:**
- Create: `backend/app/models/scoring.py`
- Create: `backend/app/models/event.py`
- Create: `backend/app/models/user.py`

**Step 1: Create scoring model**

`backend/app/models/scoring.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class SponsorScore(Base):
    __tablename__ = "sponsor_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), index=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    overall_score: Mapped[int] = mapped_column(Integer, default=50)

    # 7-factor breakdown
    compliance_score: Mapped[int] = mapped_column(Integer, default=50)
    financial_health_score: Mapped[int] = mapped_column(Integer, default=50)
    hiring_activity_score: Mapped[int] = mapped_column(Integer, default=50)
    reputation_score: Mapped[int] = mapped_column(Integer, default=50)
    legitimacy_score: Mapped[int] = mapped_column(Integer, default=50)
    track_record_score: Mapped[int] = mapped_column(Integer, default=50)
    growth_signal_score: Mapped[int] = mapped_column(Integer, default=50)

    risk_flags: Mapped[dict | None] = mapped_column(JSONB)
    score_version: Mapped[int] = mapped_column(Integer, default=1)

    sponsor: Mapped["Sponsor"] = relationship(back_populates="scores")

    __table_args__ = (
        Index("ix_scores_computed", "computed_at"),
    )
```

**Step 2: Create event model**

`backend/app/models/event.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
from app.models.enums import EventType, Severity


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(Enum(EventType), index=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    severity: Mapped[str] = mapped_column(Enum(Severity), default=Severity.INFO)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_events_type_created", "event_type", "created_at"),
        Index("ix_events_entity", "entity_type", "entity_id"),
    )
```

**Step 3: Create user models**

`backend/app/models/user.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
from app.models.enums import (
    UserPlan, SubscriptionStatus, ApplicationStatus,
    AlertType, AlertChannel
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(200))
    name: Mapped[str | None] = mapped_column(String(200))
    oauth_provider: Mapped[str | None] = mapped_column(String(50))
    oauth_id: Mapped[str | None] = mapped_column(String(200))
    plan: Mapped[str] = mapped_column(Enum(UserPlan), default=UserPlan.FREE)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

    subscription: Mapped["Subscription | None"] = relationship(back_populates="user")
    watchlist_items: Mapped[list["WatchlistItem"]] = relationship(back_populates="user")
    notes: Mapped[list["UserNote"]] = relationship(back_populates="user")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="user")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    plan: Mapped[str] = mapped_column(Enum(UserPlan), default=UserPlan.FREE)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(200))
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="subscription")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str | None] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.WATCHING)
    applied_date: Mapped[datetime | None] = mapped_column(DateTime)
    next_followup: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="watchlist_items")


class UserNote(Base):
    __tablename__ = "user_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    alert_type: Mapped[str] = mapped_column(Enum(AlertType))
    config: Mapped[dict | None] = mapped_column(JSONB)
    channel: Mapped[str] = mapped_column(Enum(AlertChannel), default=AlertChannel.EMAIL)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="alerts")
    history: Mapped[list["AlertHistory"]] = relationship(back_populates="alert")


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alerts.id"), index=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payload: Mapped[dict | None] = mapped_column(JSONB)
    read: Mapped[bool] = mapped_column(Boolean, default=False)

    alert: Mapped["Alert"] = relationship(back_populates="history")
```

**Step 4: Create models/__init__.py to import all models**

`backend/app/models/__init__.py`:
```python
from app.models.sponsor import Sponsor, CsvImport, SponsorSnapshot, SponsorChange
from app.models.company import (
    CompanyProfile, CompanyOfficer, CompanyPSC,
    CompanyNews, CompanyReview, CompanyAlias,
)
from app.models.job import Job, JobDedupCluster, SalaryBenchmark, ShortageOccupation
from app.models.scoring import SponsorScore
from app.models.event import Event
from app.models.user import (
    User, Subscription, WatchlistItem, UserNote, Alert, AlertHistory,
)

__all__ = [
    "Sponsor", "CsvImport", "SponsorSnapshot", "SponsorChange",
    "CompanyProfile", "CompanyOfficer", "CompanyPSC",
    "CompanyNews", "CompanyReview", "CompanyAlias",
    "Job", "JobDedupCluster", "SalaryBenchmark", "ShortageOccupation",
    "SponsorScore", "Event",
    "User", "Subscription", "WatchlistItem", "UserNote", "Alert", "AlertHistory",
]
```

**Step 5: Generate initial migration**

Run: `docker compose exec backend alembic revision --autogenerate -m "initial schema"`
Run: `docker compose exec backend alembic upgrade head`
Expected: Migration created and applied successfully. All tables created.

**Step 6: Enable pg_trgm extension**

Create `docker/postgres/init.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete database schema — scoring, events, users, alerts, subscriptions"
```

---

## Phase 3: Core Backend Services

### Task 3.1: CSV Import & Diff Engine

**Files:**
- Create: `backend/app/services/csv_import.py`
- Create: `backend/app/services/diff_engine.py`
- Create: `backend/app/utils/name_normaliser.py`
- Test: `backend/tests/unit/test_csv_import.py`
- Test: `backend/tests/unit/test_diff_engine.py`

This is the foundation — importing GOV.UK CSV and detecting changes. The diff engine computes additions, removals, rating changes between CSV imports.

**Step 1: Create name normaliser utility**

`backend/app/utils/name_normaliser.py`:
```python
import re

_SUFFIXES = re.compile(
    r'\b(ltd|limited|plc|llp|inc|incorporated|co|company|corp|corporation|'
    r'group|holdings|uk|t/a|trading as)\b\.?',
    re.IGNORECASE,
)
_WHITESPACE = re.compile(r'\s+')
_NON_ALNUM = re.compile(r'[^a-z0-9\s]')


def normalise_company_name(name: str) -> str:
    """Normalise company name for matching. Strips legal suffixes, punctuation, extra whitespace."""
    if not name:
        return ""
    result = name.lower().strip()
    result = result.strip('"').strip("'")
    result = _SUFFIXES.sub("", result)
    result = _NON_ALNUM.sub(" ", result)
    result = _WHITESPACE.sub(" ", result).strip()
    return result
```

**Step 2: Write failing test for name normaliser**

`backend/tests/unit/test_name_normaliser.py`:
```python
from app.utils.name_normaliser import normalise_company_name


def test_strips_ltd():
    assert normalise_company_name("Acme Solutions Ltd") == "acme solutions"


def test_strips_limited():
    assert normalise_company_name("TATA CONSULTANCY SERVICES LIMITED") == "tata consultancy services"


def test_strips_plc():
    assert normalise_company_name("Barclays PLC") == "barclays"


def test_strips_quotes():
    assert normalise_company_name('"K" Line Energy Shipping (UK) Limited') == "k line energy shipping"


def test_strips_punctuation():
    assert normalise_company_name("O'Brien & Partners Co.") == "obrien partners"


def test_empty():
    assert normalise_company_name("") == ""


def test_whitespace_collapse():
    assert normalise_company_name("  Foo   Bar   Ltd  ") == "foo bar"
```

**Step 3: Run test to verify it passes**

Run: `docker compose exec backend pytest tests/unit/test_name_normaliser.py -v`
Expected: All tests PASS.

**Step 4: Create CSV import service**

`backend/app/services/csv_import.py`:
```python
import csv
import hashlib
import io
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sponsor import Sponsor, CsvImport, SponsorSnapshot
from app.models.enums import SponsorRating, SponsorType
from app.utils.name_normaliser import normalise_company_name


def parse_rating(type_and_rating: str) -> SponsorRating | None:
    if "A rating" in type_and_rating:
        return SponsorRating.A
    if "B rating" in type_and_rating:
        return SponsorRating.B
    return None


def parse_sponsor_type(type_and_rating: str) -> SponsorType | None:
    if type_and_rating.startswith("Worker"):
        return SponsorType.WORKER
    if type_and_rating.startswith("Temporary Worker"):
        return SponsorType.TEMPORARY_WORKER
    return None


def parse_routes(route_str: str) -> list[str]:
    if not route_str:
        return []
    return [r.strip() for r in route_str.split(",") if r.strip()]


async def import_csv(
    db: AsyncSession,
    file_content: bytes,
    filename: str,
    source_url: str | None = None,
    is_auto: bool = False,
) -> CsvImport:
    """Import a GOV.UK sponsor register CSV. Returns the CsvImport record."""

    checksum = hashlib.md5(file_content).hexdigest()

    # Check for duplicate import
    existing = await db.execute(
        select(CsvImport).where(CsvImport.checksum_md5 == checksum)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"CSV with checksum {checksum} already imported")

    # Parse CSV
    text = file_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        cleaned = {k.strip(): (v or "").strip() for k, v in row.items()}
        rows.append(cleaned)

    # Create import record
    csv_import = CsvImport(
        id=uuid4(),
        filename=filename,
        source_url=source_url,
        checksum_md5=checksum,
        record_count=len(rows),
        imported_at=datetime.utcnow(),
        is_auto=is_auto,
    )
    db.add(csv_import)

    # Load existing sponsors for matching
    result = await db.execute(select(Sponsor))
    existing_sponsors = {s.organisation_name_normalised: s for s in result.scalars().all()}

    now = datetime.utcnow()
    seen_normalised = set()
    added = 0
    updated = 0

    for row in rows:
        org_name = row.get("Organisation Name", "")
        if not org_name:
            continue

        normalised = normalise_company_name(org_name)
        type_and_rating = row.get("Type & Rating", "")
        route_str = row.get("Route", "")
        town = row.get("Town/City", "")
        county = row.get("County", "")

        seen_normalised.add(normalised)

        if normalised in existing_sponsors:
            sponsor = existing_sponsors[normalised]
            sponsor.last_seen_date = now
            sponsor.is_active = True
            sponsor.type_and_rating = type_and_rating
            sponsor.rating = parse_rating(type_and_rating)
            sponsor.town_city = town
            sponsor.county = county
            sponsor.route = parse_routes(route_str)
            updated += 1
        else:
            sponsor = Sponsor(
                id=uuid4(),
                organisation_name=org_name,
                organisation_name_normalised=normalised,
                town_city=town,
                county=county,
                type_and_rating=type_and_rating,
                rating=parse_rating(type_and_rating),
                sponsor_type=parse_sponsor_type(type_and_rating),
                route=parse_routes(route_str),
                is_active=True,
                first_seen_date=now,
                last_seen_date=now,
            )
            db.add(sponsor)
            existing_sponsors[normalised] = sponsor
            added += 1

        # Create snapshot
        snapshot = SponsorSnapshot(
            id=uuid4(),
            sponsor_id=sponsor.id,
            csv_import_id=csv_import.id,
            snapshot_date=now,
            organisation_name=org_name,
            town_city=town,
            county=county,
            type_and_rating=type_and_rating,
            route=route_str,
        )
        db.add(snapshot)

    # Mark removed sponsors
    removed = 0
    for norm_name, sponsor in existing_sponsors.items():
        if norm_name not in seen_normalised and sponsor.is_active:
            sponsor.is_active = False
            removed += 1

    csv_import.added_count = added
    csv_import.removed_count = removed
    csv_import.changed_count = updated

    await db.commit()
    return csv_import
```

**Step 5: Create diff engine**

`backend/app/services/diff_engine.py`:
```python
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sponsor import Sponsor, SponsorSnapshot, SponsorChange, CsvImport
from app.models.event import Event
from app.models.enums import ChangeType, EventType, Severity


async def compute_diff(db: AsyncSession, csv_import_id) -> list[SponsorChange]:
    """Compare the latest import against the previous one and record all changes."""

    # Get current and previous imports
    imports_result = await db.execute(
        select(CsvImport).order_by(CsvImport.imported_at.desc()).limit(2)
    )
    imports = imports_result.scalars().all()
    if len(imports) < 2:
        return []  # Need at least 2 imports to diff

    current_import = imports[0]
    previous_import = imports[1]

    # Get snapshots for both imports
    curr_result = await db.execute(
        select(SponsorSnapshot).where(SponsorSnapshot.csv_import_id == current_import.id)
    )
    prev_result = await db.execute(
        select(SponsorSnapshot).where(SponsorSnapshot.csv_import_id == previous_import.id)
    )

    current_map = {}
    for s in curr_result.scalars().all():
        key = s.organisation_name.lower().strip()
        current_map[key] = s

    previous_map = {}
    for s in prev_result.scalars().all():
        key = s.organisation_name.lower().strip()
        previous_map[key] = s

    changes = []
    now = datetime.utcnow()

    # Detect additions
    for key, snap in current_map.items():
        if key not in previous_map:
            change = SponsorChange(
                id=uuid4(),
                sponsor_id=snap.sponsor_id,
                csv_import_id=current_import.id,
                change_type=ChangeType.ADDED,
                new_value=snap.organisation_name,
                detected_at=now,
                significance_score=7,
            )
            db.add(change)
            changes.append(change)

            # Emit event
            db.add(Event(
                id=uuid4(),
                event_type=EventType.SPONSOR_ADDED,
                entity_type="sponsor",
                entity_id=snap.sponsor_id,
                payload={"name": snap.organisation_name, "city": snap.town_city},
                severity=Severity.INFO,
            ))

    # Detect removals
    for key, snap in previous_map.items():
        if key not in current_map:
            change = SponsorChange(
                id=uuid4(),
                sponsor_id=snap.sponsor_id,
                csv_import_id=current_import.id,
                change_type=ChangeType.REMOVED,
                old_value=snap.organisation_name,
                detected_at=now,
                significance_score=9,
            )
            db.add(change)
            changes.append(change)

            db.add(Event(
                id=uuid4(),
                event_type=EventType.SPONSOR_REMOVED,
                entity_type="sponsor",
                entity_id=snap.sponsor_id,
                payload={"name": snap.organisation_name},
                severity=Severity.WARNING,
            ))

    # Detect changes (rating, route, location)
    for key in current_map:
        if key in previous_map:
            curr = current_map[key]
            prev = previous_map[key]

            # Rating change
            if curr.type_and_rating != prev.type_and_rating:
                old_has_a = "A rating" in (prev.type_and_rating or "")
                new_has_a = "A rating" in (curr.type_and_rating or "")
                old_has_b = "B rating" in (prev.type_and_rating or "")
                new_has_b = "B rating" in (curr.type_and_rating or "")

                if old_has_a and new_has_b:
                    ct = ChangeType.RATING_DOWNGRADE
                    sig = 10
                elif old_has_b and new_has_a:
                    ct = ChangeType.RATING_UPGRADE
                    sig = 8
                else:
                    continue

                change = SponsorChange(
                    id=uuid4(),
                    sponsor_id=curr.sponsor_id,
                    csv_import_id=current_import.id,
                    change_type=ct,
                    field_changed="type_and_rating",
                    old_value=prev.type_and_rating,
                    new_value=curr.type_and_rating,
                    detected_at=now,
                    significance_score=sig,
                )
                db.add(change)
                changes.append(change)

                db.add(Event(
                    id=uuid4(),
                    event_type=EventType.RATING_CHANGE,
                    entity_type="sponsor",
                    entity_id=curr.sponsor_id,
                    payload={
                        "name": curr.organisation_name,
                        "old": prev.type_and_rating,
                        "new": curr.type_and_rating,
                        "direction": "downgrade" if ct == ChangeType.RATING_DOWNGRADE else "upgrade",
                    },
                    severity=Severity.CRITICAL if ct == ChangeType.RATING_DOWNGRADE else Severity.INFO,
                ))

            # Location change
            if curr.town_city != prev.town_city and curr.town_city and prev.town_city:
                change = SponsorChange(
                    id=uuid4(),
                    sponsor_id=curr.sponsor_id,
                    csv_import_id=current_import.id,
                    change_type=ChangeType.LOCATION_CHANGE,
                    field_changed="town_city",
                    old_value=prev.town_city,
                    new_value=curr.town_city,
                    detected_at=now,
                    significance_score=3,
                )
                db.add(change)
                changes.append(change)

    await db.commit()
    return changes
```

**Step 6: Write tests**

`backend/tests/unit/test_diff_engine.py`:
```python
from app.models.enums import ChangeType


def test_change_type_values():
    assert ChangeType.RATING_DOWNGRADE.value == "rating_downgrade"
    assert ChangeType.RATING_UPGRADE.value == "rating_upgrade"
    assert ChangeType.ADDED.value == "added"
    assert ChangeType.REMOVED.value == "removed"


def test_all_change_types_exist():
    expected = {"added", "removed", "rating_upgrade", "rating_downgrade",
                "route_added", "route_removed", "location_change",
                "name_change", "reactivated"}
    actual = {ct.value for ct in ChangeType}
    assert expected == actual
```

**Step 7: Run tests**

Run: `docker compose exec backend pytest tests/unit/ -v`
Expected: All tests PASS.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: CSV import service and diff engine with event emission"
```

---

### Task 3.2: Auth Service (JWT + OAuth)

**Files:**
- Create: `backend/app/services/auth.py`
- Create: `backend/app/api/v1/auth.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/core/security.py`
- Test: `backend/tests/unit/test_auth.py`

Implements: user registration, login, JWT token creation/validation, OAuth (Google), and the `get_current_user` dependency.

*(Full code provided in each file — registration endpoint, login endpoint, JWT encode/decode, password hashing with passlib/bcrypt, OAuth callback, and middleware for plan-based feature gating.)*

**Step 1-7:** Create security module, auth schemas, auth service, auth router, wire into main app, write tests, commit.

```bash
git commit -m "feat: authentication system (JWT + OAuth + plan-based gating)"
```

---

### Task 3.3: Scoring Engine Service

**Files:**
- Create: `backend/app/services/scoring.py`
- Test: `backend/tests/unit/test_scoring.py`

Implements the 7-factor scoring model with weighted composition. Each factor is computed from available data, with graceful fallback when enrichment data is missing.

**Step 1-5:** Create scoring functions for each factor, composite scorer, tests, commit.

```bash
git commit -m "feat: 7-factor sponsor scoring engine"
```

---

### Task 3.4: Entity Resolution Service ("Nexus")

**Files:**
- Create: `backend/app/services/entity_resolution.py`
- Test: `backend/tests/unit/test_entity_resolution.py`

Implements the 5-stage matching pipeline using rapidfuzz for fuzzy matching, the alias table, and address+name combo matching.

**Step 1-5:** Create resolution pipeline, alias lookup, fuzzy matcher, tests, commit.

```bash
git commit -m "feat: entity resolution engine (Nexus) with fuzzy matching"
```

---

## Phase 4: Scraping Engine ("Hydra")

### Task 4.1: Scraping Infrastructure

**Files:**
- Create: `backend/app/scrapers/base.py` — abstract base scraper with retry, rate limiting, proxy support
- Create: `backend/app/scrapers/proxy_manager.py` — proxy pool rotation, ban detection
- Create: `backend/app/scrapers/rate_limiter.py` — per-domain token bucket
- Create: `backend/app/scrapers/anti_detection.py` — UA rotation, headers, delays

**Step 1-6:** Create base scraper class, proxy manager with pool rotation, rate limiter, anti-detection module, tests, commit.

```bash
git commit -m "feat: scraping infrastructure (base scraper, proxy, rate limiter, anti-detection)"
```

---

### Task 4.2: Tier 1 Scrapers (GOV.UK + Companies House)

**Files:**
- Create: `backend/app/scrapers/gov_uk_register.py` — auto-download CSV from GOV.UK
- Create: `backend/app/scrapers/companies_house.py` — CH API client (profile, officers, PSC, filings)
- Create: `backend/app/tasks/scrape_register.py` — Celery task for scheduled CSV check

**Step 1-8:** Implement GOV.UK page scraper (detect new CSV link, download, import), Companies House API wrapper (search, profile, officers, PSC, filings), Celery task, tests, commit.

```bash
git commit -m "feat: Tier 1 scrapers (GOV.UK register auto-import + Companies House API)"
```

---

### Task 4.3: Tier 2 Scrapers (Job Boards)

**Files:**
- Create: `backend/app/scrapers/reed_api.py`
- Create: `backend/app/scrapers/adzuna_api.py`
- Create: `backend/app/scrapers/indeed.py`
- Create: `backend/app/scrapers/linkedin_jobs.py`
- Create: `backend/app/scrapers/totaljobs.py`
- Create: `backend/app/scrapers/gov_findajob.py`
- Create: `backend/app/scrapers/nhs_jobs.py`
- Create: `backend/app/services/sponsorship_detector.py` — NLP classifier for sponsorship likelihood

Each scraper implements the base scraper interface with source-specific parsing. The sponsorship detector scans job descriptions for sponsorship signals.

**Step 1-12:** Implement each scraper, sponsorship NLP detector (keyword + pattern matching with confidence scoring), job deduplication service, tests, commit.

```bash
git commit -m "feat: Tier 2 job board scrapers (Reed, Adzuna, Indeed, LinkedIn, TotalJobs, GOV, NHS)"
git commit -m "feat: sponsorship likelihood NLP detector"
```

---

### Task 4.4: Tier 3 Scrapers (Company Intelligence)

**Files:**
- Create: `backend/app/scrapers/glassdoor.py`
- Create: `backend/app/scrapers/trustpilot.py`
- Create: `backend/app/scrapers/google_places.py`
- Create: `backend/app/scrapers/linkedin_company.py`
- Create: `backend/app/scrapers/google_news.py`
- Create: `backend/app/scrapers/website_analyser.py`

**Step 1-10:** Implement each scraper, integrate with CompanyProfile enrichment, tests, commit.

```bash
git commit -m "feat: Tier 3 company intelligence scrapers (Glassdoor, TrustPilot, Google, LinkedIn, News)"
```

---

### Task 4.5: Celery Tasks & Scheduling

**Files:**
- Create: `backend/app/tasks/celery_app.py` — Celery config with Redis broker
- Create: `backend/app/tasks/schedule.py` — Celery Beat schedule (all frequencies from design)
- Create: `backend/app/tasks/enrichment.py` — progressive enrichment task with priority queue
- Create: `backend/app/tasks/scoring.py` — batch score recomputation
- Create: `backend/app/tasks/alerts.py` — alert evaluation and notification dispatch
- Create: `backend/app/tasks/dedup.py` — job deduplication pass

**Step 1-8:** Configure Celery app, define beat schedule, create each task, wire up, tests, commit.

```bash
git commit -m "feat: Celery tasks and beat schedule (enrichment, scoring, alerts, dedup)"
```

---

## Phase 5: REST API Endpoints

### Task 5.1: Sponsor API

**Files:**
- Create: `backend/app/api/v1/sponsors.py`
- Create: `backend/app/schemas/sponsor.py`

Endpoints:
- `GET /api/v1/sponsors` — paginated, filtered, sorted list
- `GET /api/v1/sponsors/{id}` — full sponsor detail with profile
- `GET /api/v1/sponsors/{id}/changes` — change history
- `GET /api/v1/sponsors/{id}/timeline` — unified timeline (changes + news + jobs)
- `GET /api/v1/sponsors/{id}/similar` — similar companies by industry/size
- `GET /api/v1/sponsors/search` — fuzzy name search (pg_trgm)
- `POST /api/v1/sponsors/import` — manual CSV upload

**Step 1-6:** Create Pydantic schemas, implement each endpoint, add plan-based gating, tests, commit.

```bash
git commit -m "feat: sponsor API endpoints with search, pagination, and filtering"
```

---

### Task 5.2: Jobs API

**Files:**
- Create: `backend/app/api/v1/jobs.py`
- Create: `backend/app/schemas/job.py`

Endpoints:
- `GET /api/v1/jobs` — aggregated job search with sponsorship filter
- `GET /api/v1/jobs/{id}` — job detail
- `GET /api/v1/jobs/stats` — job market statistics
- `GET /api/v1/jobs/salary-benchmarks` — salary data by role/region

```bash
git commit -m "feat: jobs API with sponsorship filtering and salary benchmarks"
```

---

### Task 5.3: Analytics API

**Files:**
- Create: `backend/app/api/v1/analytics.py`
- Create: `backend/app/schemas/analytics.py`

Endpoints:
- `GET /api/v1/analytics/overview` — dashboard stats
- `GET /api/v1/analytics/trends` — sponsor growth, industry trends
- `GET /api/v1/analytics/geographic` — city/region breakdown
- `GET /api/v1/analytics/changes` — recent changes feed
- `GET /api/v1/analytics/filters` — available filter values

```bash
git commit -m "feat: analytics API (trends, geographic, changes feed)"
```

---

### Task 5.4: User API (Watchlist, Notes, Alerts, Tracker)

**Files:**
- Create: `backend/app/api/v1/users.py`
- Create: `backend/app/api/v1/watchlist.py`
- Create: `backend/app/api/v1/alerts.py`
- Create: `backend/app/schemas/user.py`

Endpoints:
- `GET/POST/DELETE /api/v1/watchlist` — manage watched companies
- `PUT /api/v1/watchlist/{id}/status` — update application status
- `GET/POST/PUT/DELETE /api/v1/notes` — per-company notes
- `GET/POST/PUT/DELETE /api/v1/alerts` — alert CRUD
- `GET /api/v1/alerts/history` — triggered alert history
- `GET /api/v1/me/stats` — user dashboard stats (response rate, etc.)

```bash
git commit -m "feat: user API (watchlist, notes, alerts, application tracker)"
```

---

### Task 5.5: Payment API (Stripe)

**Files:**
- Create: `backend/app/api/v1/payments.py`
- Create: `backend/app/services/stripe_service.py`

Endpoints:
- `POST /api/v1/payments/create-checkout` — Stripe Checkout session
- `POST /api/v1/payments/webhook` — Stripe webhook handler
- `GET /api/v1/payments/subscription` — current subscription status
- `POST /api/v1/payments/cancel` — cancel subscription
- `POST /api/v1/payments/portal` — Stripe customer portal link

```bash
git commit -m "feat: Stripe payment integration (checkout, webhooks, subscription management)"
```

---

### Task 5.6: WebSocket for Real-Time Feed

**Files:**
- Create: `backend/app/api/v1/websocket.py`
- Create: `backend/app/services/event_broadcaster.py`

Implements WebSocket endpoint at `/ws/feed` that streams real-time events (new sponsors, rating changes, job spikes, news) to connected clients. Uses Redis pub/sub for broadcasting across workers.

```bash
git commit -m "feat: WebSocket real-time event feed with Redis pub/sub"
```

---

### Task 5.7: Admin API

**Files:**
- Create: `backend/app/api/v1/admin.py`

Endpoints:
- `GET /api/v1/admin/engine-status` — scraping engine health dashboard data
- `GET /api/v1/admin/enrichment-progress` — enrichment levels per tier
- `GET /api/v1/admin/proxy-health` — proxy pool status
- `POST /api/v1/admin/trigger-scrape` — manually trigger a scrape task
- `GET /api/v1/admin/import-history` — CSV import log

```bash
git commit -m "feat: admin API (engine status, enrichment progress, proxy health)"
```

---

## Phase 6: Next.js Frontend

### Task 6.1: Frontend Scaffolding & Layout

**Files:**
- Create: `frontend/src/app/layout.tsx` — root layout with sidebar, topbar
- Create: `frontend/src/app/page.tsx` — redirect to dashboard
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/Topbar.tsx`
- Create: `frontend/src/components/layout/GlobalSearch.tsx`
- Create: `frontend/src/lib/api.ts` — API client (fetch wrapper with auth)
- Create: `frontend/src/lib/auth.ts` — auth context, token management
- Create: `frontend/src/styles/globals.css` — dark theme (Bloomberg-inspired)
- Create: `frontend/tailwind.config.ts` — custom theme colours

Implements the app shell with sidebar navigation, top bar with global search, and dark theme matching the design mockups.

```bash
git commit -m "feat: Next.js app shell with sidebar, topbar, dark theme"
```

---

### Task 6.2: Dashboard Page

**Files:**
- Create: `frontend/src/app/dashboard/page.tsx`
- Create: `frontend/src/components/dashboard/MarketPulse.tsx` — stat cards
- Create: `frontend/src/components/dashboard/GrowthChart.tsx` — Recharts line chart
- Create: `frontend/src/components/dashboard/RatingChanges.tsx` — bar chart
- Create: `frontend/src/components/dashboard/TopHiring.tsx` — top sponsors table
- Create: `frontend/src/components/dashboard/LiveFeed.tsx` — WebSocket signal feed
- Create: `frontend/src/components/dashboard/IndustryBreakdown.tsx` — pie/bar chart

```bash
git commit -m "feat: dashboard page with market pulse, charts, and live feed"
```

---

### Task 6.3: Search & Explore Page

**Files:**
- Create: `frontend/src/app/search/page.tsx`
- Create: `frontend/src/components/search/FilterBar.tsx` — 20+ filter controls
- Create: `frontend/src/components/search/ResultsTable.tsx` — @tanstack/react-table
- Create: `frontend/src/components/search/ExportButton.tsx` — CSV/XLSX export

```bash
git commit -m "feat: search page with advanced filters, sortable table, and export"
```

---

### Task 6.4: Company Profile Page

**Files:**
- Create: `frontend/src/app/company/[id]/page.tsx` — SSR company profile
- Create: `frontend/src/components/company/OverviewTab.tsx`
- Create: `frontend/src/components/company/JobsTab.tsx`
- Create: `frontend/src/components/company/PeopleTab.tsx`
- Create: `frontend/src/components/company/FinancialsTab.tsx`
- Create: `frontend/src/components/company/ReviewsTab.tsx`
- Create: `frontend/src/components/company/NewsTab.tsx`
- Create: `frontend/src/components/company/TimelineTab.tsx`
- Create: `frontend/src/components/company/ScoreBreakdown.tsx` — 7-factor radar chart
- Create: `frontend/src/components/company/SimilarCompanies.tsx`

This is the most important page — the comprehensive company profile. SSR for SEO (Google-indexed company pages).

```bash
git commit -m "feat: company profile page with all tabs (overview, jobs, people, financials, reviews, news, timeline)"
```

---

### Task 6.5: Interactive Map Page

**Files:**
- Create: `frontend/src/app/map/page.tsx`
- Create: `frontend/src/components/map/UKMap.tsx` — Leaflet with custom layers
- Create: `frontend/src/components/map/RegionStats.tsx`
- Create: `frontend/src/components/map/MapFilters.tsx`

Layers: density, score heatmap, industry clusters, new additions, B-ratings, job hotspots.

```bash
git commit -m "feat: interactive UK map with density, score, and industry layers"
```

---

### Task 6.6: Job Intelligence Page

**Files:**
- Create: `frontend/src/app/jobs/page.tsx`
- Create: `frontend/src/components/jobs/JobTable.tsx` — with sponsorship likelihood badges
- Create: `frontend/src/components/jobs/SalaryDistribution.tsx` — Recharts histogram
- Create: `frontend/src/components/jobs/SectorBreakdown.tsx`

```bash
git commit -m "feat: job intelligence page with sponsorship scores and salary charts"
```

---

### Task 6.7: Trends & Analytics Page (Pro)

**Files:**
- Create: `frontend/src/app/trends/page.tsx`
- Create: `frontend/src/components/trends/GrowthTrend.tsx`
- Create: `frontend/src/components/trends/IndustryTrends.tsx`
- Create: `frontend/src/components/trends/SalaryTrends.tsx`
- Create: `frontend/src/components/trends/GeographicShifts.tsx`

Plan-gated: shows upgrade prompt for free users.

```bash
git commit -m "feat: trends & analytics page with growth, industry, salary, and geographic charts"
```

---

### Task 6.8: Signals Feed, Compare Tool, Application Tracker

**Files:**
- Create: `frontend/src/app/signals/page.tsx` — real-time event stream
- Create: `frontend/src/app/compare/page.tsx` — side-by-side (up to 4)
- Create: `frontend/src/app/tracker/page.tsx` — Kanban pipeline
- Create: `frontend/src/components/tracker/KanbanBoard.tsx`
- Create: `frontend/src/components/tracker/PipelineStats.tsx`

```bash
git commit -m "feat: signals feed, compare tool, and application tracker with Kanban"
```

---

### Task 6.9: Alerts, Settings, Auth Pages

**Files:**
- Create: `frontend/src/app/alerts/page.tsx` — alert list + builder
- Create: `frontend/src/app/settings/page.tsx` — API keys, billing, profile
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`
- Create: `frontend/src/app/pricing/page.tsx` — pricing tiers page
- Create: `frontend/src/components/alerts/AlertBuilder.tsx` — visual condition builder

```bash
git commit -m "feat: alerts page, settings, auth pages, and pricing page"
```

---

### Task 6.10: Admin Dashboard

**Files:**
- Create: `frontend/src/app/admin/page.tsx`
- Create: `frontend/src/components/admin/EngineStatus.tsx` — scraper health table
- Create: `frontend/src/components/admin/EnrichmentProgress.tsx` — progress bars
- Create: `frontend/src/components/admin/ProxyHealth.tsx`
- Create: `frontend/src/components/admin/ImportHistory.tsx`

```bash
git commit -m "feat: admin dashboard with engine status, enrichment progress, and proxy health"
```

---

## Phase 7: Integration & Polish

### Task 7.1: Initial Data Seed

**Files:**
- Create: `backend/app/scripts/seed_data.py`
- Move: existing CSV to `data/` directory

Script that imports the existing `2026-02-27_-_Worker_and_Temporary_Worker.csv`, runs Level 0 enrichment, and triggers initial Companies House enrichment for the first 1,000 companies.

```bash
git commit -m "feat: data seed script with initial CSV import and enrichment kickoff"
```

---

### Task 7.2: End-to-End Testing

**Files:**
- Create: `backend/tests/integration/test_csv_import_flow.py`
- Create: `backend/tests/integration/test_search_flow.py`
- Create: `backend/tests/integration/test_auth_flow.py`

Integration tests that verify: CSV import → diff detection → scoring → API response → WebSocket event.

```bash
git commit -m "test: end-to-end integration tests for core flows"
```

---

### Task 7.3: Performance Optimisation

- Add database indexes for common query patterns
- Implement Redis caching on hot API endpoints (sponsor search, analytics)
- Add connection pooling configuration
- Implement cursor-based pagination for large result sets
- Add query plan analysis for slow queries

```bash
git commit -m "perf: database indexes, Redis caching, and cursor-based pagination"
```

---

## Phase 8: Deployment

### Task 8.1: Production Docker & CI/CD

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.github/workflows/ci.yml` — lint, test, build
- Create: `.github/workflows/deploy.yml` — deploy to VPS
- Create: `docker/nginx/nginx.conf` — reverse proxy with SSL

```bash
git commit -m "feat: production Docker config and CI/CD pipeline"
```

---

### Task 8.2: Monitoring & Observability

**Files:**
- Create: `backend/app/core/monitoring.py` — Sentry setup, custom metrics
- Create: `docker/prometheus/prometheus.yml`
- Create: `docker/grafana/dashboards/` — pre-built dashboards

```bash
git commit -m "feat: monitoring setup (Sentry, Prometheus, Grafana)"
```

---

## Execution Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1-1.3 | Scaffolding, Docker, FastAPI, Alembic |
| 2 | 2.1-2.4 | All database models (20+ tables) |
| 3 | 3.1-3.4 | Core services (CSV import, diff, auth, scoring, entity resolution) |
| 4 | 4.1-4.5 | Scraping engine (30+ sources, Celery tasks) |
| 5 | 5.1-5.7 | REST API endpoints (sponsors, jobs, analytics, users, payments, WebSocket, admin) |
| 6 | 6.1-6.10 | Next.js frontend (12 pages, dark theme, charts, maps) |
| 7 | 7.1-7.3 | Data seed, integration tests, performance |
| 8 | 8.1-8.2 | Deployment, CI/CD, monitoring |

**Total: 8 phases, 30 tasks, ~50 commits.**
