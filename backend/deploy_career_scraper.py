#!/usr/bin/env python3
"""
SponsorIntel CAREER PAGE SCRAPER — Jobs directly from sponsor companies
========================================================================
This is the REAL data. Not third-party boards. The actual jobs that
sponsor companies have posted on their own websites.

1. Visit every discovered careers page (568+)
2. Visit every company website and look for job listings
3. Extract actual job titles, descriptions, links
4. Also search Indeed for each company with a website
5. Store as first-party sponsor jobs (highest value)
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import quote_plus, urlparse, urljoin

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from playwright.async_api import async_playwright, Browser

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("CAREERS")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BROWSER_TABS = 10

stats = {
    "companies_scraped": 0, "jobs_found": 0, "jobs_saved": 0,
    "pages_crawled": 0, "indeed_jobs": 0, "total": 0, "start": 0,
}


async def extract_jobs_from_page(page, url, company_name, sponsor_id) -> list[dict]:
    """Visit a page and extract all job listings from it."""
    jobs = []
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=12000)
        stats["pages_crawled"] += 1

        # Extract job-like content from the page
        extracted = await page.evaluate("""
            () => {
                const jobs = [];
                const seen = new Set();

                // Strategy 1: Look for links with job-related text
                document.querySelectorAll('a[href]').forEach(a => {
                    const text = (a.innerText || '').trim();
                    const href = a.href || '';
                    // Skip navigation/social/tiny links
                    if (text.length < 5 || text.length > 200) return;
                    if (href.includes('linkedin.com') || href.includes('facebook.com') ||
                        href.includes('twitter.com') || href.includes('instagram.com')) return;

                    // Job indicators in the link text or URL
                    const combined = (text + ' ' + href).toLowerCase();
                    const jobWords = ['apply', 'vacancy', 'position', 'role', 'job', 'career',
                                     'opening', 'opportunity', 'recruit', 'hiring', 'join',
                                     'engineer', 'manager', 'analyst', 'developer', 'nurse',
                                     'doctor', 'teacher', 'accountant', 'consultant', 'officer',
                                     'coordinator', 'specialist', 'advisor', 'assistant', 'director',
                                     'supervisor', 'lead', 'senior', 'junior', 'intern',
                                     'full-time', 'part-time', 'permanent', 'contract', 'temporary'];

                    if (jobWords.some(w => combined.includes(w))) {
                        const key = text.substring(0, 50);
                        if (!seen.has(key)) {
                            seen.add(key);
                            jobs.push({title: text, url: href});
                        }
                    }
                });

                // Strategy 2: Look for structured job listings (common patterns)
                // Many career pages use <li>, <article>, <div> with class containing 'job', 'vacancy', 'position'
                const jobContainers = document.querySelectorAll(
                    '[class*="job"], [class*="vacancy"], [class*="position"], ' +
                    '[class*="opening"], [class*="career"], [class*="role"], ' +
                    '[data-job], [data-vacancy], [data-position]'
                );

                jobContainers.forEach(container => {
                    const titleEl = container.querySelector('h1, h2, h3, h4, a');
                    if (titleEl) {
                        const text = titleEl.innerText.trim();
                        const link = titleEl.closest('a')?.href || container.querySelector('a')?.href || '';
                        if (text.length >= 5 && text.length <= 200) {
                            const key = text.substring(0, 50);
                            if (!seen.has(key)) {
                                seen.add(key);
                                // Get extra info
                                const locationEl = container.querySelector('[class*="location"], [class*="place"]');
                                const salaryEl = container.querySelector('[class*="salary"], [class*="pay"]');
                                jobs.push({
                                    title: text,
                                    url: link,
                                    location: locationEl ? locationEl.innerText.trim() : '',
                                    salary: salaryEl ? salaryEl.innerText.trim() : '',
                                });
                            }
                        }
                    }
                });

                // Strategy 3: Look for ATS iframes (Workable, Greenhouse, Lever, BreezyHR)
                document.querySelectorAll('iframe').forEach(iframe => {
                    const src = iframe.src || '';
                    if (src.includes('workable.com') || src.includes('greenhouse.io') ||
                        src.includes('lever.co') || src.includes('breezyhr.com') ||
                        src.includes('smartrecruiters.com') || src.includes('recruitee.com') ||
                        src.includes('ashbyhq.com') || src.includes('bamboohr.com')) {
                        jobs.push({title: '[ATS EMBED: ' + src.split('/')[2] + ']', url: src, is_ats: true});
                    }
                });

                return jobs.slice(0, 50);
            }
        """)

        for item in (extracted or []):
            title = item.get("title", "").strip()
            job_url = item.get("url", "")

            # Aggressive filter — skip anything that isn't a real job title
            skip_words = [
                # Navigation & UI elements
                "cookie", "privacy", "terms", "about us", "about", "contact",
                "home", "login", "sign in", "register", "blog", "news", "menu",
                "read more", "learn more", "click here", "view all", "accept",
                "more options", "save my", "skip to", "subscribe", "newsletter",
                "follow us", "share", "download", "upload", "settings", "preferences",
                "close", "back to", "loading", "submit", "navigation", "search",
                "enquire", "complete the form", "get in touch", "find us", "join us",
                "our team", "our story", "who we are", "what we do", "our work",
                "location finder", "gallery", "portfolio", "faq", "help", "support",
                "pricing", "features", "services", "products", "solutions",
                # Social / misc
                "facebook", "twitter", "instagram", "linkedin", "youtube",
                "forgot password", "user agreement", "join now",
                # Common page section headers
                "careers", "vacancies", "the lab",
            ]
            title_lower = title.lower()
            if any(sw in title_lower for sw in skip_words):
                continue

            # Skip very short titles (likely nav links)
            if len(title) < 10:
                continue

            # Skip titles that are ALL CAPS single words (nav items)
            if title.isupper() and len(title.split()) <= 2 and len(title) < 30:
                continue

            # Skip if title looks like a URL or CSS
            if title.startswith(('#', '.', 'http', 'www', 'mailto')):
                continue

            # Make URL absolute
            if job_url and not job_url.startswith("http"):
                job_url = urljoin(url, job_url)

            jobs.append({
                "title": title[:200],
                "url": job_url,
                "location": item.get("location", ""),
                "salary": item.get("salary", ""),
                "is_ats": item.get("is_ats", False),
                "company": company_name,
                "sponsor_id": sponsor_id,
                "source_page": url,
            })

    except Exception as e:
        logger.debug(f"  Error crawling {url}: {str(e)[:80]}")

    return jobs


async def search_indeed_for_company(page, company_name, sponsor_id) -> list[dict]:
    """Search Indeed UK for this specific company's jobs."""
    jobs = []
    clean = company_name.strip()
    # Remove common suffixes for better search
    for suffix in [" Limited", " Ltd", " PLC", " LLP"]:
        if clean.upper().endswith(suffix.upper()):
            clean = clean[:len(clean)-len(suffix)].strip()

    try:
        await page.goto(
            f"https://www.indeed.co.uk/jobs?q={quote_plus(clean)}&l=United+Kingdom&fromage=30",
            wait_until="domcontentloaded",
            timeout=12000,
        )
        stats["pages_crawled"] += 1

        extracted = await page.evaluate("""
            () => {
                const jobs = [];
                document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList > li, [data-jk]').forEach(card => {
                    const titleEl = card.querySelector('h2 a span, h2 span, .jobTitle span, a[data-jk]');
                    const companyEl = card.querySelector('[data-testid="company-name"], .companyName, .company');
                    const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation, .location');
                    const salaryEl = card.querySelector('.salary-snippet, .estimated-salary, [class*="salary"]');
                    const linkEl = card.querySelector('h2 a, a[data-jk], a.jcs-JobTitle');

                    if (titleEl && titleEl.innerText.trim().length > 3) {
                        jobs.push({
                            title: titleEl.innerText.trim(),
                            company: companyEl ? companyEl.innerText.trim() : '',
                            location: locationEl ? locationEl.innerText.trim() : '',
                            salary: salaryEl ? salaryEl.innerText.trim() : '',
                            url: linkEl ? linkEl.href : '',
                        });
                    }
                });
                return jobs.slice(0, 15);
            }
        """)

        for item in (extracted or []):
            jobs.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "company": item.get("company", clean),
                "location": item.get("location", ""),
                "salary": item.get("salary", ""),
                "sponsor_id": sponsor_id,
                "source": "indeed",
            })
            stats["indeed_jobs"] += 1

    except Exception:
        pass

    return jobs


