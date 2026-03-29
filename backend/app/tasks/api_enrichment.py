"""API Enrichment — Wire ALL available APIs to enrich sponsor data.

APIs we have keys for:
1. Companies House (8eef31df) — company profile, filings, officers, charges, PSC
2. Adzuna (68c87d5e) — job listings with salary data
3. GROQ (gsk_NDNc) — LLM classification and analysis

Free APIs (no key needed):
4. GOV.UK Content API — immigration rules, policy documents
5. ONS API — employment statistics
6. Charity Commission API — for charity sponsors
7. DVLA/HMRC — public company data
8. Hansard API — parliamentary debates (already wired)

This module runs Companies House enrichment in bulk.
"""

import asyncio
import logging
import time
from datetime import datetime, timezone

import httpx

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

CH_BASE = "https://api.company-information.service.gov.uk"


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_supabase():
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


async def fetch_ch_profile(client: httpx.AsyncClient, company_number: str, api_key: str) -> dict | None:
    """Fetch company profile from Companies House API."""
    try:
        r = await client.get(
            f"{CH_BASE}/company/{company_number}",
            auth=(api_key, ""),
        )
        if r.status_code == 200:
            return r.json()
        return None
    except Exception:
        return None


async def fetch_ch_filing_history(client: httpx.AsyncClient, company_number: str, api_key: str) -> list:
    """Fetch recent filing history."""
    try:
        r = await client.get(
            f"{CH_BASE}/company/{company_number}/filing-history",
            auth=(api_key, ""),
            params={"items_per_page": 5},
        )
        if r.status_code == 200:
            return r.json().get("items", [])
        return []
    except Exception:
        return []


async def fetch_ch_officers(client: httpx.AsyncClient, company_number: str, api_key: str) -> list:
    """Fetch current officers."""
    try:
        r = await client.get(
            f"{CH_BASE}/company/{company_number}/officers",
            auth=(api_key, ""),
            params={"items_per_page": 10},
        )
        if r.status_code == 200:
            return r.json().get("items", [])
        return []
    except Exception:
        return []


async def fetch_ch_charges(client: httpx.AsyncClient, company_number: str, api_key: str) -> dict:
    """Fetch charges (mortgages/debentures)."""
    try:
        r = await client.get(
            f"{CH_BASE}/company/{company_number}/charges",
            auth=(api_key, ""),
        )
        if r.status_code == 200:
            data = r.json()
            return {
                "total_count": data.get("total_count", 0),
                "satisfied_count": data.get("satisfied_count", 0),
                "part_satisfied_count": data.get("part_satisfied_count", 0),
                "unfiltered_count": data.get("unfiltered_count", 0),
            }
        return {}
    except Exception:
        return {}


async def enrich_sponsor_from_ch(
    sb, client: httpx.AsyncClient, api_key: str, sponsor_id: str, ch_number: str
) -> dict:
    """Full Companies House enrichment for a single sponsor."""
    profile = await fetch_ch_profile(client, ch_number, api_key)
    if not profile:
        return {"status": "not_found"}

    # Extract useful data
    update = {}

    # Company status
    status = profile.get("company_status", "")
    update["company_status"] = status

    # SIC codes (industry)
    sic = profile.get("sic_codes", [])
    if sic:
        update["sic_codes"] = sic

    # Incorporation date
    inc_date = profile.get("date_of_creation")
    if inc_date:
        update["incorporation_date"] = inc_date

    # Company type
    update["company_type"] = profile.get("type", "")

    # Registered address
    addr = profile.get("registered_office_address", {})
    if addr:
        parts = [addr.get("address_line_1", ""), addr.get("address_line_2", ""),
                 addr.get("locality", ""), addr.get("postal_code", "")]
        update["registered_address"] = ", ".join(p for p in parts if p)

    # Accounts
    accounts = profile.get("accounts", {})
    if accounts:
        update["last_accounts_date"] = accounts.get("last_accounts", {}).get("made_up_to")
        next_due = accounts.get("next_due")
        if next_due:
            update["next_accounts_due"] = next_due
            # Check if overdue
            try:
                due = datetime.strptime(next_due, "%Y-%m-%d")
                update["accounts_overdue"] = due < datetime.now()
            except Exception:
                pass

    # Confirmation statement
    conf = profile.get("confirmation_statement", {})
    if conf:
        next_due = conf.get("next_due")
        if next_due:
            try:
                due = datetime.strptime(next_due, "%Y-%m-%d")
                update["confirmation_statement_overdue"] = due < datetime.now()
            except Exception:
                pass

    # Has charges
    update["has_charges"] = profile.get("has_charges", False)
    update["has_insolvency_history"] = profile.get("has_insolvency_history", False)

    # Fetch charges detail
    if profile.get("has_charges"):
        charges = await fetch_ch_charges(client, ch_number, api_key)
        update["charge_count"] = charges.get("total_count", 0)

    # Update company_profiles
    if update:
        try:
            sb.table("company_profiles").update(update).eq("sponsor_id", sponsor_id).execute()
        except Exception as e:
            logger.debug(f"CH update failed for {sponsor_id}: {e}")

    return {"status": "enriched", "fields_updated": len(update)}


