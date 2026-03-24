"""
Celery application configuration for SponsorIntel.

Configures the Celery worker with Redis as broker and backend,
JSON serialization, and late acknowledgement for reliability.
"""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

def _redis_url(db: int = 0) -> str:
    """Build Redis URL for a specific db number."""
    from urllib.parse import urlparse, urlunparse
    url = settings.redis_url or "redis://localhost:6379/0"
    parsed = urlparse(url)
    # Replace path with db number
    return urlunparse(parsed._replace(path=f"/{db}"))


celery_app = Celery(
    "sponsorintel",
    broker=_redis_url(0),
    backend=_redis_url(1),
    include=[
        "app.tasks.scraping",
        "app.tasks.agent_tasks",
        "app.tasks.schedule",
        "app.tasks.intel_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/London",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    worker_max_tasks_per_child=200,
    result_expires=86400,  # 24 hours
    task_soft_time_limit=1800,  # 30 min soft limit
    task_time_limit=3600,  # 1 hour hard limit
    task_routes={
        "tasks.*": {"queue": "default"},
        "agent.*": {"queue": "agents"},
    },
)


# ---------------------------------------------------------------------------
# Worker startup validation
# ---------------------------------------------------------------------------

from celery.signals import worker_ready


@worker_ready.connect
def on_worker_ready(**kwargs):
    """Validate all critical services when the worker boots."""
    from app.agents.startup import validate_worker_startup
    validate_worker_startup()
