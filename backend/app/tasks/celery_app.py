"""
Celery application configuration for SponsorIntel.

Configures the Celery worker with Redis as broker and backend,
JSON serialization, and late acknowledgement for reliability.
"""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "sponsorintel",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    worker_max_tasks_per_child=200,
    result_expires=86400,  # 24 hours
    task_soft_time_limit=1800,  # 30 min soft limit
    task_time_limit=3600,  # 1 hour hard limit
)
