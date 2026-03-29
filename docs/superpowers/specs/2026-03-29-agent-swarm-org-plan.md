# Agent Swarm Organization — Full Operational Plan

**Date:** 2026-03-29
**Status:** Proposed

## Current State

46 scheduled tasks running, 181 agents defined across 6 divisions. But most agents are wrappers — the actual scanning is done by a handful of scripts. The platform needs **purpose-built agent swarms** for every operational need.

---

## Proposed Swarm Organization — 12 Squads

### DIVISION 1: ACQUISITION (Job Discovery)

**Squad A1: Job Board Scanners** (runs every 2-3 hours)
- 13 free API scrapers (Remotive, DevITJobs, Arbeitnow, etc.) — RUNNING
- Adzuna API scraper — RUNNING
- Reed API scraper — NEEDS KEY
- Indeed scraper — RUNNING
- Total: ~15 agents continuously pulling from job boards

**Squad A2: Sponsor Job Hunters** (runs every 4 hours)
- Scans Adzuna for jobs BY company name for each sponsor — JUST DEPLOYED
- Needs expansion: also search Reed, Google Jobs, LinkedIn via API
- Target: cycle through all 140K sponsors, 300/day
- Total: 4 agents (one per job board API)

**Squad A3: Career Page Crawlers** (runs every 6 hours)
- Crawl sponsor websites for career pages — EXISTS but scrapes garbage
- Needs: Crawl4AI LLM extraction to get real job listings
- Target: 10K sponsors with known career page URLs
- Total: 1 smart agent with Crawl4AI

---

### DIVISION 2: INTELLIGENCE (Enrichment & Analysis)

**Squad I1: Sponsorship Scorer** (runs every 15 min on new jobs)
- Score every new job 0-100% for visa sponsorship likelihood
- Check salary vs threshold, ISL match, sponsor register match, keyword signals
- RUNNING but only scored 3,562 of 12,563 jobs

**Squad I2: Companies House Monitor** (runs every 3 hours)
- Check filing history, officer changes, charges, PSC for each sponsor
- Calculate risk signals (late filings, insolvency markers)
- EXISTS but needs Companies House API key — NOW SET
- Target: all 140K sponsors, cycle every 30 days

**Squad I3: Intel Scanners** (runs every 15 min)
- GOV.UK RSS (Home Office, UKVI, MAC, ONS) — RUNNING
- BBC, Guardian, Reuters, FT, Times — RUNNING
- Legal blogs (Free Movement, ILPA, Tribunal decisions) — RUNNING
- Reddit r/ukvisa, r/iwantout — RUNNING
- Hansard parliamentary debates — RUNNING
- Total: 5 scanner agents, 92 items ingested so far

**Squad I4: Intel Classifier** (runs every 5 min)
- Classify raw items: topic, impact, visa routes, industries — RUNNING (GROQ)
- Analyze medium+ impact items: summary, who affected, action required — RUNNING
- Dedup by title similarity — RUNNING

---

### DIVISION 3: QUALITY (Data Integrity)

**Squad Q1: Data Validator** (runs every 15 min on new data)
- Clean job titles (strip HTML, normalize case)
- Validate salaries (reject impossible values)
- Normalize company names (match to sponsor register)
- Detect duplicates across sources
- EXISTS as ValidatorAgent with 8 sub-agents

**Squad Q2: Garbage Collector** (runs daily at 3 AM)
- Delete jobs with navigation text as titles
- Delete jobs with no real content
- Merge duplicate job listings
- Archive expired jobs (>60 days old)
- JUST DEPLOYED — quality_cleanup task

**Squad Q3: Completeness Auditor** (runs every 30 min)
- Score each sponsor profile 0-100% completeness
- Flag sponsors missing key data (website, industry, employee count)
- Prioritize enrichment for lowest-completeness profiles
- EXISTS as QualityAgent with 4 sub-agents

---

### DIVISION 4: OPERATIONS (System Health)

**Squad O1: Freshness Monitor** (runs every 4 hours)
- Check if job listing URLs still return 200
- Mark expired jobs
- Track reposted jobs
- Calculate market velocity per city/industry
- EXISTS as FreshnessAgent with 4 sub-agents

**Squad O2: System Orchestrator** (runs every 30 min)
- Collect metrics from all squads
- Detect anomalies (sudden drop in jobs, scraper failures)
- Publish alerts to admin dashboard
- EXISTS as OrchestratorAgent with 3 sub-agents

**Squad O3: Circuit Breaker** (runs every 5 min)
- Monitor per-source failure rates
- Open circuit after 3 consecutive failures (back off 4x)
- Open circuit after 10 failures (disable source, alert admin)
- Auto-resume after cooldown period
- EXISTS in circuit_breaker.py

---

### DIVISION 5: RESEARCH (Discovery & Improvement)

**Squad R1: Company Discoverer** (runs every 2 hours)
- Find website URLs for sponsors without them (33K missing)
- Find LinkedIn pages (49K missing)
- Detect career page URLs
- Extract contact information
- EXISTS as DiscoveryAgent with 4 sub-agents

**Squad R2: Platform Improver** (runs daily at 5 AM)
- Analyze keyword effectiveness for sponsorship detection
- Scout for new data sources
- Calibrate scoring weights
- EXISTS as ImprovementAgent with 3 sub-agents

---

### DIVISION 6: COMMAND (AEGIS)

**Squad C1: AEGIS Supreme Commander**
- Orchestrates all 5 divisions
- Generates weekly executive reports (PDF)
- War Room dashboard at /admin/warroom
- Multi-division coordinated operations
- EXISTS — deployed

**Squad C2: Notification Dispatcher** (runs every 5 min)
- Match intel events against user subscriptions
- Dispatch in-app, email, webhook notifications
- Weekly digest compilation (Monday 6 AM)
- EXISTS — notification_engine.py + data.process_notifications

---

## What's MISSING (Gaps to Fill)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **Sponsor scanner only uses Adzuna** — need Reed, Google Jobs, LinkedIn | HIGH | Medium | P0 |
| **9,000 jobs unscored** — enrichment not running on new Adzuna jobs | HIGH | Easy | P0 |
| **Career page scraper produces garbage** — need Crawl4AI upgrade | HIGH | Medium | P1 |
| **33K sponsors missing website** — Discovery agent needs to run more | MEDIUM | Easy | P1 |
| **No automatic register diff** — task exists but hasn't run yet | HIGH | Easy | P0 |
| **No email notifications** — Resend key not set | MEDIUM | Easy | P2 |
| **No weekly digest email** — task exists but no Resend key | LOW | Easy | P2 |
| **Agent learning not active** — Q-learning tables empty | LOW | Medium | P3 |
| **Memory system not wired** — agents don't use memory.py yet | LOW | Medium | P3 |

## Immediate Actions (P0)

1. **Trigger enrichment on all unscored jobs** — run enrichment task for 9K+ jobs
2. **Add Reed API to sponsor scanner** — double job coverage (need Reed API key)
3. **Run register diff NOW** — detect any sponsor changes since last sync
4. **Increase sponsor scanner batch size** — 50→200 per run for faster coverage
5. **Wire enrichment to run on every new Adzuna job automatically**

## Summary

**Current: 46 tasks, 12 squads across 6 divisions**
**Agents defined: 181 (47 sub-agents + 9 main agents + army hierarchy)**
**Running autonomously: 24/7 on Railway via Celery Beat**
**Data growing daily: jobs, intel items, company profiles auto-enriching**
