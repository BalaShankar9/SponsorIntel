# SponsorIntel: Continuous Enrichment Strategy

## Mission
SponsorIntel is the definitive intelligence platform for UK visa sponsorship. We track every company with a sponsor licence, enrich their profiles with deep company data, and find every job they post — giving visa seekers the most complete picture of their options.

## The Problem We Solve
- The Home Office publishes a raw CSV of ~140,000 licensed sponsors — just names, cities, and routes
- Visa seekers have NO WAY to know which sponsors are actually hiring, which are legitimate, or which match their skills
- Job boards don't filter by sponsorship status; companies' registered names often differ from trading names
- Critical information (company size, financials, reviews, career pages) is scattered across 10+ sources

## Phase 1: Deep Enrichment (Current Priority)

**Goal**: Transform every sponsor record from a bare name into a rich company profile.

### Data Sources & Priority

| Source | Data Points | Priority | Method |
|--------|------------|----------|--------|
| Companies House API | Registration, SIC codes, directors, accounts, charges, insolvency | P0 | API (free, rate-limited) |
| Company Website | Career page URL, tech stack, contact info, about text | P0 | Playwright crawler |
| LinkedIn | Employee count, follower count, industry, company page | P1 | Scraper with rate limiting |
| Glassdoor | Rating, review count, CEO approval, recommend % | P1 | Scraper |
| Trustpilot | Rating, review count | P2 | Scraper |
| Google Maps | Rating, review count, address verification | P2 | API |
| Google News | Recent mentions, PR activity | P3 | RSS/API |

### Name Matching Problem (Critical)

The Home Office register uses **registered company names** (Companies House), but companies often trade under different names:

| Registered Name (Sponsors Table) | Trading Name | Job Board Name |
|----------------------------------|-------------|----------------|
| ALPHABET INC | Google | Google |
| META PLATFORMS IRELAND LIMITED | Facebook / Instagram | Meta |
| PRICEWATERHOUSECOOPERS LLP | PwC | PwC |

**Solution — Multi-layer name resolution**:
1. **Companies House lookup** → Get registered name, trading name, previous names
2. **Fuzzy matching** → Use Levenshtein distance + token overlap to match sponsors to job listings
3. **Domain matching** → If we know `google.com` belongs to sponsor X, match jobs that link to `google.com/careers`
4. **Manual corrections** → Build a verified mapping table for top 1,000 sponsors

### Enrichment Queue Strategy
- **Tier 1** (first): A-rated sponsors in major cities (London, Manchester, Birmingham, Edinburgh, Glasgow) — ~30,000 companies
- **Tier 2**: All remaining A-rated sponsors — ~70,000 companies
- **Tier 3**: B-rated sponsors with active job listings — ~5,000 companies
- **Tier 4**: All remaining B-rated sponsors — ~35,000 companies

### Quality Metrics
- `enrichment_level`: 0-100 score based on data completeness
  - 0-19: Name only (from register)
  - 20-49: Basic (Companies House data)
  - 50-79: Partial (+ website, LinkedIn)
  - 80-100: Full (all sources enriched)
- `data_quality_score`: Confidence in the data accuracy
- `legitimacy_score`: Red flag detection (shell companies, dissolved, overdue accounts)

## Phase 2: Continuous Monitoring

**Goal**: Keep data fresh and detect changes in real-time.

### Daily Tasks
1. **Home Office Register Diff** — Download latest CSV, compare with stored data:
   - New sponsors added → Trigger full enrichment
   - Sponsors removed → Mark as `is_active: false`, alert watchers
   - Rating changes (A→B or B→A) → High-priority signal
   - Route changes → Alert watchers

2. **Job Discovery Sweep** — For each active sponsor:
   - Check career page for new listings (if known)
   - Search job boards (Indeed, LinkedIn, Reed, etc.) using both registered and trading names
   - Match new jobs to sponsors via name resolution

