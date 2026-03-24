from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import engine
from app.api.v1.auth import router as auth_router
from app.api.v1.sponsors import router as sponsors_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.watchlist import router as watchlist_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.notes import router as notes_router
from app.api.v1.websocket import router as ws_router
from app.api.v1.admin import router as admin_router
from app.api.v1.profile import router as profile_router
from app.api.v1.score_breakdown import router as score_breakdown_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.saved_searches import router as saved_searches_router
from app.api.v1.community import router as community_router
from app.api.v1.gamification import router as gamification_router
from app.api.v1.intel import router as intel_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    print(f"Starting {settings.app_name} in {settings.env} mode")
    yield
    await engine.dispose()
    print(f"Shutting down {settings.app_name}")


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="UK Sponsor Licence Intelligence Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix="/api/v1")
app.include_router(sponsors_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(watchlist_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(notes_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(score_breakdown_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(saved_searches_router, prefix="/api/v1")
app.include_router(community_router, prefix="/api/v1")
app.include_router(gamification_router, prefix="/api/v1")
app.include_router(intel_router, prefix="/api/v1")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "sponsorintel"}


@app.get("/api/trigger-pipeline")
async def trigger_pipeline(agent: str = "hunter"):
    """Quick trigger for agent pipeline (temporary, no auth)."""
    import uuid
    import base64
    import json
    import redis as redis_lib

    task_map = {
        "hunter": ("agent.run_hunter", [["free_apis"]]),
        "hunter-all": ("agent.run_hunter", [None]),
        "validator": ("agent.run_validator", []),
        "enrichment": ("agent.run_enrichment", []),
        "freshness": ("agent.run_freshness", []),
        "discovery": ("agent.run_discovery", []),
        "ch-watcher": ("agent.run_ch_watcher", []),
    }
    if agent not in task_map:
        return {"error": f"Unknown agent. Valid: {list(task_map.keys())}"}

    task_name, args = task_map[agent]
    task_id = str(uuid.uuid4())

    # Celery protocol v2 message format
    body_raw = json.dumps([args, {}, {"callbacks": None, "errbacks": None, "chain": None}])
    body_b64 = base64.b64encode(body_raw.encode()).decode()

    message = json.dumps({
        "body": body_b64,
        "content-encoding": "utf-8",
        "content-type": "application/json",
        "headers": {
            "lang": "py",
            "task": task_name,
            "id": task_id,
            "root_id": task_id,
            "parent_id": None,
            "group": None,
            "retries": 0,
        },
        "properties": {
            "correlation_id": task_id,
            "reply_to": "",
            "delivery_mode": 2,
            "delivery_tag": task_id,
            "delivery_info": {"exchange": "", "routing_key": "celery"},
            "body_encoding": "base64",
        },
    })

    r = redis_lib.from_url(settings.redis_url)
    r.lpush("celery", message)
    r.close()

    return {"task_id": task_id, "agent": agent, "status": "queued"}


@app.get("/api/swarm-status")
async def swarm_status():
    """Public endpoint: agent swarm health and metrics for the dashboard."""
    from supabase import create_client
    from datetime import datetime, timezone, timedelta

    supabase = create_client(settings.supabase_url, settings.supabase_service_key)

    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(hours=24)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    # Parallel queries for dashboard data
    jobs_total = supabase.table("jobs").select("id", count="exact", head=True).execute()
    jobs_today = supabase.table("jobs").select("id", count="exact", head=True).gte("scraped_at", day_ago).execute()
    jobs_enriched = supabase.table("jobs").select("id", count="exact", head=True).not_.is_("sponsorship_likelihood", "null").execute()
    sponsors_total = supabase.table("sponsors").select("id", count="exact", head=True).eq("is_active", True).execute()
    profiles_enriched = supabase.table("company_profiles").select("id", count="exact", head=True).not_.is_("enriched_at", "null").execute()
    profiles_with_website = supabase.table("company_profiles").select("id", count="exact", head=True).not_.is_("website_url", "null").execute()

    # Latest swarm metrics
    latest_metrics = supabase.table("swarm_metrics").select("*").order("completed_at", desc=True).limit(1).execute()

    # Source breakdown (jobs scraped in last 24h)
    recent_jobs = supabase.table("jobs").select("source").gte("scraped_at", day_ago).limit(5000).execute()
    by_source = {}
    for j in (recent_jobs.data or []):
        src = j.get("source", "unknown")
        by_source[src] = by_source.get(src, 0) + 1

    # Top sponsoring companies (most jobs with high likelihood)
    top_sponsors = supabase.table("jobs").select(
        "company_name_raw, sponsor_id, sponsorship_likelihood"
    ).gte("sponsorship_likelihood", 60).not_.is_(
        "sponsor_id", "null"
    ).limit(2000).execute()

    company_counts = {}
    for j in (top_sponsors.data or []):
        name = j.get("company_name_raw", "Unknown")
        company_counts[name] = company_counts.get(name, 0) + 1
    top_companies = sorted(company_counts.items(), key=lambda x: -x[1])[:15]

    # Recent high-sponsorship jobs
    recent_spons = supabase.table("jobs").select(
        "id,title_raw,company_name_raw,source_url,sponsorship_likelihood,source,posted_date,location_city"
    ).gte("sponsorship_likelihood", 60).order(
        "scraped_at", desc=True
    ).limit(10).execute()

    agents = [
        {
            "name": "Aria Singh",
            "title": "Head of Job Sourcing",
            "department": "Acquisition",
            "mission": "Leads a team of 5 that sweeps 23+ UK job boards and APIs every hour to discover every visa-sponsorship opportunity before anyone else.",
            "sources": 23,
            "team_size": 5,
            "schedule": "Every hour",
            "status": "active",
        },
        {
            "name": "Marcus Chen",
            "title": "Head of Data Quality",
            "department": "Quality Assurance",
            "mission": "Runs an 8-person QA team that cleans, validates, and deduplicates every record entering the platform. Zero tolerance for spam or bad data.",
            "team_size": 8,
            "schedule": "Every 15 min",
            "status": "active",
        },
        {
            "name": "Priya Kapoor",
            "title": "Lead Sponsorship Analyst",
            "department": "Intelligence",
            "mission": "Manages a 12-analyst team that scores every job (0-100%) for sponsorship likelihood using the UK Sponsor Register, shortage list, salary thresholds, and 40+ keyword signals.",
            "team_size": 12,
            "schedule": "Every 15 min",
            "status": "active",
        },
        {
            "name": "James Okafor",
            "title": "Listings Lifecycle Manager",
            "department": "Operations",
            "mission": "Keeps the job board fresh — checks if listings are still live, catches reposts, removes stale jobs older than 60 days, and tracks market velocity by city and industry.",
            "team_size": 4,
            "schedule": "Every 4 hours",
            "status": "active",
        },
        {
            "name": "Elena Volkov",
            "title": "Company Research Director",
            "department": "Research",
            "mission": "Leads digital research on 124,000+ UK sponsor licence holders — finding their websites, LinkedIn pages, career portals, ATS platforms, and contact details.",
            "team_size": 4,
            "schedule": "Every 2 hours",
            "status": "active",
        },
        {
            "name": "Daniel Mensah",
            "title": "Corporate Intelligence Officer",
            "department": "Compliance",
            "mission": "Monitors Companies House for every sponsor — new filings, status changes, officer moves, financial health signals, and early warning signs of licence risk.",
            "team_size": 4,
            "schedule": "Every 3 hours",
            "status": "active",
        },
        {
            "name": "Sophie Laurent",
            "title": "Data Completeness Auditor",
            "department": "Quality Assurance",
            "mission": "Audits every record for completeness, identifies missing fields, tracks source reliability, and scores sponsor hiring activity levels.",
            "team_size": 4,
            "schedule": "Every 30 min",
            "status": "active",
        },
        {
            "name": "Raj Patel",
            "title": "Chief Operations Coordinator",
            "department": "Operations",
            "mission": "The person who keeps everything running. Collects performance metrics from all teams, spots anomalies, and raises the alarm when something breaks.",
            "team_size": 3,
            "schedule": "Every 30 min",
            "status": "active",
        },
        {
            "name": "Dr. Alex Thornton",
            "title": "Head of Platform Intelligence",
            "department": "Improvement & R&D",
            "mission": "Leads a 3-person R&D team that continuously optimizes keyword strategy, discovers new data sources, and calibrates scoring accuracy.",
            "team_size": 3,
            "schedule": "Daily at 5 AM",
            "status": "active",
        },
    ]

    return {
        "agents": agents,
        "metrics": {
            "total_jobs": jobs_total.count or 0,
            "jobs_scraped_24h": jobs_today.count or 0,
            "jobs_enriched": jobs_enriched.count or 0,
            "total_sponsors": sponsors_total.count or 0,
            "profiles_enriched": profiles_enriched.count or 0,
            "profiles_with_website": profiles_with_website.count or 0,
            "sources_active_24h": len(by_source),
        },
        "jobs_by_source_24h": by_source,
        "top_sponsoring_companies": [{"name": n, "jobs": c} for n, c in top_companies],
        "recent_sponsorship_jobs": recent_spons.data or [],
        "latest_swarm_run": (latest_metrics.data[0] if latest_metrics.data else None),
    }
