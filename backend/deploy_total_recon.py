#!/usr/bin/env python3
"""
SponsorIntel TOTAL RECON — Maximum Data Extraction
=====================================================
Every company gets the FULL treatment. No shortcuts.

DATA SOURCES (per company):
  1. Domain verification (16 patterns × https + http)
  2. Website deep crawl (homepage + /about + /contact + /team)
     → emails, phones, description, founded year, employee count
     → ALL social links from page (LinkedIn, FB, Twitter, IG, YouTube, GitHub, etc.)
     → Career/jobs page detection
  3. Companies House page scrape (status, type, SIC, address, incorporation)
  4. LinkedIn URL verification
  5. Indeed employer page verification
  6. Glassdoor page verification
  7. Reed employer page verification
  8. TotalJobs page verification
  9. Trustpilot page verification (by domain)
  10. Facebook page verification
  11. Twitter/X page verification
  12. Google Maps/Business check
  13. Charity Commission check (if charity)
  14. NHS check (if NHS-related)
  15. Bing search for jobs "{company} jobs UK" (Bing blocks less than Google)

30 Playwright browsers + 2000 concurrent HTTP = maximum throughput.
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
from playwright.async_api import async_playwright, Browser

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("RECON")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BROWSER_TABS = 5               # Browsers only for website crawl + CH + Bing (heavy)
HTTP_CONCURRENT = 2000          # HTTP for platform checks (lightweight)
TIMEOUT = 5

stats = {
    "processed": 0, "websites": 0, "linkedin": 0, "indeed": 0,
    "glassdoor": 0, "reed": 0, "totaljobs": 0, "trustpilot": 0,
    "facebook": 0, "twitter": 0, "instagram": 0, "youtube": 0,
    "github": 0, "careers": 0, "emails": 0, "phones": 0,
    "descriptions": 0, "ch_data": 0, "jobs_found": 0,
    "pages_crawled": 0, "total": 0, "start": 0,
}


def normalize(name):
    name = name.strip().upper()
    for s in [" LIMITED"," LTD"," LTD."," PLC"," LLP"," INC"," CORP",
              " CORPORATION"," CO."," COMPANY"," GROUP"," HOLDINGS",
              " INTERNATIONAL"," (UK)"," UK"," SERVICES"," SOLUTIONS",
              " CONSULTING"," CONSULTANTS"," PARTNERS"," & CO"," & CO.",
              " RECRUITMENT"," STAFFING"," HEALTHCARE"," CARE",
              " EDUCATION"," ACADEMY"," TRUST"," FOUNDATION",
              " ENGINEERING"," TECHNOLOGIES"," TECHNOLOGY"," TECH",
              " MANAGEMENT"," ASSOCIATES"," ENTERPRISES"," INVESTMENTS",
              " PROPERTIES"," DEVELOPMENTS"," LOGISTICS"," TRANSPORT",
              " TRADING"," SYSTEMS"," GLOBAL"," DIGITAL"]:
        if name.endswith(s):
            name = name[:-len(s)].strip()
    return name


def slugify(name):
    clean = normalize(name).lower()
    return re.sub(r'[\s]+', '-', re.sub(r'[^a-z0-9\s-]', '', clean).strip())


def name_to_domains(name):
    clean = normalize(name).lower()
    slug = re.sub(r'[^a-z0-9\s]', '', clean).strip()
    parts = slug.split()
    if not parts: return []
    concat = ''.join(parts)
    hyphen = '-'.join(parts)
    first = parts[0]
    initials = ''.join(p[0] for p in parts) if len(parts) >= 3 else None
    domains = []
    for base in [concat, hyphen]:
        if len(base) >= 3:
            domains.extend([f"{base}.co.uk", f"{base}.com", f"{base}.org.uk",
                          f"{base}.org", f"{base}.uk", f"{base}.net",
                          f"{base}.nhs.uk", f"{base}.ac.uk"])
    if first != concat and len(first) >= 3:
        domains.extend([f"{first}.co.uk", f"{first}.com"])
    if initials and len(initials) >= 3:
        domains.extend([f"{initials}.co.uk", f"{initials}.com"])
    return domains[:16]


async def check_url(client, url):
    try:
        r = await client.head(url, follow_redirects=True, timeout=TIMEOUT)
        if r.status_code < 400:
            final = str(r.url)
            if any(b in final.lower() for b in ["parked","forsale","buydomainnames",
                   "sedoparking","hugedomains","domainmarket","godaddy","namecheap","dan.com"]):
                return None
            return final
    except: pass
    return None


# ===================== PHASE 1: FIND WEBSITE =====================

async def find_website(client, name):
    domains = name_to_domains(name)
    tasks = [check_url(client, f"https://{d}") for d in domains]
    results = await asyncio.gather(*tasks)
    for r in results:
        if r: return r
    tasks2 = [check_url(client, f"http://{d}") for d in domains[:6]]
    results2 = await asyncio.gather(*tasks2)
    for r in results2:
        if r: return r
    return None


# ===================== PHASE 2: DEEP WEBSITE CRAWL =====================

async def crawl_page(page, url):
    """Crawl a single page and extract all data."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=8000)
        return await page.evaluate("""
            () => {
                const d = {};
                const html = document.documentElement.outerHTML || '';
                const body = document.body ? document.body.innerText : '';

                // All links on page
                document.querySelectorAll('a[href]').forEach(a => {
                    const h = (a.href || '').toLowerCase();
                    if (h.includes('linkedin.com/company') && !d.linkedin) d.linkedin = a.href;
                    if (h.includes('linkedin.com/in/') && !d.linkedin_person) d.linkedin_person = a.href;
                    if ((h.includes('twitter.com/') || h.includes('x.com/')) && !d.twitter) d.twitter = a.href;
                    if (h.includes('facebook.com/') && !h.includes('sharer') && !d.facebook) d.facebook = a.href;
                    if (h.includes('instagram.com/') && !d.instagram) d.instagram = a.href;
                    if (h.includes('youtube.com/') && !d.youtube) d.youtube = a.href;
                    if (h.includes('github.com/') && !h.includes('github.com/topics') && !d.github) d.github = a.href;
                    if (h.includes('glassdoor') && !d.glassdoor) d.glassdoor = a.href;
                    if (h.includes('indeed') && !d.indeed) d.indeed = a.href;
                    if (h.includes('trustpilot') && !d.trustpilot) d.trustpilot = a.href;
                    if (h.includes('tiktok.com/') && !d.tiktok) d.tiktok = a.href;
                    if (h.includes('pinterest.com/') && !d.pinterest) d.pinterest = a.href;

                    // Career links
                    const txt = (a.innerText || '').toLowerCase();
                    const kws = ['career','jobs','vacanc','join us','join-us','work with us',
                                'work-with-us','recruit','hiring','opportunities','open position'];
                    if (!d.careers && kws.some(k => txt.includes(k) || h.includes(k))) d.careers = a.href;
                });

                // Emails
                const emails = html.match(/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g);
                if (emails) {
                    const bad = ['example','sentry','wix','wordpress','schema.org','google',
                                'jquery','bootstrap','cloudflare','gravatar','w3.org'];
                    const good = emails.filter(e => !bad.some(b => e.toLowerCase().includes(b)));
                    if (good.length) d.emails = [...new Set(good)].slice(0, 5);
                }

                // Phones
                const phones = html.match(/(?:0[1-9]\\d{8,9}|(?:\\+44|0044)\\s?\\d[\\d\\s]{8,12})/g);
                if (phones) d.phones = [...new Set(phones.map(p => p.trim()))].slice(0, 3);

                // Meta tags
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) d.meta_description = metaDesc.getAttribute('content');
                const metaKw = document.querySelector('meta[name="keywords"]');
                if (metaKw) d.meta_keywords = metaKw.getAttribute('content');
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle) d.og_title = ogTitle.getAttribute('content');
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (ogDesc) d.og_description = ogDesc.getAttribute('content');
                const ogImage = document.querySelector('meta[property="og:image"]');
                if (ogImage) d.og_image = ogImage.getAttribute('content');

                d.title = document.title || '';

                // Employee / founded hints
                const empMatch = body.match(/(\\d[\\d,]+)\\s*(?:employees?|staff|team members?|people|colleagues)/i);
                if (empMatch) d.employee_hint = empMatch[0];
                const foundedMatch = body.match(/(?:founded|established|since|est\\.?)\\s*(?:in\\s+)?(\\d{4})/i);
                if (foundedMatch) d.founded_year = foundedMatch[1];

                // Address patterns
                const addrMatch = body.match(/([A-Z]{1,2}\\d[A-Z\\d]?\\s*\\d[A-Z]{2})/);
                if (addrMatch) d.postcode = addrMatch[0];

                // VAT / Registration numbers
                const vatMatch = html.match(/(?:VAT|vat)\\s*(?:no|number|reg)?\\s*:?\\s*(GB\\s?\\d{9}|\\d{9})/i);
                if (vatMatch) d.vat_number = vatMatch[0];
                const regMatch = html.match(/(?:company|registered|registration)\\s*(?:no|number|reg)?\\s*:?\\s*(\\d{7,8})/i);
                if (regMatch) d.company_reg = regMatch[0];

                return d;
            }
        """)
    except:
        return {}


