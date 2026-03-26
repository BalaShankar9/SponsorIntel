# Sub-Project 1: Data Foundation — Ground Truth Layer

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Nothing (foundation layer)
**Blocks:** Sub-Projects 2-6

## Purpose

Make SponsorIntel's data the most complete, freshest, and most authoritative source of UK visa sponsorship intelligence. Every metric shown to users must be backed by verifiable government data, not estimates.

## Components

### 1. Weekly Sponsor Register Delta Automation

**What:** Automated weekly download of the Home Office Sponsor Register CSV, diff against previous week, detect new sponsors/removals/rating changes, trigger downstream enrichment.

**Source:** `https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers`

**Flow:**
1. Celery Beat task runs every Monday 08:00 UTC
2. Download latest Worker & Temporary Worker CSV
3. Parse and normalize (strip whitespace, standardize town/county names)
4. Diff against `sponsors` table: new rows, removed rows, rating changes, route changes
5. Write changes to `sponsor_changes` table with change_type enum
6. For new sponsors: queue enrichment pipeline (Companies House, website discovery, job search)
7. For removed/suspended: update status, alert subscribers
8. For rating changes (A→B or B→A): emit signal via SignalBus, alert subscribers
9. Store raw CSV in Supabase Storage for audit trail

**Note:** This replaces the existing daily `scrape_register` / `sync-gov-register` Celery Beat entry in `schedule.py`. The new task keeps the daily cadence (Home Office updates mid-week too) but adds proper diffing, change logging to the existing `sponsor_changes` table, and downstream enrichment triggers. The existing `sponsor_changes` table is reused — no new diff table.

**Output:** `data.sync_sponsor_register` Celery task (replaces `sync-gov-register`)

### 2. Home Office Visa Statistics Ingestion

**What:** Quarterly ingestion of visa grant statistics by SOC code, nationality, and industry from Home Office transparency data.

**Source:** `https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables`

**Tables used:**
- Work visa entry clearance grants by occupation (SOC code)
- Grants by nationality
- Grants by industry sector
- Processing times by route

**Flow:**
1. Celery Beat task runs first Monday of each quarter (Jan, Apr, Jul, Oct)
2. Download Excel/ODS tables from GOV.UK
3. Parse specific sheets (Vis_D01 = work visas by occupation, Vis_D02 = by nationality)
4. Map SOC codes to job titles using ONS SOC 2020 hierarchy
5. Store in `visa_statistics` table: soc_code, occupation_title, grants_total, grants_by_nationality (JSONB), period, source_url
6. Calculate year-over-year trends per SOC code
7. Expose via `/api/v1/intel/visa-stats` endpoint

**Output:** `visa_statistics` table + API endpoint + Trends page integration

### 3. Shortage Occupation List (SOL) Integration

**What:** Parse the MAC Shortage Occupation List and flag matching jobs/sponsors.

**Source:** `https://www.gov.uk/government/publications/skilled-worker-visa-shortage-occupations`

**Data:**
- SOC codes on the shortage list
- 20% salary discount threshold per SOC code
- Eligible job titles per SOC code

**Flow:**
1. Manual update (SOL changes ~annually) + automated GOV.UK page diff check monthly
2. Parse SOL into `shortage_occupations` table: soc_code, job_titles, salary_threshold_discount, effective_date
3. Enrichment pipeline flags jobs matching SOL SOC codes: `is_on_shortage_list = true`
4. Frontend shows SOL badge on job cards + filter option
5. Company profiles show "X jobs on shortage list" metric

**Output:** `shortage_occupations` table + job enrichment flag + UI badge

### 4. ONS Salary Benchmarks by SOC Code

**What:** Ingest Annual Survey of Hours and Earnings (ASHE) data for salary benchmarking against visa thresholds.

**Source:** ONS ASHE Table 14 (earnings by occupation) — `https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/occupation4digitsoc2010ashetable14`

**Data per SOC code:**
- Median annual salary
- 10th/25th/75th/90th percentiles
- Sample size
- By region (London vs rest of UK)

**Flow:**
1. Annual update (ASHE published each November)
2. Parse Excel Table 14.7a (full-time, all employees)
3. Store in `ons_salary_benchmarks` table: soc_code, median_salary, p10/p25/p75/p90, region, year
4. Enrichment pipeline compares advertised salary against:
   - Visa salary threshold (£38,700 general, or going rate for SOC code)
   - ONS median for that SOC code
   - Flags jobs paying below threshold or below median
5. Frontend shows salary benchmark on job detail page

**Output:** `ons_salary_benchmarks` table + salary comparison in enrichment + job detail UI

### 5. Companies House Enhanced Enrichment

**What:** Expand Companies House API usage beyond basic profile to include filing history, charges, PSC (persons with significant control), and officer changes.

**Current state:** `companies_house.py` fetches basic company profile.

