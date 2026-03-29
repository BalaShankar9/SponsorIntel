"""Celery tasks for the agent swarm pipeline."""

import logging
import asyncio
from datetime import datetime, timezone
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_supabase():
    """Get Supabase client for writing jobs."""
    from supabase import create_client
    from app.core.config import get_settings
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def _load_sponsor_cache(supabase) -> dict:
    """Load normalised sponsor names → IDs for entity resolution."""
    from app.agents.hunter.entity_resolver import normalise_company_name
    cache = {}
    page = 0
    while True:
        result = supabase.table("sponsors").select(
            "id, organisation_name"
        ).range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not result.data:
            break
        for s in result.data:
            n = normalise_company_name(s["organisation_name"])
            if n:
                cache[n] = s["id"]
        if len(result.data) < 1000:
            break
        page += 1
    logger.info(f"Loaded {len(cache)} sponsors into cache")
    return cache


async def _run_hunter_pipeline(sources: list[str] | None = None):
    """Run the full hunter → entity resolution → ingest pipeline."""
    from app.agents.hunter.agent import HunterAgent
    from app.agents.hunter.entity_resolver import EntityResolver

    supabase = _get_supabase()
    sponsor_cache = await _load_sponsor_cache(supabase)
    resolver = EntityResolver()

    # Run hunter pipeline
    hunter = HunterAgent()
    result = await hunter.run_pipeline(sources=sources)
    raw_jobs = result.get("raw_jobs", [])

    # Process and insert jobs
    inserted = 0
    skipped = 0
    for job_data in raw_jobs:
        try:
            # Entity resolution
            match = await resolver.execute(
                company_name=job_data.get("company_name_raw", ""),
                sponsor_cache=sponsor_cache,
            )

            # Build job record
            record = {
                "source": job_data.get("source", "unknown"),
                "source_job_id": job_data.get("source_job_id"),
                "source_url": job_data.get("source_url"),
                "title_raw": job_data.get("title_raw", ""),
                "company_name_raw": job_data.get("company_name_raw", ""),
                "location_raw": job_data.get("location_raw"),
                "location_city": job_data.get("location_city"),
                "location_is_remote": job_data.get("location_is_remote", False),
                "salary_min": job_data.get("salary_min"),
                "salary_max": job_data.get("salary_max"),
                "salary_currency": job_data.get("salary_currency", "GBP"),
                "salary_period": job_data.get("salary_period"),
                "salary_text_raw": job_data.get("salary_text_raw"),
                "description_full": job_data.get("description_full"),
                "description_snippet": (job_data.get("description_full") or "")[:500],
                "contract_type": job_data.get("contract_type"),
                "seniority": job_data.get("seniority"),
                "posted_date": job_data.get("posted_date").isoformat() if job_data.get("posted_date") else None,
                "sponsorship_likelihood": job_data.get("sponsorship_likelihood"),
                "sponsorship_signals": job_data.get("sponsorship_signals"),
                "skills_extracted": job_data.get("skills_extracted"),
                "sponsor_id": match.data.get("sponsor_id") if match.success else None,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
                "first_seen_at": datetime.now(timezone.utc).isoformat(),
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
            }

            # Skip if missing required fields
            if not record["title_raw"] or not record["company_name_raw"]:
                skipped += 1
                continue

            # Dedup by source + source_job_id
            if record["source_job_id"]:
                existing = supabase.table("jobs").select("id").eq(
                    "source", record["source"]
                ).eq("source_job_id", record["source_job_id"]).execute()

                if existing.data:
                    supabase.table("jobs").update({
                        "last_seen_at": record["last_seen_at"]
                    }).eq("id", existing.data[0]["id"]).execute()
                    skipped += 1
                    continue

            # Insert new job
            supabase.table("jobs").insert(record).execute()
            inserted += 1

        except Exception as e:
            logger.error(f"Failed to insert job: {e}")
            skipped += 1

    # Log metrics to swarm_metrics
    try:
        supabase.table("swarm_metrics").insert({
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "jobs_scraped": len(raw_jobs),
            "jobs_validated": inserted,
            "errors_total": skipped,
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log swarm metrics: {e}")

    logger.info(f"Hunter pipeline: {inserted} inserted, {skipped} skipped")
    return {"inserted": inserted, "skipped": skipped, "total_found": len(raw_jobs)}


async def _run_validator_pipeline():
    """Run validation on unvalidated jobs."""
    from app.agents.validator.agent import ValidatorAgent
    supabase = _get_supabase()

    validator = ValidatorAgent()
    # Get jobs that need validation (no data_quality_score), prioritise newest
    result = supabase.table("jobs").select("*").is_(
        "data_quality_score", "null"
    ).order("scraped_at", desc=True).limit(500).execute()
    jobs = result.data or []

    if not jobs:
        logger.info("No jobs to validate")
        return {"validated": 0}

    validated = await validator.run_pipeline(jobs=jobs, supabase=supabase)
    return validated


async def _run_enrichment_pipeline():
    """Run enrichment on unenriched or poorly-enriched jobs."""
    from app.agents.enrichment.agent import EnrichmentAgent
    supabase = _get_supabase()

    enricher = EnrichmentAgent()

    # Phase 1: Jobs with no sponsorship score at all
    result = supabase.table("jobs").select("*").is_(
        "sponsorship_likelihood", "null"
    ).limit(300).execute()
    jobs = result.data or []

    # Phase 2: Jobs with default/low scores that haven't been properly enriched
    # (these got a default 10-15 from the scraper but were never run through
    # the full enrichment pipeline with register matching etc.)
    if len(jobs) < 300:
        remaining = 300 - len(jobs)
        seen_ids = {j["id"] for j in jobs}
        result2 = supabase.table("jobs").select("*").is_(
            "data_quality_score", "null"
        ).not_.is_("sponsorship_likelihood", "null").limit(remaining).execute()
        for j in (result2.data or []):
            if j["id"] not in seen_ids:
                jobs.append(j)

    if not jobs:
        logger.info("No jobs to enrich")
        return {"enriched": 0}

    logger.info(f"Enriching {len(jobs)} jobs")
    enriched = await enricher.run_pipeline(jobs=jobs, supabase=supabase)
    return enriched


async def _run_freshness_pipeline():
    """Run freshness checks on existing jobs."""
    from app.agents.freshness.agent import FreshnessAgent
    supabase = _get_supabase()

    freshness = FreshnessAgent()
    result = await freshness.run_pipeline(supabase=supabase)
    return result


@celery_app.task(name="agent.run_hunter", soft_time_limit=1800, time_limit=3600)
def run_hunter_task(sources: list[str] | None = None):
    """Celery task to run the hunter pipeline."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_hunter_pipeline(sources))
    finally:
        loop.close()


@celery_app.task(name="agent.run_validator", soft_time_limit=900, time_limit=1800)
def run_validator_task():
    """Celery task to validate jobs."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_validator_pipeline())
    finally:
        loop.close()


@celery_app.task(name="agent.run_enrichment", soft_time_limit=900, time_limit=1800)
def run_enrichment_task():
    """Celery task to enrich jobs."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_enrichment_pipeline())
    finally:
        loop.close()


@celery_app.task(name="agent.run_freshness", soft_time_limit=600, time_limit=1200)
def run_freshness_task():
    """Celery task for freshness checks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_freshness_pipeline())
    finally:
        loop.close()


async def _run_discovery_pipeline(batch_size: int = 200):
    """Run link discovery on sponsors missing website_url."""
    from app.agents.discovery.agent import DiscoveryAgent
    supabase = _get_supabase()

    # Fetch sponsors with no website_url, prioritise A-rated active sponsors
    result = (
        supabase.table("sponsors")
        .select("id, organisation_name, town_city, rating")
        .is_("website_url", "null")
        .order("rating", desc=False)
        .limit(batch_size)
        .execute()
    )
    sponsors = result.data or []

    if not sponsors:
        logger.info("No sponsors need link discovery")
        return {"processed": 0}

    logger.info(f"Running discovery on {len(sponsors)} sponsors")
    agent = DiscoveryAgent()
    metrics = await agent.run_pipeline(sponsors=sponsors, supabase=supabase)

    try:
        supabase.table("swarm_metrics").insert({
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "pipeline": "discovery",
            "jobs_scraped": metrics.get("processed", 0),
            "jobs_validated": metrics.get("websites_found", 0),
            "errors_total": metrics.get("errors", 0),
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log discovery metrics: {e}")

    return metrics


@celery_app.task(name="agent.run_discovery", soft_time_limit=1800, time_limit=3600)
def run_discovery_task(batch_size: int = 200):
    """Celery task to discover website URLs, LinkedIn pages, and contact info for sponsors."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_discovery_pipeline(batch_size))
    finally:
        loop.close()


async def _run_ch_watcher_pipeline(batch_size: int = 100):
    """Run Companies House watcher on a batch of sponsor companies."""
    from app.agents.companies_house.agent import CompaniesHouseWatcherAgent

    supabase = _get_supabase()
    watcher = CompaniesHouseWatcherAgent()
    result = await watcher.run_pipeline(supabase=supabase, batch_size=batch_size)
    return result


@celery_app.task(name="agent.run_ch_watcher", soft_time_limit=1800, time_limit=3600)
def run_ch_watcher_task(batch_size: int = 100):
    """Celery task to run the Companies House watcher pipeline.

    Checks a batch of sponsor companies for changes at Companies House:
    new filings, status changes, officer changes, and financial health signals.
    Prioritises companies that haven't been checked recently.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_ch_watcher_pipeline(batch_size))
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Quality Agent — Sophie Laurent
# ---------------------------------------------------------------------------

async def _run_quality_pipeline():
    """Run the quality audit pipeline (completeness, gaps, source health, hiring scores)."""
    from app.agents.quality.agent import QualityAgent
    supabase = _get_supabase()

    agent = QualityAgent()
    results = await agent.run_pipeline(supabase=supabase)

    # Summarise for metrics
    summary = {}
    for name, result in results.items():
        summary[name] = {
            "success": result.success,
            "duration_ms": result.duration_ms,
        }

    logger.info(f"Quality pipeline complete: {summary}")
    return summary


@celery_app.task(name="agent.run_quality", soft_time_limit=900, time_limit=1800)
def run_quality_task():
    """Sophie Laurent runs the data quality audit."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_quality_pipeline())
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Orchestrator Agent — Raj Patel
# ---------------------------------------------------------------------------

async def _run_orchestrator_pipeline():
    """Run the orchestrator: collect metrics, detect anomalies, publish alerts."""
    from app.agents.orchestrator.agent import OrchestratorAgent
    from app.agents.circuit_breaker import auto_probe_paused_sources

    supabase = _get_supabase()

    # First: auto-probe paused sources (circuit breaker self-healing)
    probe_results = auto_probe_paused_sources()
    logger.info(f"[NEXUS] Circuit breaker probe: {probe_results}")

    # Then: run the orchestrator pipeline
    agent = OrchestratorAgent()
    results = await agent.run_pipeline(supabase=supabase)

    summary = {}
    for name, result in results.items():
        summary[name] = {
            "success": result.success,
            "duration_ms": result.duration_ms,
        }

    # Check for zero-jobs alert
    try:
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent = supabase.table("jobs").select("id", count="exact").gte(
            "first_seen_at", cutoff
        ).execute()
        if recent.count == 0:
            from app.agents.notifications import notify_zero_jobs
            notify_zero_jobs(24)
    except Exception as e:
        logger.error(f"[NEXUS] Zero-jobs check failed: {e}")

    summary["circuit_breaker_probe"] = probe_results
    return summary


@celery_app.task(name="agent.run_orchestrator", soft_time_limit=600, time_limit=1200)
def run_orchestrator_task():
    """Raj Patel runs the orchestrator — metrics, anomalies, alerts, self-healing."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_orchestrator_pipeline())
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Bootstrap All Companies — Full data gathering sweep
# ---------------------------------------------------------------------------

async def _bootstrap_company_profiles(batch_size: int = 500, offset: int = 0):
    """Create company_profiles and gather details for ALL sponsors.

    This is the big one — processes every sponsor in the register:
    1. Creates company_profile records for sponsors that don't have one
    2. Runs Elena's discovery team to find websites, LinkedIn, careers pages
    3. Runs Daniel's CH watcher to get Companies House data
    4. Runs Priya's enrichment to calculate sponsorship scores

    Designed to run in batches via Celery to avoid timeouts.
    """
    from app.agents.discovery.agent import DiscoveryAgent
    supabase = _get_supabase()

    # Fetch sponsors that need profiles (no company_profile yet)
    result = (
        supabase.table("sponsors")
        .select("id, organisation_name, town_city, county, rating, route")
        .eq("is_active", True)
        .range(offset, offset + batch_size - 1)
        .execute()
    )
    sponsors = result.data or []

    if not sponsors:
        logger.info(f"[BOOTSTRAP] No more sponsors to process at offset {offset}")
        return {"processed": 0, "offset": offset, "done": True}

    # Step 1: Ensure company_profiles exist
    created = 0
    for sponsor in sponsors:
        try:
            existing = supabase.table("company_profiles").select("id").eq(
                "sponsor_id", sponsor["id"]
            ).execute()
            if not existing.data:
                supabase.table("company_profiles").insert({
                    "sponsor_id": sponsor["id"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
                created += 1
        except Exception as e:
            logger.error(f"[BOOTSTRAP] Profile creation failed for {sponsor['organisation_name']}: {e}")

    # Step 2: Run discovery on this batch
    discovery = DiscoveryAgent()
    discovery_results = await discovery.run_pipeline(sponsors=sponsors, supabase=supabase)

    # Step 3: Queue the next batch if more sponsors remain
    next_offset = offset + batch_size
    if len(sponsors) == batch_size:
        # More to process — chain next batch
        bootstrap_company_profiles_task.apply_async(
            kwargs={"batch_size": batch_size, "offset": next_offset},
            countdown=30,  # 30s delay between batches to be gentle
        )

    stats = {
        "batch_offset": offset,
        "sponsors_in_batch": len(sponsors),
        "profiles_created": created,
        "discovery": discovery_results,
        "next_offset": next_offset if len(sponsors) == batch_size else None,
    }
    logger.info(f"[BOOTSTRAP] Batch complete: {stats}")
    return stats


@celery_app.task(name="agent.bootstrap_profiles", soft_time_limit=3600, time_limit=7200)
def bootstrap_company_profiles_task(batch_size: int = 500, offset: int = 0):
    """Bootstrap company profiles for ALL sponsors in the register.

    Processes in batches of 500, auto-chains to next batch.
    Total: ~123,000 sponsors / 500 per batch = ~246 batches.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_bootstrap_company_profiles(batch_size, offset))
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Gather Jobs for Sponsor Companies — scan career pages + match to sponsors
# ---------------------------------------------------------------------------

async def _gather_sponsor_jobs(batch_size: int = 200, offset: int = 0):
    """Scan career pages of sponsor companies and gather their jobs.

    For each sponsor with a known careers_url or website_url:
    1. Scrape their careers page for job listings
    2. Match jobs to the sponsor
    3. Run through enrichment for sponsorship scoring
    """
    supabase = _get_supabase()

    # Get sponsors with known websites that haven't been scanned recently
    result = (
        supabase.table("company_profiles")
        .select("sponsor_id, website_url, careers_url, sponsors(id, organisation_name)")
        .not_.is_("website_url", "null")
        .range(offset, offset + batch_size - 1)
        .execute()
    )
    profiles = result.data or []

    if not profiles:
        logger.info(f"[JOB_GATHER] No more profiles to scan at offset {offset}")
        return {"processed": 0, "offset": offset, "done": True}

    # Use the career page scraper
    from app.scrapers.career_page_scraper import CareerPageScraper
    scraper = CareerPageScraper()

    total_jobs = 0
    errors = 0

    for profile in profiles:
        url = profile.get("careers_url") or profile.get("website_url")
        sponsor_name = (profile.get("sponsors") or {}).get("organisation_name", "Unknown")
        sponsor_id = profile.get("sponsor_id")

        if not url:
            continue

        try:
            jobs = await scraper.scrape(url)
            for job in (jobs or []):
                try:
                    record = {
                        "source": "career_page",
                        "source_url": job.get("url", url),
                        "title_raw": job.get("title", ""),
                        "company_name_raw": sponsor_name,
                        "location_raw": job.get("location"),
                        "description_full": job.get("description"),
                        "description_snippet": (job.get("description") or "")[:500],
                        "sponsor_id": sponsor_id,
                        "sponsorship_likelihood": 70,  # High — they're on the register
                        "sponsorship_signals": {"on_register": True},
                        "scraped_at": datetime.now(timezone.utc).isoformat(),
                        "first_seen_at": datetime.now(timezone.utc).isoformat(),
                        "last_seen_at": datetime.now(timezone.utc).isoformat(),
                    }
                    if record["title_raw"]:
                        supabase.table("jobs").insert(record).execute()
                        total_jobs += 1
                except Exception as e:
                    logger.debug(f"[JOB_GATHER] Job insert failed: {e}")
                    errors += 1

        except Exception as e:
            logger.debug(f"[JOB_GATHER] Scrape failed for {sponsor_name}: {e}")
            errors += 1

    # Chain next batch
    next_offset = offset + batch_size
    if len(profiles) == batch_size:
        gather_sponsor_jobs_task.apply_async(
            kwargs={"batch_size": batch_size, "offset": next_offset},
            countdown=30,
        )

    stats = {
        "batch_offset": offset,
        "profiles_scanned": len(profiles),
        "jobs_found": total_jobs,
        "errors": errors,
        "next_offset": next_offset if len(profiles) == batch_size else None,
    }
    logger.info(f"[JOB_GATHER] Batch complete: {stats}")
    return stats


@celery_app.task(name="agent.gather_sponsor_jobs", soft_time_limit=3600, time_limit=7200)
def gather_sponsor_jobs_task(batch_size: int = 200, offset: int = 0):
    """Scan sponsor company career pages and gather all their job listings.

    Processes in batches, auto-chains to next batch.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_gather_sponsor_jobs(batch_size, offset))
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Improvement Agent — Dr. Alex Thornton's R&D team
# ---------------------------------------------------------------------------

async def _run_improvement_pipeline():
    """Run the improvement pipeline: keywords, sources, scoring calibration."""
    from app.agents.improvement.agent import ImprovementAgent
    supabase = _get_supabase()

    agent = ImprovementAgent()
    results = await agent.run_pipeline(supabase=supabase)

    # Notify if significant findings
    try:
        from app.agents.notifications import send_notification_sync
        keyword_data = results.get("keyword_optimizer", {}).get("data", {})
        source_data = results.get("source_scout", {}).get("data", {})
        scoring_data = results.get("scoring_calibrator", {}).get("data", {})

        emerging = keyword_data.get("emerging_keywords", [])
        new_sources = source_data.get("recommended_integrations", 0)
        recommendations = scoring_data.get("recommendations", [])

        if emerging or new_sources or recommendations:
            send_notification_sync(
                title="R&D Team Report",
                message=(
                    f"Zara found {len(emerging)} emerging keywords. "
                    f"Tomas recommends {new_sources} new sources. "
                    f"Ines has {len(recommendations)} scoring recommendations."
                ),
                severity="info",
                fields={
                    "Emerging Keywords": ", ".join(k.get("keyword", "") for k in emerging[:5]),
                    "New Sources": str(new_sources),
                    "Scoring Issues": str(len(recommendations)),
                },
            )
    except Exception as e:
        logger.debug(f"[R&D] Notification failed: {e}")

    return results


@celery_app.task(name="agent.run_improvement", soft_time_limit=1800, time_limit=3600)
def run_improvement_task():
    """Dr. Alex Thornton's R&D team analyses and optimizes the platform."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_improvement_pipeline())
    finally:
        loop.close()


# ===================================================================
# Tier 12: Company Reconnaissance (browser-based real data gathering)
# ===================================================================
@celery_app.task(name="agent.run_company_recon", soft_time_limit=3600, time_limit=7200)
def run_company_recon_task(batch_size: int = 500, re_verify: bool = False):
    """Scout agents discover real company websites, LinkedIn, careers pages."""
    sb = _get_supabase()

    if re_verify:
        profiles = sb.table("company_profiles").select(
            "id, sponsor_id, companies_house_number"
        ).eq("website_url", "NOT_FOUND").limit(batch_size).execute()
    else:
        profiles = sb.table("company_profiles").select(
            "id, sponsor_id, companies_house_number"
        ).is_("website_url", "null").limit(batch_size).execute()

    count = len(profiles.data or [])
    logger.info(f"[RECON] Processing {count} companies (re_verify={re_verify})")
    # Actual browser-based recon handled by deploy_scouts.py subprocess
    import subprocess
    subprocess.Popen(
        ["python", "deploy_scouts.py"],
        cwd="/app",
        env={**dict(__import__("os").environ), "SCOUT_BATCH_SIZE": str(batch_size)},
    )
    return {"queued": count}


# ===================================================================
# Tier 13: Career Page Monitoring
# ===================================================================
@celery_app.task(name="agent.monitor_career_pages", soft_time_limit=3600, time_limit=7200)
def monitor_career_pages_task(batch_size: int = 1000, priority: str = "high"):
    """Visit enriched company career pages and scrape new job postings."""
    sb = _get_supabase()

    query = sb.table("company_profiles").select(
        "id, sponsor_id, careers_page_url, website_url"
    ).eq("has_careers_page", True)

    if priority == "high":
        query = query.limit(batch_size)
    else:
        query = query.limit(batch_size)

    profiles = query.execute()
    logger.info(f"[CAREER-MONITOR] Scanning {len(profiles.data or [])} careers pages")

    # TODO: implement actual career page scraping with Playwright
    return {"scanned": len(profiles.data or [])}


# ===================================================================
# Tier 14: Entity Resolution (continuous)
# ===================================================================
@celery_app.task(name="agent.run_entity_resolution", soft_time_limit=600, time_limit=1200)
def run_entity_resolution_task():
    """Match unmatched jobs to sponsor companies."""
    loop = asyncio.new_event_loop()
    try:
        sb = _get_supabase()

        # Load sponsor cache
        cache = {}
        page = 0
        while True:
            result = sb.table("sponsors").select(
                "id, organisation_name"
            ).range(page * 1000, (page + 1) * 1000 - 1).execute()
            if not result.data:
                break
            for s in result.data:
                name = s["organisation_name"].strip().upper()
                cache[name] = s["id"]
                for suffix in [" LIMITED", " LTD", " PLC", " LLP", " INC", " CORP"]:
                    if name.endswith(suffix):
                        cache[name[:-len(suffix)].strip()] = s["id"]
            if len(result.data) < 1000:
                break
            page += 1

        # Match unmatched jobs
        unmatched = sb.table("jobs").select(
            "id, company_name_raw"
        ).is_("sponsor_id", "null").limit(5000).execute()

        matched = 0
        for job in (unmatched.data or []):
            company = (job.get("company_name_raw") or "").strip().upper()
            sponsor_id = cache.get(company)
            if not sponsor_id:
                for suffix in [" LIMITED", " LTD", " PLC", " LLP", " INC", " CORP"]:
                    if company.endswith(suffix):
                        sponsor_id = cache.get(company[:-len(suffix)].strip())
                        if sponsor_id:
                            break
            if sponsor_id:
                sb.table("jobs").update({
                    "sponsor_id": sponsor_id,
                    "sponsorship_likelihood": 75,
                }).eq("id", job["id"]).execute()
                matched += 1

        logger.info(f"[ENTITY-RES] Matched {matched}/{len(unmatched.data or [])} jobs")
        return {"matched": matched}
    finally:
        loop.close()


# ===================================================================
# Tier 15: Sponsorship Scoring (continuous)
# ===================================================================
@celery_app.task(name="agent.run_sponsorship_scoring", soft_time_limit=600, time_limit=1200)
def run_sponsorship_scoring_task():
    """Score unscored jobs for sponsorship likelihood."""
    sb = _get_supabase()

    POSITIVE = [
        "visa sponsorship", "sponsor visa", "skilled worker",
        "certificate of sponsorship", "cos", "sponsorship available",
        "willing to sponsor", "can sponsor", "will sponsor",
        "international candidates", "overseas candidates",
        "right to work assistance", "immigration support",
        "tier 2", "work permit",
    ]
    NEGATIVE = [
        "no sponsorship", "cannot sponsor", "won't sponsor",
        "must have right to work", "no visa", "uk residents only",
        "british passport", "eu passport only",
    ]

    unscored = sb.table("jobs").select(
        "id, title_raw, description_full, description_snippet, sponsor_id, salary_min"
    ).is_("sponsorship_likelihood", "null").limit(5000).execute()

    scored = 0
    for job in (unscored.data or []):
        text = f"{job.get('title_raw', '')} {job.get('description_full', '') or job.get('description_snippet', '')}".lower()
        score = 15
        signals = []

        for sig in POSITIVE:
            if sig in text:
                score += 15
                signals.append(f"+{sig}")
        for sig in NEGATIVE:
            if sig in text:
                score -= 30
                signals.append(f"-{sig}")
        if job.get("sponsor_id"):
            score += 25
            signals.append("+on_register")
        if (job.get("salary_min") or 0) >= 26200:
            score += 10
            signals.append("+meets_salary")

        score = max(0, min(100, score))
        sb.table("jobs").update({
            "sponsorship_likelihood": score,
            "sponsorship_signals": signals,
        }).eq("id", job["id"]).execute()
        scored += 1

    logger.info(f"[SCORING] Scored {scored} jobs")
    return {"scored": scored}
