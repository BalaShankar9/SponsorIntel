"""
Deploy SUPERPOWERED enrichment worker fleet v2 to Railway.

25-worker army across 6 specialised modes with deterministic partitioning.
Each worker runs the Superpowered Worker v2 (enrich_worker.py) with
multi-provider LLM routing, smart website discovery, deep HTML scraping,
and intelligent career page detection.

Usage:
    python deploy_workers.py                        # Deploy all workers
    python deploy_workers.py --mode website         # Deploy only website scouts
    python deploy_workers.py --mode ai_intel        # Deploy only AI intel agents
    python deploy_workers.py --dry-run              # Show what would be deployed
    python deploy_workers.py --list                 # Show fleet configuration
    python deploy_workers.py --destroy              # Tear down all workers
    python deploy_workers.py --destroy --mode web   # Tear down website scouts only

Prerequisites:
    - Railway CLI installed: npm i -g @railway/cli
    - Logged in: railway login
    - Project linked: railway link
"""

import argparse
import os
import subprocess
import sys
import time

# ═══════════════════════════════════════════════════════════════════════════
# SUPER SOLDIER FLEET v2 — 25 WORKERS
# ═══════════════════════════════════════════════════════════════════════════
#
# Architecture:
#   - website (5 workers):     Smart domain discovery, 20+ patterns per company
#   - deep_scrape (4 workers): Contact extraction, social links, tech stack from HTML
#   - careers (3 workers):     Intelligent career page detection + content analysis
#   - linkedin (3 workers):    Deterministic LinkedIn URL construction (instant)
#   - ai_intel (3 workers):    Multi-provider LLM company intelligence
#   - ai_search (2 workers):   LLM-generated job search tips
#   - full_sweep (5 workers):  End-to-end pipeline for maximum coverage
#
# Data partitioning: MD5(sponsor_id) % N_partitions — zero conflict between workers

WORKER_FLEET = [
    # ─── WEBSITE DISCOVERY SCOUTS (5) ─── pure HTTP, highly parallelizable ───
    {"name": "scout-web-0", "mode": "website", "partition": 0, "partitions": 5, "limit": 30000, "batch": 100},
    {"name": "scout-web-1", "mode": "website", "partition": 1, "partitions": 5, "limit": 30000, "batch": 100},
    {"name": "scout-web-2", "mode": "website", "partition": 2, "partitions": 5, "limit": 30000, "batch": 100},
    {"name": "scout-web-3", "mode": "website", "partition": 3, "partitions": 5, "limit": 30000, "batch": 100},
    {"name": "scout-web-4", "mode": "website", "partition": 4, "partitions": 5, "limit": 30000, "batch": 100},

    # ─── DEEP SCRAPE AGENTS (4) ─── extract contacts, socials, tech stack ────
    {"name": "scrape-deep-0", "mode": "deep_scrape", "partition": 0, "partitions": 4, "limit": 25000, "batch": 80},
    {"name": "scrape-deep-1", "mode": "deep_scrape", "partition": 1, "partitions": 4, "limit": 25000, "batch": 80},
    {"name": "scrape-deep-2", "mode": "deep_scrape", "partition": 2, "partitions": 4, "limit": 25000, "batch": 80},
    {"name": "scrape-deep-3", "mode": "deep_scrape", "partition": 3, "partitions": 4, "limit": 25000, "batch": 80},

    # ─── CAREER PAGE HUNTERS (3) ─── 20 URL paths + homepage link scanning ───
    {"name": "scout-careers-0", "mode": "careers", "partition": 0, "partitions": 3, "limit": 20000, "batch": 80},
    {"name": "scout-careers-1", "mode": "careers", "partition": 1, "partitions": 3, "limit": 20000, "batch": 80},
    {"name": "scout-careers-2", "mode": "careers", "partition": 2, "partitions": 3, "limit": 20000, "batch": 80},

    # ─── LINKEDIN BUILDERS (3) ─── deterministic, no network needed ──────────
    {"name": "scout-linkedin-0", "mode": "linkedin", "partition": 0, "partitions": 3, "limit": 50000, "batch": 200},
    {"name": "scout-linkedin-1", "mode": "linkedin", "partition": 1, "partitions": 3, "limit": 50000, "batch": 200},
    {"name": "scout-linkedin-2", "mode": "linkedin", "partition": 2, "partitions": 3, "limit": 50000, "batch": 200},

    # ─── AI INTELLIGENCE AGENTS (3) ─── multi-provider LLM company intel ─────
    {"name": "agent-intel-0", "mode": "ai_intel", "partition": 0, "partitions": 3, "limit": 15000, "batch": 30},
    {"name": "agent-intel-1", "mode": "ai_intel", "partition": 1, "partitions": 3, "limit": 15000, "batch": 30},
    {"name": "agent-intel-2", "mode": "ai_intel", "partition": 2, "partitions": 3, "limit": 15000, "batch": 30},

    # ─── AI SEARCH TIP AGENTS (2) ─── job search tips via LLM ────────────────
    {"name": "agent-search-0", "mode": "ai_search", "partition": 0, "partitions": 2, "limit": 10000, "batch": 30},
    {"name": "agent-search-1", "mode": "ai_search", "partition": 1, "partitions": 2, "limit": 10000, "batch": 30},

    # ─── FULL SWEEP SOLDIERS (5) ─── end-to-end enrichment pipeline ──────────
    {"name": "soldier-sweep-0", "mode": "full_sweep", "partition": 0, "partitions": 5, "limit": 10000, "batch": 50},
    {"name": "soldier-sweep-1", "mode": "full_sweep", "partition": 1, "partitions": 5, "limit": 10000, "batch": 50},
    {"name": "soldier-sweep-2", "mode": "full_sweep", "partition": 2, "partitions": 5, "limit": 10000, "batch": 50},
    {"name": "soldier-sweep-3", "mode": "full_sweep", "partition": 3, "partitions": 5, "limit": 10000, "batch": 50},
    {"name": "soldier-sweep-4", "mode": "full_sweep", "partition": 4, "partitions": 5, "limit": 10000, "batch": 50},
]

