"""
Celery Beat schedule for SponsorIntel.

Defines periodic tasks for scraping, enrichment, scoring, and alerting.
"""

from celery.schedules import crontab

from app.tasks.celery_app import celery_app

celery_app.conf.beat_schedule = {
    # --- Tier 1: Register scraping (every 6 hours) ---
    "scrape-gov-register": {
        "task": "tasks.scrape_register",
        "schedule": crontab(hour="*/6", minute="0"),
    },
    # --- Tier 2: Job board scraping ---
    "scrape-jobs-reed": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="10"),
        "args": ["reed"],
    },
    "scrape-jobs-indeed": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/6", minute="20"),
        "args": ["indeed"],
    },
    "scrape-jobs-linkedin": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="30"),
        "args": ["linkedin"],
    },
    "scrape-jobs-totaljobs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="15"),
        "args": ["totaljobs"],
    },
    "scrape-jobs-cwjobs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="25"),
        "args": ["cwjobs"],
    },
    "scrape-jobs-findajob": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/12", minute="35"),
        "args": ["findajob"],
    },
    "scrape-jobs-nhs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/12", minute="40"),
        "args": ["nhs"],
    },
    "scrape-jobs-glassdoor": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="45"),
        "args": ["glassdoor"],
    },
    "scrape-jobs-guardian": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/12", minute="50"),
        "args": ["guardian"],
    },
    # --- Company enrichment (every 30 minutes) ---
    "enrich-companies": {
        "task": "tasks.enrich_companies",
        "schedule": crontab(minute="*/30"),
    },
    # --- Score recomputation (every 6 hours) ---
    "recompute-scores": {
        "task": "tasks.recompute_scores",
        "schedule": crontab(hour="*/6", minute="5"),
    },
    # --- Alert evaluation (every hour) ---
    "evaluate-alerts": {
        "task": "tasks.evaluate_alerts",
        "schedule": crontab(minute="0"),
    },
    # --- Job deduplication (every 4 hours) ---
    "deduplicate-jobs": {
        "task": "tasks.deduplicate_jobs",
        "schedule": crontab(hour="*/4", minute="55"),
    },
    # --- News scraping (every 12 hours) ---
    "scrape-news": {
        "task": "tasks.scrape_news",
        "schedule": crontab(hour="*/12", minute="15"),
    },
    # --- Review scraping (weekly, Sunday) ---
    "scrape-reviews": {
        "task": "tasks.scrape_reviews",
        "schedule": crontab(day_of_week="0", hour="3", minute="0"),
    },
}