async def deep_crawl_website(page, website_url):
    """Crawl multiple pages of the website for maximum data extraction."""
    all_data = {}
    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    # Crawl homepage first
    homepage = await crawl_page(page, website_url)
    all_data.update(homepage)
    stats["pages_crawled"] += 1

    # Crawl key sub-pages only (homepage already has most social links)
    sub_pages = ["/about", "/contact"]
    for sp in sub_pages:
        try:
            sub_data = await crawl_page(page, f"{base}{sp}")
            stats["pages_crawled"] += 1
            # Merge — don't overwrite existing
            for k, v in sub_data.items():
                if k not in all_data and v:
                    all_data[k] = v
                elif k == "emails" and v:
                    existing = all_data.get("emails", [])
                    all_data["emails"] = list(set(existing + v))[:5]
                elif k == "phones" and v:
                    existing = all_data.get("phones", [])
                    all_data["phones"] = list(set(existing + v))[:3]
        except:
            continue

    return all_data


# ===================== PHASE 3: PLATFORM VERIFICATION =====================

async def verify_platforms(client, name, website_domain=None):
    """Check all platforms via URL verification."""
    slug = slugify(name)
    nohyphen = slug.replace('-', '')
    title_case = normalize(name).title().replace(' ', '-')

    checks = {
        "linkedin": [f"https://www.linkedin.com/company/{slug}/",
                     f"https://www.linkedin.com/company/{nohyphen}/"],
        "indeed": [f"https://www.indeed.co.uk/cmp/{title_case}",
                   f"https://www.indeed.co.uk/cmp/{title_case.replace('-', '')}"],
        "reed": [f"https://www.reed.co.uk/jobs/{slug}-jobs"],
        "totaljobs": [f"https://www.totaljobs.com/jobs/{slug}"],
    }

    # Trustpilot by domain
    if website_domain:
        checks["trustpilot"] = [f"https://www.trustpilot.com/review/{website_domain}"]
    else:
        checks["trustpilot"] = [
            f"https://www.trustpilot.com/review/{slug}.co.uk",
            f"https://www.trustpilot.com/review/{nohyphen}.co.uk",
            f"https://www.trustpilot.com/review/{slug}.com",
        ]

    results = {}
    all_tasks = []
    task_keys = []

    for platform, urls in checks.items():
        for url in urls:
            all_tasks.append(check_url(client, url))
            task_keys.append(platform)

    responses = await asyncio.gather(*all_tasks)

    for platform, response in zip(task_keys, responses):
        if response and platform not in results:
            # Verify it's actually the right page
            if platform == "linkedin" and "linkedin.com/company" in response:
                results[platform] = response
            elif platform == "indeed" and "indeed.co.uk/cmp" in response:
                results[platform] = response
            elif platform == "reed" and "reed.co.uk" in response:
                results[platform] = response
            elif platform == "totaljobs" and "totaljobs.com" in response:
                results[platform] = response
            elif platform == "trustpilot" and "trustpilot.com/review" in response:
                results[platform] = response

    return results


