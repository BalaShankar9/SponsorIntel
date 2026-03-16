# Agent Swarm Job Pipeline — Design Specification

**Date**: 2026-03-16
**Status**: Draft
**Author**: Claude + User

---

## 1. Problem Statement

The SponsorIntel platform has 140,910 sponsors in the database with enriched company profiles and scores, but zero job data. The `jobs` table exists with a comprehensive schema (50+ fields) and 38 scrapers are built but not running. The frontend jobs page, company profile jobs tab, dashboard job metrics, and trend analytics all depend on real job data.

The goal is to build an intelligent agent swarm that continuously scrapes, validates, enriches, and maintains job data from 38 sources — linking every job to its sponsor, scoring sponsorship likelihood, and keeping the entire platform interconnected with real-time truthful data.

---

## 2. Architecture Overview

### 2.1 Deployment Topology

```
Railway Service: "sponsorintel-backend"
├── FastAPI (web process)          — API endpoints + WebSocket
├── Celery Worker x2 (worker)     — Processes scraping/enrichment tasks
├── Celery Beat (beat)             — Schedules recurring tasks
└── Ollama (ollama)                — phi-3-mini LLM for intelligent sub-agents

Railway Addon: Redis              — Task broker + pub/sub + caching
External: Supabase PostgreSQL     — Primary database (shared with frontend)
External: Vercel                  — Frontend (reads from Supabase)
```

### 2.2 Agent Hierarchy

Six main agents coordinate 103 specialised sub-agents:

| Agent | Sub-Agents | LLM | Deterministic | Hybrid |
|-------|-----------|-----|--------------|--------|
| HunterAgent | 22 | 4 | 18 | 0 |
| ValidatorAgent | 16 | 3 | 11 | 2 |
| EnrichmentAgent | 28 | 12 | 12 | 4 |
| FreshnessAgent | 12 | 1 | 11 | 0 |
| QualityAgent | 15 | 2 | 13 | 0 |
| OrchestratorAgent | 10 | 0 | 10 | 0 |
| **Total** | **103** | **22** | **75** | **6** |

### 2.3 Data Flow

```
Sponsor Register (140K sponsors)
         │
         ▼
   OrchestratorAgent
   (priority queue, rate budgets, pipeline sequencing)
         │
         ▼
   HunterAgent ──────────────────────────────────────┐
   (22 sub-agents: query formulation, 14 source      │
    scrapers, career page discovery + parsing)        │
         │                                            │
         ▼                                            │
   ValidatorAgent                                     │
   (16 sub-agents: dedup, spam filter, canonical      │
    merge, conflict resolution)                       │
         │                                            │
         ▼                                            │
   EnrichmentAgent                                    │
   (28 sub-agents: sponsorship scoring, SOC           │
    classification, salary intelligence, skills       │
    extraction, visa route matching)                  │
         │                                            │
         ▼                                            │
   QualityAgent ──────── gap found ───────────────────┘
   (15 sub-agents: completeness scoring, cross-       (re-scrape from
    source gap filling, data integrity, source         alternative source)
    health monitoring)
         │
         ▼
   FreshnessAgent (runs on schedule)
   (12 sub-agents: HTTP checks, page analysis,
    repost detection, lifecycle tracking)
         │
         ▼
   Supabase PostgreSQL
   (jobs, job_dedup_clusters, salary_benchmarks,
    shortage_occupations, swarm_metrics, swarm_reports)
         │
         ▼
   Redis pub/sub → WebSocket → Frontend
   (real-time job alerts, dashboard updates)
```

---

## 3. Agent Specifications

### 3.1 HunterAgent — Discovery & Acquisition

**Mission**: Find every job posted by every known sponsor across all 38 sources.

#### Sub-Agents (22)

**Search Strategy (6):**

1. **QueryFormulator [LLM]**
   - Input: sponsor name, industry, location
   - Output: list of optimised search queries per source
   - Prompt: "Generate 3-5 search queries to find jobs posted by {company} in {industry} based in {location}. Include name variants."
   - Cache: 7 days per sponsor
   - Batch: process 50 sponsors per LLM call (list format)

2. **NameVariantGenerator [LLM]**
   - Input: registered company name from sponsor register
   - Output: array of name variants (trading names, abbreviations, common misspellings)
   - Stored in: `company_profiles.name_variants` (new JSONB column)
   - Run: once per sponsor, re-run if company name changes
   - Batch: 100 names per LLM call

3. **IndustryQueryMapper [DET]**
   - Static mapping: industry_primary → list of relevant job title keywords
   - Example: "Technology & IT" → ["developer", "engineer", "devops", "data scientist", "analyst"]
   - Source: hardcoded dictionary, ~30 industries × 5-10 keywords each

4. **SourceSelector [DET]**
   - Rules engine mapping sponsor attributes to relevant sources:
     - NHS/healthcare sponsor → include nhs_jobs
     - Education sponsor → include teaching_vacancies
     - Tech company → include devitjobs, cwjobs
     - All sponsors → always search free APIs + Reed + Adzuna
   - Input: sponsor industry + type
   - Output: ordered list of sources to search

5. **SearchPrioritiser [DET]**
   - Priority score = (A-rated: +50, B-rated: +20) + (has_recent_jobs: +30) + (never_searched: +40) + (days_since_last_search × 2)
   - Maintains sorted queue in Redis
   - Processes top 500 sponsors per cycle

