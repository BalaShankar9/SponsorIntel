# Sub-Project 3: Scraper Fleet Upgrade

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Sub-Project 2 (SafetyGovernor)

## Purpose

Replace brittle CSS-selector scrapers with AI-powered extraction that survives site redesigns, unblock authenticated targets (LinkedIn, Glassdoor), and add self-healing capability.

## Components

### 1. Crawl4AI Integration (62K stars)

Replace existing scrapers for career pages and company websites with Crawl4AI's LLM extraction mode.

**Current pain:** `career_page_scraper.py`, `website_analyser.py` break when target sites redesign.

**New approach:** Define extraction schemas, Crawl4AI uses LLM to extract data from any page layout.

```python
from crawl4ai import AsyncWebCrawler, LLMExtractionStrategy

strategy = LLMExtractionStrategy(
    provider="groq/llama-3.3-70b-versatile",
    schema={
        "company_name": "string",
        "careers_url": "string",
        "open_roles_count": "integer",
        "tech_stack": "array of strings",
        "benefits_mentioned": "array of strings",
    }
)
```

**Migration targets:**
- `website_analyser.py` → Crawl4AI with company profile schema
- `career_page_scraper.py` → Crawl4AI with job listing schema
- `contact_scraper.py` → Crawl4AI with contact info schema

### 2. Firecrawl for Hard Targets

Self-host Firecrawl on Railway for sites that block direct scraping.

**Targets:** LinkedIn company pages, Glassdoor reviews, complex JS-rendered career portals.

**Architecture:** Firecrawl runs as a separate Railway service. Agents call its API when SafetyGovernor approves.

### 3. Browser-Use for Authenticated Portals (84K stars)

AI-controlled browser automation for job portals requiring login/interaction.

**Use cases:**
- Navigate paginated career pages
- Handle cookie consent banners
- Fill search forms on company ATS systems (Workday, Lever, Greenhouse)
- Extract jobs from portals with infinite scroll

### 4. Self-Healing Scrapers

When a scraper fails 3 times consecutively:
1. Circuit breaker opens (existing pattern)
2. **NEW:** Agent attempts Crawl4AI LLM extraction as fallback
3. If LLM extraction succeeds, replace the broken scraper's strategy
4. Log the adaptation in `agent_memory` (L4: procedural memory)
5. Admin notification: "Scraper X self-healed using LLM extraction"

## Success Criteria

1. Zero scraper outages lasting >1 hour (self-healing kicks in)
2. Career page extraction works on 90%+ of company websites
3. LinkedIn/Glassdoor data flows without manual intervention
4. LLM extraction fallback activates automatically on scraper failure