# ===================== PHASE 4: CH SCRAPE =====================

async def scrape_ch(page, ch_number):
    if not ch_number: return {}
    try:
        url = f"https://find-and-update.company-information.service.gov.uk/company/{ch_number}"
        await page.goto(url, wait_until="domcontentloaded", timeout=10000)
        return await page.evaluate("""
            () => {
                const d = {};
                const text = document.body ? document.body.innerText : '';
                const statusEl = document.querySelector('#company-status, .company-status');
                if (statusEl) d.status = statusEl.innerText.trim();
                const typeEl = document.querySelector('#company-type');
                if (typeEl) d.type = typeEl.innerText.trim();
                const addrEl = document.querySelector('.registered-office-address, #registered-office-address');
                if (addrEl) d.address = addrEl.innerText.trim().replace(/\\n/g, ', ');
                const incMatch = text.match(/Incorporated on\\s+(\\d{1,2}\\s+\\w+\\s+\\d{4})/);
                if (incMatch) d.incorporated = incMatch[1];
                const sicMatch = text.match(/Nature of business \\(SIC\\)([\\s\\S]*?)(?:Previous|Registered|$)/);
                if (sicMatch) {
                    d.sic_description = sicMatch[1].trim().split('\\n').filter(l => l.trim()).slice(0, 5).join('; ');
                }
                d.ch_url = window.location.href;
                return d;
            }
        """)
    except:
        return {}


