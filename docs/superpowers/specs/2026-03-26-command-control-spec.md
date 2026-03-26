# Sub-Project 6: Command & Control — AEGIS Supreme Intelligence

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Sub-Projects 1-5 (integrates everything)

## Purpose

Upgrade AEGIS from a simple orchestrator into a strategic intelligence commander that generates executive reports, coordinates multi-division operations, self-heals failing pipelines, and provides a real-time war room dashboard for admins.

## Components

### 1. Executive PDF Report Generation

AEGIS generates weekly/monthly intelligence reports using reportlab (already in requirements).

**Report sections:**
- Executive Summary: Key metrics changes this period
- Sponsor Landscape: New sponsors, removals, rating changes (from Data Foundation)
- Job Market: Volume trends, salary movements, top hiring sectors
- Immigration Policy: Intel items summary, policy tracker updates
- Risk Signals: Companies showing distress, late filings, rating downgrades
- Agent Performance: Division health, LLM cost breakdown, enrichment success rates

**Output:** PDF stored in Supabase Storage, emailed to admin, downloadable from admin dashboard.

### 2. War Room Dashboard (`/admin/warroom`)

Real-time operational dashboard for the agent army.

**Panels:**
- **Division Status Grid:** 6 divisions with real-time health (heartbeat, last mission, error rate)
- **Mission Feed:** Live stream of agent missions (from `army_missions` table)
- **LLM Cost Tracker:** Today's spend vs. budget, cost by tier/division (from Langfuse)
- **Signal Stream:** Live SignalBus feed (warroom:signals Redis channel)
- **Alert Ticker:** Active alerts, circuit breaker status, rate limit warnings
- **Memory Dashboard:** Top learned patterns (L3/L4 memory), agent skill levels (Q-table)

### 3. Multi-Division Operation Coordination

AEGIS can run coordinated multi-division operations:

**Example: "New Sponsor Discovery" operation:**
1. Data Foundation detects new sponsor in register diff
2. AEGIS triggers coordinated response:
   - Research Division → Discovery agent finds website, LinkedIn, careers page
   - Intelligence Division → Enrichment agent scores existing jobs, CH watcher checks financial health
   - Operations Division → Freshness agent checks if their existing job listings are still live
   - Quality Division → Validator agent ensures all data is clean
3. AEGIS aggregates results → generates sponsor profile card
4. Notification system alerts subscribers who match this sponsor's profile

**Implementation:** New `AEGISOperation` class that defines multi-step, multi-division workflows as directed graphs.

### 4. Self-Healing Pipeline

When any division reports failures:
1. AEGIS detects via heartbeat monitoring (120s TTL on Redis keys)
2. Diagnoses: is it a rate limit? API outage? data corruption?
3. Takes action:
   - Rate limit → reduce concurrency, notify SafetyGovernor
   - API outage → switch to fallback provider (via LiteLLM), emit warning signal
   - Data corruption → quarantine affected records, trigger re-validation
   - Agent crash → restart agent task via Celery, log to `army_missions`
4. Reports action taken in War Room dashboard

### 5. Prometheus Metrics Export

Export agent army metrics for monitoring (prometheus_client already in requirements).

**Metrics:**
- `sponsorintel_missions_total{division, status}` — Mission count by division/status
- `sponsorintel_llm_cost_usd{tier, provider}` — LLM cost by tier
- `sponsorintel_enrichment_duration_ms{agent}` — Enrichment latency
- `sponsorintel_jobs_discovered_total{source}` — Jobs found per source
- `sponsorintel_sponsors_active` — Current active sponsor count
- `sponsorintel_signals_emitted_total{channel}` — Signal bus traffic

**Endpoint:** `/metrics` (Prometheus scrape endpoint)

### 6. CrewAI/LangGraph Orchestration (Future Phase)

Architecture note for future: When complexity warrants it, AEGIS operations can be modeled as:
- **LangGraph:** DAG-based workflow with conditional edges and persistent state
- **CrewAI:** Role-based agent conversations for complex research tasks

Current army architecture is sufficient for Phase 1 launch. CrewAI/LangGraph migration is a v2.0 enhancement after the platform is live and generating revenue.

## Success Criteria

1. Weekly executive report generated automatically every Monday
2. War Room dashboard shows real-time health of all 6 divisions
3. Self-healing triggers within 60 seconds of detected failure
4. Prometheus metrics exportable to any monitoring stack
5. Multi-division operations complete coordinated workflows end-to-end
6. Admin can view and control the entire agent army from a single page
