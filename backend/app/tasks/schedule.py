"""
Celery Beat schedule for SponsorIntel.

Defines periodic tasks for scraping, enrichment, scoring, and alerting.
Scrapers are staggered across minutes to avoid thundering-herd on Redis/DB.
"""

from celery.schedules import crontab

from app.tasks.celery_app import celery_app

celery_app.conf.beat_schedule = {
    # ===================================================================
    # Tier 0: GOV.UK Sponsor Register — daily sync at 7 AM UTC
    # Downloads latest CSV, diffs against DB, detects new/removed/changed sponsors.
    # The Home Office publishes updates once daily, so daily sync is sufficient.
    # ===================================================================
    "sync-gov-register": {
        "task": "data.sync_sponsor_register",
        "schedule": crontab(hour="7", minute="0"),
    },
    "monitor-hansard": {
        "task": "data.monitor_hansard",
        "schedule": crontab(hour="7", minute="30"),
    },

    # ===================================================================
    # Tier 1: Zero-auth free API scrapers (every 2 hours, staggered)
    # These are the most reliable — no API keys, no browser needed.
    # ===================================================================
    "scrape-jobs-remotive": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="2"),
        "args": ["remotive"],
    },
    "scrape-jobs-arbeitnow": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="5"),
        "args": ["arbeitnow"],
    },
    "scrape-jobs-jobicy": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="8"),
        "args": ["jobicy"],
    },
    "scrape-jobs-themuse": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="11"),
        "args": ["themuse"],
    },
    "scrape-jobs-himalayas": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="14"),
        "args": ["himalayas"],
    },
    "scrape-jobs-remoteok": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="17"),
        "args": ["remoteok"],
    },
    "scrape-jobs-wwr": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="20"),
        "args": ["wwr"],
    },
    "scrape-jobs-teaching-vacancies": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="23"),
        "args": ["teaching_vacancies"],
    },
    "scrape-jobs-devitjobs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="26"),
        "args": ["devitjobs"],
    },
    "scrape-jobs-hn-hiring": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/6", minute="29"),  # Monthly thread, less frequent
        "args": ["hn_hiring"],
    },
    "scrape-jobs-charityjob": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="32"),
        "args": ["charityjob"],
    },

    # ===================================================================
    # Tier 1b: NEW free sources (RSS feeds + public APIs)
    # ===================================================================
    "scrape-jobs-jobsacuk": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="35"),
        "args": ["jobs_ac_uk"],
    },
    "scrape-jobs-workinstartups": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="38"),
        "args": ["workinstartups"],
    },
    "scrape-jobs-nofluffjobs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/2", minute="41"),
        "args": ["nofluffjobs"],
    },
    "scrape-jobs-escapecity": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="44"),
        "args": ["escapecity"],
    },
    "scrape-jobs-cvlibrary": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="47"),
        "args": ["cvlibrary"],
    },
    "scrape-jobs-efinancial": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/6", minute="50"),
        "args": ["efinancial"],
    },
    "scrape-jobs-bmj": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/6", minute="53"),
        "args": ["bmj_careers"],
    },
    "scrape-jobs-civilservice": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/6", minute="56"),
        "args": ["civilservice"],
    },

    # ===================================================================
    # Tier 2: API-key scrapers (every 4 hours)
    # These need free API keys set in .env to function.
    # ===================================================================
    "scrape-jobs-reed": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="30"),
        "args": ["reed"],
    },
    "scrape-jobs-adzuna": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="33"),
        "args": ["adzuna"],
    },
    "scrape-jobs-jooble": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/4", minute="36"),
        "args": ["jooble"],
    },

    # ===================================================================
    # Tier 3: Browser-based scrapers (every 8 hours)
    # Heavier, use Playwright/proxies. Lower frequency.
    # ===================================================================
    "scrape-jobs-indeed": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="40"),
        "args": ["indeed"],
    },
    "scrape-jobs-linkedin": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="43"),
        "args": ["linkedin"],
    },
    "scrape-jobs-totaljobs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="46"),
        "args": ["totaljobs"],
    },
    "scrape-jobs-cwjobs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="49"),
        "args": ["cwjobs"],
    },
    "scrape-jobs-glassdoor": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/8", minute="52"),
        "args": ["glassdoor"],
    },
    "scrape-jobs-findajob": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/12", minute="35"),
        "args": ["findajob"],
    },
    "scrape-jobs-nhs": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/12", minute="38"),
        "args": ["nhs"],
    },
    "scrape-jobs-guardian": {
        "task": "tasks.scrape_jobs",
        "schedule": crontab(hour="*/12", minute="41"),
        "args": ["guardian"],
    },

    # ===================================================================
    # Tier 4: Intelligence pipeline (enrichment, scoring, alerts)
    # ===================================================================
    "enrich-companies": {
        "task": "tasks.enrich_companies",
        "schedule": crontab(minute="*/30"),
    },
    "recompute-scores": {
        "task": "tasks.recompute_scores",
        "schedule": crontab(hour="*/6", minute="5"),
    },
    "evaluate-alerts": {
        "task": "tasks.evaluate_alerts",
        "schedule": crontab(minute="0"),
    },
    "deduplicate-jobs": {
        "task": "tasks.deduplicate_jobs",
        "schedule": crontab(hour="*/4", minute="55"),
    },
    "match-jobs-to-sponsors": {
        "task": "tasks.match_jobs_to_sponsors",
        "schedule": crontab(hour="*/2", minute="10"),
    },
    "scrape-news": {
        "task": "tasks.scrape_news",
        "schedule": crontab(hour="*/12", minute="15"),
    },
    "scrape-reviews": {
        "task": "tasks.scrape_reviews",
        "schedule": crontab(day_of_week="0", hour="3", minute="0"),
    },

    # ===================================================================
    # Tier 5: Career Page Swarm (scan sponsor websites for jobs)
    # Aggressive scanning: every hour for top sponsors, full daily sweep.
    # ===================================================================
    "scan-career-pages-frequent": {
        "task": "tasks.scan_career_pages",
        "schedule": crontab(minute="45"),  # every hour
        "kwargs": {"batch_size": 500},
    },
    "scan-career-pages-daily-sweep": {
        "task": "tasks.scan_career_pages",
        "schedule": crontab(hour="4", minute="0"),
        "kwargs": {"batch_size": 2000},
    },

    # ===================================================================
    # Tier 6: Bulk scrape all free sources (twice daily: 6 AM and 6 PM)
    # ===================================================================
    "scrape-all-free-sources-am": {
        "task": "tasks.scrape_all_free",
        "schedule": crontab(hour="6", minute="0"),
    },
    "scrape-all-free-sources-pm": {
        "task": "tasks.scrape_all_free",
        "schedule": crontab(hour="18", minute="0"),
    },

    # ===================================================================
    # Tier 7: Agent Swarm Pipeline — aggressive scheduling
    # The agents are the brain: hunter finds, validator cleans,
    # enrichment scores, freshness prunes. Run them hard.
    # ===================================================================
    "agent-hunter-free-apis": {
        "task": "agent.run_hunter",
        "schedule": crontab(minute="0"),  # every hour (was every 2h)
        "args": [["free_apis"]],
    },
    "agent-hunter-api-key": {
        "task": "agent.run_hunter",
        "schedule": crontab(hour="*/2", minute="15"),  # every 2h (was 4h)
        "args": [["api_key"]],
    },
    "agent-validator": {
        "task": "agent.run_validator",
        "schedule": crontab(minute="*/15"),  # every 15 min (was 30)
    },
    "agent-enrichment": {
        "task": "agent.run_enrichment",
        "schedule": crontab(minute="*/15"),  # every 15 min (was 30)
    },
    "agent-freshness": {
        "task": "agent.run_freshness",
        "schedule": crontab(hour="*/4", minute="20"),  # every 4h (was 6h)
    },

    # ===================================================================
    # Tier 8: Intelligence Agents — company profiling & monitoring
    # ===================================================================
    "agent-discovery": {
        "task": "agent.run_discovery",
        "schedule": crontab(hour="*/2", minute="35"),  # every 2h — find company links
    },
    "agent-ch-watcher": {
        "task": "agent.run_ch_watcher",
        "schedule": crontab(hour="*/3", minute="50"),  # every 3h — monitor CH changes
    },

    # ===================================================================
    # Tier 9: Quality & Operations Agents
    # Sophie Laurent (quality audit) + Raj Patel (orchestrator/self-healing)
    # ===================================================================
    "agent-quality": {
        "task": "agent.run_quality",
        "schedule": crontab(hour="*/2", minute="10"),  # every 2h — audit data completeness
    },
    "agent-orchestrator": {
        "task": "agent.run_orchestrator",
        "schedule": crontab(minute="*/30"),  # every 30 min — metrics, anomalies, circuit breaker probe
    },

    # ===================================================================
    # Tier 10: Company Data Gathering — scan sponsor career pages for jobs
    # Runs daily at 2 AM to crawl all sponsor websites.
    # ===================================================================
    "gather-sponsor-jobs-daily": {
        "task": "agent.gather_sponsor_jobs",
        "schedule": crontab(hour="2", minute="0"),
        "kwargs": {"batch_size": 200, "offset": 0},
    },

    # ===================================================================
    # Tier 11: Improvement & R&D — Dr. Alex Thornton's team
    # Runs daily at 5 AM. Analyses keywords, sources, and scoring.
    # ===================================================================
    "agent-improvement": {
        "task": "agent.run_improvement",
        "schedule": crontab(hour="5", minute="0"),  # daily at 5 AM
    },

    # ===================================================================
    # Tier 12: Company Reconnaissance — continuous website/LinkedIn discovery
    # Runs every hour. Picks up unprocessed companies in batches.
    # Uses headless browser to find real websites, LinkedIn, careers pages.
    # ===================================================================
    "scout-company-recon-hourly": {
        "task": "agent.run_company_recon",
        "schedule": crontab(minute="10"),  # every hour at :10
        "kwargs": {"batch_size": 500},
    },
    "scout-re-verify-websites-weekly": {
        "task": "agent.run_company_recon",
        "schedule": crontab(day_of_week="6", hour="1", minute="0"),  # Saturday 1 AM
        "kwargs": {"batch_size": 5000, "re_verify": True},
    },

    # ===================================================================
    # Tier 13: Real-Time Job Monitoring — check enriched company careers pages
    # Visits career pages of companies WITH found websites and scrapes jobs.
    # Runs 4x daily for top sponsors, full sweep weekly.
    # ===================================================================
    "monitor-careers-pages-frequent": {
        "task": "agent.monitor_career_pages",
        "schedule": crontab(hour="*/6", minute="25"),  # 4x daily
        "kwargs": {"batch_size": 1000, "priority": "high"},
    },
    "monitor-careers-pages-full-sweep": {
        "task": "agent.monitor_career_pages",
        "schedule": crontab(day_of_week="0", hour="2", minute="0"),  # Sunday 2 AM
        "kwargs": {"batch_size": 10000, "priority": "all"},
    },

    # ===================================================================
    # Tier 14: Entity Resolution — continuous matching of new jobs to sponsors
    # Runs every 2 hours to match newly scraped jobs to sponsor register.
    # ===================================================================
    "entity-resolution-continuous": {
        "task": "agent.run_entity_resolution",
        "schedule": crontab(hour="*/2", minute="40"),  # every 2h
    },

    # ===================================================================
    # Tier 15: Sponsorship Scoring — continuous scoring of new/unscored jobs
    # Runs every 2 hours to score newly ingested jobs.
    # ===================================================================
    "sponsorship-scoring-continuous": {
        "task": "agent.run_sponsorship_scoring",
        "schedule": crontab(hour="*/2", minute="45"),  # every 2h
    },

    # ===================================================================
    # Tier 16: Intel — Immigration Intelligence Hub
    # Real-time scanning of government, news, legal, and social sources.
    # ===================================================================
    "intel-scan-gov": {
        "task": "intel.scan_gov",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-scan-news": {
        "task": "intel.scan_news",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-scan-legal": {
        "task": "intel.scan_legal",
        "schedule": crontab(minute="*/30"),  # every 30 min
    },
    "intel-scan-social": {
        "task": "intel.scan_social",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-classify": {
        "task": "intel.classify",
        "schedule": crontab(minute="*/5"),  # every 5 min
    },
    "intel-analyze": {
        "task": "intel.analyze",
        "schedule": crontab(minute="*/5"),  # every 5 min
    },
    "intel-dedup": {
        "task": "intel.dedup",
        "schedule": crontab(minute="*/15"),  # every 15 min
    },
    "intel-scan-lawyers": {
        "task": "intel.scan_lawyers",
        "schedule": crontab(day_of_week="0", hour="3", minute="0"),  # Sunday 3 AM
    },
    "intel-notify": {
        "task": "intel.notify",
        "schedule": crontab(minute="*/5"),  # every 5 min
    },
    "intel-weekly-digest": {
        "task": "intel.weekly_digest",
        "schedule": crontab(day_of_week="1", hour="6", minute="0"),  # Monday 6 AM
    },
    "intel-cleanup-old-content": {
        "task": "intel.cleanup_old_content",
        "schedule": crontab(day_of_week="0", hour="4", minute="0"),  # Sunday 4 AM
    },
}