async def search_all_boards(page, company_name, sponsor_id) -> list[dict]:
    """Search EVERY major UK job board for this company's jobs."""
    clean = company_name.strip()
    for suffix in [" Limited", " Ltd", " Ltd.", " PLC", " LLP", " Inc"]:
        if clean.upper().endswith(suffix.upper()):
            clean = clean[:len(clean)-len(suffix)].strip()

    all_jobs = []

    # Board configs: (name, url_template, extractor)
    boards = [
        ("indeed", f"https://www.indeed.co.uk/jobs?q={quote_plus(clean)}&l=United+Kingdom&fromage=30"),
        ("reed", f"https://www.reed.co.uk/jobs?keywords={quote_plus(clean)}&location=United+Kingdom"),
        ("totaljobs", f"https://www.totaljobs.com/jobs?Keywords={quote_plus(clean)}&LTxt=United+Kingdom"),
        ("cvlibrary", f"https://www.cv-library.co.uk/search-jobs?q={quote_plus(clean)}"),
        ("linkedin", f"https://www.linkedin.com/jobs/search/?keywords={quote_plus(clean)}&location=United+Kingdom"),
        ("glassdoor", f"https://www.glassdoor.co.uk/Job/uk-{quote_plus(clean.lower().replace(' ','-'))}-jobs-SRCH_IL.0,2_IN2_KO3,{3+len(clean.replace(' ','-'))}.htm"),
        ("bing_jobs", f"https://www.bing.com/search?q={quote_plus(clean + ' jobs UK hiring 2026')}&count=15"),
    ]

    for board_name, url in boards:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=10000)
            stats["pages_crawled"] += 1

            if board_name == "bing_jobs":
                # Bing: extract job links from search results
                extracted = await page.evaluate("""
                    () => {
                        const jobs = [];
                        const jobDomains = ['indeed.co.uk','reed.co.uk','totaljobs.com','cwjobs.co.uk',
                            'linkedin.com/jobs','glassdoor.co.uk','cv-library.co.uk','monster.co.uk',
                            'adzuna.co.uk','charityjob.co.uk','jobs.nhs.uk','workable.com',
                            'greenhouse.io','lever.co','smartrecruiters.com','jobsite.co.uk',
                            'jobs.ac.uk','efinancialcareers','bmj.com','civilservicejobs'];
                        document.querySelectorAll('#b_results .b_algo').forEach(item => {
                            const cite = item.querySelector('cite');
                            const title = item.querySelector('h2');
                            if (cite && title) {
                                let url = cite.innerText.trim();
                                if (!url.startsWith('http')) url = 'https://' + url;
                                url = url.split(' ')[0];
                                const urlLower = url.toLowerCase();
                                if (jobDomains.some(d => urlLower.includes(d))) {
                                    jobs.push({
                                        title: title.innerText.trim(),
                                        url: url,
                                        source: 'bing_' + (jobDomains.find(d => urlLower.includes(d)) || 'other').split('.')[0],
                                    });
                                }
                            }
                        });
                        return jobs.slice(0, 10);
                    }
                """)
                for item in (extracted or []):
                    all_jobs.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "company": clean,
                        "sponsor_id": sponsor_id,
                        "source": item.get("source", "bing"),
                    })
            else:
                # Generic job board extractor
                extracted = await page.evaluate("""
                    () => {
                        const jobs = [];
                        const seen = new Set();
                        // Look for job cards/listings
                        const selectors = [
                            'h2 a', 'h3 a', '.job-title a', '.jobTitle a', '.jcs-JobTitle',
                            '[class*="job"] a', '[class*="vacancy"] a', '[class*="result"] h2 a',
                            '.job_seen_beacon h2 span', '.lister__item a', 'article h2 a',
                            '[data-jk] h2 span', '.search-result a[href*="job"]',
                        ];
                        selectors.forEach(sel => {
                            document.querySelectorAll(sel).forEach(el => {
                                const text = el.innerText.trim();
                                if (text.length >= 5 && text.length <= 200 && !seen.has(text)) {
                                    seen.add(text);
                                    const link = el.closest('a');
                                    jobs.push({
                                        title: text,
                                        url: link ? link.href : (el.href || ''),
                                    });
                                }
                            });
                        });
                        return jobs.slice(0, 15);
                    }
                """)
                for item in (extracted or []):
                    title = item.get("title", "")
                    if len(title) >= 5:
                        all_jobs.append({
                            "title": title,
                            "url": item.get("url", ""),
                            "company": clean,
                            "sponsor_id": sponsor_id,
                            "source": board_name,
                        })

            await asyncio.sleep(0.5)

        except Exception:
            continue

    stats["indeed_jobs"] += len(all_jobs)
    return all_jobs


