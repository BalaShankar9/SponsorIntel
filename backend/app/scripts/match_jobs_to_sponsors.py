"""
Job-to-Sponsor Matching Engine.

Matches unlinked jobs to sponsors using multi-strategy name resolution:
1. Exact normalized name match against sponsor register
2. Trading name match (from T/A patterns in sponsor names)
3. Domain match (job URL domain vs sponsor website domain)
4. Prefix match (job company name is a prefix of a sponsor name)
5. Contains match (sponsor name starts with/contains the job company name)
6. Token overlap (for multi-word names, at least 75% token overlap)

The matching uses the `name_variants` JSONB in company_profiles and
`organisation_name_normalised` in sponsors for fast lookups.

Usage:
    python -m app.scripts.match_jobs_to_sponsors [--limit 1000] [--dry-run]
"""

import argparse
import asyncio
import logging
import os
import re
import time
from collections import defaultdict
from typing import Optional
from urllib.parse import urlparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("job_matcher")

# Recruitment agencies — these post jobs on behalf of sponsors, not themselves
RECRUITMENT_AGENCIES = {
    "HAYS", "REED", "ADECCO", "MANPOWER", "RANDSTAD", "ROBERT HALF",
    "MICHAEL PAGE", "PAGE GROUP", "PAGEGROUP", "ROBERT WALTERS",
    "HARVEY NASH", "CAPITA", "PERTEMPS", "STAFFLINE", "MATCHTECH",
    "SRG", "SPENCER OGDEN", "PROGRESSIVE", "BLUE ARROW", "IMPELLAM",
    "JAM RECRUITMENT", "LA FOSSE", "NIGEL FRANK", "MADISON BRIDGE",
    # Identified from unmatched job analysis
    "EXPERIS", "MORSON EDGE", "MORSON", "SPECTRUM IT RECRUITMENT",
    "CERTAIN ADVANTAGE", "BRIGHT PURPLE RESOURCING", "IO ASSOCIATES",
    "SANDERSON RECRUITMENT", "SANDERSON GOVERNMENT AND DEFENCE",
    "CLIENT SERVER", "PLATFORM RECRUITMENT", "ANSON MCCADE",
    "CBSBUTLER", "AKKODIS", "VIQU IT", "VIQU",
    "HARNHAM", "VANRATH", "RISE TECHNICAL RECRUITMENT",
    "FORWARD ROLE", "GERRELL HARD", "GERRELL AND HARD",
}


