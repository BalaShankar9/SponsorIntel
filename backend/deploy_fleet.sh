#!/bin/bash
# Deploy Super Soldier Fleet v2 — 25 workers to Railway
# Each worker gets its own service with deterministic partitioning

set -e

SUPABASE_URL="https://sbjbqjuzjjjpdilmpzkb.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiamJxanV6ampqcGRpbG1wemtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE4NDQ5MCwiZXhwIjoyMDg5NzYwNDkwfQ.A6rN5bAEoSJAoYOM3Du7IYhZAxGnzFeawd0asJljUwM"
NVIDIA_KEY="${NVIDIA_API_KEY:?Set NVIDIA_API_KEY env var}"

deploy_worker() {
    local NAME=$1 MODE=$2 PARTITION=$3 PARTITIONS=$4 LIMIT=$5 BATCH=$6

    echo ""
    echo "=== Deploying $NAME (mode=$MODE, partition=$PARTITION/$PARTITIONS) ==="

    railway add --service "$NAME" \
        --variables "WORKER_MODE=$MODE" \
        --variables "WORKER_LIMIT=$LIMIT" \
        --variables "WORKER_BATCH=$BATCH" \
        --variables "WORKER_PARTITION=$PARTITION" \
        --variables "WORKER_PARTITIONS=$PARTITIONS" \
        --variables "RAILWAY_DOCKERFILE_PATH=Dockerfile.worker" \
        --variables "SUPABASE_URL=$SUPABASE_URL" \
        --variables "SUPABASE_SERVICE_KEY=$SUPABASE_KEY" \
        --variables "NVIDIA_API_KEY=$NVIDIA_KEY" \
        2>&1 || echo "  (service may already exist)"

    railway up --service "$NAME" --detach 2>&1
    echo "  DEPLOYED: $NAME"
}

echo "╔══════════════════════════════════════════╗"
echo "║  SUPER SOLDIER FLEET v2 — DEPLOYING     ║"
echo "╚══════════════════════════════════════════╝"

# Website discovery scouts (5)
deploy_worker "scout-web-0" "website" 0 5 30000 100
deploy_worker "scout-web-1" "website" 1 5 30000 100
deploy_worker "scout-web-2" "website" 2 5 30000 100
deploy_worker "scout-web-3" "website" 3 5 30000 100
deploy_worker "scout-web-4" "website" 4 5 30000 100

# Deep scrape agents (4)
deploy_worker "scrape-deep-0" "deep_scrape" 0 4 25000 80
deploy_worker "scrape-deep-1" "deep_scrape" 1 4 25000 80
deploy_worker "scrape-deep-2" "deep_scrape" 2 4 25000 80
deploy_worker "scrape-deep-3" "deep_scrape" 3 4 25000 80

# Career page hunters (3)
deploy_worker "scout-careers-0" "careers" 0 3 20000 80
deploy_worker "scout-careers-1" "careers" 1 3 20000 80
deploy_worker "scout-careers-2" "careers" 2 3 20000 80

# LinkedIn builders (2 more, scout-linkedin-0 already deployed)
deploy_worker "scout-linkedin-1" "linkedin" 1 3 50000 200
deploy_worker "scout-linkedin-2" "linkedin" 2 3 50000 200

# AI intelligence agents (3)
deploy_worker "agent-intel-0" "ai_intel" 0 3 15000 30
deploy_worker "agent-intel-1" "ai_intel" 1 3 15000 30
deploy_worker "agent-intel-2" "ai_intel" 2 3 15000 30

# AI search tip agents (2)
deploy_worker "agent-search-0" "ai_search" 0 2 10000 30
deploy_worker "agent-search-1" "ai_search" 1 2 10000 30

# Full sweep soldiers (5)
deploy_worker "soldier-sweep-0" "full_sweep" 0 5 10000 50
deploy_worker "soldier-sweep-1" "full_sweep" 1 5 10000 50
deploy_worker "soldier-sweep-2" "full_sweep" 2 5 10000 50
deploy_worker "soldier-sweep-3" "full_sweep" 3 5 10000 50
deploy_worker "soldier-sweep-4" "full_sweep" 4 5 10000 50

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  FLEET DEPLOYMENT COMPLETE!              ║"
echo "║  24 workers deployed (1 was pre-deployed)║"
echo "║  Total: 25 super soldiers                ║"
echo "╚══════════════════════════════════════════╝"
