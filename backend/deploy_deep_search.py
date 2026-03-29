#!/usr/bin/env python3
"""
SponsorIntel DEEP SEARCH — Data That No One Else Has
======================================================
Real browser searches. Every platform. Every job board. Every data point.

For EACH company:
  1. Google/Bing search "{company name}" → extract ALL platform links
  2. Google search "{company name} jobs UK" → find jobs posted ANYWHERE
  3. Visit company website → scrape email, phone, description, tech stack
  4. Deep crawl /about, /team, /contact pages
  5. Check every major UK job board individually
  6. Companies House data via direct page scrape
  7. Store everything

Uses 10 parallel Playwright browsers for speed.
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
from playwright.async_api import async_playwright, Browser, BrowserContext

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("DEEP")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BROWSER_TABS = 20
SEARCH_DELAY = 1.0   # Between searches per tab

stats = {
    "processed": 0, "websites": 0, "linkedin": 0, "indeed": 0,
    "glassdoor": 0, "reed": 0, "totaljobs": 0, "cwjobs": 0,
    "trustpilot": 0, "facebook": 0, "twitter": 0, "github": 0,
    "careers": 0, "emails": 0, "phones": 0, "descriptions": 0,
    "jobs_found": 0, "news": 0, "ch_data": 0,
    "total": 0, "start": 0,
}


def clean_name(name: str) -> str:
    name = name.strip()
    for suffix in [" LIMITED", " LTD", " LTD.", " PLC", " LLP", " INC",
                   " CORP", " CORPORATION", " CO."]:
        if name.upper().endswith(suffix):
            name = name[:len(name) - len(suffix)].strip()
    return name


# ==========================================
# SEARCH ENGINE — extracts ALL platform links from one search
# ==========================================
async def search_and_extract(page, query: str) -> dict:
    """
    Search Google/Bing and categorize ALL result links by platform.
    One search gives us website, LinkedIn, Indeed, Glassdoor, Facebook, etc.
    """
    found = {
        "website": None, "linkedin": None, "indeed": None,
        "glassdoor": None, "reed": None, "totaljobs": None,
        "cwjobs": None, "trustpilot": None, "facebook": None,
        "twitter": None, "github": None, "crunchbase": None,
        "other_links": [],
    }

    results = await _do_search(page, query)

    PLATFORM_PATTERNS = {
        "linkedin": "linkedin.com/company",
        "indeed": "indeed.co.uk/cmp",
        "glassdoor": "glassdoor.co.uk",
        "reed": "reed.co.uk",
        "totaljobs": "totaljobs.com",
        "cwjobs": "cwjobs.co.uk",
        "trustpilot": "trustpilot.com/review",
        "facebook": "facebook.com",
        "twitter": ["x.com/", "twitter.com/"],
        "github": "github.com",
        "crunchbase": "crunchbase.com",
    }

    EXCLUDE_WEBSITE = {
        "linkedin.com", "indeed.com", "indeed.co.uk", "glassdoor.com",
        "glassdoor.co.uk", "reed.co.uk", "totaljobs.com", "cwjobs.co.uk",
        "trustpilot.com", "facebook.com", "twitter.com", "x.com",
        "github.com", "crunchbase.com", "wikipedia.org", "google.com",
        "bing.com", "companieshouse.gov.uk", "youtube.com", "instagram.com",
        "yell.com", "endole.co.uk", "duedil.com", "bloomberg.com",
        "gov.uk", "amazon.com", "ebay.co.uk", "pinterest.com",
    }

    for r in results:
        url = r.get("url", "")
        url_lower = url.lower()

        # Categorize by platform
        matched = False
        for platform, pattern in PLATFORM_PATTERNS.items():
            patterns = pattern if isinstance(pattern, list) else [pattern]
            for p in patterns:
                if p in url_lower and not found[platform]:
                    found[platform] = url
                    matched = True
                    break
            if matched:
                break

        # First non-platform link = likely company website
        if not matched and not found["website"]:
            try:
                domain = urlparse(url).netloc.lower().replace("www.", "")
                if domain and not any(ex in domain for ex in EXCLUDE_WEBSITE):
                    found["website"] = url
            except Exception:
                pass

    return found


async def _do_search(page, query: str) -> list[dict]:
    """Try Google first, fall back to Bing."""
    results = await _google_search(page, query)
    if not results:
        results = await _bing_search(page, query)
    return results


async def _google_search(page, query: str) -> list[dict]:
    results = []
    try:
        await page.goto(
            f"https://www.google.co.uk/search?q={quote_plus(query)}&num=20&hl=en",
            wait_until="domcontentloaded", timeout=12000,
        )
        # Handle consent
        try:
            btn = page.locator("button:has-text('Accept all'), button:has-text('I agree')")
            if await btn.count() > 0:
                await btn.first.click()
                await page.wait_for_load_state("domcontentloaded")
        except Exception:
            pass

        await page.wait_for_selector("div#search, div#rso", timeout=5000)

        results = await page.evaluate("""
            () => {
                const results = [];
                // Extract from cite elements (real URLs)
                document.querySelectorAll('div#search cite, div#rso cite').forEach(cite => {
                    let url = cite.innerText.trim();
                    if (url && url.includes('.') && !url.includes('google')) {
                        if (!url.startsWith('http')) url = 'https://' + url;
                        url = url.split(' ')[0].replace(/…$/, '');
                        const parent = cite.closest('div');
                        const h3 = parent ? parent.querySelector('h3') : null;
                        results.push({url, title: h3 ? h3.innerText : ''});
                    }
                });
                // Also get from actual <a> tags
                if (results.length < 5) {
                    document.querySelectorAll('div#search a[href], div#rso a[href]').forEach(a => {
                        const href = a.href;
                        if (href.startsWith('http') && !href.includes('google.') && a.innerText.length > 3) {
                            results.push({url: href, title: a.innerText.substring(0, 200)});
                        }
                    });
                }
                // Deduplicate by URL
                const seen = new Set();
                return results.filter(r => {
                    if (seen.has(r.url)) return false;
                    seen.add(r.url);
                    return true;
                }).slice(0, 20);
            }
        """)

        content = await page.content()
        if "unusual traffic" in content.lower() or "captcha" in content.lower():
            return await _bing_search(page, query)

    except Exception:
        return await _bing_search(page, query)
    return results


async def _bing_search(page, query: str) -> list[dict]:
    results = []
    try:
        await page.goto(
            f"https://www.bing.com/search?q={quote_plus(query)}&count=20",
            wait_until="domcontentloaded", timeout=12000,
        )
        await page.wait_for_selector("#b_results", timeout=5000)

        results = await page.evaluate("""
            () => {
                const results = [];
                document.querySelectorAll('#b_results .b_algo').forEach(item => {
                    const cite = item.querySelector('cite');
                    const titleEl = item.querySelector('h2 a');
                    if (cite && titleEl) {
                        let url = cite.innerText.trim();
                        if (!url.startsWith('http')) url = 'https://' + url;
                        url = url.split(' ')[0].replace(/\\u200e/g, '').replace(/…$/, '');
                        results.push({url, title: titleEl.innerText || ''});
                    }
                });
                return results.slice(0, 20);
            }
        """)
    except Exception:
        pass
    return results


# ==========================================
# WEBSITE DEEP CRAWL — scrape real content
# ==========================================
async def deep_crawl_website(page, url: str) -> dict:
    """Visit website and extract everything possible."""
    data = {}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=10000)

        info = await page.evaluate("""
            () => {
                const data = {};
                const body = document.body ? document.body.innerText : '';
                const html = document.documentElement.outerHTML;

                // Meta description
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) data.description = metaDesc.getAttribute('content');

                // Title
                data.title = document.title || '';

                // Emails from page
                const emailMatches = html.match(/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g);
                if (emailMatches) {
                    const filtered = emailMatches.filter(e =>
                        !e.includes('example.com') && !e.includes('sentry') &&
                        !e.includes('wixpress') && !e.includes('wordpress') &&
                        !e.includes('schema.org') && !e.includes('google')
                    );
                    if (filtered.length > 0) data.email = filtered[0];
                }

                // UK phone numbers
                const phoneMatches = html.match(/(?:0[1-9]\\d{8,9}|(?:\\+44|0044)\\s?\\d[\\d\\s]{8,12})/g);
                if (phoneMatches) data.phone = phoneMatches[0].trim();

                // Career/jobs links
                const careerLinks = [];
                document.querySelectorAll('a[href]').forEach(a => {
                    const text = (a.innerText || '').toLowerCase();
                    const href = (a.href || '').toLowerCase();
                    const keywords = ['career', 'jobs', 'vacanc', 'join us', 'join-us',
                                     'work with us', 'work-with-us', 'recruit', 'hiring',
                                     'opportunities', 'open positions'];
                    for (const kw of keywords) {
                        if (text.includes(kw) || href.includes(kw)) {
                            careerLinks.push(a.href);
                            break;
                        }
                    }
                });
                if (careerLinks.length > 0) data.careers_url = careerLinks[0];

                // Social links from page
                document.querySelectorAll('a[href]').forEach(a => {
                    const h = a.href || '';
                    if (h.includes('linkedin.com/company') && !data.linkedin) data.linkedin = h;
                    if (h.includes('twitter.com/') && !data.twitter) data.twitter = h;
                    if (h.includes('x.com/') && !data.x) data.x = h;
                    if (h.includes('facebook.com/') && !data.facebook) data.facebook = h;
                    if (h.includes('instagram.com/') && !data.instagram) data.instagram = h;
                    if (h.includes('youtube.com/') && !data.youtube) data.youtube = h;
                    if (h.includes('github.com/') && !data.github) data.github = h;
                    if (h.includes('glassdoor') && !data.glassdoor) data.glassdoor = h;
                    if (h.includes('indeed') && !data.indeed) data.indeed = h;
                    if (h.includes('trustpilot') && !data.trustpilot) data.trustpilot = h;
                });

                // Employee count hints
                const empMatch = body.match(/(\\d[\\d,]+)\\s*(?:employees?|staff|team members?|people)/i);
                if (empMatch) data.employee_hint = empMatch[0];

                // Founded year
                const foundedMatch = body.match(/(?:founded|established|since|est\\.?)\\s*(?:in\\s+)?(\\d{4})/i);
                if (foundedMatch) data.founded_year = foundedMatch[1];

                return data;
            }
        """)
        data = info or {}

    except Exception:
        pass
    return data


# ==========================================
# JOB SEARCH — find jobs posted ANYWHERE
# ==========================================
async def search_jobs_everywhere(page, company_name: str) -> list[dict]:
    """Search Google for company jobs to find postings on ANY board."""
    clean = clean_name(company_name)
    jobs = []

    results = await _do_search(page, f'"{clean}" jobs UK hiring 2026')

    JOB_DOMAINS = [
        "indeed.co.uk", "reed.co.uk", "totaljobs.com", "cwjobs.co.uk",
        "linkedin.com/jobs", "glassdoor.co.uk/job", "monster.co.uk",
        "cv-library.co.uk", "s1jobs.com", "jobsite.co.uk",
        "adzuna.co.uk", "jooble.org", "simplyhired.co.uk",
        "charityjob.co.uk", "healthjobsuk.com", "jobs.nhs.uk",
        "civilservicejobs.service.gov.uk", "teachingvacancies",
        "workable.com", "greenhouse.io", "lever.co", "breezy.hr",
        "smartrecruiters.com", "apply.workable.com",
    ]

    for r in results:
        url = r.get("url", "").lower()
        title = r.get("title", "")
        if any(jd in url for jd in JOB_DOMAINS):
            jobs.append({
                "source": next((jd.split('.')[0] for jd in JOB_DOMAINS if jd in url), "other"),
                "title": title[:200],
                "url": r["url"],
                "company": clean,
            })

    return jobs[:10]


# ==========================================
# COMPANIES HOUSE SCRAPE (no API key needed)
# ==========================================
async def scrape_companies_house(page, ch_number: str) -> dict:
    """Scrape Companies House web page for company data."""
    if not ch_number:
        return {}
    data = {}
    try:
        url = f"https://find-and-update.company-information.service.gov.uk/company/{ch_number}"
        await page.goto(url, wait_until="domcontentloaded", timeout=10000)

        info = await page.evaluate("""
            () => {
                const data = {};
                const text = document.body ? document.body.innerText : '';

                // Company status
                const statusEl = document.querySelector('#company-status');
                if (statusEl) data.status = statusEl.innerText.trim();

                // Company type
                const typeEl = document.querySelector('#company-type');
                if (typeEl) data.type = typeEl.innerText.trim();

                // Registered address
                const addrEl = document.querySelector('.registered-office-address');
                if (addrEl) data.address = addrEl.innerText.trim().replace(/\\n/g, ', ');

                // Incorporation date
                const incMatch = text.match(/Incorporated on\\s+(\\d{1,2}\\s+\\w+\\s+\\d{4})/);
                if (incMatch) data.incorporated = incMatch[1];

                // SIC codes
                const sicEls = document.querySelectorAll('.sic-code');
                if (sicEls.length > 0) {
                    data.sic_codes = Array.from(sicEls).map(e => e.innerText.trim());
                }

                // Nature of business from SIC
                const natureMatch = text.match(/Nature of business \\(SIC\\)\\s*([\\s\\S]*?)(?:Previous company names|Registered office address|$)/);
                if (natureMatch) {
                    data.nature = natureMatch[1].trim().split('\\n').filter(l => l.trim()).slice(0, 5);
                }

                return data;
            }
        """)
        data = info or {}
        if data:
            stats["ch_data"] += 1

    except Exception:
        pass
    return data


# ==========================================
# MAIN WORKER — one browser tab
# ==========================================
async def worker(worker_id: int, queue: asyncio.Queue, browser: Browser, sponsors_map: dict):
    context = await browser.new_context(
        viewport={"width": 1280, "height": 720},
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    )
    page = await context.new_page()
    # Block images/fonts/media for speed
    await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,mp4,mp3}", lambda route: route.abort())

    while True:
        try:
            company = queue.get_nowait()
        except asyncio.QueueEmpty:
            break

        sponsor = sponsors_map.get(company.get("sponsor_id"), {})
        name = sponsor.get("organisation_name", "")
        if not name:
            queue.task_done()
            continue

        clean = clean_name(name)
        updates = {}
        social = {}
        try:
            existing_social = json.loads(company.get("social_links") or "{}")
        except Exception:
            existing_social = {}

        try:
            # ===== STEP 1: Search for company — one search gets ALL platform links =====
            search_results = await search_and_extract(page, f"{clean} UK company")
            await asyncio.sleep(SEARCH_DELAY)

            # Website
            existing_website = company.get("website_url")
            if not existing_website and search_results.get("website"):
                updates["website_url"] = search_results["website"]
                existing_website = search_results["website"]
                stats["websites"] += 1

            # Platform links from search
            for platform in ["linkedin", "indeed", "glassdoor", "reed", "totaljobs",
                           "cwjobs", "trustpilot", "facebook", "twitter", "github", "crunchbase"]:
                if search_results.get(platform) and platform not in existing_social:
                    social[platform] = search_results[platform]
                    if platform in stats:
                        stats[platform] += 1

            # LinkedIn goes to dedicated column
            if search_results.get("linkedin") and not company.get("linkedin_url"):
                updates["linkedin_url"] = search_results["linkedin"]
                stats["linkedin"] += 1

            # ===== STEP 2: Deep crawl website =====
            if existing_website:
                crawl_data = await deep_crawl_website(page, existing_website)
                await asyncio.sleep(0.5)

                if crawl_data.get("email") and "contact_email" not in existing_social:
                    social["contact_email"] = crawl_data["email"]
                    stats["emails"] += 1
                if crawl_data.get("phone") and "contact_phone" not in existing_social:
                    social["contact_phone"] = crawl_data["phone"]
                    stats["phones"] += 1
                if crawl_data.get("description"):
                    social["website_description"] = crawl_data["description"][:500]
                    stats["descriptions"] += 1
                if crawl_data.get("title"):
                    social["website_title"] = crawl_data["title"][:200]
                if crawl_data.get("employee_hint"):
                    social["employee_hint"] = crawl_data["employee_hint"]
                if crawl_data.get("founded_year"):
                    social["founded_year"] = crawl_data["founded_year"]

                # Social links found ON the website (most reliable)
                for key in ["linkedin", "twitter", "x", "facebook", "instagram",
                           "youtube", "github", "glassdoor", "indeed", "trustpilot"]:
                    if crawl_data.get(key) and key not in existing_social and key not in social:
                        social[key] = crawl_data[key]

                # Career page from website crawl
                if crawl_data.get("careers_url") and not company.get("has_careers_page"):
                    updates["careers_page_url"] = crawl_data["careers_url"]
                    updates["has_careers_page"] = True
                    stats["careers"] += 1

            # ===== STEP 3: Search for jobs posted ANYWHERE =====
            jobs = await search_jobs_everywhere(page, name)
            await asyncio.sleep(SEARCH_DELAY)

            if jobs:
                stats["jobs_found"] += len(jobs)
                social["job_postings"] = [{"source": j["source"], "title": j["title"], "url": j["url"]} for j in jobs[:5]]

                # Insert jobs into jobs table
                for j in jobs[:5]:
                    try:
                        sb.table("jobs").insert({
                            "source": j["source"],
                            "source_url": j["url"],
                            "title_raw": j["title"],
                            "company_name_raw": j["company"],
                            "sponsor_id": company.get("sponsor_id"),
                            "sponsorship_likelihood": 75,
                            "scraped_at": datetime.now(timezone.utc).isoformat(),
                            "first_seen_at": datetime.now(timezone.utc).isoformat(),
                            "last_seen_at": datetime.now(timezone.utc).isoformat(),
                        }).execute()
                    except Exception:
                        pass  # Duplicate

            # ===== STEP 4: Companies House scrape =====
            ch_number = company.get("companies_house_number")
            if ch_number and "ch_status" not in existing_social:
                ch_data = await scrape_companies_house(page, ch_number)
                await asyncio.sleep(0.5)
                if ch_data:
                    if ch_data.get("status"):
                        updates["company_status"] = ch_data["status"]
                    if ch_data.get("type"):
                        updates["company_type"] = ch_data["type"]
                    if ch_data.get("incorporated"):
                        social["incorporated"] = ch_data["incorporated"]
                    if ch_data.get("address"):
                        updates["registered_address"] = ch_data["address"][:500]
                    if ch_data.get("sic_codes"):
                        updates["sic_codes"] = ch_data["sic_codes"]
                    if ch_data.get("nature"):
                        social["nature_of_business"] = ch_data["nature"]
                    social["ch_status"] = ch_data.get("status", "unknown")
                    social["companies_house_url"] = (
                        f"https://find-and-update.company-information.service.gov.uk/company/{ch_number}"
                    )

        except Exception as e:
            logger.debug(f"  Worker {worker_id}: {clean}: {str(e)[:80]}")

        # ===== SAVE EVERYTHING =====
        if social:
            merged = {**existing_social, **social}
            updates["social_links"] = json.dumps(merged)

        if updates:
            try:
                sb.table("company_profiles").update(updates).eq("id", company["id"]).execute()
            except Exception:
                pass

        stats["processed"] += 1
        queue.task_done()

        if stats["processed"] % 50 == 0:
            elapsed = time.time() - stats["start"]
            rate = stats["processed"] / max(1, elapsed)
            remaining = (stats["total"] - stats["processed"]) / max(0.01, rate)
            logger.info(
                f"  [{stats['processed']:,}/{stats['total']:,}] "
                f"W:{stats['websites']:,} LI:{stats['linkedin']:,} "
                f"IN:{stats['indeed']:,} GD:{stats['glassdoor']:,} "
                f"RD:{stats['reed']:,} TJ:{stats['totaljobs']:,} "
                f"TP:{stats['trustpilot']:,} FB:{stats['facebook']:,} "
                f"TW:{stats['twitter']:,} GH:{stats['github']:,} "
                f"C:{stats['careers']:,} E:{stats['emails']:,} P:{stats['phones']:,} "
                f"J:{stats['jobs_found']:,} CH:{stats['ch_data']:,} | "
                f"{rate:.1f}/s | ETA {remaining/60:.0f}m"
            )

    await context.close()


def _fetch_page(table, select, start, end, retries=3):
    import time as _time
    for attempt in range(retries):
        try:
            return sb.table(table).select(select).range(start, end).execute()
        except Exception:
            if attempt < retries - 1:
                _time.sleep(2)
            else:
                return type('R', (), {'data': []})()


async def main():
    stats["start"] = time.time()

    logger.info("=" * 70)
    logger.info("  DEEP SEARCH — DATA THAT NO ONE ELSE HAS")
    logger.info("=" * 70)
    logger.info(f"  {BROWSER_TABS} parallel browsers | Real Google/Bing search")
    logger.info("  Per company: search + website crawl + job search + CH scrape")
    logger.info("")

    # Load sponsors
    logger.info("  Loading sponsors...")
    sponsors_map = {}
    page = 0
    while True:
        result = _fetch_page("sponsors", "id, organisation_name", page * 1000, (page + 1) * 1000 - 1)
        if not result.data:
            break
        for s in result.data:
            sponsors_map[s["id"]] = s
        if len(result.data) < 1000:
            break
        page += 1
    logger.info(f"  Loaded {len(sponsors_map):,} sponsors")

    # Load ALL profiles
    logger.info("  Loading profiles...")
    profiles = []
    page = 0
    while True:
        result = _fetch_page(
            "company_profiles",
            "id, sponsor_id, companies_house_number, website_url, linkedin_url, has_careers_page, social_links",
            page * 1000, (page + 1) * 1000 - 1,
        )
        if not result.data:
            break
        profiles.extend(result.data)
        if len(result.data) < 1000:
            break
        page += 1
        if page % 50 == 0:
            logger.info(f"    {len(profiles):,} loaded...")

    logger.info(f"  Loaded {len(profiles):,} profiles")
    stats["total"] = len(profiles)

    # Fill queue
    queue = asyncio.Queue()
    for p in profiles:
        queue.put_nowait(p)

    logger.info(f"  Browser tabs: {BROWSER_TABS}")
    logger.info("=" * 70)

    # Launch browsers
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        workers = [
            worker(i + 1, queue, browser, sponsors_map)
            for i in range(BROWSER_TABS)
        ]
        await asyncio.gather(*workers)
        await browser.close()

    elapsed = time.time() - stats["start"]

    logger.info("=" * 70)
    logger.info("  DEEP SEARCH — FINAL REPORT")
    logger.info("=" * 70)
    logger.info(f"  Processed:     {stats['processed']:,}")
    logger.info(f"  Websites:      {stats['websites']:,}")
    logger.info(f"  LinkedIn:      {stats['linkedin']:,}")
    logger.info(f"  Indeed:        {stats['indeed']:,}")
    logger.info(f"  Glassdoor:     {stats['glassdoor']:,}")
    logger.info(f"  Reed:          {stats['reed']:,}")
    logger.info(f"  TotalJobs:     {stats['totaljobs']:,}")
    logger.info(f"  Trustpilot:    {stats['trustpilot']:,}")
    logger.info(f"  Facebook:      {stats['facebook']:,}")
    logger.info(f"  Twitter/X:     {stats['twitter']:,}")
    logger.info(f"  GitHub:        {stats['github']:,}")
    logger.info(f"  Careers pages: {stats['careers']:,}")
    logger.info(f"  Emails:        {stats['emails']:,}")
    logger.info(f"  Phones:        {stats['phones']:,}")
    logger.info(f"  Jobs found:    {stats['jobs_found']:,}")
    logger.info(f"  CH enriched:   {stats['ch_data']:,}")
    logger.info(f"  Time:          {elapsed/60:.1f} min")
    logger.info(f"  Rate:          {stats['processed']/max(1,elapsed):.1f}/s")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
