# SponsorIntel v3.0 — Complete UK Immigration Ecosystem

**Date:** 2026-03-29
**Vision:** Not just a sponsor tracker. The ONE platform every UK immigrant needs.

---

## NEW SECTIONS TO BUILD

### 1. Universities & Student Visa Hub (`/universities`)

**Data to gather (all publicly available):**
- HESA (Higher Education Statistics Agency) — student enrollment by nationality, course, institution
- UCAS — acceptance rates, entry requirements
- QS/THE rankings — UK university rankings
- Home Office Student sponsor register — licensed student sponsors
- Graduate Outcomes data — employment rates post-graduation
- Tier 4/Student visa grant statistics by university

**Pages:**
- University search — filter by course, city, ranking, acceptance rate, international student %
- University profile — courses, fees, international student stats, graduate employment rates
- Course comparison — side-by-side comparison tool
- Student visa stats — which universities have most visa grants, by nationality
- City guides — for each university city (accommodation, cost of living, transport)

**Statistics to show:**
- Top 10 universities by international student count
- Visa grant rates by university
- Graduate employment rates (from HESA Graduate Outcomes)
- International student fee ranges
- Countries of origin breakdown per university

---

### 2. Trusted Consultancies Directory (`/consultancies`)

**Data sources:**
- OISC (Office of the Immigration Services Commissioner) register — all registered advisers
- SRA (Solicitors Regulation Authority) — all regulated solicitors
- Reviews from Google, Trustpilot
- Price comparison (where publicly available)

**Pages:**
- Search consultancies — filter by city, specialisation, OISC level, rating
- Consultancy profile — services, pricing, reviews, success rates
- Compare consultancies — side-by-side
- Verify registration — check if an adviser is OISC/SRA registered
- Report scams — community reporting

**Trust indicators:**
- OISC registration level (1, 2, 3)
- SRA regulated status
- Years in practice
- Google/Trustpilot rating
- Number of reviews
- Specialisations (work visas, family, asylum, nationality)

---

### 3. Trusted Solicitors for Visas & Jobs (`/solicitors`)

**Data from SRA API (free, public):**
- Solicitor name, firm, location
- Practice areas (immigration listed)
- Regulatory status
- Year of admission

**Enrich with:**
- Google reviews
- Trustpilot ratings
- Office location on map
- Languages spoken (from firm websites where available)

---

### 4. Immigration Demographics (`/demographics`)

**Data sources (all public ONS/Home Office):**
- ONS International Migration data
- Home Office Immigration Statistics quarterly
- Census 2021 data on country of birth
- National Insurance Number registrations by nationality

**Pages:**
- UK immigration map — where immigrants live, by nationality, by city
- Country of origin statistics — top nationalities, trends over time
- City profiles — immigrant population %, top nationalities, community resources
- Visa route statistics — Skilled Worker vs Student vs Family vs Asylum
- Trends dashboard — year-over-year changes

**Statistics:**
- Top 20 nationalities by visa grants
- Net migration by year
- Immigrant population by city/region
- Employment rates by nationality
- NI number registrations as proxy for economic activity

---

### 5. Immigrant Community Resources (`/community`)

**Curated directories:**
- Religious/cultural centres by nationality and city
- Ethnic grocery stores and restaurants
- Community organisations and support groups
- Language schools / ESOL providers
- Legal aid providers
- Job centres with multilingual support

**Community features:**
- Success stories (user-submitted)
- Tips by city ("Moving to Manchester as an Indian" etc.)
- Events calendar (cultural festivals, community meetups)
- Q&A forum (moderated)

---

## DATA ACQUISITION PLAN

### Publicly Available APIs (NO KEYS NEEDED):

| Source | Data | URL | Update Frequency |
|--------|------|-----|------------------|
| OISC Register | Immigration advisers | https://home.oisc.gov.uk/adviser_finder/ | Monthly scrape |
| SRA Register | Solicitors | https://www.sra.org.uk/consumers/register/ | Monthly scrape |
| HESA Open Data | University stats | https://www.hesa.ac.uk/data-and-analysis | Annual |
| UCAS | Course data | https://www.ucas.com/explore | Annual |
| ONS Migration | Demographics | https://www.ons.gov.uk | Quarterly |
| Home Office Stats | Visa grants | https://www.gov.uk | Quarterly |
| Census 2021 | Population | https://www.ons.gov.uk/census | Static |
| Charity Commission | Charities | https://register-of-charities.charitycommission.gov.uk/api | Live |
| CQC | Care providers | https://www.cqc.org.uk/about-us/transparency/using-cqc-data | Live |
| Google Places | Reviews/ratings | Places API (free tier) | On demand |

### APIs We Already Have Keys For:

| API | Key | What we get |
|-----|-----|-------------|
| Companies House | 8eef31df | Company filings, officers, charges for 140K sponsors |
| Adzuna | 68c87d5e | 1M+ UK jobs with salary data |
| GROQ | gsk_NDNc | LLM classification for intel items |

---

## PRIORITY ORDER

| Phase | Section | Effort | Impact |
|-------|---------|--------|--------|
| 1 | Trusted Consultancies (OISC scrape) | Medium | HIGH — immigrants need this DAY ONE |
| 2 | Solicitors Directory (SRA API) | Easy | HIGH — legal help is critical |
| 3 | University Hub (HESA + UCAS) | Large | HIGH — student visa is biggest route |
| 4 | Demographics (ONS + Census) | Medium | MEDIUM — interesting but not actionable |
| 5 | Community Resources | Large | MEDIUM — needs community contribution |

---

## AGENT REQUIREMENTS

Each new section needs agents:

### Consultancy Agents
- OISC Register Scanner — scrapes OISC adviser finder monthly
- SRA Register Scanner — scrapes SRA register monthly
- Review Aggregator — fetches Google/Trustpilot reviews
- Scam Detector — flags unregistered advisers

### University Agents
- HESA Data Ingester — annual student statistics
- UCAS Course Scanner — course data and entry requirements
- Graduate Outcomes Scanner — employment data
- Student Sponsor Register Scanner — Home Office CSV (separate from worker register)

### Demographics Agents
- ONS Migration Scanner — quarterly statistics
- Census Data Processor — static dataset, one-time load
- NI Registration Scanner — quarterly data from DWP

---

## IMMEDIATE NEXT STEPS

1. Build OISC register scraper and `/consultancies` page
2. Build SRA register lookup and `/solicitors` page
3. Download Student sponsor register CSV and build `/universities` basic search
4. Add these to Celery Beat for ongoing updates
