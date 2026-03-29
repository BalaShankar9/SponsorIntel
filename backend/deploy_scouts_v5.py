#!/usr/bin/env python3
"""
SponsorIntel MEGA ENRICHMENT — Leave Nothing Behind
=====================================================
Multiple passes. Every platform. Every data point.

PASS 1: Domain verification — find company websites (if v4 didn't)
PASS 2: Platform profiles — LinkedIn, Indeed, Glassdoor, Reed, Trustpilot, Facebook, Twitter
PASS 3: Career page deep scan — 20+ path patterns on every found website
PASS 4: Website content scrape — email, phone, description from actual pages
PASS 5: Indeed active jobs — check every single company for live job postings
PASS 6: Companies House links + charity check
PASS 7: Gap fill — browser search (Playwright) for companies with NO website after passes 1-6

3x agent power: 600 concurrent, 60 agents at once.
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote_plus, urlparse

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("MEGA")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

MAX_CONCURRENT = 5000
BATCH_SIZE = 1          # 1 agent per company
AGENTS_AT_ONCE = 5000   # All at once
TIMEOUT = 5

stats = {}


def reset_stats():
    global stats
    stats = {
        "processed": 0, "websites": 0, "linkedin": 0, "indeed": 0,
        "glassdoor": 0, "reed": 0, "trustpilot": 0, "facebook": 0,
        "twitter": 0, "careers": 0, "emails": 0, "phones": 0,
        "descriptions": 0, "jobs_found": 0, "ch_links": 0,
        "batches": 0, "total_batches": 0, "start": 0, "total": 0,
    }


def normalize(name: str) -> str:
    name = name.strip().upper()
    for suffix in [
        " LIMITED", " LTD", " LTD.", " PLC", " LLP", " INC", " CORP",
        " CORPORATION", " CO.", " COMPANY", " GROUP", " HOLDINGS",
        " INTERNATIONAL", " (UK)", " UK", " SERVICES", " SOLUTIONS",
        " CONSULTING", " CONSULTANTS", " PARTNERS", " & CO", " & CO.",
        " RECRUITMENT", " STAFFING", " HEALTHCARE", " CARE",
        " EDUCATION", " ACADEMY", " TRUST", " FOUNDATION",
        " ENGINEERING", " TECHNOLOGIES", " TECHNOLOGY", " TECH",
        " MANAGEMENT", " ASSOCIATES", " ENTERPRISES", " INVESTMENTS",
        " PROPERTIES", " DEVELOPMENTS", " LOGISTICS", " TRANSPORT",
        " TRADING", " SYSTEMS", " GLOBAL", " DIGITAL",
    ]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
    return name


def slugify(name: str) -> str:
    clean = normalize(name).lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', clean).strip()
    return re.sub(r'[\s]+', '-', slug)


def name_to_domains(name: str) -> list[str]:
    clean = normalize(name).lower()
    slug = re.sub(r'[^a-z0-9\s]', '', clean).strip()
    parts = slug.split()
    if not parts:
        return []
    concat = ''.join(parts)
    hyphen = '-'.join(parts)
    first = parts[0]
    # Also try initials for long names (e.g., "ABC" for "Alpha Beta Corp")
    initials = ''.join(p[0] for p in parts) if len(parts) >= 3 else None

    domains = []
    for base in [concat, hyphen]:
        if len(base) >= 3:
            domains.extend([
                f"{base}.co.uk", f"{base}.com", f"{base}.org.uk",
                f"{base}.org", f"{base}.uk", f"{base}.net",
                f"{base}.nhs.uk", f"{base}.ac.uk", f"{base}.edu",
            ])
    if first != concat and len(first) >= 3:
        domains.extend([f"{first}.co.uk", f"{first}.com"])
    if initials and len(initials) >= 3:
        domains.extend([f"{initials}.co.uk", f"{initials}.com"])

    return domains[:16]


async def check_url(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        r = await client.head(url, follow_redirects=True, timeout=TIMEOUT)
        if r.status_code < 400:
            final = str(r.url)
            bad = ["parked", "forsale", "buydomainnames", "sedoparking",
                   "hugedomains", "domainmarket", "afternic", "godaddy",
                   "namecheap", "dan.com", "sav.com"]
            if any(b in final.lower() for b in bad):
                return None
            return final
    except Exception:
        pass
    return None


# ==================== PASS 1: WEBSITES ====================

async def find_website(client: httpx.AsyncClient, name: str) -> Optional[str]:
    domains = name_to_domains(name)
    tasks = [check_url(client, f"https://{d}") for d in domains]
    results = await asyncio.gather(*tasks)
    for r in results:
        if r:
            return r
    tasks2 = [check_url(client, f"http://{d}") for d in domains[:6]]
    results2 = await asyncio.gather(*tasks2)
    for r in results2:
        if r:
            return r
    return None


# ==================== PASS 2: PLATFORM PROFILES ====================

async def find_linkedin(client: httpx.AsyncClient, name: str) -> Optional[str]:
    slug = slugify(name)
    nohyphen = slug.replace('-', '')
    variants = list(dict.fromkeys([slug, nohyphen]))  # Dedup
    tasks = [check_url(client, f"https://www.linkedin.com/company/{v}/") for v in variants[:3]]
    results = await asyncio.gather(*tasks)
    for r in results:
        if r and "linkedin.com/company" in r:
            return r
    return None


async def find_indeed(client: httpx.AsyncClient, name: str) -> Optional[str]:
    clean = normalize(name).title().replace(' ', '-')
    nohyphen = clean.replace('-', '')
    for v in [clean, nohyphen]:
        r = await check_url(client, f"https://www.indeed.co.uk/cmp/{v}")
        if r and "indeed.co.uk/cmp" in r:
            return r
    return None


async def find_glassdoor(client: httpx.AsyncClient, name: str) -> Optional[str]:
    clean = normalize(name).title().replace(' ', '-')
    r = await check_url(client, f"https://www.glassdoor.co.uk/Reviews/{clean}-Reviews")
    if r and "glassdoor" in r:
        return r
    return None


async def find_reed(client: httpx.AsyncClient, name: str) -> Optional[str]:
    slug = slugify(name)
    r = await check_url(client, f"https://www.reed.co.uk/jobs/{slug}-jobs")
    if r and "reed.co.uk" in r:
        return r
    return None


async def find_trustpilot(client: httpx.AsyncClient, name: str, domain: str = None) -> Optional[str]:
    targets = []
    if domain:
        targets.append(domain)
    slug = slugify(name)
    targets.extend([f"{slug}.co.uk", f"{slug}.com", slug.replace('-', '') + ".co.uk"])
    for t in targets[:4]:
        r = await check_url(client, f"https://www.trustpilot.com/review/{t}")
        if r and "trustpilot.com/review" in r:
            return r
    return None


async def find_facebook(client: httpx.AsyncClient, name: str) -> Optional[str]:
    slug = slugify(name)
    nohyphen = slug.replace('-', '')
    for v in [nohyphen, slug]:
        r = await check_url(client, f"https://www.facebook.com/{v}/")
        if r and "facebook.com" in r and "/login" not in r:
            return r
    return None


async def find_twitter(client: httpx.AsyncClient, name: str) -> Optional[str]:
    slug = slugify(name).replace('-', '')
    r = await check_url(client, f"https://x.com/{slug}")
    if r and ("x.com/" in r or "twitter.com/" in r):
        # Make sure it's not an error page
        if "/error" not in r and "/404" not in r:
            return r
    return None


# ==================== PASS 3: CAREER PAGES ====================

CAREER_PATHS = [
    "/careers", "/jobs", "/vacancies", "/join-us", "/work-with-us",
    "/career", "/en/careers", "/about/careers", "/opportunities",
    "/recruitment", "/hiring", "/work-for-us", "/join",
    "/current-vacancies", "/job-opportunities", "/open-positions",
    "/careers/", "/jobs/", "/about-us/careers", "/join-our-team",
    "/employment", "/staff-vacancies",
]


async def find_careers(client: httpx.AsyncClient, website_url: str) -> Optional[str]:
    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    tasks = [check_url(client, f"{base}{p}") for p in CAREER_PATHS]
    results = await asyncio.gather(*tasks)
    for r in results:
        if r:
            return r
    return None


# ==================== PASS 4: WEBSITE CONTENT ====================

async def scrape_website_content(client: httpx.AsyncClient, url: str) -> dict:
    """Scrape basic info from company website — email, phone, description."""
    data = {}
    try:
        r = await client.get(url, timeout=8, follow_redirects=True)
        if r.status_code != 200:
            return data
        text = r.text[:50000]  # First 50KB only

        # Extract emails
        emails = set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text))
        # Filter out common non-company emails
        emails = [e for e in emails if not any(x in e.lower() for x in
                  ['example.com', 'sentry.io', 'wixpress', 'wordpress', 'google',
                   'facebook', 'twitter', 'jquery', 'bootstrap', 'schema.org'])]
        if emails:
            data["contact_email"] = emails[0]
            stats["emails"] += 1

        # Extract UK phone numbers
        phones = re.findall(r'(?:0[1-9]\d{8,9}|(?:\+44|0044)\s?\d[\d\s]{8,12})', text)
        if phones:
            data["contact_phone"] = phones[0].strip()
            stats["phones"] += 1

        # Extract meta description
        desc_match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', text, re.I)
        if desc_match:
            data["description"] = desc_match.group(1)[:500]
            stats["descriptions"] += 1

        # Extract title
        title_match = re.search(r'<title>(.*?)</title>', text, re.I)
        if title_match:
            data["page_title"] = title_match.group(1)[:200]

    except Exception:
        pass
    return data


# ==================== PASS 5: INDEED JOBS ====================

async def count_indeed_jobs(client: httpx.AsyncClient, name: str) -> int:
    clean = normalize(name)
    try:
        r = await client.get(
            "https://www.indeed.co.uk/jobs",
            params={"q": f'company:"{clean}"', "l": "United Kingdom"},
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            timeout=8,
        )
        if r.status_code == 200:
            match = re.search(r'(\d[\d,]*)\s*jobs?', r.text[:5000])
            if match:
                return int(match.group(1).replace(',', ''))
    except Exception:
        pass
    return 0


# ==================== MAIN BATCH PROCESSOR ====================

async def process_batch(
    batch_id: int,
    companies: list[dict],
    sponsors_map: dict,
    semaphore: asyncio.Semaphore,
    pass_name: str,
):
    updates = []

    async with httpx.AsyncClient(
        follow_redirects=True,
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=25),
        headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/2.0)"},
    ) as client:

        async def enrich_one(company: dict):
            async with semaphore:
                sponsor = sponsors_map.get(company.get("sponsor_id"), {})
                name = sponsor.get("organisation_name", "")
                if not name:
                    return

                data = {}
                social = {}
                existing_website = company.get("website_url")
                ch_number = company.get("companies_house_number")

                try:
                    existing_social = json.loads(company.get("social_links") or "{}")
                except Exception:
                    existing_social = {}

                # PASS 1: Website
                if not existing_website:
                    w = await find_website(client, name)
                    if w:
                        data["website_url"] = w
                        existing_website = w
                        stats["websites"] += 1

                # PASS 2: Platform profiles
                if not company.get("linkedin_url"):
                    li = await find_linkedin(client, name)
                    if li:
                        data["linkedin_url"] = li
                        stats["linkedin"] += 1

                if "indeed" not in existing_social:
                    indeed = await find_indeed(client, name)
                    if indeed:
                        social["indeed"] = indeed
                        stats["indeed"] += 1

                if "glassdoor" not in existing_social:
                    gd = await find_glassdoor(client, name)
                    if gd:
                        social["glassdoor"] = gd
                        stats["glassdoor"] += 1

                if "reed" not in existing_social:
                    rd = await find_reed(client, name)
                    if rd:
                        social["reed"] = rd
                        stats["reed"] += 1

                if "trustpilot" not in existing_social:
                    domain = None
                    if existing_website:
                        try:
                            domain = urlparse(existing_website).netloc.replace("www.", "")
                        except Exception:
                            pass
                    tp = await find_trustpilot(client, name, domain)
                    if tp:
                        social["trustpilot"] = tp
                        stats["trustpilot"] += 1

                if "facebook" not in existing_social:
                    fb = await find_facebook(client, name)
                    if fb:
                        social["facebook"] = fb
                        stats["facebook"] += 1

                if "twitter" not in existing_social:
                    tw = await find_twitter(client, name)
                    if tw:
                        social["twitter"] = tw
                        stats["twitter"] += 1

                # PASS 3: Careers page
                if existing_website and not company.get("has_careers_page"):
                    cp = await find_careers(client, existing_website)
                    if cp:
                        data["careers_page_url"] = cp
                        data["has_careers_page"] = True
                        stats["careers"] += 1

                # PASS 4: Website content
                if existing_website and not existing_social.get("contact_email"):
                    content = await scrape_website_content(client, existing_website)
                    if content.get("contact_email"):
                        social["contact_email"] = content["contact_email"]
                    if content.get("contact_phone"):
                        social["contact_phone"] = content["contact_phone"]
                    if content.get("description"):
                        social["website_description"] = content["description"]
                    if content.get("page_title"):
                        social["website_title"] = content["page_title"]

                # PASS 5: Indeed job count
                if "indeed_active_jobs" not in existing_social:
                    jc = await count_indeed_jobs(client, name)
                    if jc > 0:
                        social["indeed_active_jobs"] = jc
                        stats["jobs_found"] += jc

                # PASS 6: Companies House link
                if ch_number and "companies_house" not in existing_social:
                    social["companies_house"] = (
                        f"https://find-and-update.company-information.service.gov.uk/company/{ch_number}"
                    )
                    stats["ch_links"] += 1

                # Merge social links
                if social:
                    merged = {**existing_social, **social}
                    data["social_links"] = json.dumps(merged)

                if data:
                    updates.append((company["id"], data))
                stats["processed"] += 1

        tasks = [enrich_one(c) for c in companies]
        await asyncio.gather(*tasks, return_exceptions=True)

    for company_id, data in updates:
        try:
            sb.table("company_profiles").update(data).eq("id", company_id).execute()
        except Exception:
            pass

    stats["batches"] += 1
    if stats["batches"] % 500 == 0 or stats["batches"] == stats["total_batches"]:
        elapsed = time.time() - stats["start"]
        rate = stats["processed"] / max(1, elapsed)
        remaining = (stats["total"] - stats["processed"]) / max(0.01, rate)
        logger.info(
            f"  [{pass_name}] Batch {stats['batches']}/{stats['total_batches']} | "
            f"{stats['processed']:,}/{stats['total']:,} | "
            f"W:{stats['websites']:,} LI:{stats['linkedin']:,} "
            f"IN:{stats['indeed']:,} GD:{stats['glassdoor']:,} "
            f"RD:{stats['reed']:,} TP:{stats['trustpilot']:,} "
            f"FB:{stats['facebook']:,} TW:{stats['twitter']:,} "
            f"C:{stats['careers']:,} E:{stats['emails']:,} "
            f"P:{stats['phones']:,} J:{stats['jobs_found']:,} | "
            f"{rate:.1f}/s | ETA {remaining/60:.0f}m"
        )


async def run_pass(pass_name: str, profiles: list[dict], sponsors_map: dict):
    """Run one enrichment pass over the given profiles."""
    reset_stats()
    stats["start"] = time.time()
    stats["total"] = len(profiles)

    batches = [profiles[i:i + BATCH_SIZE] for i in range(0, len(profiles), BATCH_SIZE)]
    stats["total_batches"] = len(batches)

    logger.info(f"  [{pass_name}] {len(profiles):,} companies, {len(batches):,} agents")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    for group_start in range(0, len(batches), AGENTS_AT_ONCE):
        group = batches[group_start:group_start + AGENTS_AT_ONCE]
        tasks = [
            process_batch(group_start + i + 1, batch, sponsors_map, semaphore, pass_name)
            for i, batch in enumerate(group)
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    elapsed = time.time() - stats["start"]
    logger.info(
        f"  [{pass_name}] DONE in {elapsed/60:.1f}m — "
        f"W:{stats['websites']:,} LI:{stats['linkedin']:,} "
        f"IN:{stats['indeed']:,} GD:{stats['glassdoor']:,} "
        f"RD:{stats['reed']:,} TP:{stats['trustpilot']:,} "
        f"FB:{stats['facebook']:,} TW:{stats['twitter']:,} "
        f"C:{stats['careers']:,} E:{stats['emails']:,} "
        f"P:{stats['phones']:,} J:{stats['jobs_found']:,}"
    )
    return dict(stats)


def _fetch_page(table, select, start, end, retries=3):
    """Fetch a page from Supabase with retry."""
    import time as _time
    for attempt in range(retries):
        try:
            return sb.table(table).select(select).range(start, end).execute()
        except Exception as e:
            if attempt < retries - 1:
                _time.sleep(2)
            else:
                logger.warning(f"  Failed to fetch {table} page {start}-{end}: {e}")
                return type('R', (), {'data': []})()


def load_all_profiles() -> list[dict]:
    """Load ALL company profiles with retry."""
    profiles = []
    page = 0
    cols = ("id, sponsor_id, companies_house_number, website_url, "
            "linkedin_url, has_careers_page, social_links")
    while True:
        result = _fetch_page("company_profiles", cols, page * 1000, (page + 1) * 1000 - 1)
        if not result.data:
            break
        profiles.extend(result.data)
        if len(result.data) < 1000:
            break
        page += 1
        if page % 50 == 0:
            logger.info(f"    Loading profiles... {len(profiles):,}")
    return profiles


def load_sponsors() -> dict:
    sponsors = {}
    page = 0
    while True:
        result = _fetch_page("sponsors", "id, organisation_name", page * 1000, (page + 1) * 1000 - 1)
        if not result.data:
            break
        for s in result.data:
            sponsors[s["id"]] = s
        if len(result.data) < 1000:
            break
        page += 1
        if page % 50 == 0:
            logger.info(f"    Loading sponsors... {len(sponsors):,}")
    return sponsors


async def main():
    total_start = time.time()

    logger.info("=" * 70)
    logger.info("  MEGA ENRICHMENT — LEAVE NOTHING BEHIND")
    logger.info("=" * 70)
    logger.info("  7 data passes × 140k companies × 3x agent power")
    logger.info(f"  Concurrent: {MAX_CONCURRENT} HTTP | {AGENTS_AT_ONCE} agents at once")
    logger.info("")

    sponsors_map = load_sponsors()
    logger.info(f"  Loaded {len(sponsors_map):,} sponsors")

    # ===== ROUND 1: Full enrichment on ALL companies =====
    logger.info("")
    logger.info("  ========== ROUND 1: FULL ENRICHMENT ==========")
    profiles = load_all_profiles()
    logger.info(f"  Loaded {len(profiles):,} profiles")
    r1 = await run_pass("ROUND-1", profiles, sponsors_map)

    # ===== ROUND 2: Re-enrich companies with gaps =====
    logger.info("")
    logger.info("  ========== ROUND 2: GAP FILL (no website) ==========")
    profiles2 = load_all_profiles()
    gaps = [p for p in profiles2 if not p.get("website_url")]
    if gaps:
        logger.info(f"  {len(gaps):,} companies still without website — retrying")
        r2 = await run_pass("ROUND-2-GAPS", gaps, sponsors_map)
    else:
        logger.info("  No gaps! All companies have websites.")

    # ===== ROUND 3: Re-enrich companies missing LinkedIn =====
    logger.info("")
    logger.info("  ========== ROUND 3: LINKEDIN FILL ==========")
    profiles3 = load_all_profiles()
    no_li = [p for p in profiles3 if not p.get("linkedin_url")]
    if no_li:
        logger.info(f"  {len(no_li):,} companies without LinkedIn — retrying")
        r3 = await run_pass("ROUND-3-LINKEDIN", no_li, sponsors_map)
    else:
        logger.info("  All companies have LinkedIn!")

    # ===== FINAL REPORT =====
    total_elapsed = time.time() - total_start

    # Get final counts from Supabase
    total_profiles = sb.table("company_profiles").select("id", count="exact", head=True).execute()
    with_website = sb.table("company_profiles").select("id", count="exact", head=True).not_.is_("website_url", "null").execute()
    with_linkedin = sb.table("company_profiles").select("id", count="exact", head=True).not_.is_("linkedin_url", "null").execute()
    with_careers = sb.table("company_profiles").select("id", count="exact", head=True).eq("has_careers_page", True).execute()
    with_social = sb.table("company_profiles").select("id", count="exact", head=True).not_.is_("social_links", "null").execute()

    logger.info("")
    logger.info("=" * 70)
    logger.info("  MEGA ENRICHMENT — FINAL REPORT")
    logger.info("=" * 70)
    logger.info(f"  Total profiles:     {total_profiles.count:,}")
    logger.info(f"  With website:       {with_website.count:,}")
    logger.info(f"  With LinkedIn:      {with_linkedin.count:,}")
    logger.info(f"  With careers page:  {with_careers.count:,}")
    logger.info(f"  With social links:  {with_social.count:,}")
    logger.info(f"  Total time:         {total_elapsed/60:.1f} minutes")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