ALL_MODES = ["website", "deep_scrape", "careers", "linkedin", "ai_intel", "ai_search", "full_sweep"]

# Environment variables propagated to each worker
SHARED_ENV_KEYS = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "NVIDIA_API_KEY",
    "GROQ_API_KEY",
    "TOGETHER_API_KEY",
    "OPENROUTER_API_KEY",
]


def run_cmd(cmd: list[str], check=True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def check_railway_cli():
    try:
        result = run_cmd(["railway", "whoami"], check=False)
        if result.returncode != 0:
            print("ERROR: Not logged in to Railway. Run: railway login")
            sys.exit(1)
        print(f"Railway user: {result.stdout.strip()}")
    except FileNotFoundError:
        print("ERROR: Railway CLI not installed. Run: npm i -g @railway/cli")
        sys.exit(1)


def deploy_worker(worker: dict, dry_run: bool = False):
    name = worker["name"]
    env_vars = {
        "WORKER_MODE": worker["mode"],
        "WORKER_LIMIT": str(worker["limit"]),
        "WORKER_BATCH": str(worker["batch"]),
        "WORKER_PARTITION": str(worker["partition"]),
        "WORKER_PARTITIONS": str(worker["partitions"]),
        "RAILWAY_DOCKERFILE_PATH": "Dockerfile.worker",
    }

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Deploying {name}:")
    print(f"  Mode: {worker['mode']}")
    print(f"  Partition: {worker['partition']}/{worker['partitions']}")
    print(f"  Limit: {worker['limit']:,}  Batch: {worker['batch']}")

    if dry_run:
        return True

    # Create service with initial variables using `railway add`
    var_args = []
    for key, value in env_vars.items():
        var_args.extend(["--variables", f"{key}={value}"])

    # Propagate shared secrets from local environment
    for key in SHARED_ENV_KEYS:
        val = os.environ.get(key, "")
        if val:
            var_args.extend(["--variables", f"{key}={val}"])

    try:
        cmd = ["railway", "add", "--service", name] + var_args
        result = run_cmd(cmd, check=False)
        if result.returncode != 0:
            stderr = result.stderr.strip()
            if "already exists" in stderr or "already" in stderr.lower():
                print(f"  Service exists — updating variables...")
                # Update variables on existing service
                for key, value in env_vars.items():
                    run_cmd(["railway", "variable", "set", f"{key}={value}",
                             "--service", name, "--skip-deploys"], check=False)
                for key in SHARED_ENV_KEYS:
                    val = os.environ.get(key, "")
                    if val:
                        run_cmd(["railway", "variable", "set", f"{key}={val}",
                                 "--service", name, "--skip-deploys"], check=False)
            else:
                print(f"  WARNING: {stderr[:200]}")
    except Exception as e:
        print(f"  ERROR creating service: {e}")
        return False

    # Deploy the worker
    result = run_cmd(["railway", "up", "--service", name, "--detach"], check=False)
    if result.returncode == 0:
        print(f"  DEPLOYED: {name}")
        return True
    else:
        print(f"  DEPLOY ERROR: {result.stderr.strip()[:200]}")
        return False


def destroy_worker(worker: dict, dry_run: bool = False):
    name = worker["name"]
    print(f"{'[DRY RUN] ' if dry_run else ''}Destroying {name}...")
    if dry_run:
        return
    # Delete service — Railway CLI syntax
    run_cmd(["railway", "service", "delete", name, "--yes"], check=False)


def main():
    parser = argparse.ArgumentParser(
        description="Deploy SUPERPOWERED enrichment worker fleet v2 to Railway",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  deploy_workers.py --list              Show all 25 workers and capacity
  deploy_workers.py --dry-run           Preview deployment
  deploy_workers.py --mode website      Deploy only website scouts (5 workers)
  deploy_workers.py --mode full_sweep   Deploy only full sweep soldiers (5 workers)
  deploy_workers.py --destroy           Tear down entire fleet
""",
    )
    parser.add_argument("--mode", type=str, choices=ALL_MODES,
                        help="Deploy only workers for this mode")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deployed")
    parser.add_argument("--list", action="store_true", help="List worker configuration")
    parser.add_argument("--destroy", action="store_true", help="Destroy worker services")
    args = parser.parse_args()

    workers = WORKER_FLEET
    if args.mode:
        workers = [w for w in workers if w["mode"] == args.mode]

    if args.list:
        print("\n  SUPER SOLDIER FLEET v2 — WORKER CONFIGURATION")
        print("  " + "=" * 65)
        print(f"  {'Name':<22} {'Mode':<14} {'Part':<8} {'Limit':<10} {'Batch':<6}")
        print("  " + "-" * 65)

        current_mode = None
        for w in workers:
            if w["mode"] != current_mode:
                current_mode = w["mode"]
                if w != workers[0]:
                    print()
            print(f"  {w['name']:<22} {w['mode']:<14} {w['partition']}/{w['partitions']:<5} "
                  f"{w['limit']:<10,} {w['batch']:<6}")

        total_limit = sum(w["limit"] for w in workers)
        by_mode = {}
        for w in workers:
            by_mode.setdefault(w["mode"], []).append(w)

        print()
        print("  " + "=" * 65)
        print(f"  TOTAL: {len(workers)} workers | {total_limit:,} company capacity")
        print()
        print("  Breakdown by mode:")
        for mode, mworkers in by_mode.items():
            cap = sum(w["limit"] for w in mworkers)
            print(f"    {mode:<14} {len(mworkers)} workers   {cap:>10,} capacity")
        print()
        return

    if args.destroy:
        if not args.dry_run:
            check_railway_cli()
        print(f"\nDestroying {len(workers)} workers...")
        for worker in workers:
            destroy_worker(worker, dry_run=args.dry_run)
        print("Destruction complete.")
        return

    if not args.dry_run:
        check_railway_cli()

    print(f"\nDeploying {len(workers)} SUPERPOWERED workers...")
    deployed = 0
    failed = 0
    for worker in workers:
        ok = deploy_worker(worker, dry_run=args.dry_run)
        if ok:
            deployed += 1
        else:
            failed += 1

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Fleet deployment complete!")
    print(f"  Workers deployed: {deployed}")
    if failed:
        print(f"  Workers failed: {failed}")
    print(f"  Total capacity: {sum(w['limit'] for w in workers):,} companies")


if __name__ == "__main__":
    main()