3. **Stale Data Refresh** — Re-enrich sponsors where data is > 30 days old:
   - Companies House: Check for new filings, status changes
   - Glassdoor/Trustpilot: Updated ratings
   - LinkedIn: Employee count changes

### Weekly Tasks
- Full sponsor register re-import (catch any missed changes)
- Dead career page detection (re-crawl known career URLs)
- Name resolution improvements (new trading name mappings)

### Signals to Track
- **Hiring surge**: Company posts 5+ jobs in 7 days
- **Hiring freeze**: Company had jobs but none in 30 days
- **Rating downgrade**: A → B (risk signal)
- **New sponsor**: Company just got licence (opportunity signal)
- **Dissolved/Dormant**: Companies House status change (avoid signal)
- **Financial distress**: Insolvency, overdue accounts, CCJs

## Phase 3: Job Intelligence

**Goal**: Find every relevant job and link it to the right sponsor.

### Job Discovery Methods
1. **Direct career page scraping** — Crawl sponsor's career page for listings
2. **Job board search** — Query Indeed, LinkedIn, Reed, Glassdoor, etc. by company name
3. **API feeds** — Free APIs: Adzuna, Remotive, Arbeitnow, Jobicy, TheMuse, DevITJobs
4. **RSS feeds** — CharityJob, WorkInStartups, JobsAC, We Work Remotely

### Job Quality Scoring
Each job gets a `sponsorship_likelihood` score (0-100):
- Company is on sponsor register: +40
- Job explicitly mentions visa/sponsorship: +30
- Salary meets minimum threshold (£26,200 for Skilled Worker): +15
- Job is on shortage occupation list: +10
- Role matches sponsor's licensed routes: +5

### Deduplication
- Same job from multiple sources → Keep the one with most detail, link others
- Hash on: normalized title + company name + location
- `first_seen_at` / `last_seen_at` tracking for freshness

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 SCHEDULER (Celery Beat)          │
│  ┌─────────┐ ┌─────────┐ ┌─────────────────┐    │
│  │Daily CSV │ │Job Sweep│ │Enrichment Queue │    │
│  │  Import  │ │  Cycle  │ │  (Tiered)       │    │
│  └────┬─────┘ └────┬────┘ └───────┬─────────┘    │
│       │            │              │              │
│  ┌────▼────────────▼──────────────▼──────────┐   │
│  │           WORKER POOL (Celery)            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │Companies │ │ Career   │ │  Job     │   │   │
│  │  │House API │ │ Page     │ │  Board   │   │   │
│  │  │ Enricher │ │ Crawler  │ │ Scrapers │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘   │   │
│  └───────────────────┬───────────────────────┘   │
│                      │                           │
│  ┌───────────────────▼───────────────────────┐   │
│  │            SUPABASE (PostgreSQL)           │   │
│  │  sponsors │ company_profiles │ jobs        │   │
│  │  sponsor_scores │ sponsor_changes          │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Implementation Priority (Next Steps)

### Immediate (This Week)
1. [x] Companies page with full filtering (route, city, rating, type)
2. [ ] Name resolution table: `sponsor_name_aliases` with registered_name, trading_name, domain
3. [ ] Companies House batch enrichment script (Tier 1 sponsors)

### Short-term (Week 2-3)
4. [ ] Career page discovery: Crawl top 5,000 A-rated sponsors for career URLs
5. [ ] Job board multi-name search: Query Indeed/Reed using both registered AND trading names
6. [ ] Daily Home Office CSV diff pipeline

### Medium-term (Week 4-6)
7. [ ] LinkedIn company page enrichment
8. [ ] Glassdoor/Trustpilot review enrichment
9. [ ] Signal detection system (hiring surges, rating changes)
10. [ ] Push notifications for watchlist changes

### Long-term (Month 2+)
11. [ ] AI-powered company similarity matching
12. [ ] Salary benchmarking by industry/city
13. [ ] Application tracking integration
14. [ ] Mobile app