def normalize_company(name: str) -> str:
    """Normalize a company name from a job listing for matching."""
    if not name:
        return ""
    n = name.upper().strip()
    # Remove common suffixes (loop to strip multiple, e.g. "INTERNATIONAL LLC")
    changed = True
    while changed:
        changed = False
        for suffix in [
            " LIMITED", " LTD", " LTD.", " PLC", " LLP", " LP", " INC",
            " INC.", " LLC", " CORPORATION", " CORP", " CORP.",
            " CO.", " CO", " CIC", " C.I.C", " C.I.C.",
            " UK", " (UK)", " GROUP", " HOLDINGS", " INTERNATIONAL",
            " SERVICES", " SOLUTIONS", " CONSULTING",
        ]:
            if n.endswith(suffix):
                n = n[: -len(suffix)]
                changed = True
    # Remove punctuation except spaces
    n = re.sub(r"[^A-Z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def extract_domain(url: str) -> Optional[str]:
    """Extract clean domain from URL."""
    if not url:
        return None
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        domain = (parsed.netloc or parsed.path.split("/")[0]).lower().strip()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain if domain else None
    except Exception:
        return None


def is_recruitment_agency(name: str) -> bool:
    """Check if a company name is a known recruitment agency."""
    norm = normalize_company(name)
    return norm in RECRUITMENT_AGENCIES or any(
        agency in norm for agency in RECRUITMENT_AGENCIES
    )


async def get_supabase():
    """Get Supabase client."""
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


async def build_lookup_indexes(sb) -> dict:
    """
    Build in-memory lookup indexes from sponsors + company_profiles.

    Returns dict with:
    - norm_to_sponsor: { normalized_name: sponsor_id }
    - trading_to_sponsor: { trading_name: sponsor_id }
    - domain_to_sponsor: { domain: sponsor_id }
    - search_to_sponsor: { search_name_variant: sponsor_id }
    - prefix_index: { first_word: [(full_name, sponsor_id), ...] }
    """
    logger.info("Building lookup indexes...")
    start = time.time()

    norm_to_sponsor = {}
    trading_to_sponsor = {}
    domain_to_sponsor = {}
    search_to_sponsor = {}
    prefix_index = defaultdict(list)  # first word -> list of (full_name, sponsor_id)

    # Load sponsors with their normalised names
    page = 0
    batch_size = 1000
    sponsor_count = 0

    while True:
        resp = sb.table("sponsors").select(
            "id, organisation_name_normalised"
        ).range(page * batch_size, (page + 1) * batch_size - 1).execute()

        if not resp.data:
            break

        for row in resp.data:
            raw_norm = row.get("organisation_name_normalised")
            if raw_norm:
                # Re-normalize through our function to strip suffixes consistently
                norm = normalize_company(raw_norm)
                if norm:
                    norm_to_sponsor[norm] = row["id"]
                    first_word = norm.split()[0] if norm.split() else ""
                    if first_word and len(first_word) >= 3:
                        prefix_index[first_word].append((norm, row["id"]))
                # Also index the raw DB value for exact matches
                norm_to_sponsor[raw_norm] = row["id"]
            sponsor_count += 1

        if len(resp.data) < batch_size:
            break
        page += 1

    logger.info("Loaded %d sponsors (%.1fs)", sponsor_count, time.time() - start)

    # Load name_variants from company_profiles
    page = 0
    variant_count = 0

    while True:
        resp = sb.table("company_profiles").select(
            "sponsor_id, name_variants"
        ).not_.is_("name_variants", "null").range(
            page * batch_size, (page + 1) * batch_size - 1
        ).execute()

        if not resp.data:
            break

        for row in resp.data:
            sid = row["sponsor_id"]
            variants = row.get("name_variants") or {}

            # Trading name
            trading = variants.get("trading_name")
            if trading:
                trading_norm = normalize_company(trading)
                if trading_norm:
                    trading_to_sponsor[trading_norm] = sid
                trading_upper = trading.upper().strip()
                if trading_upper:
                    trading_to_sponsor[trading_upper] = sid

            # Domain
            domain = variants.get("domain")
            if domain:
                domain_to_sponsor[domain.lower()] = sid

            # All search names
            search_names = variants.get("search_names") or []
            for sn in search_names:
                if sn and len(sn) > 2:
                    search_to_sponsor[sn] = sid
                    # Also add to prefix index
                    first_word = sn.split()[0] if sn.split() else ""
                    if first_word and len(first_word) >= 3:
                        prefix_index[first_word].append((sn, sid))

            variant_count += 1

        if len(resp.data) < batch_size:
            break
        page += 1

    elapsed = time.time() - start
    logger.info(
        "Indexes built in %.1fs: %d norm, %d trading, %d domains, %d search, %d prefix groups",
        elapsed, len(norm_to_sponsor), len(trading_to_sponsor),
        len(domain_to_sponsor), len(search_to_sponsor), len(prefix_index),
    )

    return {
        "norm_to_sponsor": norm_to_sponsor,
        "trading_to_sponsor": trading_to_sponsor,
        "domain_to_sponsor": domain_to_sponsor,
        "search_to_sponsor": search_to_sponsor,
        "prefix_index": dict(prefix_index),
    }


def find_prefix_match(company_norm: str, prefix_index: dict, min_name_len: int = 3) -> Optional[str]:
    """
    Find a sponsor match where the job company name is a prefix of the sponsor name.

    Example: "OPTUM" matches "OPTUM HEALTH SOLUTIONS UK"
    Example: "FLEXPORT" matches "FLEXPORT INTERNATIONAL"
    Example: "GE VERNOVA" matches "GE VERNOVA INTERNATIONAL LLC"
    """
    if not company_norm or len(company_norm) < min_name_len:
        return None

    first_word = company_norm.split()[0]
    if first_word not in prefix_index:
        return None

    candidates = prefix_index[first_word]
    best_match = None
    best_len_diff = float("inf")

    for full_name, sid in candidates:
        # Job company name must be a prefix of sponsor name
        if full_name.startswith(company_norm):
            len_diff = len(full_name) - len(company_norm)
            # Prefer closest length match (less extra suffixed words = better match)
            if len_diff < best_len_diff:
                best_len_diff = len_diff
                best_match = sid

    return best_match


def find_token_match(company_norm: str, prefix_index: dict) -> Optional[str]:
    """
    Find a match using token overlap — for multi-word company names.

    Only matches if ≥75% of tokens from the shorter name are in the longer name.
    Uses the prefix index to narrow candidates efficiently (must share first word).
    """
    if not company_norm:
        return None
    tokens_job = set(company_norm.split())
    if len(tokens_job) < 2:
        return None

    first_word = company_norm.split()[0]
    if first_word not in prefix_index:
        return None

    candidates = prefix_index[first_word]
    best_score = 0.0
    best_sid = None

    for full_name, sid in candidates:
        if len(full_name) < 4:
            continue
        tokens_sponsor = set(full_name.split())
        intersection = tokens_job & tokens_sponsor
        shorter = min(len(tokens_job), len(tokens_sponsor))
        score = len(intersection) / shorter if shorter > 0 else 0.0

        if score > best_score and score >= 0.75:
            best_score = score
            best_sid = sid

    return best_sid


async def match_jobs(sb, indexes: dict, limit: int, dry_run: bool):
    """Match unlinked jobs to sponsors using multi-strategy resolution."""
    norm_idx = indexes["norm_to_sponsor"]
    trading_idx = indexes["trading_to_sponsor"]
    domain_idx = indexes["domain_to_sponsor"]
    search_idx = indexes["search_to_sponsor"]
    prefix_idx = indexes["prefix_index"]

    stats = {
        "processed": 0,
        "matched_exact": 0,
        "matched_trading": 0,
        "matched_domain": 0,
        "matched_search": 0,
        "matched_prefix": 0,
        "matched_token": 0,
        "skipped_agency": 0,
        "unmatched": 0,
        "errors": 0,
    }

    page = 0
    batch_size = 500
    total_processed = 0
    start = time.time()

    while total_processed < limit:
        resp = sb.table("jobs").select(
            "id, company_name_raw, company_name_normalised, source_url, source"
        ).is_("sponsor_id", "null").not_.is_(
            "company_name_raw", "null"
        ).range(page * batch_size, (page + 1) * batch_size - 1).execute()

        if not resp.data:
            break

        updates = []  # Batch updates for efficiency

        for job in resp.data:
            if total_processed >= limit:
                break

            company_raw = job.get("company_name_raw") or ""
            if not company_raw.strip():
                total_processed += 1
                stats["processed"] += 1
                stats["unmatched"] += 1
                continue

            # Skip known recruitment agencies
            if is_recruitment_agency(company_raw):
                stats["skipped_agency"] += 1
                total_processed += 1
                stats["processed"] += 1
                stats["unmatched"] += 1
                continue

            company_norm = job.get("company_name_normalised") or normalize_company(company_raw)
            job_url = job.get("source_url") or ""
            sponsor_id = None
            match_method = None

            # Strategy 1: Exact normalized name match
            if company_norm and company_norm in norm_idx:
                sponsor_id = norm_idx[company_norm]
                match_method = "exact"
                stats["matched_exact"] += 1

            # Strategy 2: Trading name match
            if not sponsor_id and company_norm:
                if company_norm in trading_idx:
                    sponsor_id = trading_idx[company_norm]
                    match_method = "trading"
                    stats["matched_trading"] += 1
                elif company_raw.upper().strip() in trading_idx:
                    sponsor_id = trading_idx[company_raw.upper().strip()]
                    match_method = "trading"
                    stats["matched_trading"] += 1

            # Strategy 3: Domain match (from job URL)
            if not sponsor_id and job_url:
                job_domain = extract_domain(job_url)
                if job_domain and job_domain in domain_idx:
                    sponsor_id = domain_idx[job_domain]
                    match_method = "domain"
                    stats["matched_domain"] += 1

            # Strategy 4: Search name variant match
            if not sponsor_id and company_norm and company_norm in search_idx:
                sponsor_id = search_idx[company_norm]
                match_method = "search"
                stats["matched_search"] += 1

            # Strategy 5: Prefix match (job name is prefix of sponsor name)
            if not sponsor_id and company_norm:
                sponsor_id = find_prefix_match(company_norm, prefix_idx)
                if sponsor_id:
                    match_method = "prefix"
                    stats["matched_prefix"] += 1

            # Strategy 6: Token overlap (multi-word names, ≥75% overlap)
            if not sponsor_id and company_norm:
                sponsor_id = find_token_match(company_norm, prefix_idx)
                if sponsor_id:
                    match_method = "token"
                    stats["matched_token"] += 1

            if sponsor_id:
                updates.append({"id": job["id"], "sponsor_id": sponsor_id})
            else:
                stats["unmatched"] += 1

            total_processed += 1
            stats["processed"] += 1

        # Apply batch updates
        if not dry_run and updates:
            for upd in updates:
                try:
                    sb.table("jobs").update({
                        "sponsor_id": upd["sponsor_id"],
                    }).eq("id", upd["id"]).execute()
                except Exception as e:
                    stats["errors"] += 1
                    if stats["errors"] <= 5:
                        logger.warning("Update error: %s", str(e)[:80])

        page += 1

        if total_processed % 500 == 0 and total_processed > 0:
            elapsed = time.time() - start
            rate = total_processed / elapsed if elapsed > 0 else 0
            matched = sum(stats[k] for k in stats if k.startswith("matched_"))
            logger.info(
                "Progress: %d processed, %d matched (%.1f%%), %d unmatched (%.1f/sec)",
                total_processed, matched,
                (matched / total_processed * 100) if total_processed > 0 else 0,
                stats["unmatched"], rate,
            )

    return stats


async def main():
    parser = argparse.ArgumentParser(description="Match jobs to sponsors")
    parser.add_argument("--limit", type=int, default=10000, help="Max jobs to process")
    parser.add_argument("--dry-run", action="store_true", help="Show matches without applying")
    args = parser.parse_args()

    logger.info("=== JOB-TO-SPONSOR MATCHING ===")
    if args.dry_run:
        logger.info("DRY RUN — no changes will be applied")

    sb = await get_supabase()
    indexes = await build_lookup_indexes(sb)

    start = time.time()
    stats = await match_jobs(sb, indexes, args.limit, args.dry_run)
    elapsed = time.time() - start

    total_matched = sum(stats[k] for k in stats if k.startswith("matched_"))

    logger.info("\n=== MATCHING COMPLETE (%.1fs) ===", elapsed)
    logger.info("Processed: %d", stats["processed"])
    logger.info("Total matched: %d (%.1f%%)",
                total_matched,
                (total_matched / stats["processed"] * 100) if stats["processed"] > 0 else 0)
    logger.info("  Exact name:     %d", stats["matched_exact"])
    logger.info("  Trading name:   %d", stats["matched_trading"])
    logger.info("  Domain:         %d", stats["matched_domain"])
    logger.info("  Search variant: %d", stats["matched_search"])
    logger.info("  Prefix match:   %d", stats["matched_prefix"])
    logger.info("  Token overlap:  %d", stats["matched_token"])
    logger.info("Skipped (agencies): %d", stats["skipped_agency"])
    logger.info("Unmatched: %d", stats["unmatched"])
    logger.info("Errors: %d", stats["errors"])


if __name__ == "__main__":
    asyncio.run(main())