async def worker(wid, queue, browser):
    """One browser tab processing companies."""
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

        sponsor_id = company.get("sponsor_id")
        name = company.get("company_name", "Unknown")
        careers_url = company.get("careers_page_url")
        website_url = company.get("website_url")
        all_jobs = []

        # Step 1: Scrape careers page
        if careers_url:
            jobs = await extract_jobs_from_page(page, careers_url, name, sponsor_id)
            all_jobs.extend(jobs)

        # Step 2: If no jobs from careers page, try website + /careers, /jobs paths
        if not all_jobs and website_url:
            parsed = urlparse(website_url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            for path in ["/careers", "/jobs", "/vacancies", "/join-us"]:
                jobs = await extract_jobs_from_page(page, f"{base}{path}", name, sponsor_id)
                all_jobs.extend(jobs)
                if all_jobs:
                    break

        # Step 3: Search EVERY job board for this company
        if name and len(name) > 2:
            board_jobs = await search_all_boards(page, name, sponsor_id)
            all_jobs.extend(board_jobs)

        # Save jobs to Supabase (upsert to handle duplicates gracefully)
        saved = 0
        for job in all_jobs:
            title = job.get("title", "")
            if len(title) < 5 or job.get("is_ats"):
                continue

            job_url = job.get("url") or None
            source = job.get("source", "career_page")
            now = datetime.now(timezone.utc).isoformat()

            try:
                # Check for existing job with same title + company to avoid duplicates
                existing = sb.table("jobs").select("id").eq(
                    "title_raw", title[:200]
                ).eq(
                    "company_name_raw", job.get("company", name)
                ).eq(
                    "source", source
                ).limit(1).execute()

                if existing.data:
                    # Update last_seen_at
                    sb.table("jobs").update({"last_seen_at": now}).eq(
                        "id", existing.data[0]["id"]
                    ).execute()
                    continue

                record = {
                    "source": source,
                    "source_url": job_url,
                    "title_raw": title[:200],
                    "company_name_raw": job.get("company", name),
                    "sponsor_id": sponsor_id,
                    "location_raw": job.get("location") or None,
                    "salary_text_raw": job.get("salary") or None,
                    "sponsorship_likelihood": 80,
                    "scraped_at": now,
                    "first_seen_at": now,
                    "last_seen_at": now,
                }
                sb.table("jobs").insert(record).execute()
                saved += 1
            except Exception as e:
                err_msg = str(e)[:100]
                if "duplicate" not in err_msg.lower() and "already exists" not in err_msg.lower():
                    logger.debug(f"  Insert error for '{title[:40]}': {err_msg}")

        stats["companies_scraped"] += 1
        stats["jobs_found"] += len(all_jobs)
        stats["jobs_saved"] += saved
        queue.task_done()

        if stats["companies_scraped"] % 20 == 0:
            elapsed = time.time() - stats["start"]
            rate = stats["companies_scraped"] / max(1, elapsed)
            remaining = (stats["total"] - stats["companies_scraped"]) / max(0.01, rate)
            logger.info(
                f"  [{stats['companies_scraped']}/{stats['total']}] "
                f"Jobs found: {stats['jobs_found']:,} | "
                f"Saved: {stats['jobs_saved']:,} | "
                f"Indeed: {stats['indeed_jobs']:,} | "
                f"Pages: {stats['pages_crawled']:,} | "
                f"{rate:.1f}/s | ETA {remaining/60:.0f}m"
            )

    await ctx.close()


async def main():
    stats["start"] = time.time()

    logger.info("=" * 70)
    logger.info("  CAREER PAGE SCRAPER — JOBS FROM SPONSOR COMPANIES DIRECTLY")
    logger.info("=" * 70)

    # Load companies with websites/careers pages + their sponsor names
    logger.info("  Loading companies with websites...")
    companies = []
    page = 0
    while True:
        r = sb.table("company_profiles").select(
            "id, sponsor_id, website_url, careers_page_url, has_careers_page"
        ).not_.is_("website_url", "null").range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not r.data:
            break
        companies.extend(r.data)
        if len(r.data) < 1000:
            break
        page += 1

    # Load sponsor names
    logger.info("  Loading sponsor names...")
    sponsors = {}
    page = 0
    while True:
        r = sb.table("sponsors").select("id, organisation_name").range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not r.data:
            break
        for s in r.data:
            sponsors[s["id"]] = s["organisation_name"]
        if len(r.data) < 1000:
            break
        page += 1

    # Enrich company list with names
    for c in companies:
        c["company_name"] = sponsors.get(c["sponsor_id"], "Unknown")

    # Check which companies already have jobs from career scraping (skip them)
    logger.info("  Checking which companies already scraped...")
    scraped_sponsors = set()
    page = 0
    while True:
        r = sb.table("jobs").select("sponsor_id").eq("source", "career_page").not_.is_("sponsor_id", "null").range(page * 1000, (page + 1) * 1000 - 1).execute()
        if not r.data:
            break
        for row in r.data:
            scraped_sponsors.add(row["sponsor_id"])
        if len(r.data) < 1000:
            break
        page += 1

    already = len(scraped_sponsors)
    companies = [c for c in companies if c.get("sponsor_id") not in scraped_sponsors]
    logger.info(f"  Already scraped: {already:,} companies (skipping)")

    # Prioritize: careers pages first, then websites
    companies.sort(key=lambda c: (0 if c.get("has_careers_page") else 1))

    stats["total"] = len(companies)
    logger.info(f"  Companies to scrape: {len(companies):,}")
    logger.info(f"  With careers pages: {sum(1 for c in companies if c.get('has_careers_page')):,}")
    logger.info(f"  Browser tabs: {BROWSER_TABS}")
    logger.info("=" * 70)

    queue = asyncio.Queue()
    for c in companies:
        queue.put_nowait(c)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        workers = [worker(i + 1, queue, browser) for i in range(BROWSER_TABS)]
        await asyncio.gather(*workers)
        await browser.close()

    elapsed = time.time() - stats["start"]
    logger.info("=" * 70)
    logger.info("  CAREER PAGE SCRAPER — FINAL REPORT")
    logger.info("=" * 70)
    logger.info(f"  Companies scraped:  {stats['companies_scraped']:,}")
    logger.info(f"  Jobs found:         {stats['jobs_found']:,}")
    logger.info(f"  Jobs saved:         {stats['jobs_saved']:,}")
    logger.info(f"  Indeed jobs:        {stats['indeed_jobs']:,}")
    logger.info(f"  Pages crawled:      {stats['pages_crawled']:,}")
    logger.info(f"  Time:               {elapsed/60:.1f} min")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
