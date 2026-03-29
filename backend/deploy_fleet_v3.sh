#!/bin/bash
# Deploy Super Soldier Fleet v3 — Upgraded Railway
# Points all workers to NEW Supabase project (SponsorIntel in Sponsor Intel org)
# Higher limits, bigger batches, more partitions for maximum throughput

set -e

SUPABASE_URL="https://sbjbqjuzjjjpdilmpzkb.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiamJxanV6ampqcGRpbG1wemtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE4NDQ5MCwiZXhwIjoyMDg5NzYwNDkwfQ.A6rN5bAEoSJAoYOM3Du7IYhZAxGnzFeawd0asJljUwM"
NVIDIA_KEY="${NVIDIA_API_KEY:?Set NVIDIA_API_KEY env var}"

DEPLOYED=0
FAILED=0

deploy_worker() {
    local NAME=$1 MODE=$2 PARTITION=$3 PARTITIONS=$4 LIMIT=$5 BATCH=$6

    echo ""
    echo "=== [$((DEPLOYED+FAILED+1))] $NAME (mode=$MODE, partition=$PARTITION/$PARTITIONS, limit=$LIMIT, batch=$BATCH) ==="

    # Update env vars (creates service if needed)
    railway variable set \
        "WORKER_MODE=$MODE" \
        "WORKER_LIMIT=$LIMIT" \
        "WORKER_BATCH=$BATCH" \
        "WORKER_PARTITION=$PARTITION" \
        "WORKER_PARTITIONS=$PARTITIONS" \
        "RAILWAY_DOCKERFILE_PATH=Dockerfile.worker" \
        "SUPABASE_URL=$SUPABASE_URL" \
        "SUPABASE_SERVICE_KEY=$SUPABASE_KEY" \
        "NVIDIA_API_KEY=$NVIDIA_KEY" \
        --service "$NAME" --skip-deploys 2>&1 || {
            echo "  Creating new service..."
            railway add --service "$NAME" 2>&1 || true
            railway variable set \
                "WORKER_MODE=$MODE" \
                "WORKER_LIMIT=$LIMIT" \
                "WORKER_BATCH=$BATCH" \
                "WORKER_PARTITION=$PARTITION" \
                "WORKER_PARTITIONS=$PARTITIONS" \
                "RAILWAY_DOCKERFILE_PATH=Dockerfile.worker" \
                "SUPABASE_URL=$SUPABASE_URL" \
                "SUPABASE_SERVICE_KEY=$SUPABASE_KEY" \
                "NVIDIA_API_KEY=$NVIDIA_KEY" \
                --service "$NAME" --skip-deploys 2>&1
        }

    # Deploy
    if railway up --service "$NAME" --detach 2>&1; then
        echo "  DEPLOYED: $NAME"
        DEPLOYED=$((DEPLOYED+1))
    else
        echo "  FAILED: $NAME"
        FAILED=$((FAILED+1))
    fi
}

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  SUPER SOLDIER FLEET v3 — UPGRADED RAILWAY DEPLOY      ║"
echo "║  New Supabase: sbjbqjuzjjjpdilmpzkb (Sponsor Intel)    ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ─── Website Discovery Scouts (6 partitions, 150K limit each = full coverage) ───
deploy_worker "scout-web-0" "website" 0 6 150000 200
deploy_worker "scout-web-1" "website" 1 6 150000 200
deploy_worker "scout-web-2" "website" 2 6 150000 200
deploy_worker "scout-web-3" "website" 3 6 150000 200
deploy_worker "scout-web-4" "website" 4 6 150000 200
deploy_worker "scout-web-5" "website" 5 6 150000 200

# ─── Deep Scrape Agents (6 partitions) ───
deploy_worker "scrape-deep-0" "deep_scrape" 0 6 150000 150
deploy_worker "scrape-deep-1" "deep_scrape" 1 6 150000 150
deploy_worker "scrape-deep-2" "deep_scrape" 2 6 150000 150
deploy_worker "scrape-deep-3" "deep_scrape" 3 6 150000 150
deploy_worker "scrape-deep-4" "deep_scrape" 4 6 150000 150
deploy_worker "scrape-deep-5" "deep_scrape" 5 6 150000 150

# ─── Career Page Hunters (4 partitions) ───
deploy_worker "scout-careers-0" "careers" 0 4 150000 150
deploy_worker "scout-careers-1" "careers" 1 4 150000 150
deploy_worker "scout-careers-2" "careers" 2 4 150000 150
deploy_worker "scout-careers-3" "careers" 3 4 150000 150

# ─── LinkedIn Builders (4 partitions) ───
deploy_worker "scout-linkedin-0" "linkedin" 0 4 150000 300
deploy_worker "scout-linkedin-1" "linkedin" 1 4 150000 300
deploy_worker "scout-linkedin-2" "linkedin" 2 4 150000 300
deploy_worker "scout-linkedin-3" "linkedin" 3 4 150000 300

# ─── AI Intelligence Agents (4 partitions) ───
deploy_worker "agent-intel-0" "ai_intel" 0 4 150000 50
deploy_worker "agent-intel-1" "ai_intel" 1 4 150000 50
deploy_worker "agent-intel-2" "ai_intel" 2 4 150000 50
deploy_worker "agent-intel-3" "ai_intel" 3 4 150000 50

# ─── AI Search Tip Agents (3 partitions) ───
deploy_worker "agent-search-0" "ai_search" 0 3 150000 50
deploy_worker "agent-search-1" "ai_search" 1 3 150000 50
deploy_worker "agent-search-2" "ai_search" 2 3 150000 50

# ─── Full Sweep Soldiers (6 partitions) ───
deploy_worker "soldier-sweep-0" "full_sweep" 0 6 150000 100
deploy_worker "soldier-sweep-1" "full_sweep" 1 6 150000 100
deploy_worker "soldier-sweep-2" "full_sweep" 2 6 150000 100
deploy_worker "soldier-sweep-3" "full_sweep" 3 6 150000 100
deploy_worker "soldier-sweep-4" "full_sweep" 4 6 150000 100
deploy_worker "soldier-sweep-5" "full_sweep" 5 6 150000 100

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  FLEET v3 DEPLOYMENT COMPLETE!                          ║"
echo "║  Deployed: $DEPLOYED  |  Failed: $FAILED                          ║"
echo "║  Total: 37 super soldiers (upgraded Railway)            ║"
echo "╚══════════════════════════════════════════════════════════╝"