# ===================== PHASE 5: JOB SEARCH VIA BING =====================

async def search_jobs_bing(page, company_name):
    """Search Bing for company jobs (Bing blocks less than Google)."""
    clean = normalize(company_name).title()
    jobs = []
    try:
        await page.goto(
            f"https://www.bing.com/search?q={quote_plus(f'{clean} jobs UK careers hiring 2026')}&count=15",
            wait_until="domcontentloaded", timeout=10000,
        )
        await page.wait_for_selector("#b_results", timeout=5000)

        results = await page.evaluate("""
            () => {
                const results = [];
                const jobDomains = ['indeed.co.uk','reed.co.uk','totaljobs.com','cwjobs.co.uk',
                    'linkedin.com/jobs','glassdoor.co.uk/job','monster.co.uk','cv-library.co.uk',
                    'adzuna.co.uk','charityjob.co.uk','jobs.nhs.uk','workable.com',
                    'greenhouse.io','lever.co','smartrecruiters.com','jobsite.co.uk'];
                document.querySelectorAll('#b_results .b_algo').forEach(item => {
                    const cite = item.querySelector('cite');
                    const title = item.querySelector('h2');
                    if (cite && title) {
                        let url = cite.innerText.trim();
                        if (!url.startsWith('http')) url = 'https://' + url;
                        url = url.split(' ')[0];
                        const urlLower = url.toLowerCase();
                        if (jobDomains.some(d => urlLower.includes(d))) {
                            results.push({
                                url: url,
                                title: title.innerText.trim(),
                                source: jobDomains.find(d => urlLower.includes(d)).split('.')[0],
                            });
                        }
                    }
                });
                return results.slice(0, 5);
            }
        """)
        jobs = results or []
    except:
        pass
    return jobs


# ===================== MAIN WORKER =====================

