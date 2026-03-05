#!/usr/bin/env python3
"""
SponsorIntel - UK Sponsor Licence Intelligence Platform
A local server that scrapes real job data, enriches company info,
and provides powerful analytics. Zero pip installs required.

Usage: python server.py
Then open http://localhost:8777 in your browser.
"""

import http.server
import json
import csv
import os
import sys
import sqlite3
import urllib.request
import urllib.parse
import urllib.error
import ssl
import re
import hashlib
import time
import threading
from datetime import datetime, timedelta
from pathlib import Path
from html.parser import HTMLParser
import gzip
import io

PORT = 8777
DATA_DIR = Path(__file__).parent
DB_PATH = DATA_DIR / "sponsorintel_cache.db"

# ═══════════════════════════════════════════
# DATABASE CACHE LAYER
# ═══════════════════════════════════════════

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at REAL,
        ttl_hours REAL DEFAULT 24
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS company_enrichment (
        name TEXT PRIMARY KEY,
        companies_house_data TEXT,
        industry TEXT,
        sic_codes TEXT,
        company_number TEXT,
        incorporation_date TEXT,
        company_status TEXT,
        address TEXT,
        employee_estimate TEXT,
        last_accounts_date TEXT,
        enriched_at REAL
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS job_listings (
        id TEXT PRIMARY KEY,
        company_name TEXT,
        title TEXT,
        location TEXT,
        salary TEXT,
        description TEXT,
        url TEXT,
        source TEXT,
        posted_date TEXT,
        scraped_at REAL
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS notes (
        company_name TEXT PRIMARY KEY,
        note TEXT,
        updated_at REAL
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS api_keys (
        service TEXT PRIMARY KEY,
        key TEXT
    )""")
    conn.commit()
    conn.close()

def cache_get(key, max_age_hours=24):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("SELECT value, created_at FROM cache WHERE key=?", (key,))
    row = c.fetchone()
    conn.close()
    if row and (time.time() - row[1]) < max_age_hours * 3600:
        return json.loads(row[0])
    return None

def cache_set(key, value, ttl_hours=24):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO cache (key, value, created_at, ttl_hours) VALUES (?,?,?,?)",
              (key, json.dumps(value), time.time(), ttl_hours))
    conn.commit()
    conn.close()

def get_api_key(service):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("SELECT key FROM api_keys WHERE service=?", (service,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def set_api_key(service, key):
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO api_keys (service, key) VALUES (?,?)", (service, key))
    conn.commit()
    conn.close()

# ═══════════════════════════════════════════
# WEB SCRAPING ENGINE
# ═══════════════════════════════════════════

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}

def fetch_url(url, headers=None, timeout=15):
    """Fetch URL with proper error handling and gzip support"""
    hdrs = {**HEADERS, **(headers or {})}
    req = urllib.request.Request(url, headers=hdrs)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ctx)
        data = resp.read()
        if resp.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return data.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"[FETCH ERROR] {url}: {e}")
        return None

def fetch_json(url, headers=None, timeout=15):
    """Fetch JSON from URL"""
    hdrs = {**HEADERS, "Accept": "application/json", **(headers or {})}
    req = urllib.request.Request(url, headers=hdrs)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ctx)
        data = resp.read()
        if resp.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return json.loads(data.decode('utf-8', errors='replace'))
    except Exception as e:
        print(f"[JSON FETCH ERROR] {url}: {e}")
        return None


# ═══════════════════════════════════════════
# COMPANIES HOUSE API (Free - https://developer.company-information.service.gov.uk/)
# ═══════════════════════════════════════════

def search_companies_house(company_name):
    """Search Companies House for company details"""
    cache_key = f"ch_{hashlib.md5(company_name.encode()).hexdigest()}"
    cached = cache_get(cache_key, max_age_hours=168)  # Cache for 1 week
    if cached:
        return cached

    api_key = get_api_key("companies_house")
    if not api_key:
        return {"error": "No Companies House API key configured. Get one free at https://developer.company-information.service.gov.uk/"}

    encoded = urllib.parse.quote(company_name)
    url = f"https://api.company-information.service.gov.uk/search/companies?q={encoded}&items_per_page=5"

    import base64
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    headers = {"Authorization": f"Basic {auth}"}

    result = fetch_json(url, headers=headers)
    if result and result.get("items"):
        items = []
        for item in result["items"][:3]:
            company_number = item.get("company_number", "")
            detail = fetch_company_detail(company_number, api_key) if company_number else {}
            items.append({
                "name": item.get("title", ""),
                "company_number": company_number,
                "company_status": item.get("company_status", ""),
                "date_of_creation": item.get("date_of_creation", ""),
                "address": item.get("address_snippet", ""),
                "company_type": item.get("company_type", ""),
                "sic_codes": detail.get("sic_codes", []),
                "accounts": detail.get("accounts", {}),
                "has_charges": detail.get("has_charges", False),
                "has_insolvency_history": detail.get("has_insolvency_history", False),
                "last_accounts": detail.get("last_accounts", {}),
                "confirmation_statement": detail.get("confirmation_statement", {}),
            })
        result_data = {"items": items, "total_results": result.get("total_results", 0)}
        cache_set(cache_key, result_data, ttl_hours=168)
        return result_data

    return {"items": [], "total_results": 0}

def fetch_company_detail(company_number, api_key):
    """Fetch detailed company info from Companies House"""
    import base64
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    url = f"https://api.company-information.service.gov.uk/company/{company_number}"
    result = fetch_json(url, headers={"Authorization": f"Basic {auth}"})
    return result or {}

def get_company_officers(company_number):
    """Fetch company officers (directors etc.)"""
    api_key = get_api_key("companies_house")
    if not api_key:
        return {"error": "No API key"}
    import base64
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    url = f"https://api.company-information.service.gov.uk/company/{company_number}/officers"
    return fetch_json(url, headers={"Authorization": f"Basic {auth}"}) or {}

def get_company_filings(company_number):
    """Fetch company filing history"""
    api_key = get_api_key("companies_house")
    if not api_key:
        return {"error": "No API key"}
    import base64
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    url = f"https://api.company-information.service.gov.uk/company/{company_number}/filing-history?items_per_page=10"
    return fetch_json(url, headers={"Authorization": f"Basic {auth}"}) or {}


# ═══════════════════════════════════════════
# JOB SCRAPING ENGINE - MULTI-SOURCE
# ═══════════════════════════════════════════

def scrape_reed_jobs(company_name, keywords="", location=""):
    """Scrape jobs from Reed.co.uk API (free API key at reed.co.uk/developers)"""
    api_key = get_api_key("reed")
    if not api_key:
        return {"error": "No Reed API key. Get one free at https://www.reed.co.uk/developers", "jobs": []}

    cache_key = f"reed_{hashlib.md5(f'{company_name}_{keywords}_{location}'.encode()).hexdigest()}"
    cached = cache_get(cache_key, max_age_hours=6)
    if cached:
        return cached

    params = {"employerProfileName": company_name}
    if keywords:
        params["keywords"] = keywords
    if location:
        params["locationName"] = location
    params["resultsToTake"] = 50

    query = urllib.parse.urlencode(params)
    url = f"https://www.reed.co.uk/api/1.0/search?{query}"

    import base64
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    result = fetch_json(url, headers={"Authorization": f"Basic {auth}"})

    if result and result.get("results"):
        jobs = []
        for job in result["results"]:
            jobs.append({
                "id": str(job.get("jobId", "")),
                "title": job.get("jobTitle", ""),
                "company": job.get("employerName", ""),
                "location": job.get("locationName", ""),
                "salary_min": job.get("minimumSalary"),
                "salary_max": job.get("maximumSalary"),
                "salary_text": job.get("currency", "£") + f"{job.get('minimumSalary','?')}-{job.get('maximumSalary','?')}",
                "description": job.get("jobDescription", "")[:500],
                "url": job.get("jobUrl", ""),
                "posted": job.get("date", ""),
                "expiry": job.get("expirationDate", ""),
                "source": "Reed"
            })
        data = {"jobs": jobs, "total": result.get("totalResults", 0)}
        cache_set(cache_key, data, ttl_hours=6)
        _save_jobs_to_db(jobs)
        return data

    return {"jobs": [], "total": 0}


def scrape_adzuna_jobs(company_name, keywords="", location=""):
    """Scrape jobs from Adzuna API (free at developer.adzuna.com)"""
    app_id = get_api_key("adzuna_app_id")
    app_key = get_api_key("adzuna_app_key")
    if not app_id or not app_key:
        return {"error": "No Adzuna API keys. Get free at https://developer.adzuna.com/", "jobs": []}

    cache_key = f"adzuna_{hashlib.md5(f'{company_name}_{keywords}_{location}'.encode()).hexdigest()}"
    cached = cache_get(cache_key, max_age_hours=6)
    if cached:
        return cached

    search_terms = f"{company_name} {keywords}".strip()
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": 50,
        "what": search_terms,
        "content-type": "application/json",
        "sort_by": "date"
    }
    if location:
        params["where"] = location

    query = urllib.parse.urlencode(params)
    url = f"https://api.adzuna.com/v1/api/jobs/gb/search/1?{query}"
    result = fetch_json(url)

    if result and result.get("results"):
        jobs = []
        for job in result["results"]:
            sal_min = job.get("salary_min")
            sal_max = job.get("salary_max")
            salary_text = ""
            if sal_min and sal_max:
                salary_text = f"£{int(sal_min):,} - £{int(sal_max):,}"
            elif sal_min:
                salary_text = f"£{int(sal_min):,}+"

            jobs.append({
                "id": job.get("id", ""),
                "title": job.get("title", ""),
                "company": job.get("company", {}).get("display_name", ""),
                "location": job.get("location", {}).get("display_name", ""),
                "salary_min": sal_min,
                "salary_max": sal_max,
                "salary_text": salary_text,
                "description": job.get("description", "")[:500],
                "url": job.get("redirect_url", ""),
                "posted": job.get("created", ""),
                "source": "Adzuna",
                "category": job.get("category", {}).get("label", ""),
                "contract_type": job.get("contract_type", ""),
                "contract_time": job.get("contract_time", "")
            })
        data = {"jobs": jobs, "total": result.get("count", 0)}
        cache_set(cache_key, data, ttl_hours=6)
        _save_jobs_to_db(jobs)
        return data

    return {"jobs": [], "total": 0}


def scrape_findajob_gov(keywords="", location=""):
    """Scrape from Find a Job (DWP gov.uk) - no API key needed"""
    cache_key = f"findajob_{hashlib.md5(f'{keywords}_{location}'.encode()).hexdigest()}"
    cached = cache_get(cache_key, max_age_hours=12)
    if cached:
        return cached

    search = urllib.parse.quote(f"{keywords} visa sponsorship".strip())
    loc = urllib.parse.quote(location) if location else ""
    url = f"https://findajob.dwp.gov.uk/search?q={search}&w={loc}&d=20"
    html = fetch_url(url)
    if not html:
        return {"jobs": [], "total": 0, "url": url}

    # Simple HTML parsing
    jobs = parse_findajob_html(html)
    data = {"jobs": jobs, "total": len(jobs), "url": url}
    cache_set(cache_key, data, ttl_hours=12)
    return data


def parse_findajob_html(html):
    """Parse Find a Job search results"""
    jobs = []
    # Basic regex extraction
    listings = re.findall(r'<div class="search-result".*?</div>\s*</div>', html, re.DOTALL)
    for listing in listings[:20]:
        title_match = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', listing)
        company_match = re.search(r'<span class="company">(.*?)</span>', listing)
        location_match = re.search(r'<span class="location">(.*?)</span>', listing)

        if title_match:
            jobs.append({
                "id": hashlib.md5(title_match.group(1).encode()).hexdigest()[:12],
                "title": re.sub(r'<[^>]+>', '', title_match.group(2)).strip(),
                "company": re.sub(r'<[^>]+>', '', company_match.group(1)).strip() if company_match else "",
                "location": re.sub(r'<[^>]+>', '', location_match.group(1)).strip() if location_match else "",
                "url": "https://findajob.dwp.gov.uk" + title_match.group(1),
                "source": "Find a Job (GOV.UK)"
            })
    return jobs


def scrape_all_jobs(company_name, keywords="", location=""):
    """Aggregate jobs from ALL sources"""
    results = {"jobs": [], "sources": {}, "total": 0}

    # Reed
    reed = scrape_reed_jobs(company_name, keywords, location)
    if reed.get("jobs"):
        results["jobs"].extend(reed["jobs"])
        results["sources"]["reed"] = {"count": len(reed["jobs"]), "total": reed.get("total", 0)}
    elif reed.get("error"):
        results["sources"]["reed"] = {"error": reed["error"]}

    # Adzuna
    adzuna = scrape_adzuna_jobs(company_name, keywords, location)
    if adzuna.get("jobs"):
        results["jobs"].extend(adzuna["jobs"])
        results["sources"]["adzuna"] = {"count": len(adzuna["jobs"]), "total": adzuna.get("total", 0)}
    elif adzuna.get("error"):
        results["sources"]["adzuna"] = {"error": adzuna["error"]}

    # Find a Job
    findajob = scrape_findajob_gov(f"{company_name} {keywords}".strip(), location)
    if findajob.get("jobs"):
        results["jobs"].extend(findajob["jobs"])
        results["sources"]["findajob"] = {"count": len(findajob["jobs"])}

    # Deduplicate by title + company
    seen = set()
    unique = []
    for job in results["jobs"]:
        key = f"{job.get('title','').lower()}_{job.get('company','').lower()}"
        if key not in seen:
            seen.add(key)
            unique.append(job)
    results["jobs"] = unique
    results["total"] = len(unique)

    return results


def _save_jobs_to_db(jobs):
    """Persist scraped jobs to SQLite"""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    for j in jobs:
        try:
            c.execute("""INSERT OR REPLACE INTO job_listings
                (id, company_name, title, location, salary, description, url, source, posted_date, scraped_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (j.get("id",""), j.get("company",""), j.get("title",""), j.get("location",""),
                 j.get("salary_text",""), j.get("description",""), j.get("url",""),
                 j.get("source",""), j.get("posted",""), time.time()))
        except:
            pass
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════
# INDUSTRY CLASSIFICATION ENGINE
# ═══════════════════════════════════════════

SIC_INDUSTRY_MAP = {
    "01": "Agriculture", "02": "Forestry", "03": "Fishing",
    "05": "Mining", "06": "Oil & Gas", "07": "Metal Ores", "08": "Quarrying", "09": "Mining Support",
    "10": "Food", "11": "Beverages", "12": "Tobacco", "13": "Textiles", "14": "Clothing",
    "15": "Leather", "16": "Wood", "17": "Paper", "18": "Printing", "19": "Petroleum",
    "20": "Chemicals", "21": "Pharmaceuticals", "22": "Rubber & Plastics", "23": "Non-metallic Minerals",
    "24": "Basic Metals", "25": "Metal Products", "26": "Electronics", "27": "Electrical Equipment",
    "28": "Machinery", "29": "Motor Vehicles", "30": "Transport Equipment", "31": "Furniture",
    "32": "Other Manufacturing", "33": "Repair & Installation",
    "35": "Energy & Utilities", "36": "Water Supply", "37": "Sewerage", "38": "Waste", "39": "Remediation",
    "41": "Construction", "42": "Civil Engineering", "43": "Specialist Construction",
    "45": "Motor Vehicle Trade", "46": "Wholesale", "47": "Retail",
    "49": "Transport (Land)", "50": "Transport (Water)", "51": "Transport (Air)", "52": "Warehousing", "53": "Postal/Courier",
    "55": "Accommodation", "56": "Food & Drink Service",
    "58": "Publishing", "59": "Film & TV", "60": "Broadcasting", "61": "Telecommunications",
    "62": "IT & Software", "63": "Information Services",
    "64": "Financial Services", "65": "Insurance", "66": "Financial Support",
    "68": "Real Estate",
    "69": "Legal & Accounting", "70": "Management Consultancy", "71": "Architecture & Engineering",
    "72": "Scientific R&D", "73": "Advertising & Marketing", "74": "Other Professional", "75": "Veterinary",
    "77": "Rental & Leasing", "78": "Recruitment", "79": "Travel & Tourism",
    "80": "Security", "81": "Facilities Management", "82": "Office Admin",
    "84": "Public Administration", "85": "Education", "86": "Healthcare", "87": "Residential Care",
    "88": "Social Work", "90": "Creative Arts", "91": "Libraries & Museums", "92": "Gambling",
    "93": "Sports & Recreation", "94": "Membership Organisations", "95": "Repair Services",
    "96": "Personal Services", "97": "Households", "99": "International Organisations"
}

def classify_industry_from_sic(sic_codes):
    """Map SIC codes to human-readable industries"""
    if not sic_codes:
        return "Unknown"
    industries = set()
    for code in sic_codes:
        prefix = str(code)[:2]
        if prefix in SIC_INDUSTRY_MAP:
            industries.add(SIC_INDUSTRY_MAP[prefix])
    return ", ".join(sorted(industries)) if industries else "Unknown"

def classify_industry_from_name(name):
    """Heuristic industry classification from company name"""
    name_lower = name.lower()
    patterns = {
        "Healthcare": ["hospital", "health", "medical", "pharma", "nhs", "clinic", "care home", "dental", "nursing", "surgery", "therapist"],
        "Technology": ["tech", "software", "digital", "cyber", "data", "cloud", "ai ", "saas", "app ", "computing", "systems"],
        "Finance": ["bank", "capital", "invest", "financ", "insur", "mortgage", "wealth", "fund ", "trading", "fintech"],
        "Education": ["university", "school", "college", "academy", "education", "training", "learning", "tutor"],
        "Legal": ["solicitor", "law firm", "legal", "barrister", "advocate"],
        "Construction": ["construction", "building", "architect", "engineer", "plumb", "electr", "roofing"],
        "Hospitality": ["hotel", "restaurant", "cafe", "catering", "hospitality", "pub ", "bar "],
        "Retail": ["retail", "shop", "store", "supermarket", "market", "ecommerce"],
        "Manufacturing": ["manufactur", "factory", "production", "fabricat"],
        "Logistics": ["logistics", "transport", "delivery", "shipping", "freight", "courier", "warehouse"],
        "Consulting": ["consult", "advisory", "strategy"],
        "Recruitment": ["recruit", "staffing", "talent", "hr ", "human resource"],
        "Charity/NGO": ["charity", "foundation", "trust", "non-profit", "nonprofit"],
        "Media": ["media", "broadcast", "news", "publish", "magazine"],
        "Energy": ["energy", "oil", "gas", "solar", "wind", "renewable", "power"],
        "Telecommunications": ["telecom", "mobile", "wireless", "network"],
    }
    for industry, keywords in patterns.items():
        for kw in keywords:
            if kw in name_lower:
                return industry
    return "Other"


# ═══════════════════════════════════════════
# COMPANY SCORING ENGINE
# ═══════════════════════════════════════════

def calculate_sponsor_score(row, enrichment=None):
    """Score a company on sponsorship desirability (0-100)"""
    score = 50  # Base score

    tr = row.get("Type & Rating", "")
    if "A rating" in tr:
        score += 15  # A rating = good compliance
    elif "B rating" in tr:
        score -= 20  # B rating = risky

    route = row.get("Route", "")
    if "Skilled Worker" in route:
        score += 10  # Most common useful route
    if "Global Business Mobility" in route:
        score += 5

    if enrichment:
        if enrichment.get("company_status") == "active":
            score += 5
        if enrichment.get("has_insolvency_history"):
            score -= 15

        sic = enrichment.get("sic_codes", [])
        # High-demand sectors
        high_demand = ["62", "63", "72", "86", "85", "64", "65"]
        if any(str(s)[:2] in high_demand for s in sic):
            score += 10

    return max(0, min(100, score))


# ═══════════════════════════════════════════
# SALARY INTELLIGENCE
# ═══════════════════════════════════════════

def get_salary_data(job_title, location=""):
    """Get salary estimates from Adzuna salary data"""
    app_id = get_api_key("adzuna_app_id")
    app_key = get_api_key("adzuna_app_key")
    if not app_id or not app_key:
        return {"error": "No Adzuna API keys configured"}

    cache_key = f"salary_{hashlib.md5(f'{job_title}_{location}'.encode()).hexdigest()}"
    cached = cache_get(cache_key, max_age_hours=72)
    if cached:
        return cached

    # Adzuna salary predictor
    params = {"app_id": app_id, "app_key": app_key}
    title_enc = urllib.parse.quote(job_title)
    loc_enc = urllib.parse.quote(location) if location else "uk"
    url = f"https://api.adzuna.com/v1/api/jobs/gb/history?{urllib.parse.urlencode(params)}&what={title_enc}&location0=UK"
    result = fetch_json(url)

    if result and result.get("month"):
        data = {"salary_history": result["month"], "job_title": job_title}
        cache_set(cache_key, data, ttl_hours=72)
        return data

    return {"salary_history": {}}


# ═══════════════════════════════════════════
# BULK DATA PROCESSING
# ═══════════════════════════════════════════

def load_sponsor_data():
    """Load sponsor CSV data"""
    csv_files = list(DATA_DIR.glob("*.csv"))
    if not csv_files:
        return []

    # Use the most recent CSV
    csv_file = max(csv_files, key=os.path.getmtime)
    print(f"[DATA] Loading: {csv_file.name}")

    rows = []
    with open(csv_file, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {k.strip(): (v or "").strip() for k, v in row.items()}
            cleaned["_industry_guess"] = classify_industry_from_name(cleaned.get("Organisation Name", ""))
            rows.append(cleaned)

    print(f"[DATA] Loaded {len(rows):,} records")
    return rows


def compute_analytics(data):
    """Compute comprehensive analytics from the dataset"""
    analytics = {
        "total": len(data),
        "by_rating": {"A": 0, "B": 0, "other": 0},
        "by_type": {},
        "by_city": {},
        "by_county": {},
        "by_route": {},
        "by_industry_guess": {},
        "top_cities": [],
        "top_counties": [],
        "top_routes": [],
        "top_industries": [],
        "cities_with_most_b_ratings": [],
        "route_combinations": {},
    }

    for row in data:
        tr = row.get("Type & Rating", "")
        if "A rating" in tr:
            analytics["by_rating"]["A"] += 1
        elif "B rating" in tr:
            analytics["by_rating"]["B"] += 1
        else:
            analytics["by_rating"]["other"] += 1

        # Type
        type_match = re.match(r'^(Worker|Temporary Worker)', tr)
        if type_match:
            t = type_match.group(1)
            analytics["by_type"][t] = analytics["by_type"].get(t, 0) + 1

        city = row.get("Town/City", "")
        if city:
            analytics["by_city"][city] = analytics["by_city"].get(city, 0) + 1

        county = row.get("County", "") or "Not specified"
        analytics["by_county"][county] = analytics["by_county"].get(county, 0) + 1

        route = row.get("Route", "")
        if route:
            analytics["by_route"][route] = analytics["by_route"].get(route, 0) + 1
            for r in route.split(","):
                r = r.strip()
                if r:
                    pass  # individual routes tracked above

        industry = row.get("_industry_guess", "Other")
        analytics["by_industry_guess"][industry] = analytics["by_industry_guess"].get(industry, 0) + 1

    # Sort tops
    analytics["top_cities"] = sorted(analytics["by_city"].items(), key=lambda x: -x[1])[:30]
    analytics["top_counties"] = sorted(analytics["by_county"].items(), key=lambda x: -x[1])[:20]
    analytics["top_routes"] = sorted(analytics["by_route"].items(), key=lambda x: -x[1])[:15]
    analytics["top_industries"] = sorted(analytics["by_industry_guess"].items(), key=lambda x: -x[1])[:20]

    # Cities with most B ratings
    b_by_city = {}
    for row in data:
        if "B rating" in row.get("Type & Rating", ""):
            city = row.get("Town/City", "Unknown")
            b_by_city[city] = b_by_city.get(city, 0) + 1
    analytics["cities_with_most_b_ratings"] = sorted(b_by_city.items(), key=lambda x: -x[1])[:15]

    return analytics


# ═══════════════════════════════════════════
# HTTP REQUEST HANDLER
# ═══════════════════════════════════════════

sponsor_data = []
sponsor_analytics = {}

class SponsorHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.urlparse(self.path)
        query = dict(urllib.parse.parse_qsl(path.query))

        if path.path == "/" or path.path == "/index.html":
            self.serve_file("index.html")
        elif path.path == "/api/data":
            self.json_response({"count": len(sponsor_data), "columns": list(sponsor_data[0].keys()) if sponsor_data else []})
        elif path.path == "/api/data/all":
            self.json_response(sponsor_data)
        elif path.path == "/api/data/page":
            page = int(query.get("page", 1))
            size = int(query.get("size", 100))
            search = query.get("search", "").lower()
            city = query.get("city", "").lower()
            county = query.get("county", "")
            rating = query.get("rating", "")
            route = query.get("route", "")
            stype = query.get("type", "")
            industry = query.get("industry", "")
            sort_by = query.get("sort", "")
            sort_dir = query.get("dir", "asc")

            filtered = sponsor_data
            if search:
                filtered = [r for r in filtered if search in r.get("Organisation Name", "").lower()]
            if city:
                filtered = [r for r in filtered if city in r.get("Town/City", "").lower()]
            if county:
                filtered = [r for r in filtered if r.get("County", "") == county]
            if rating:
                filtered = [r for r in filtered if f"{rating} rating" in r.get("Type & Rating", "")]
            if route:
                filtered = [r for r in filtered if route in r.get("Route", "")]
            if stype:
                filtered = [r for r in filtered if stype.lower() in r.get("Type & Rating", "").lower()]
            if industry:
                filtered = [r for r in filtered if r.get("_industry_guess", "") == industry]

            if sort_by:
                filtered = sorted(filtered, key=lambda x: x.get(sort_by, "").lower(),
                                  reverse=(sort_dir == "desc"))

            total = len(filtered)
            start = (page - 1) * size
            page_data = filtered[start:start + size]

            self.json_response({
                "data": page_data,
                "total": total,
                "page": page,
                "pages": (total + size - 1) // size
            })

        elif path.path == "/api/analytics":
            self.json_response(sponsor_analytics)

        elif path.path == "/api/search-jobs":
            company = query.get("company", "")
            keywords = query.get("keywords", "")
            location = query.get("location", "")
            jobs = scrape_all_jobs(company, keywords, location)
            self.json_response(jobs)

        elif path.path == "/api/company-info":
            name = query.get("name", "")
            result = search_companies_house(name)
            self.json_response(result)

        elif path.path == "/api/company-officers":
            num = query.get("number", "")
            result = get_company_officers(num)
            self.json_response(result)

        elif path.path == "/api/salary":
            title = query.get("title", "")
            location = query.get("location", "")
            result = get_salary_data(title, location)
            self.json_response(result)

        elif path.path == "/api/keys":
            # Return which keys are configured (not the keys themselves)
            keys = {}
            for svc in ["companies_house", "reed", "adzuna_app_id", "adzuna_app_key"]:
                k = get_api_key(svc)
                keys[svc] = bool(k)
            self.json_response(keys)

        elif path.path == "/api/cached-jobs":
            conn = sqlite3.connect(str(DB_PATH))
            c = conn.cursor()
            company = query.get("company", "")
            if company:
                c.execute("SELECT * FROM job_listings WHERE company_name LIKE ? ORDER BY scraped_at DESC LIMIT 100",
                         (f"%{company}%",))
            else:
                c.execute("SELECT * FROM job_listings ORDER BY scraped_at DESC LIMIT 200")
            cols = [desc[0] for desc in c.description]
            rows = [dict(zip(cols, row)) for row in c.fetchall()]
            conn.close()
            self.json_response({"jobs": rows, "total": len(rows)})

        elif path.path == "/api/notes":
            name = query.get("company", "")
            conn = sqlite3.connect(str(DB_PATH))
            c = conn.cursor()
            if name:
                c.execute("SELECT * FROM notes WHERE company_name=?", (name,))
                row = c.fetchone()
                conn.close()
                self.json_response({"note": row[1] if row else "", "company": name})
            else:
                c.execute("SELECT * FROM notes ORDER BY updated_at DESC")
                notes = [{"company": r[0], "note": r[1]} for r in c.fetchall()]
                conn.close()
                self.json_response({"notes": notes})

        elif path.path == "/api/filters":
            # Return unique values for filters
            cities = sorted(set(r.get("Town/City","") for r in sponsor_data if r.get("Town/City")))
            counties = sorted(set(r.get("County","") for r in sponsor_data if r.get("County")))
            routes = sorted(set(r.get("Route","") for r in sponsor_data if r.get("Route")))
            industries = sorted(set(r.get("_industry_guess","") for r in sponsor_data if r.get("_industry_guess")))
            self.json_response({
                "cities": cities[:500],  # Cap for performance
                "counties": counties,
                "routes": routes,
                "industries": industries
            })

        else:
            super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length else {}

        if path.path == "/api/keys":
            for service, key in body.items():
                if key:
                    set_api_key(service, key)
            self.json_response({"status": "ok"})

        elif path.path == "/api/notes":
            company = body.get("company", "")
            note = body.get("note", "")
            conn = sqlite3.connect(str(DB_PATH))
            c = conn.cursor()
            c.execute("INSERT OR REPLACE INTO notes (company_name, note, updated_at) VALUES (?,?,?)",
                     (company, note, time.time()))
            conn.commit()
            conn.close()
            self.json_response({"status": "ok"})

        elif path.path == "/api/enrich-batch":
            names = body.get("names", [])[:20]  # Limit batch size
            results = {}
            for name in names:
                results[name] = search_companies_house(name)
            self.json_response(results)

        else:
            self.send_error(404)

    def json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def serve_file(self, filename):
        filepath = DATA_DIR / filename
        if filepath.exists():
            self.send_response(200)
            ct = "text/html" if filename.endswith(".html") else "application/octet-stream"
            self.send_header("Content-Type", ct)
            self.end_headers()
            self.wfile.write(filepath.read_bytes())
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        if "/api/" in str(args[0]):
            print(f"[API] {args[0]}")


# ═══════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════

def main():
    global sponsor_data, sponsor_analytics

    print("=" * 60)
    print("  SponsorIntel - UK Sponsor Licence Intelligence Platform")
    print("=" * 60)
    print()

    init_db()

    # Load data
    sponsor_data = load_sponsor_data()
    if not sponsor_data:
        print("[WARNING] No CSV file found in this directory!")
        print("  Place your sponsor licence CSV file in the same folder as this script.")
        print("  Download from: https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers")
        print()
    else:
        sponsor_analytics = compute_analytics(sponsor_data)
        print(f"[DATA] Analytics computed: {sponsor_analytics['total']:,} companies")
        print(f"  A-Rated: {sponsor_analytics['by_rating']['A']:,}  |  B-Rated: {sponsor_analytics['by_rating']['B']:,}")
        print(f"  Top city: {sponsor_analytics['top_cities'][0][0]} ({sponsor_analytics['top_cities'][0][1]:,})" if sponsor_analytics['top_cities'] else "")
        print()

    # Check API keys
    print("[KEYS] API Key Status:")
    for svc, label in [("companies_house", "Companies House"), ("reed", "Reed.co.uk"),
                        ("adzuna_app_id", "Adzuna App ID"), ("adzuna_app_key", "Adzuna App Key")]:
        k = get_api_key(svc)
        status = "✅ Configured" if k else "❌ Not set"
        print(f"  {label}: {status}")
    print()
    print("  Configure API keys in the Settings tab of the web dashboard")
    print("  Or visit: http://localhost:8777/#settings")
    print()

    os.chdir(str(DATA_DIR))
    server = http.server.HTTPServer(("0.0.0.0", PORT), SponsorHandler)
    print(f"[SERVER] Running at http://localhost:{PORT}")
    print(f"  Press Ctrl+C to stop")
    print()

    try:
        import webbrowser
        webbrowser.open(f"http://localhost:{PORT}")
    except:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Shutting down...")
        server.shutdown()

if __name__ == "__main__":
    main()