**New endpoints to integrate:**
- `/company/{id}/filing-history` — Detect dormant companies, late filings (risk signal)
- `/company/{id}/charges` — Outstanding charges/debentures (financial distress)
- `/company/{id}/persons-with-significant-control` — Ownership structure, foreign ownership %
- `/company/{id}/officers` — Track officer appointments/resignations (already in CH watcher but ensure completeness)
- `/company/{id}/uk-establishments` — For overseas companies with UK presence

**Flow:**
1. Extend `CompaniesHouseWatcherAgent` sub-agents to call new endpoints
2. Store enriched data in `company_profiles` JSONB fields
3. Calculate risk signals: `late_filings_count`, `outstanding_charges`, `foreign_ownership_pct`
4. Feed into company risk score calculation

**Output:** Enhanced `company_profiles` data + risk signals

### 6. Parliament Hansard Immigration Monitor

**What:** Monitor parliamentary debates and written questions about immigration policy.

**Source:** `https://hansard.parliament.uk/` + `https://members-api.parliament.uk/`

**Flow:**
1. Daily Celery task searches Hansard API for keywords: "visa", "immigration", "sponsor licence", "skilled worker", "shortage occupation", "salary threshold"
2. Extract: debate title, date, speakers, full text snippet, hansard URL
3. Classify by Intel agent (topic: policy_update/debate/written_question, impact: critical/high/medium/low)
4. Store in `intel_items` table with source_category = 'government'
5. High-impact items trigger subscriber notifications

**Output:** Daily parliamentary intel items in the Intel feed

## Database Schema Changes

### New Tables

```sql
-- NOTE: Register diffs use the existing `sponsor_changes` table (not a new table).
-- Change types: 'added', 'removed', 'rating_upgrade', 'rating_downgrade', 'location_change', 'route_change'

-- Visa grant statistics by SOC code (SOC 2020)
CREATE TABLE visa_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soc_code VARCHAR(10) NOT NULL,
    occupation_title VARCHAR(500),
    grants_total INTEGER NOT NULL,
    grants_by_nationality JSONB,
    grants_by_industry JSONB,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    year INTEGER NOT NULL,
    source_url VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visa_stats_soc_year ON visa_statistics (soc_code, year);

-- Immigration Salary List (ISL) — replaces old Shortage Occupation List (SOL)
-- ISL roles are exempt from going rate requirement, NOT a blanket 20% discount
CREATE TABLE immigration_salary_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soc_code VARCHAR(10) NOT NULL,
    occupation_title VARCHAR(500) NOT NULL,
    job_titles TEXT[],
    is_going_rate_exempt BOOLEAN DEFAULT TRUE,
    standard_threshold INTEGER DEFAULT 38700,
    effective_date DATE,
    superseded_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_isl_soc_effective ON immigration_salary_list (soc_code, effective_date);

-- ONS salary benchmarks (ASHE Table 14, SOC 2020)
CREATE TABLE ons_salary_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soc_code VARCHAR(10) NOT NULL,
    occupation_title VARCHAR(500),
    median_salary INTEGER,
    p10_salary INTEGER,
    p25_salary INTEGER,
    p75_salary INTEGER,
    p90_salary INTEGER,
    sample_size INTEGER,
    region VARCHAR(50) DEFAULT 'UK',
    year INTEGER NOT NULL,
    source_url VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_ons_salary_soc_region_year ON ons_salary_benchmarks (soc_code, region, year);

-- Extend existing csv_imports table for sync run tracking
-- (add duration_ms, status, error_message columns if not present)
```

## API Endpoints

- `GET /api/v1/intel/visa-stats` — Visa grant statistics with SOC code filter
- `GET /api/v1/intel/visa-stats/{soc_code}` — Detailed stats for a SOC code
- `GET /api/v1/intel/shortage-list` — Current shortage occupation list
- `GET /api/v1/intel/salary-benchmarks/{soc_code}` — ONS salary data for a SOC code
- `GET /api/v1/sponsors/register-changes` — Recent register diff (new, removed, changed)
- `GET /api/v1/sponsors/register-changes/stats` — Summary stats of recent changes

## Celery Beat Schedule Additions

| Task | Queue | Schedule | Description |
|------|-------|----------|-------------|
| `data.sync_sponsor_register` | `army_intelligence` | Daily 07:00 UTC (replaces existing `sync-gov-register`) | Download + diff sponsor register CSV |
| `data.ingest_visa_stats` | `army_intelligence` | First Monday of quarter | Parse Home Office visa statistics |
| `data.check_isl_update` | `army_intelligence` | First Monday of month | Check for ISL changes on GOV.UK |
| `data.monitor_hansard` | `army_intelligence` | Daily 07:30 UTC | Search Hansard for immigration debates |

## Success Criteria

1. Sponsor register changes detected within 24 hours of publication
2. ≥80% of jobs with salary data show salary vs. visa threshold comparison
3. ISL-eligible jobs are flagged with a visible badge
4. Parliamentary immigration debates appear in Intel feed within 24 hours
5. `visa_statistics` table populated for all SOC codes with ≥100 grants in the reference period
6. ≥60% of matched company profiles have Companies House risk signals populated (late filings, charges)