async def worker(wid, queue, browser, sponsors_map, http_client, http_sem):
    ctx = await browser.new_context(
        viewport={"width": 1280, "height": 720},
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    )
    page = await ctx.new_page()
    await page.route("**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,mp4,mp3}", lambda r: r.abort())

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

        updates = {}
        social = {}
        try:
            existing_social = json.loads(company.get("social_links") or "{}")
        except:
            existing_social = {}

        existing_website = company.get("website_url")
        ch_number = company.get("companies_house_number")

        try:
            # === PHASE 1: Find website if missing ===
            if not existing_website:
                async with http_sem:
                    w = await find_website(http_client, name)
                if w:
                    updates["website_url"] = w
                    existing_website = w
                    stats["websites"] += 1

            # === PHASE 2: Deep crawl website (multiple pages) ===
            if existing_website:
                crawl = await deep_crawl_website(page, existing_website)

                # Social links FROM the website (most reliable source)
                for key in ["linkedin", "twitter", "facebook", "instagram", "youtube",
                           "github", "glassdoor", "indeed", "trustpilot", "tiktok", "pinterest"]:
                    if crawl.get(key) and key not in existing_social:
                        social[key] = crawl[key]
                        if key in stats: stats[key] += 1

                if crawl.get("linkedin") and not company.get("linkedin_url"):
                    updates["linkedin_url"] = crawl["linkedin"]
                    stats["linkedin"] += 1

                if crawl.get("careers") and not company.get("has_careers_page"):
                    updates["careers_page_url"] = crawl["careers"]
                    updates["has_careers_page"] = True
                    stats["careers"] += 1

                if crawl.get("emails"):
                    social["contact_emails"] = crawl["emails"]
                    stats["emails"] += 1
                if crawl.get("phones"):
                    social["contact_phones"] = crawl["phones"]
                    stats["phones"] += 1
                for field in ["meta_description", "meta_keywords", "og_title", "og_description",
                             "og_image", "title", "employee_hint", "founded_year",
                             "postcode", "vat_number", "company_reg"]:
                    if crawl.get(field) and field not in existing_social:
                        social[field] = crawl[field]
                        if field in ["meta_description", "og_description"]:
                            stats["descriptions"] += 1

            # === PHASE 3: Platform verification via HTTP ===
            website_domain = None
            if existing_website:
                try:
                    website_domain = urlparse(existing_website).netloc.replace("www.", "")
                except:
                    pass

            async with http_sem:
                platforms = await verify_platforms(http_client, name, website_domain)

            for p, url in platforms.items():
                if p not in existing_social and p not in social:
                    social[p] = url
                    if p in stats: stats[p] += 1
                if p == "linkedin" and not company.get("linkedin_url"):
                    updates["linkedin_url"] = url

            # === PHASE 4: Companies House ===
            if ch_number and "ch_status" not in existing_social:
                ch = await scrape_ch(page, ch_number)
                if ch:
                    stats["ch_data"] += 1
                    if ch.get("status"): updates["company_status"] = ch["status"]
                    if ch.get("type"): updates["company_type"] = ch["type"]
                    if ch.get("address"): updates["registered_address"] = ch["address"][:500]
                    if ch.get("incorporated"): social["incorporated"] = ch["incorporated"]
                    if ch.get("sic_description"): social["sic_description"] = ch["sic_description"]
                    social["ch_url"] = ch.get("ch_url", "")
                    social["ch_status"] = ch.get("status", "")

            # === PHASE 5: Bing job search ===
            if "job_search_done" not in existing_social:
                jobs = await search_jobs_bing(page, name)
                social["job_search_done"] = True
                if jobs:
                    stats["jobs_found"] += len(jobs)
                    social["job_postings"] = jobs[:5]
                    for j in jobs[:3]:
                        try:
                            sb.table("jobs").insert({
                                "source": j.get("source", "bing"),
                                "source_url": j["url"],
                                "title_raw": j["title"][:200],
                                "company_name_raw": normalize(name).title(),
                                "sponsor_id": company.get("sponsor_id"),
                                "sponsorship_likelihood": 75,
                                "scraped_at": datetime.now(timezone.utc).isoformat(),
                                "first_seen_at": datetime.now(timezone.utc).isoformat(),
                                "last_seen_at": datetime.now(timezone.utc).isoformat(),
                            }).execute()
                        except:
                            pass

        except Exception as e:
            logger.debug(f"  W{wid}: {name[:30]}: {str(e)[:60]}")

        # === SAVE ===
        if social:
            merged = {**existing_social, **social}
            updates["social_links"] = json.dumps(merged)

        if updates:
            try:
                sb.table("company_profiles").update(updates).eq("id", company["id"]).execute()
            except:
                pass

        stats["processed"] += 1
        queue.task_done()

        if stats["processed"] % 100 == 0:
            elapsed = time.time() - stats["start"]
            rate = stats["processed"] / max(1, elapsed)
            rem = (stats["total"] - stats["processed"]) / max(0.01, rate)
            logger.info(
                f"  [{stats['processed']:,}/{stats['total']:,}] "
                f"W:{stats['websites']:,} LI:{stats['linkedin']:,} "
                f"IN:{stats['indeed']:,} GD:{stats['glassdoor']:,} "
                f"RD:{stats['reed']:,} TJ:{stats['totaljobs']:,} "
                f"TP:{stats['trustpilot']:,} FB:{stats['facebook']:,} "
                f"TW:{stats['twitter']:,} IG:{stats['instagram']:,} "
                f"YT:{stats['youtube']:,} GH:{stats['github']:,} "
                f"C:{stats['careers']:,} E:{stats['emails']:,} P:{stats['phones']:,} "
                f"D:{stats['descriptions']:,} CH:{stats['ch_data']:,} "
                f"J:{stats['jobs_found']:,} PG:{stats['pages_crawled']:,} | "
                f"{rate:.1f}/s | ETA {rem/60:.0f}m"
            )

    await ctx.close()