6. **KeywordExpander [LLM]**
   - Input: base job title
   - Output: 5-8 related titles/synonyms
   - Example: "Data Engineer" → ["Data Pipeline Engineer", "ETL Developer", "Analytics Engineer", "Big Data Engineer", "Data Platform Engineer"]
   - Cache: permanent per title (titles don't change)
   - Batch: 50 titles per LLM call

**Source-Specific Scrapers (14):**

Each wraps the existing scraper class with error handling, metrics, and retry logic.

7. **FreeAPIHunter [DET]** — Wraps all 11 zero-auth APIs. Runs them concurrently via `asyncio.gather`. Sources: Remotive, Arbeitnow, Jobicy, TheMuse, Himalayas, RemoteOK, WWR, Teaching Vacancies, DevITJobs, CharityJob, HN Hiring.

8. **ReedHunter [DET]** — Wraps `ReedAPIScraper` (primary) + `ReedScraper` (HTML fallback). Manages daily API quota (500 requests).

9. **AdzunaHunter [DET]** — Wraps `AdzunaAPIScraper`. Manages daily quota (250 requests).

10. **JoobleHunter [DET]** — Wraps `JoobleAPIScraper`.

11. **IndeedHunter [DET]** — Wraps `IndeedScraper`. Playwright + proxy rotation. CAPTCHA detection → back off, don't solve.

12. **LinkedInHunter [DET]** — Wraps `LinkedInJobsScraper`. curl_cffi primary, Playwright fallback.

13. **TotalJobsHunter [DET]** — Wraps `TotalJobsScraper`. Playwright.

14. **CWJobsHunter [DET]** — Wraps `CWJobsScraper`. IT/tech focus.

15. **GlassdoorHunter [DET]** — Wraps `GlassdoorJobsScraper`.

16. **NHSHunter [DET]** — Wraps `NHSJobsScraper`. Healthcare sponsors only.

17. **GovHunter [DET]** — Wraps `FindAJobScraper`. Government/DWP jobs.

18. **GuardianHunter [DET]** — Wraps `GuardianJobsScraper`.

19. **TeachingHunter [DET]** — Wraps `TeachingVacanciesAPIScraper`. Education sponsors only.

20. **CharityHunter [DET]** — Wraps `CharityJobFeedScraper`. Third sector.

**Career Page (2):**

21. **CareerPageDiscoverer [LLM]**
   - Input: sponsor website HTML (first 5KB)
   - Output: career page URL or null
   - Prompt: "Given this website HTML, find the URL to the careers/jobs page. Return just the URL or 'NONE'."
   - Runs for sponsors where `company_profiles.has_careers_page IS NULL`
   - Stores result in `company_profiles.careers_page_url`

22. **CareerPageParser [LLM]**
   - Input: career page HTML (first 10KB)
   - Output: array of {title, location, url, snippet}
   - Prompt: "Extract all job listings from this career page HTML. Return JSON array."
   - Creates Job records with `source = CAREER_PAGE`

#### Schedule

| Source Tier | Interval | Sources |
|------------|----------|---------|
| Free APIs | Every 2 hours | 11 sources |
| API-key | Every 4 hours | Reed, Adzuna, Jooble |
| Browser | Every 8 hours | Indeed, LinkedIn, TotalJobs, CWJobs, Glassdoor |
| Gov/NHS | Every 12 hours | FindAJob, NHS, Guardian, Teaching |
| Career pages | Daily sweep | Sponsor websites |

---

### 3.2 ValidatorAgent — Truth Engine

**Mission**: Deduplicate, merge, filter spam, resolve conflicts.

#### Sub-Agents (16)

**Deduplication (6):**

1. **TitleNormaliser [LLM]**
   - "Sr. Software Dev (Python)" → "Senior Software Developer"
   - Batch: 100 titles per call
   - Cache: permanent per raw title

2. **CompanyNormaliser [DET]**
   - Strip: "Ltd", "Limited", "PLC", "Inc", "LLP", "& Co"
   - Lowercase, remove punctuation, collapse whitespace
   - "TATA CONSULTANCY SERVICES LIMITED" → "tata consultancy services"

3. **LocationNormaliser [DET]**
   - UK city lookup table (~500 cities)
   - "Greater London" → "London", "Bham" → "Birmingham"
   - Fuzzy match with Levenshtein < 2

4. **SimilarityScorer [DET]**
   - 5-dimension comparison:
     - Title: token overlap ratio (0-1)
     - Company: normalised exact match (0 or 1)
     - City: exact match (0 or 1)
     - Salary: overlap ratio of [min, max] ranges (0-1)
     - Date: 1 - (day_diff / 14), clamped to [0, 1]
   - Composite: weighted sum, threshold 0.7 for match
   - Weights: title=0.3, company=0.3, city=0.15, salary=0.15, date=0.1

5. **ClusterBuilder [DET]**
   - Union-find algorithm over job pairs scoring > 0.7
   - Canonical job = highest completeness score in cluster
   - Creates/updates `job_dedup_clusters` records

6. **CanonicalMerger [DET]**
   - Per cluster, picks best field per source:
     - `description_full`: longest (> 100 chars, non-boilerplate)
     - `salary_min/max`: most specific (non-null, reasonable range)
     - `posted_date`: earliest
     - `location_city`: most specific
     - `source_url`: keep all as `source_urls[]` on canonical

**Quality Control (6):**

7. **SpamClassifier [LLM]**
   - Categories: GENUINE, RECRUITER_SPAM, GHOST_JOB, SCAM
   - Signals:
     - RECRUITER_SPAM: same agency, 20+ identical listings, vague "client" company
     - GHOST_JOB: re-posted monthly, never filled, no apply mechanism
     - SCAM: asks for money, unrealistic salary, suspicious contact info
   - Input: title + company + description (first 500 chars)
   - Batch: 20 jobs per call
   - Action: SPAM/SCAM → set `is_flagged = true`, exclude from default frontend queries

8. **SalaryValidator [DET]**
   - Rules: min <= max, annual £15K-£500K, hourly £8-£250
   - Violations: swap min/max, null impossible values, log correction

9. **DateValidator [DET]**
   - Rules: not in future, not before 2020, posted < first_seen < last_seen
   - Violations: clamp to valid range

10. **URLValidator [DET]**
    - Valid URL format, matches expected domain for source
    - Reed → reed.co.uk, Indeed → indeed.co.uk, etc.

11. **DescriptionCleaner [DET]**
    - Strip HTML tags, collapse whitespace
    - Remove boilerplate footers (equal opportunity disclaimers, agency disclaimers)
    - Regex patterns for ~20 common boilerplate blocks

12. **DuplicateDescriptionDetector [DET]**
    - SimHash on cleaned description text
    - Hamming distance < 3 → likely same job (catches rewording)
    - Supplements title-based dedup

**Conflict Resolution (4):**

13. **SalaryConflictResolver [HYB]**
    - When cluster has conflicting salaries:
      - If one source has no salary → pick the one with salary
      - If both have salary → pick source with higher reliability score
      - If reliability scores within 10% → LLM reads both descriptions for context

14. **LocationConflictResolver [DET]**
    - Most specific wins: "Shoreditch, London" > "London" > "South East" > "UK"
    - Truly conflicting (London vs Manchester) → keep as "Multiple Locations"

15. **TitleConflictResolver [LLM]**
    - Picks the most descriptive, accurate title from cluster
    - "Java Dev" vs "Senior Java Developer - Microservices" → longer, more specific

16. **ConflictLogger [DET]**
    - Records all conflicts + resolutions to `job_validation_log` table
    - Schema: job_id, field, source_a, value_a, source_b, value_b, resolution, reason

---

### 3.3 EnrichmentAgent — Intelligence Layer

**Mission**: Score sponsorship likelihood, classify roles, extract structured data, make every job maximally useful for visa seekers.

#### Sub-Agents (28)

**Sponsorship Intelligence (8):**

1. **SponsorshipKeywordScanner [DET]**
   - Regex scan for 40+ patterns:
     - Positive: "visa sponsorship", "sponsor your visa", "certificate of sponsorship", "skilled worker", "willing to sponsor", "we sponsor", "sponsorship available", "tier 2"
     - Negative: "no sponsorship", "cannot sponsor", "must have right to work", "no visa", "UK residents only"
   - Returns: {positive_hits: [...], negative_hits: [...], score_adjustment: int}

2. **SponsorshipContextAnalyser [LLM]**
   - Triggered when keyword scan finds both positive AND negative signals, or is ambiguous
   - Prompt: "Read this job description excerpt. Does the employer offer visa sponsorship? Answer: YES (confident), LIKELY, UNCLEAR, UNLIKELY, NO (confident). Brief reasoning."
   - Input: relevant paragraphs (not full description)
   - Returns: verdict + confidence

3. **SponsorRegisterMatcher [DET]**
   - Fuzzy match company_name_normalised against sponsor register
   - Uses trigram similarity (pg_trgm) for database-level matching
   - Returns: matched_sponsor_id, match_confidence (0-100)

4. **SponsorHistoryAnalyser [DET]**
   - Query: count of previous jobs from this sponsor with sponsorship_likelihood > 70
   - Historical rate: sponsored_jobs / total_jobs from this sponsor
   - Returns: historical_rate (0-1), sample_size

5. **VisaThresholdChecker [DET]**
   - Lookup salary_benchmarks for job's SOC code + region
   - Compare salary_min against visa_salary_threshold
   - Returns: meets_threshold (bool), threshold_amount, salary_percentile

6. **ShortageListMatcher [DET]**
   - Lookup shortage_occupations for SOC code
   - Check effective date range
   - Returns: is_shortage (bool), threshold if applicable

7. **SponsorshipScoreCalculator [DET]**
   - Combines all signals:
   ```
   score = 0
   IF on sponsor register           → +25
   IF A-rated                        → +15 (B: +5)
   IF positive keywords (strong)     → +25
   IF positive keywords (weak)       → +15
   IF negative keywords              → -30 (floor 0)
   IF LLM says YES/LIKELY           → +20 / +10
   IF LLM says UNLIKELY/NO          → -15 / -25
   IF salary >= threshold            → +15
   IF salary >= 1.5x threshold       → +20
   IF salary < threshold             → -5
   IF on shortage list               → +10
   IF historical sponsor rate > 0.5  → +10
   Cap at 100, floor at 0.
   ```

8. **VisaRouteClassifier [LLM]**
   - Input: SOC code, salary, company type, job requirements summary
   - Output: eligible visa routes array
   - Routes: Skilled Worker, Health & Care Worker, Global Talent, Scale-up, Senior/Specialist Worker, Graduate (for entry-level)
   - Batch: 20 jobs per call

**Classification (7):**

9. **SOCClassifier [LLM]**
   - Input: title + description snippet (200 chars)
   - Output: SOC code (4-digit) + confidence
   - Lookup table (~400 patterns) checked first; LLM for ambiguous titles
   - Cache: permanent per normalised title
   - Batch: 50 titles per call

10. **SeniorityDetector [LLM]**
    - Input: title + salary + experience requirements
    - Output: entry | mid | senior | lead | director | executive
    - Batch: 50 jobs per call

11. **ContractTypeClassifier [HYB]**
    - Keyword scan first: "permanent", "contract", "6-month", "temp", "FTC", "apprentice"
    - LLM fallback for ambiguous: "Initial contract with view to perm"
    - Output: permanent | contract | temporary | apprenticeship

12. **RemoteClassifier [HYB]**
    - Keywords: "remote", "hybrid", "on-site", "WFH", "work from home", "office-based"
    - LLM for: "flexible working with 2 days in office" → hybrid
    - Output: remote | hybrid | onsite
    - Stored in: `location_is_remote` (bool) + new `work_model` field

13. **IndustryClassifier [LLM]**
    - Maps job to industry using employer context
    - "Software Developer" at NHS → Healthcare, not Technology
    - Input: title + company + description snippet
    - Cache: per company_name_normalised (all jobs at same company = same industry)

14. **DepartmentClassifier [LLM]**
    - Output: Engineering | Sales | Marketing | Finance | Operations | HR | Legal | Product | Research | Clinical | Education | Other
    - Batch: 50 jobs per call

15. **BenefitsExtractor [LLM]**
    - Input: description_full
    - Output JSON: {pension_pct, holidays_days, remote_policy, visa_sponsorship, relocation_package, bonus, stock_options, healthcare, other[]}
    - Batch: 10 jobs per call (descriptions are long)

**Skills & Experience (6):**

16. **TechStackExtractor [LLM]**
    - Output: [{skill, level, years, context}]
    - "Strong Python background with Django and FastAPI" → [{skill: "Python", level: "strong"}, {skill: "Django"}, {skill: "FastAPI"}]
    - Batch: 20 jobs per call

17. **SoftSkillExtractor [LLM]**
    - Output: [{skill, importance}]
    - "Must lead cross-functional teams" → [{skill: "leadership", importance: "required"}]
    - Batch: 50 jobs per call

18. **CertificationExtractor [DET]**
    - Dictionary of ~200 known certifications
    - Pattern match: "AWS Certified", "CISSP", "PMP", "CFA", "ACCA", "PRINCE2", "ITIL"

19. **ExperienceParser [HYB]**
    - Regex: "3-5 years", "5+ years", "minimum 2 years"
    - LLM fallback: "experienced professional" → {min: 3, max: null}
    - Output: {years_min, years_max}

20. **EducationExtractor [LLM]**
    - Output: {level, field, required}
    - "BSc Computer Science or equivalent" → {level: "bachelors", field: "computer_science", required: true}
    - Batch: 50 jobs per call

21. **LanguageRequirementExtractor [DET]**
    - Pattern match: "fluent in {language}", "{language} B2", "bilingual"
    - Dictionary of ~30 languages

**Salary Intelligence (4):**

22. **SalaryParser [DET]**
    - Regex extraction from salary_text_raw
    - Patterns: "£55,000 - £65,000 per annum", "£300/day", "£25-30ph", "Up to £80K OTE", "$120,000", "Competitive"
    - Output: {min, max, currency, period} or nulls

23. **SalaryNormaliser [DET]**
    - Convert to annual GBP:
      - hourly × 2080
      - daily × 260
      - weekly × 52
      - monthly × 12
    - Flag pro-rata salaries

24. **SalaryEstimator [LLM]**
    - When salary is missing, estimate from SOC + seniority + location + company size
    - Input: SOC code, seniority, city, company employee count
    - Output: {estimated_min, estimated_max, confidence}
    - Stored separately: `salary_estimated_min`, `salary_estimated_max`, `salary_is_estimated` flag

25. **SalaryBenchmarker [DET]**
    - Compare against salary_benchmarks percentiles
    - Output: percentile rank, distance from visa threshold
    - Stored: `salary_percentile`, `salary_vs_threshold`

**Content (3):**

26. **JobSummariser [LLM]**
    - 2-3 sentence summary focused on: role purpose, key requirements, standout benefits
    - Stored as `description_snippet` (overwriting the raw truncation)
    - Batch: 10 jobs per call

27. **RedFlagDetector [LLM]**
    - Flags: unpaid trials, equity-only comp, unrealistic requirements, excessive monitoring, MLM language
    - Output: [{flag, severity, evidence}]
    - Stored: `red_flags` (JSONB)
    - Batch: 20 jobs per call

28. **CultureSignalExtractor [LLM]**
    - Tags: startup, enterprise, remote-first, work-life-balance, high-growth, flat-hierarchy
    - Stored: `culture_signals` (JSONB array)
    - Batch: 20 jobs per call

---

### 3.4 FreshnessAgent — Lifecycle Intelligence

**Mission**: Track job lifecycle, detect expiry, identify reposts, never delete data.

#### Sub-Agents (12)

**Status Checking (5):**

1. **HTTPStatusChecker [DET]**
   - HEAD request to source_url
   - 404/410 → expired, 200 → alive, 301/302 → follow redirect
   - Timeout: 10 seconds
   - Concurrent: 50 checks at a time via asyncio

2. **PageContentAnalyser [LLM]**
   - For browser-scraped sources only (7 sources)
   - Fetches page, sends first 2KB to LLM
   - Prompt: "Is this job listing active or expired? Look for: 'expired', 'closed', 'no longer available', past application deadlines. Answer: ACTIVE or EXPIRED."
   - Only called when HTTP returns 200 but job is > 21 days old

3. **APIStatusChecker [DET]**
   - For API sources: re-query source API for source_job_id
   - Not found → expired
   - Found → update last_seen_at

4. **SalaryRemovalDetector [DET]**
   - Compare current scrape against stored salary
   - Salary was present, now removed → flag CLOSING_SOON
   - Stored: `closing_signal` (boolean)

5. **ListingChangeTracker [DET]**
   - Diff current scrape against stored fields
   - Track: title changes, salary changes, description updates
   - Store in: `job_change_log` table (job_id, field, old_value, new_value, detected_at)

**Lifecycle Intelligence (4):**

6. **ExpiryDateEstimator [DET]**
   - Per-source average job lifespan (computed from historical data)
   - Output: estimated_expiry_date = posted_date + avg_lifespan_for_source
   - Updated as historical data grows

7. **RepostDetector [DET]**
   - Query: same company_name_normalised + title similarity > 0.8 + expired within 30 days
   - Links: `repost_of_job_id` on the new job
   - Counter: `repost_count` incremented on each detection
   - Insight: high repost count = hard-to-fill position, more likely to sponsor

8. **SeasonalPatternTracker [DET]**
   - Per sponsor: monthly posting volumes (rolling 12 months)
   - Stored: `sponsor_hiring_patterns` table (sponsor_id, month, job_count)
   - Exposed to frontend for trend analysis

9. **MarketVelocityCalculator [DET]**
   - Per industry + location:
     - avg_days_to_fill
     - new_postings_per_week
     - churn_rate (expired / total)
   - Stored: `market_velocity` table
   - Refreshed daily

**Scheduling (3):**

10. **AdaptiveScheduler [DET]**
    - Check frequency by age:
      - < 7 days: every 6 hours
      - 7-30 days: every 24 hours
      - 30+ days active: every 3 days
      - Expired: no further checks
    - Priority queue in Redis sorted set

11. **BatchOptimiser [DET]**
    - Groups checks by source domain for connection reuse
    - All Reed checks in one batch, all Indeed in another
    - Reduces DNS lookups and connection overhead

12. **StaleJobReaper [DET]**
    - Jobs not seen for 60+ days with expired source_url → status = ARCHIVED
    - Archived jobs: still in DB, excluded from default queries, included in analytics
    - Never deleted

---

### 3.5 QualityAgent — Data Perfection

**Mission**: Maximise data completeness, maintain integrity, monitor source health.

#### Sub-Agents (15)

**Completeness (5):**

1. **CompletenessScorer [DET]**
   ```
   title_raw present           →  5 pts
   company_name_raw present    →  5 pts
   location_city present       → 10 pts
   salary_min present          → 15 pts
   salary_max present          →  5 pts
   description_full > 100ch    → 15 pts
   sponsorship_likelihood set  → 15 pts
   soc_code present            → 10 pts
   skills_extracted.len > 0    → 10 pts
   source_url present          →  5 pts
   contract_type present       →  5 pts
   ─────────────────────────────────────
   Total                         100 pts
   ```
   Stored: `data_quality_score` on each job

2. **GapIdentifier [DET]**
   - For jobs with completeness < 70 AND sponsor_id IS NOT NULL
   - Identifies: which fields are missing, which dedup cluster sources have those fields
   - Output: gap report per job

3. **CrossSourceFiller [DET]**
   - For each identified gap, queries cluster for same job on other sources
   - Pulls missing fields from best alternative source
   - Logs: "Filled salary from Reed for job originally from Remotive"

4. **MandatoryFieldEnforcer [DET]**
   - Reject: missing title_raw OR company_name_raw
   - Default: missing location → use company's registered address from company_profiles
   - Default: missing salary → leave null (SalaryEstimator handles estimation separately)

5. **EnrichmentPrioritiser [DET]**
   - Priority = sponsorship_likelihood × (100 - data_quality_score) / 100
   - High-sponsorship, low-quality jobs get re-queued first
   - Top 100 gaps processed per cycle

**Data Integrity (5):**

6. **SalaryIntegrityChecker [DET]**
   - min <= max (swap if reversed)
   - Annual: £15K-£500K range
   - Hourly: £8-£250 range
   - Currency: must be valid ISO 4217
   - Period: normalise to ANNUAL | HOURLY | DAILY | WEEKLY

7. **DateIntegrityChecker [DET]**
   - posted_date: not future, not before 2020-01-01
   - Ordering: posted_date <= first_seen_at <= last_seen_at
   - expiry_date: >= posted_date if present

8. **LocationIntegrityChecker [DET]**
   - UK cities lookup table (~500 entries)
   - Fuzzy match with Levenshtein <= 2
   - "Londn" → "London", "Mnchester" → "Manchester"

9. **DescriptionIntegrityChecker [DET]**
   - Must have > 50 meaningful characters after HTML stripping
   - Not just boilerplate/disclaimer text
   - Flag if description is identical to another job from different company (copy-paste recruiter)

10. **ForeignKeyIntegrityChecker [DET]**
    - sponsor_id → valid sponsor exists
    - dedup_cluster_id → valid cluster exists
    - soc_code → valid in SOC classification table

**Source Health (3):**

11. **SourceHealthMonitor [DET]**
    - Per source per run:
      - jobs_returned (count)
      - success_rate (%)
      - avg_completeness (0-100)
      - avg_response_time (ms)
      - error_count
    - Stored: Redis hash, refreshed every run
    - Historical: `source_health_log` table (daily snapshots)

12. **SourceDegradationDetector [DET]**
    - Alert threshold: 3 consecutive runs where:
      - success_rate drops > 20% vs 7-day average, OR
      - avg_completeness drops > 15%, OR
      - error_count > 3x average
    - Action: publish SOURCE_DEGRADED alert, recommend pause

13. **SourceRecoveryProber [DET]**
    - For paused sources: send 1 test query every 30 minutes
    - If test succeeds → resume source, publish SOURCE_RECOVERED alert
    - If still failing after 24 hours → escalate to daily probe

**Reporting (2):**

14. **DailyQualityReporter [LLM]**
    - Generates natural-language daily report from metrics
    - Input: today's metrics JSON (jobs scraped, completeness, errors, top/bottom sources)
    - Output: 5-10 sentence human-readable summary
    - Stored: `swarm_reports` table (report_date, report_type, content)
    - Displayed: admin dashboard

15. **WeeklyTrendsReporter [LLM]**
    - Weekly summary: trends, source health changes, recommendations
    - Input: 7-day metrics aggregation
    - Output: structured report with sections
    - Stored: `swarm_reports` table

---

### 3.6 OrchestratorAgent — Swarm Brain

**Mission**: Coordinate all agents, manage resources, monitor health, ensure pipeline integrity.

#### Sub-Agents (10)

**Pipeline Management (4):**

1. **PipelineSequencer [DET]**
   - Implements Celery chain: Hunter → Validator → Enrichment → Quality
   - Each stage waits for previous to complete before starting
   - Uses Celery `chain()` and `group()` primitives

2. **BatchCoordinator [DET]**
   - Splits sponsor list into batches of 100
   - Dispatches via `celery.group()` for parallel execution
   - Tracks batch completion with Redis counters
   - Max 4 concurrent batches (matches worker count)

3. **DependencyResolver [DET]**
   - Ensures sub-agent ordering within each main agent
   - Example: TitleNormaliser must complete before SimilarityScorer can run
   - Implemented as Celery chains within each agent's task

4. **RetryManager [DET]**
   - Exponential backoff: 1min → 5min → 30min → 2hr
   - Max 4 retries per task
   - After max retries: mark failed, log to `swarm_errors` table
   - Different retry strategies per error type:
     - Network timeout → retry immediately
     - Rate limited → wait for specified backoff
     - Auth error → don't retry, alert
     - Parse error → don't retry, log for investigation

**Resource Management (3):**

5. **RateLimitBudgeter [DET]**
   - Per source in Redis:
     - `rate:{source}:daily_used` (counter, TTL 24h)
     - `rate:{source}:daily_limit` (config)
     - `rate:{source}:per_minute` (sliding window)
   - Before dispatch: check budget, reject if exhausted
   - Priority allocation: sponsor-targeted (70%) > keyword (20%) > sweep (10%)

6. **MemoryManager [DET]**
   - Celery config: `worker_max_memory_per_child = 512MB`
   - Worker auto-restarts after processing 100 tasks (prevent memory leaks)
   - Browser sessions (Playwright) explicitly closed after each scrape

7. **ConcurrencyController [DET]**
   - Max concurrent Playwright sessions: 3
   - Max concurrent API calls per source: 5
   - Max concurrent Ollama requests: 2 (CPU bottleneck)
   - Implemented via Celery `rate_limit` and Redis semaphores

**Monitoring (3):**

8. **MetricsCollector [DET]**
   - Per pipeline run, writes to `swarm_metrics` table:
     ```sql
     run_id, started_at, completed_at, duration_seconds,
     jobs_scraped, jobs_validated, jobs_enriched, jobs_expired,
     errors_total, errors_by_source (JSONB),
     completeness_avg, sponsorship_scored_count,
     llm_calls_count, llm_avg_latency_ms
     ```
   - Also maintains real-time counters in Redis for dashboard

9. **AnomalyDetector [DET]**
   - Compares current run against 7-day rolling average
   - Alert conditions:
     - jobs_scraped < 50% of average → VOLUME_DROP
     - errors_total > 3x average → ERROR_SPIKE
     - completeness_avg < average - 15 → QUALITY_DROP
     - Any source returns 0 jobs for 3 runs → SOURCE_DEAD
   - Publishes to Redis pub/sub channel: `swarm:alerts`

10. **AlertPublisher [DET]**
    - Listens to all agent events, publishes structured alerts:
    ```json
    {
      "type": "SOURCE_DEGRADED",
      "source": "indeed",
      "severity": "warning",
      "message": "Indeed success rate dropped to 30% (avg: 85%)",
      "timestamp": "2026-03-16T14:30:00Z",
      "metrics": {...}
    }
    ```
    - Channels: Redis pub/sub → WebSocket → admin dashboard + signals page
    - Also writes to `swarm_alerts` table for history

---

## 4. Ollama Integration

### 4.1 Model Selection

- **Model**: `phi-3-mini` (3.8B parameters, Q4_K_M quantization)
- **RAM**: ~2.5GB for model weights
- **Inference**: 5-15 seconds per call on Railway CPU
- **Context**: 4096 tokens (sufficient for all sub-agent prompts)

### 4.2 LLM Service Interface

All 22 LLM sub-agents call Ollama through a unified `LLMService` class:

```python
class LLMService:
    """Unified interface to Ollama. Handles batching, retries, caching."""

    def __init__(self, base_url: str, model: str = "phi3:mini"):
        self.base_url = base_url
        self.model = model
        self.cache = {}  # Redis-backed

    async def complete(self, prompt: str, system: str = "",
                       cache_key: str | None = None,
                       timeout: int = 30) -> str:
        """Single completion with caching and retry."""

    async def batch_complete(self, prompts: list[str], system: str = "",
                             max_concurrent: int = 2) -> list[str]:
        """Process multiple prompts with concurrency limit."""

    async def structured_output(self, prompt: str, system: str = "",
                                schema: dict = None) -> dict:
        """Parse LLM output as JSON, with retry on parse failure."""
```

### 4.3 Prompt Templates

Each LLM sub-agent has a focused prompt template stored in `backend/app/agents/prompts/`:

```
backend/app/agents/prompts/
├── hunter/
│   ├── query_formulator.txt
│   ├── name_variant_generator.txt
│   ├── keyword_expander.txt
│   ├── career_page_discoverer.txt
│   └── career_page_parser.txt
├── validator/
│   ├── title_normaliser.txt
│   ├── spam_classifier.txt
│   └── title_conflict_resolver.txt
├── enrichment/
│   ├── sponsorship_context_analyser.txt
│   ├── visa_route_classifier.txt
│   ├── soc_classifier.txt
│   ├── seniority_detector.txt
│   ├── contract_type_classifier.txt
│   ├── remote_classifier.txt
│   ├── industry_classifier.txt
│   ├── department_classifier.txt
│   ├── benefits_extractor.txt
│   ├── tech_stack_extractor.txt
│   ├── soft_skill_extractor.txt
│   ├── experience_parser.txt
│   ├── education_extractor.txt
│   ├── salary_estimator.txt
│   ├── job_summariser.txt
│   ├── red_flag_detector.txt
│   └── culture_signal_extractor.txt
├── freshness/
│   └── page_content_analyser.txt
└── quality/
    ├── daily_quality_reporter.txt
    └── weekly_trends_reporter.txt
```

### 4.4 Batching Strategy

To minimize LLM latency impact:
- Sub-agents that process individual jobs batch multiple items per call
- Batch sizes tuned per sub-agent (10-100 items)
- Results parsed and distributed back to individual jobs
- Cache aggressively: title normalisations, SOC codes, name variants are permanent
- Estimated LLM budget per full cycle: ~500-1000 calls

### 4.5 Swappable Backend

The `LLMService` is designed to swap Ollama for any API:
- Set `LLM_BACKEND=ollama` (default) or `LLM_BACKEND=anthropic` or `LLM_BACKEND=openai`
- Same interface, different HTTP endpoint
- Zero code changes in sub-agents

---

## 5. Database Schema Changes

### 5.1 New Tables

```sql
-- Sub-agent validation log
CREATE TABLE job_validation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    field VARCHAR(100),
    source_a VARCHAR(50),
    value_a TEXT,
    source_b VARCHAR(50),
    value_b TEXT,
    resolution TEXT,
    reason VARCHAR(500),
    resolved_at TIMESTAMPTZ DEFAULT now()
);

-- Job change tracking
CREATE TABLE job_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    field VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    detected_at TIMESTAMPTZ DEFAULT now()
);

-- Swarm operational metrics
CREATE TABLE swarm_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    jobs_scraped INTEGER DEFAULT 0,
    jobs_validated INTEGER DEFAULT 0,
    jobs_enriched INTEGER DEFAULT 0,
    jobs_expired INTEGER DEFAULT 0,
    errors_total INTEGER DEFAULT 0,
    errors_by_source JSONB DEFAULT '{}',
    completeness_avg FLOAT,
    sponsorship_scored_count INTEGER DEFAULT 0,
    llm_calls_count INTEGER DEFAULT 0,
    llm_avg_latency_ms FLOAT
);

-- Swarm alerts
CREATE TABLE swarm_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50),
    source VARCHAR(50),
    severity VARCHAR(20),
    message TEXT,
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    acknowledged BOOLEAN DEFAULT false
);

-- LLM-generated reports
CREATE TABLE swarm_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE,
    report_type VARCHAR(20),  -- 'daily' | 'weekly'
    content TEXT,
    metrics_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Source health tracking
CREATE TABLE source_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50),
    logged_at TIMESTAMPTZ DEFAULT now(),
    jobs_returned INTEGER,
    success_rate FLOAT,
    avg_completeness FLOAT,
    avg_response_time_ms FLOAT,
    error_count INTEGER,
    is_paused BOOLEAN DEFAULT false
);

-- Sponsor hiring patterns
CREATE TABLE sponsor_hiring_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID REFERENCES sponsors(id),
    year_month VARCHAR(7),  -- '2026-03'
    job_count INTEGER,
    avg_salary FLOAT,
    top_role VARCHAR(500),
    UNIQUE(sponsor_id, year_month)
);

-- Market velocity
CREATE TABLE market_velocity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry VARCHAR(200),
    location_city VARCHAR(200),
    measured_at DATE,
    avg_days_to_fill FLOAT,
    new_postings_per_week FLOAT,
    churn_rate FLOAT,
    UNIQUE(industry, location_city, measured_at)
);
```

### 5.2 New Columns on Existing Tables

```sql
-- jobs table additions
ALTER TABLE jobs ADD COLUMN data_quality_score INTEGER;
ALTER TABLE jobs ADD COLUMN is_flagged BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN flag_reason VARCHAR(50);
ALTER TABLE jobs ADD COLUMN repost_of_job_id UUID REFERENCES jobs(id);
ALTER TABLE jobs ADD COLUMN repost_count INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN closing_signal BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN work_model VARCHAR(20);  -- 'remote' | 'hybrid' | 'onsite'
ALTER TABLE jobs ADD COLUMN salary_estimated_min FLOAT;
ALTER TABLE jobs ADD COLUMN salary_estimated_max FLOAT;
ALTER TABLE jobs ADD COLUMN salary_is_estimated BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN salary_percentile FLOAT;
ALTER TABLE jobs ADD COLUMN salary_vs_threshold VARCHAR(20);
ALTER TABLE jobs ADD COLUMN visa_routes_eligible TEXT[];
ALTER TABLE jobs ADD COLUMN department VARCHAR(100);
ALTER TABLE jobs ADD COLUMN benefits JSONB;
ALTER TABLE jobs ADD COLUMN red_flags JSONB;
ALTER TABLE jobs ADD COLUMN culture_signals JSONB;
ALTER TABLE jobs ADD COLUMN education_required JSONB;
ALTER TABLE jobs ADD COLUMN certifications_required TEXT[];
ALTER TABLE jobs ADD COLUMN languages_required TEXT[];
ALTER TABLE jobs ADD COLUMN source_urls TEXT[];  -- all sources for canonical job

-- company_profiles additions
ALTER TABLE company_profiles ADD COLUMN name_variants JSONB;
ALTER TABLE company_profiles ADD COLUMN careers_page_url VARCHAR(2000);
```

### 5.3 RLS Policies

```sql
-- All new tables: anon SELECT
CREATE POLICY anon_select ON job_validation_log FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON job_change_log FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON swarm_metrics FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON swarm_alerts FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON swarm_reports FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON source_health_log FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON sponsor_hiring_patterns FOR SELECT TO anon USING (true);
CREATE POLICY anon_select ON market_velocity FOR SELECT TO anon USING (true);
```

---

## 6. Backend File Structure

```
backend/app/agents/
├── __init__.py
├── base.py                    # BaseAgent, BaseSubAgent abstract classes
├── llm_service.py             # Unified Ollama/API interface
├── registry.py                # Agent + sub-agent registration
│
├── hunter/
│   ├── __init__.py
│   ├── agent.py               # HunterAgent main class
│   ├── query_formulator.py    # [LLM]
│   ├── name_variant_generator.py  # [LLM]
│   ├── industry_query_mapper.py   # [DET]
│   ├── source_selector.py     # [DET]
│   ├── search_prioritiser.py  # [DET]
│   ├── keyword_expander.py    # [LLM]
│   ├── free_api_hunter.py     # [DET] wraps 11 APIs
│   ├── reed_hunter.py         # [DET]
│   ├── adzuna_hunter.py       # [DET]
│   ├── jooble_hunter.py       # [DET]
│   ├── indeed_hunter.py       # [DET]
│   ├── linkedin_hunter.py     # [DET]
│   ├── totaljobs_hunter.py    # [DET]
│   ├── cwjobs_hunter.py       # [DET]
│   ├── glassdoor_hunter.py    # [DET]
│   ├── nhs_hunter.py          # [DET]
│   ├── gov_hunter.py          # [DET]
│   ├── guardian_hunter.py     # [DET]
│   ├── teaching_hunter.py     # [DET]
│   ├── charity_hunter.py      # [DET]
│   ├── career_page_discoverer.py  # [LLM]
│   └── career_page_parser.py  # [LLM]
│
├── validator/
│   ├── __init__.py
│   ├── agent.py               # ValidatorAgent main class
│   ├── title_normaliser.py    # [LLM]
│   ├── company_normaliser.py  # [DET]
│   ├── location_normaliser.py # [DET]
│   ├── similarity_scorer.py   # [DET]
│   ├── cluster_builder.py     # [DET]
│   ├── canonical_merger.py    # [DET]
│   ├── spam_classifier.py     # [LLM]
│   ├── salary_validator.py    # [DET]
│   ├── date_validator.py      # [DET]
│   ├── url_validator.py       # [DET]
│   ├── description_cleaner.py # [DET]
│   ├── duplicate_description_detector.py  # [DET]
│   ├── salary_conflict_resolver.py   # [HYB]
│   ├── location_conflict_resolver.py  # [DET]
│   ├── title_conflict_resolver.py     # [LLM]
│   └── conflict_logger.py     # [DET]
│
├── enrichment/
│   ├── __init__.py
│   ├── agent.py               # EnrichmentAgent main class
│   ├── sponsorship_keyword_scanner.py    # [DET]
│   ├── sponsorship_context_analyser.py   # [LLM]
│   ├── sponsor_register_matcher.py       # [DET]
│   ├── sponsor_history_analyser.py       # [DET]
│   ├── visa_threshold_checker.py         # [DET]
│   ├── shortage_list_matcher.py          # [DET]
│   ├── sponsorship_score_calculator.py   # [DET]
│   ├── visa_route_classifier.py          # [LLM]
│   ├── soc_classifier.py                # [LLM]
│   ├── seniority_detector.py            # [LLM]
│   ├── contract_type_classifier.py       # [HYB]
│   ├── remote_classifier.py             # [HYB]
│   ├── industry_classifier.py           # [LLM]
│   ├── department_classifier.py         # [LLM]
│   ├── benefits_extractor.py            # [LLM]
│   ├── tech_stack_extractor.py          # [LLM]
│   ├── soft_skill_extractor.py          # [LLM]
│   ├── certification_extractor.py       # [DET]
│   ├── experience_parser.py             # [HYB]
│   ├── education_extractor.py           # [LLM]
│   ├── language_requirement_extractor.py  # [DET]
│   ├── salary_parser.py                 # [DET]
│   ├── salary_normaliser.py             # [DET]
│   ├── salary_estimator.py              # [LLM]
│   ├── salary_benchmarker.py            # [DET]
│   ├── job_summariser.py                # [LLM]
│   ├── red_flag_detector.py             # [LLM]
│   └── culture_signal_extractor.py      # [LLM]
│
├── freshness/
│   ├── __init__.py
│   ├── agent.py               # FreshnessAgent main class
│   ├── http_status_checker.py          # [DET]
│   ├── page_content_analyser.py        # [LLM]
│   ├── api_status_checker.py           # [DET]
│   ├── salary_removal_detector.py      # [DET]
│   ├── listing_change_tracker.py       # [DET]
│   ├── expiry_date_estimator.py        # [DET]
│   ├── repost_detector.py             # [DET]
│   ├── seasonal_pattern_tracker.py     # [DET]
│   ├── market_velocity_calculator.py   # [DET]
│   ├── adaptive_scheduler.py          # [DET]
│   ├── batch_optimiser.py             # [DET]
│   └── stale_job_reaper.py            # [DET]
│
├── quality/
│   ├── __init__.py
│   ├── agent.py               # QualityAgent main class
│   ├── completeness_scorer.py          # [DET]
│   ├── gap_identifier.py              # [DET]
│   ├── cross_source_filler.py         # [DET]
│   ├── mandatory_field_enforcer.py    # [DET]
│   ├── enrichment_prioritiser.py      # [DET]
│   ├── salary_integrity_checker.py    # [DET]
│   ├── date_integrity_checker.py      # [DET]
│   ├── location_integrity_checker.py  # [DET]
│   ├── description_integrity_checker.py  # [DET]
│   ├── fk_integrity_checker.py        # [DET]
│   ├── source_health_monitor.py       # [DET]
│   ├── source_degradation_detector.py # [DET]
│   ├── source_recovery_prober.py      # [DET]
│   ├── daily_quality_reporter.py      # [LLM]
│   └── weekly_trends_reporter.py      # [LLM]
│
├── orchestrator/
│   ├── __init__.py
│   ├── agent.py               # OrchestratorAgent main class
│   ├── pipeline_sequencer.py          # [DET]
│   ├── batch_coordinator.py           # [DET]
│   ├── dependency_resolver.py         # [DET]
│   ├── retry_manager.py              # [DET]
│   ├── rate_limit_budgeter.py        # [DET]
│   ├── memory_manager.py             # [DET]
│   ├── concurrency_controller.py     # [DET]
│   ├── metrics_collector.py          # [DET]
│   ├── anomaly_detector.py           # [DET]
│   └── alert_publisher.py            # [DET]
│
└── prompts/
    ├── hunter/
    │   ├── query_formulator.txt
    │   ├── name_variant_generator.txt
    │   ├── keyword_expander.txt
    │   ├── career_page_discoverer.txt
    │   └── career_page_parser.txt
    ├── validator/
    │   ├── title_normaliser.txt
    │   ├── spam_classifier.txt
    │   └── title_conflict_resolver.txt
    ├── enrichment/
    │   ├── sponsorship_context_analyser.txt
    │   ├── visa_route_classifier.txt
    │   ├── soc_classifier.txt
    │   ├── seniority_detector.txt
    │   ├── contract_type_classifier.txt
    │   ├── remote_classifier.txt
    │   ├── industry_classifier.txt
    │   ├── department_classifier.txt
    │   ├── benefits_extractor.txt
    │   ├── tech_stack_extractor.txt
    │   ├── soft_skill_extractor.txt
    │   ├── experience_parser.txt
    │   ├── education_extractor.txt
    │   ├── salary_estimator.txt
    │   ├── job_summariser.txt
    │   ├── red_flag_detector.txt
    │   └── culture_signal_extractor.txt
    ├── freshness/
    │   └── page_content_analyser.txt
    └── quality/
        ├── daily_quality_reporter.txt
        └── weekly_trends_reporter.txt
```

---

## 7. Frontend Integration

### 7.1 Jobs Page (`/jobs`)

Already built. Will work as-is once jobs table has data. Components:
- `JobTable` — sortable table with expandable rows, sponsorship bars
- `JobFilters` — keyword, source, salary range, sponsorship slider, shortage/threshold toggles
- `JobStats` — source breakdown chart, top cities list
- Stats bar: total jobs, sponsorship likely %, avg salary, new 7 days

### 7.2 Company Profile Jobs Tab

New tab on `/company/[id]` when sponsor has jobs:
- Query: `jobs.sponsor_id = sponsor.id AND is_expired = false`
- Shows: active listings with sponsorship score, salary, source
- Also shows: recently expired jobs (last 30 days) in greyed-out section

### 7.3 Dashboard Integration

- MarketPulse: add "Total Jobs" and "Sponsorship Likely" stat cards
- LiveFeed: include new job postings alongside new sponsors
- GrowthChart: add jobs-over-time trend line

### 7.4 Trends Integration

- New chart: "Jobs by Source" — stacked bar chart
- New chart: "Salary Trends" — median salary over time by industry
- New chart: "Sponsorship Likelihood Distribution" — histogram

### 7.5 Signals Integration

- High-value job alerts: A-rated sponsor + sponsorship_likelihood > 80 + salary > threshold
- New source detected: sponsor starts posting on a new job board
- Hiring surge: sponsor's job count increases > 3x in a week

### 7.6 Search Integration

- Global search returns sponsors AND jobs
- Job results show: title, company, sponsorship score, salary
- HoverPreview includes job count for each sponsor

### 7.7 Admin Dashboard

- Swarm health panel: per-source status (green/amber/red)
- Pipeline metrics: jobs/hour, error rate, completeness avg
- Recent alerts feed
- Daily/weekly reports viewer
- Source pause/resume controls

---

## 8. Railway Deployment

### 8.1 Services

**Service 1: backend** (Dockerfile)
- Processes: web (FastAPI), worker (Celery ×2), beat (Celery Beat)
- RAM: 1GB
- Cost: ~$7/mo

**Service 2: ollama** (Docker image: `ollama/ollama`)
- Model: phi3:mini (pulled on first start)
- RAM: 3GB (2.5GB model + 0.5GB overhead)
- Cost: ~$10/mo
- Exposed internally at: `http://ollama:11434`

**Addon: Redis**
- Railway managed Redis
- Cost: ~$5/mo

### 8.2 Environment Variables

```env
# Supabase
SUPABASE_URL=https://aqhvuwrgfsfkqngnjjvh.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres.aqhvuwrgfsfkqngnjjvh:...@aws-1-eu-west-2.pooler.supabase.com:5432/postgres

# Redis (Railway provides)
REDIS_URL=redis://...

# Ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=phi3:mini

# API Keys (register for free)
REED_API_KEY=
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=

# Proxy (optional, for browser scrapers)
PROXY_URL=
```

### 8.3 Estimated Monthly Cost

| Service | Cost |
|---------|------|
| Railway backend | ~$7 |
| Railway Ollama | ~$10 |
| Railway Redis | ~$5 |
| Supabase (existing) | $0 (free tier) |
| Vercel (existing) | $0 (free tier) |
| **Total** | **~$22/mo** |

---

## 9. Success Criteria

| Metric | Day 1 | Week 1 | Week 4 |
|--------|-------|--------|--------|
| Jobs in database | 500+ | 5,000+ | 20,000+ |
| Sources active | 11 (free APIs) | 14 (+ API keys) | 20+ (+ browser) |
| Avg data quality | 50+ | 65+ | 75+ |
| Sponsorship scored | 100% | 100% | 100% |
| Sponsor-linked jobs | 30%+ | 50%+ | 70%+ |
| Expired jobs tracked | N/A | 100% | 100% |
| Frontend pages with job data | 1 (/jobs) | 4 | 7 (all) |

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Browser scrapers blocked by anti-bot | High | Medium | Free APIs provide baseline; browser scrapers are bonus |
| Ollama too slow on CPU | Medium | Medium | Batch aggressively; cache permanently; swap to API if needed |
| Railway RAM insufficient | Low | High | Monitor usage; scale up or split services |
| Supabase free tier row limits | Medium | Medium | 500K rows on free tier; archive old expired jobs if approaching |
| API key scrapers rate limited | Low | Low | Budget allocation via OrchestratorAgent |
| Job-sponsor entity resolution low accuracy | Medium | Medium | Improve with name variants + manual correction UI |