@celery_app.task(name="data.enrich_from_companies_house", soft_time_limit=1800, time_limit=3600)
def enrich_from_companies_house(batch_size: int = 30):
    """Batch-enrich sponsors from Companies House API.

    Picks sponsors that have a CH number but missing key data (SIC codes, status).
    Rate limit: 600 req/5min = 120/min. We use ~4 requests per sponsor.
    30 sponsors * 4 req = 120 req per run = safe within limits.
    """
    async def _run():
        from app.core.config import get_settings
        s = get_settings()

        if not s.companies_house_api_key:
            return {"error": "no_ch_key"}

        sb = _get_supabase()
        start = time.time()

        # Get sponsors with CH number but missing SIC codes
        result = sb.table("company_profiles").select(
            "sponsor_id, companies_house_number"
        ).is_("sic_codes", "null").neq(
            "companies_house_number", ""
        ).limit(batch_size).execute()

        profiles = [p for p in (result.data or []) if p.get("companies_house_number")]
        logger.info(f"[CH] Enriching {len(profiles)} sponsors from Companies House")

        enriched = 0
        errors = 0

        async with httpx.AsyncClient(timeout=15) as client:
            for p in profiles:
                try:
                    result = await enrich_sponsor_from_ch(
                        sb, client, s.companies_house_api_key,
                        p["sponsor_id"], p["companies_house_number"],
                    )
                    if result.get("status") == "enriched":
                        enriched += 1
                    else:
                        errors += 1
                except Exception as e:
                    errors += 1
                    logger.debug(f"[CH] Error: {e}")

                await asyncio.sleep(0.5)  # Rate limit: ~2 req/sec

        duration = int((time.time() - start) * 1000)
        stats = {"enriched": enriched, "errors": errors, "duration_ms": duration}
        logger.info(f"[CH] Complete: {stats}")
        return stats

    return _run_async(_run())


@celery_app.task(name="data.score_unscored_jobs", soft_time_limit=600, time_limit=900)
def score_unscored_jobs(batch_size: int = 200):
    """Score jobs that have no sponsorship_likelihood using deterministic logic.

    No LLM needed — uses sponsor register match, salary threshold,
    keyword signals.
    """
    sb = _get_supabase()

    result = sb.table("jobs").select(
        "id, sponsor_id, salary_min, title_raw"
    ).is_("sponsorship_likelihood", "null").limit(batch_size).execute()

    jobs = result.data or []
    logger.info(f"[SCORE] Scoring {len(jobs)} unscored jobs")

    scored = 0
    for job in jobs:
        score = 5  # base

        # Sponsor match
        if job.get("sponsor_id"):
            score += 30
            try:
                sp = sb.table("sponsors").select("rating").eq("id", job["sponsor_id"]).limit(1).execute()
                if sp.data and sp.data[0].get("rating") == "A":
                    score += 20
            except Exception:
                pass

        # Salary threshold
        sal = job.get("salary_min")
        if sal:
            if sal >= 38700:
                score += 20
            elif sal >= 25000:
                score += 10

        # Keywords
        title = (job.get("title_raw") or "").lower()
        if any(kw in title for kw in ["visa", "sponsor", "tier 2", "skilled worker"]):
            score += 15

        try:
            sb.table("jobs").update({"sponsorship_likelihood": min(100, score)}).eq("id", job["id"]).execute()
            scored += 1
        except Exception:
            pass

    logger.info(f"[SCORE] Scored {scored}/{len(jobs)} jobs")
    return {"scored": scored, "total": len(jobs)}