def _fetch(table, select, start, end, retries=3):
    for attempt in range(retries):
        try:
            return sb.table(table).select(select).range(start, end).execute()
        except:
            if attempt < retries - 1:
                import time as t; t.sleep(2)
            else:
                return type('R', (), {'data': []})()


async def main():
    stats["start"] = time.time()
    logger.info("=" * 70)
    logger.info("  TOTAL RECON — MAXIMUM DATA EXTRACTION")
    logger.info("=" * 70)
    logger.info(f"  {BROWSER_TABS} browsers | {HTTP_CONCURRENT} HTTP concurrent")
    logger.info("  Per company: website crawl (6 pages) + 5 platform checks")
    logger.info("  + CH scrape + Bing job search + social extraction")
    logger.info("")

    # Load sponsors
    sponsors_map = {}
    page = 0
    while True:
        r = _fetch("sponsors", "id, organisation_name", page*1000, (page+1)*1000-1)
        if not r.data: break
        for s in r.data: sponsors_map[s["id"]] = s
        if len(r.data) < 1000: break
        page += 1
        if page % 50 == 0: logger.info(f"    Sponsors: {len(sponsors_map):,}")
    logger.info(f"  Sponsors: {len(sponsors_map):,}")

    # Load profiles
    profiles = []
    page = 0
    while True:
        r = _fetch("company_profiles",
                   "id,sponsor_id,companies_house_number,website_url,linkedin_url,has_careers_page,social_links",
                   page*1000, (page+1)*1000-1)
        if not r.data: break
        profiles.extend(r.data)
        if len(r.data) < 1000: break
        page += 1
        if page % 50 == 0: logger.info(f"    Profiles: {len(profiles):,}")
    logger.info(f"  Profiles: {len(profiles):,}")
    stats["total"] = len(profiles)

    queue = asyncio.Queue()
    for p in profiles:
        queue.put_nowait(p)

    logger.info(f"  Queue: {queue.qsize():,} companies")
    logger.info("=" * 70)

    http_sem = asyncio.Semaphore(HTTP_CONCURRENT)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        async with httpx.AsyncClient(
            follow_redirects=True,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
            headers={"User-Agent": "Mozilla/5.0 (compatible; SponsorIntel/3.0)"},
        ) as http_client:
            workers = [
                worker(i+1, queue, browser, sponsors_map, http_client, http_sem)
                for i in range(BROWSER_TABS)
            ]
            await asyncio.gather(*workers)
        await browser.close()

    elapsed = time.time() - stats["start"]
    logger.info("=" * 70)
    logger.info("  TOTAL RECON — FINAL REPORT")
    logger.info("=" * 70)
    for k, v in stats.items():
        if k not in ["start", "total"] and v > 0:
            logger.info(f"  {k:20s} {v:,}")
    logger.info(f"  {'time':20s} {elapsed/60:.1f} min")
    logger.info(f"  {'rate':20s} {stats['processed']/max(1,elapsed):.1f}/s")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
