"""
Data Quality Cleanup Script — Fix bad data from previous enrichment runs.

Targets:
1. Bad website URLs (mega-sites, unrelated domains, parking pages)
2. Unverified LinkedIn URLs that return 404
3. Stale employee estimates from crude AI buckets
4. Recalculate enrichment levels after cleanup

Usage:
    python -m app.scripts.data_quality_cleanup --audit          # Audit only, don't fix
    python -m app.scripts.data_quality_cleanup --fix-websites   # Fix bad website URLs
    python -m app.scripts.data_quality_cleanup --fix-linkedin   # Fix bad LinkedIn URLs
    python -m app.scripts.data_quality_cleanup --fix-employees  # Fix crude employee estimates
    python -m app.scripts.data_quality_cleanup --all            # Fix everything
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from urllib.parse import urlparse

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("cleanup")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://sbjbqjuzjjjpdilmpzkb.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiamJxanV6ampqcGRpbG1wemtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE4NDQ5MCwiZXhwIjoyMDg5NzYwNDkwfQ.A6rN5bAEoSJAoYOM3Du7IYhZAxGnzFeawd0asJljUwM")


def get_sb():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ═══════════════════════════════════════════════════════════════════════════
# BAD WEBSITE DETECTION
# ═══════════════════════════════════════════════════════════════════════════

# Domains that should NEVER be a company website
BAD_DOMAINS = {
    # Search engines / social media
    "baidu.com", "google.com", "bing.com", "yahoo.com",
    "facebook.com", "twitter.com", "x.com", "instagram.com",
    "tiktok.com", "pinterest.com", "reddit.com", "tumblr.com",
    "linkedin.com", "youtube.com", "vimeo.com",
    # Reference / media
    "wikipedia.org", "imdb.com", "bbc.co.uk", "bbc.com",
    "theguardian.com", "telegraph.co.uk", "ft.com",
    # E-commerce giants
    "amazon.com", "amazon.co.uk", "ebay.com", "ebay.co.uk",
    "alibaba.com", "aliexpress.com", "etsy.com",
    # Tech giants
    "apple.com", "microsoft.com", "github.com", "gitlab.com",
    # Government / generic
    "gov.uk", "nhs.uk", "companies-house.gov.uk",
    # Domain parking / sales
    "godaddy.com", "namecheap.com", "dan.com", "sedo.com",
    "hugedomains.com", "afternic.com", "domainstore.co.uk",
    # Generic hosting / CDNs
    "wordpress.com", "blogspot.com", "wix.com", "squarespace.com",
    "weebly.com", "medium.com", "substack.com",
    # Chinese / foreign mega-sites
    "zhidao.baidu.com", "weibo.com", "qq.com", "taobao.com",
}


def is_bad_website(url: str, company_name: str = "") -> tuple[bool, str]:
    """Check if a URL is clearly wrong for a company website.

    Returns (is_bad, reason).
    """
    if not url:
        return False, ""

    parsed = urlparse(url)
    domain = parsed.netloc.lower().replace("www.", "")

    # Check against known bad domains
    for bad in BAD_DOMAINS:
        if domain == bad or domain.endswith("." + bad):
            return True, f"mega-site: {bad}"

    # Very short domains (1-2 chars before TLD) are usually wrong matches
    # Exception: well-known short domains (bp.com, bt.com, etc.)
    domain_name = domain.split(".")[0]
    legit_short_domains = {"bp", "bt", "ey", "ge", "hp", "lg", "3m", "gsk", "sky", "uk"}
    if len(domain_name) <= 2 and company_name and domain_name not in legit_short_domains:
        # Short domain is probably wrong unless company name IS the abbreviation
        name_clean = re.sub(r"[^a-z]", "", company_name.lower().replace(" limited", "").replace(" ltd", ""))
        name_words = re.findall(r"[a-z]+", company_name.lower())
        initials = "".join(w[0] for w in name_words if w)
        # Accept if domain matches initials or is the full cleaned name
        if domain_name.lower() not in (initials.lower(), name_clean[:2]):
            return True, f"too-short domain: {domain}"

    # Check for obvious redirects to unrelated sites
    if "zhidao." in domain or "baidu." in domain:
        return True, "chinese mega-site"

    return False, ""


def audit_websites(sb, limit=500):
    """Audit website URLs for quality issues."""
    logger.info("Auditing website URLs...")
    last_id = ""
    total_checked = 0
    bad_count = 0
    bad_examples = []

    while total_checked < limit:
        query = sb.table("company_profiles").select(
            "id, sponsor_id, website_url"
        ).filter("website_url", "not.is", "null").order("id", desc=False)
        if last_id:
            query = query.filter("id", "gt", last_id)
        resp = query.limit(200).execute()
        if not resp.data:
            break

        last_id = resp.data[-1]["id"]

        # Get sponsor names for these profiles
        sponsor_ids = list({p["sponsor_id"] for p in resp.data if p.get("sponsor_id")})
        names = {}
        if sponsor_ids:
            for i in range(0, len(sponsor_ids), 30):
                chunk = sponsor_ids[i:i+30]
                nr = sb.table("sponsors").select("id, organisation_name").in_("id", chunk).execute()
                for row in nr.data:
                    names[row["id"]] = row["organisation_name"]

        for p in resp.data:
            total_checked += 1
            name = names.get(p.get("sponsor_id"), "")
            is_bad, reason = is_bad_website(p["website_url"], name)
            if is_bad:
                bad_count += 1
                if len(bad_examples) < 30:
                    bad_examples.append((name[:40], p["website_url"][:60], reason))

    logger.info("Checked %d websites, found %d bad (%.1f%%)", total_checked, bad_count,
                bad_count / max(total_checked, 1) * 100)
    if bad_examples:
        logger.info("Examples of bad websites:")
        for name, url, reason in bad_examples:
            logger.info("  %-40s → %-50s [%s]", name, url, reason)

    return bad_count


def fix_bad_websites(sb, dry_run=False):
    """Remove clearly wrong website URLs."""
    logger.info("Fixing bad website URLs%s...", " (DRY RUN)" if dry_run else "")
    last_id = ""
    fixed = 0
    request_count = 0

    while True:
        # Recreate client every 5000 requests to avoid HTTP/2 stream limit
        if request_count > 5000:
            sb = get_sb()
            request_count = 0

        query = sb.table("company_profiles").select(
            "id, sponsor_id, website_url, enrichment_level"
        ).filter("website_url", "not.is", "null").order("id", desc=False)
        if last_id:
            query = query.filter("id", "gt", last_id)
        resp = query.limit(200).execute()
        request_count += 1
        if not resp.data:
            break

        last_id = resp.data[-1]["id"]

        # Get sponsor names
        sponsor_ids = list({p["sponsor_id"] for p in resp.data if p.get("sponsor_id")})
        names = {}
        if sponsor_ids:
            for i in range(0, len(sponsor_ids), 30):
                chunk = sponsor_ids[i:i+30]
                nr = sb.table("sponsors").select("id, organisation_name").in_("id", chunk).execute()
                request_count += 1
                for row in nr.data:
                    names[row["id"]] = row["organisation_name"]

        for p in resp.data:
            name = names.get(p.get("sponsor_id"), "")
            is_bad, reason = is_bad_website(p["website_url"], name)
            if is_bad:
                if not dry_run:
                    # Null out the bad website and recalculate level
                    sb.table("company_profiles").update({
                        "website_url": None,
                    }).eq("id", p["id"]).execute()
                    request_count += 1
                fixed += 1
                if fixed <= 50:
                    logger.info("  Fixed: %-35s %-50s [%s]", name[:35], p["website_url"][:50], reason)

        if fixed > 0 and fixed % 100 == 0:
            logger.info("  ... fixed %d so far", fixed)

    logger.info("Fixed %d bad website URLs%s", fixed, " (dry run)" if dry_run else "")
    return fixed


# ═══════════════════════════════════════════════════════════════════════════
# BAD LINKEDIN VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════

async def verify_linkedin_urls(sb, limit=5000, dry_run=False):
    """Verify LinkedIn URLs actually exist by checking with HEAD requests."""
    logger.info("Verifying LinkedIn URLs%s...", " (DRY RUN)" if dry_run else "")
    last_id = ""
    checked = 0
    bad = 0

    async with httpx.AsyncClient(
        timeout=10, follow_redirects=False,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
    ) as client:
        while checked < limit:
            query = sb.table("company_profiles").select(
                "id, linkedin_url"
            ).filter("linkedin_url", "not.is", "null").order("id", desc=False)
            if last_id:
                query = query.filter("id", "gt", last_id)
            resp = query.limit(100).execute()
            if not resp.data:
                break

            last_id = resp.data[-1]["id"]

            sem = asyncio.Semaphore(3)  # Gentle on LinkedIn
            async def check_one(profile):
                async with sem:
                    url = profile["linkedin_url"]
                    try:
                        r = await client.head(url, timeout=8)
                        # LinkedIn returns 999 for bot detection, 404 for not found
                        if r.status_code in (404, 999):
                            return profile["id"], url, "not_found"
                        elif r.status_code in (200, 301, 302):
                            return profile["id"], url, "ok"
                        else:
                            return profile["id"], url, f"status_{r.status_code}"
                    except Exception:
                        return profile["id"], url, "error"

            tasks = [check_one(p) for p in resp.data]
            results = await asyncio.gather(*tasks)

            for pid, url, status in results:
                checked += 1
                if status == "not_found":
                    bad += 1
                    if not dry_run:
                        sb.table("company_profiles").update({
                            "linkedin_url": None,
                        }).eq("id", pid).execute()
                    if bad <= 20:
                        logger.info("  Bad LinkedIn: %s [%s]", url[:60], status)

            if checked % 500 == 0:
                logger.info("  ... checked %d, found %d bad (%.1f%%)", checked, bad,
                            bad / max(checked, 1) * 100)

            # Rate limit — LinkedIn will block us if too fast
            await asyncio.sleep(2)

    logger.info("Checked %d LinkedIn URLs, found %d bad (%.1f%%)", checked, bad,
                bad / max(checked, 1) * 100)
    return bad


# ═══════════════════════════════════════════════════════════════════════════
# EMPLOYEE ESTIMATE CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

def fix_crude_employee_estimates(sb, dry_run=False):
    """Replace crude bucket estimates (5, 25, 150, 500, 5000) with null.

    These were generated from the old prompt's 'micro/small/medium/large/enterprise'
    mapping and are too imprecise to be useful. Better to have no data than
    misleadingly precise-looking data.
    """
    logger.info("Fixing crude employee estimates%s...", " (DRY RUN)" if dry_run else "")
    crude_values = {5, 25, 150, 500, 5000}  # Old bucket values
    last_id = ""
    fixed = 0

    while True:
        query = sb.table("company_profiles").select(
            "id, employee_count_estimate, employee_count_source"
        ).eq("employee_count_source", "ai_intelligence").order("id", desc=False)
        if last_id:
            query = query.filter("id", "gt", last_id)
        resp = query.limit(200).execute()
        if not resp.data:
            break

        last_id = resp.data[-1]["id"]

        for p in resp.data:
            est = p.get("employee_count_estimate")
            if est in crude_values:
                if not dry_run:
                    sb.table("company_profiles").update({
                        "employee_count_estimate": None,
                        "employee_count_source": None,
                    }).eq("id", p["id"]).execute()
                fixed += 1

        if fixed > 0 and fixed % 100 == 0:
            logger.info("  ... cleared %d crude estimates", fixed)

    logger.info("Cleared %d crude employee estimates%s", fixed, " (dry run)" if dry_run else "")
    return fixed


# ═══════════════════════════════════════════════════════════════════════════
# WEBSITE CONTENT VERIFICATION (re-verify existing websites)
# ═══════════════════════════════════════════════════════════════════════════

async def verify_website_content(sb, limit=5000, dry_run=False):
    """Re-verify existing websites by checking if company name appears on the page."""
    logger.info("Verifying website content matches%s...", " (DRY RUN)" if dry_run else "")
    last_id = ""
    checked = 0
    mismatched = 0

    async with httpx.AsyncClient(
        timeout=10, follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        limits=httpx.Limits(max_connections=15, max_keepalive_connections=5),
    ) as client:
        while checked < limit:
            query = sb.table("company_profiles").select(
                "id, sponsor_id, website_url"
            ).filter("website_url", "not.is", "null").order("id", desc=False)
            if last_id:
                query = query.filter("id", "gt", last_id)
            resp = query.limit(100).execute()
            if not resp.data:
                break

            last_id = resp.data[-1]["id"]

            # Get sponsor names
            sponsor_ids = list({p["sponsor_id"] for p in resp.data if p.get("sponsor_id")})
            names = {}
            if sponsor_ids:
                for i in range(0, len(sponsor_ids), 30):
                    chunk = sponsor_ids[i:i+30]
                    nr = sb.table("sponsors").select("id, organisation_name").in_("id", chunk).execute()
                    for row in nr.data:
                        names[row["id"]] = row["organisation_name"]

            sem = asyncio.Semaphore(10)

            async def verify_one(profile):
                async with sem:
                    name = names.get(profile.get("sponsor_id"), "")
                    if not name or len(name) < 3:
                        return "skip"
                    url = profile["website_url"]

                    # Skip already-verified domains (first check for known-bad)
                    is_bad, reason = is_bad_website(url, name)
                    if is_bad:
                        return "bad"

                    try:
                        r = await client.get(url, timeout=8)
                        if r.status_code >= 400:
                            return "skip"  # Can't verify, leave it
                        page_text = r.text[:80_000].lower()

                        # Check if company name appears
                        name_lower = name.lower()
                        check_name = name_lower
                        for sfx in [" limited", " ltd", " ltd.", " plc", " llp",
                                    " inc", " (uk)", " uk"]:
                            check_name = check_name.replace(sfx, "").strip()

                        # Try matching strategies
                        if len(check_name) >= 4 and check_name in page_text:
                            return "ok"

                        # Check significant words in title
                        words = [w for w in re.findall(r"[a-z]{4,}", check_name)
                                 if w not in {"the", "and", "for", "group", "services",
                                              "solutions", "international", "consulting",
                                              "management", "company", "limited"}]
                        title_match = re.search(r"<title[^>]*>([^<]{2,300})</title>", r.text[:10_000], re.I)
                        title_text = title_match.group(1).lower() if title_match else ""

                        for w in words[:3]:
                            if w in title_text:
                                return "ok"

                        # Check domain contains a significant word
                        domain = urlparse(url).netloc.lower().replace("www.", "").split(".")[0]
                        for w in words[:3]:
                            if w in domain:
                                return "ok"

                        return "mismatch"
                    except Exception:
                        return "skip"

            tasks = [verify_one(p) for p in resp.data]
            results = await asyncio.gather(*tasks)

            request_count = 0
            for i, result in enumerate(results):
                checked += 1
                if result in ("bad", "mismatch"):
                    mismatched += 1
                    p = resp.data[i]
                    name = names.get(p.get("sponsor_id"), "?")
                    if not dry_run:
                        sb.table("company_profiles").update({
                            "website_url": None,
                        }).eq("id", p["id"]).execute()
                        request_count += 1
                        # Recreate client every 5000 requests to avoid HTTP/2 stream limit
                        if request_count > 5000:
                            sb = get_sb()
                            request_count = 0
                    if mismatched <= 30:
                        logger.info("  Mismatch: %-35s → %s", name[:35], p["website_url"][:50])

            if checked % 500 == 0:
                logger.info("  ... verified %d, mismatched %d (%.1f%%)", checked, mismatched,
                            mismatched / max(checked, 1) * 100)

    logger.info("Verified %d websites, found %d mismatches (%.1f%%)", checked, mismatched,
                mismatched / max(checked, 1) * 100)
    return mismatched


# ═══════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Data quality cleanup")
    parser.add_argument("--audit", action="store_true", help="Audit only, don't fix")
    parser.add_argument("--fix-websites", action="store_true", help="Fix bad website URLs")
    parser.add_argument("--fix-linkedin", action="store_true", help="Verify and fix LinkedIn URLs")
    parser.add_argument("--fix-employees", action="store_true", help="Fix crude employee estimates")
    parser.add_argument("--verify-websites", action="store_true", help="Content-verify existing websites")
    parser.add_argument("--all", action="store_true", help="Run all fixes")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--limit", type=int, default=5000, help="Max items to process")
    args = parser.parse_args()

    sb = get_sb()

    if args.audit or (not any([args.fix_websites, args.fix_linkedin, args.fix_employees,
                                args.verify_websites, args.all])):
        audit_websites(sb, limit=args.limit)
        return

    if args.fix_websites or args.all:
        fix_bad_websites(sb, dry_run=args.dry_run)

    if args.fix_employees or args.all:
        fix_crude_employee_estimates(sb, dry_run=args.dry_run)

    if args.fix_linkedin or args.all:
        asyncio.run(verify_linkedin_urls(sb, limit=args.limit, dry_run=args.dry_run))

    if args.verify_websites or args.all:
        asyncio.run(verify_website_content(sb, limit=args.limit, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
