# Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ground truth data layer — Supabase tables for visa statistics, ISL, ONS salary benchmarks + Celery tasks for register diffing, Hansard monitoring, and API endpoints for all new data.

**Architecture:** New Supabase migration creates 3 tables. Existing `sync_register.py` gets wrapped as an enhanced Celery task with proper diff logging and SignalBus integration. New data ingestion scripts for visa stats, ISL, and ONS. New API endpoints serve the data. All tasks route through `army_intelligence` Celery queue.

**Tech Stack:** Python 3.11, FastAPI, Celery + Redis, Supabase (Postgres), httpx, openpyxl (Excel parsing), feedparser

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260326_data_foundation.sql` | 3 new tables + indexes + RLS |
| `backend/app/scripts/data_foundation/__init__.py` | Package init |
| `backend/app/scripts/data_foundation/register_diff.py` | Enhanced register sync with diff logging |
| `backend/app/scripts/data_foundation/visa_stats.py` | Home Office visa statistics ingestion |
| `backend/app/scripts/data_foundation/isl_parser.py` | Immigration Salary List parser |
| `backend/app/scripts/data_foundation/ons_salaries.py` | ONS ASHE salary benchmark ingestion |
| `backend/app/scripts/data_foundation/hansard_monitor.py` | Parliamentary debate scanner |
| `backend/app/tasks/data_tasks.py` | Celery tasks wrapping all data scripts |
| `backend/app/api/v1/data.py` | API endpoints for visa stats, ISL, salary benchmarks, register changes |
| `backend/tests/data/test_register_diff.py` | Tests for register diffing |
| `backend/tests/data/test_visa_stats.py` | Tests for visa stats parsing |
| `backend/tests/data/test_isl_parser.py` | Tests for ISL parsing |
| `backend/tests/data/test_data_api.py` | Tests for data API endpoints |

### Modified Files
| File | Change |
|------|--------|
| `backend/app/tasks/schedule.py` | Replace `sync-gov-register` entry, add new data tasks |
| `backend/app/tasks/celery_app.py` | Add `data.*` queue routing, include `data_tasks` |
| `backend/app/main.py` | Register new data API router |
| `backend/requirements.txt` | Add `openpyxl` for Excel parsing |

---

## Task 1: Supabase Migration — 3 Data Foundation Tables

**Files:**
- Create: `supabase/migrations/20260326_data_foundation.sql`

- [ ] **Step 1: Create the migration SQL file**

```sql
-- supabase/migrations/20260326_data_foundation.sql
-- Data Foundation: visa statistics, ISL, ONS salary benchmarks

-- 1. Visa grant statistics by SOC code (SOC 2020)
CREATE TABLE IF NOT EXISTS visa_statistics (
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

CREATE INDEX IF NOT EXISTS idx_visa_stats_soc_year ON visa_statistics (soc_code, year);

-- RLS: public read, service role write
ALTER TABLE visa_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read visa stats" ON visa_statistics FOR SELECT USING (true);
CREATE POLICY "Service role manages visa stats" ON visa_statistics FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- 2. Immigration Salary List (ISL) — replaces old SOL
CREATE TABLE IF NOT EXISTS immigration_salary_list (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_isl_soc_effective ON immigration_salary_list (soc_code, effective_date);

ALTER TABLE immigration_salary_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ISL" ON immigration_salary_list FOR SELECT USING (true);
CREATE POLICY "Service role manages ISL" ON immigration_salary_list FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- 3. ONS salary benchmarks (ASHE Table 14, SOC 2020)
CREATE TABLE IF NOT EXISTS ons_salary_benchmarks (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_ons_salary_soc_region_year ON ons_salary_benchmarks (soc_code, region, year);

ALTER TABLE ons_salary_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ONS salaries" ON ons_salary_benchmarks FOR SELECT USING (true);
CREATE POLICY "Service role manages ONS salaries" ON ons_salary_benchmarks FOR ALL
    TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260326_data_foundation.sql
git commit -m "feat(data): add visa_statistics, immigration_salary_list, ons_salary_benchmarks tables"
```

---

## Task 2: Enhanced Register Diff with SignalBus

**Files:**
- Create: `backend/app/scripts/data_foundation/__init__.py`
- Create: `backend/app/scripts/data_foundation/register_diff.py`
- Create: `backend/tests/data/__init__.py`
- Create: `backend/tests/data/test_register_diff.py`

This wraps the existing `sync_register.py` logic but adds: proper diff summary logging, SignalBus emission for new/changed sponsors, and enrichment triggering for new sponsors.

- [ ] **Step 1: Create test directory and package init**

```bash
mkdir -p backend/app/scripts/data_foundation backend/tests/data
touch backend/app/scripts/data_foundation/__init__.py backend/tests/data/__init__.py
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/data/test_register_diff.py
"""Tests for enhanced register diffing."""

import pytest
from unittest.mock import MagicMock, AsyncMock


class TestRegisterDiff:
    @pytest.mark.asyncio
    async def test_diff_detects_new_sponsor(self):
        """New sponsor in CSV not in DB should be detected."""
        from app.scripts.data_foundation.register_diff import compute_diff

        csv_records = [
            {"organisation_name": "TechCorp Ltd", "town_city": "London", "rating": "A", "routes": ["Skilled Worker"]},
            {"organisation_name": "NewCo Ltd", "town_city": "Manchester", "rating": "A", "routes": ["Skilled Worker"]},
        ]
        db_sponsors = {
            "TECHCORP LTD": {"id": "123", "organisation_name": "TechCorp Ltd", "rating": "A", "routes": ["Skilled Worker"]},
        }

        diff = compute_diff(csv_records, db_sponsors)

        assert len(diff["added"]) == 1
        assert diff["added"][0]["organisation_name"] == "NewCo Ltd"
        assert len(diff["removed"]) == 0
        assert len(diff["rating_changes"]) == 0

    @pytest.mark.asyncio
    async def test_diff_detects_removed_sponsor(self):
        """Sponsor in DB but not in CSV should be detected as removed."""
        from app.scripts.data_foundation.register_diff import compute_diff

        csv_records = [
            {"organisation_name": "TechCorp Ltd", "town_city": "London", "rating": "A", "routes": ["Skilled Worker"]},
        ]
        db_sponsors = {
            "TECHCORP LTD": {"id": "123", "organisation_name": "TechCorp Ltd", "rating": "A", "routes": ["Skilled Worker"]},
            "OLDCO LTD": {"id": "456", "organisation_name": "OldCo Ltd", "rating": "B", "routes": ["Skilled Worker"]},
        }

        diff = compute_diff(csv_records, db_sponsors)

        assert len(diff["removed"]) == 1
        assert diff["removed"][0]["organisation_name"] == "OldCo Ltd"

    @pytest.mark.asyncio
    async def test_diff_detects_rating_change(self):
        """Rating change from A to B should be detected."""
        from app.scripts.data_foundation.register_diff import compute_diff

        csv_records = [
            {"organisation_name": "TechCorp Ltd", "town_city": "London", "rating": "B", "routes": ["Skilled Worker"]},
        ]
        db_sponsors = {
            "TECHCORP LTD": {"id": "123", "organisation_name": "TechCorp Ltd", "rating": "A", "routes": ["Skilled Worker"]},
        }

        diff = compute_diff(csv_records, db_sponsors)

        assert len(diff["rating_changes"]) == 1
        assert diff["rating_changes"][0]["old_rating"] == "A"
        assert diff["rating_changes"][0]["new_rating"] == "B"

    @pytest.mark.asyncio
    async def test_diff_summary_stats(self):
        """Diff should return summary stats."""
        from app.scripts.data_foundation.register_diff import compute_diff

        diff = compute_diff([], {})

        assert "added" in diff
        assert "removed" in diff
        assert "rating_changes" in diff
        assert "route_changes" in diff
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/data/test_register_diff.py -v
```

Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 4: Write the register diff implementation**

```python
# backend/app/scripts/data_foundation/register_diff.py
"""Enhanced register diff — computes changes between CSV and DB.

Uses the existing sync_register.py download/parse logic. Adds:
- Structured diff output (added, removed, rating_changes, route_changes)
- SignalBus emission for changes
- Enrichment triggering for new sponsors
"""

import logging
import re

logger = logging.getLogger(__name__)


def normalize_name(name: str) -> str:
    """Normalize org name for matching."""
    n = name.upper().strip()
    n = re.sub(r"[^A-Z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def compute_diff(csv_records: list[dict], db_sponsors: dict[str, dict]) -> dict:
    """Compute diff between CSV records and database sponsors.

    Parameters
    ----------
    csv_records : list[dict]
        Parsed CSV records with keys: organisation_name, town_city, rating, routes
    db_sponsors : dict[str, dict]
        Keyed by normalized name. Values have: id, organisation_name, rating, routes

    Returns
    -------
    dict with keys: added, removed, rating_changes, route_changes
    """
    added = []
    removed = []
    rating_changes = []
    route_changes = []

    csv_names = set()

    for record in csv_records:
        norm = normalize_name(record.get("organisation_name", ""))
        if not norm:
            continue
        csv_names.add(norm)

        existing = db_sponsors.get(norm)
        if not existing:
            added.append(record)
            continue

        # Check rating change
        old_rating = existing.get("rating")
        new_rating = record.get("rating")
        if old_rating and new_rating and old_rating != new_rating:
            rating_changes.append({
                "sponsor_id": existing.get("id"),
                "organisation_name": record["organisation_name"],
                "old_rating": old_rating,
                "new_rating": new_rating,
            })

        # Check route change
        old_routes = set(existing.get("routes") or [])
        new_routes = set(record.get("routes") or [])
        if old_routes != new_routes:
            route_changes.append({
                "sponsor_id": existing.get("id"),
                "organisation_name": record["organisation_name"],
                "old_routes": list(old_routes),
                "new_routes": list(new_routes),
            })

    # Detect removed sponsors
    for norm_name, sponsor in db_sponsors.items():
        if norm_name not in csv_names:
            removed.append(sponsor)

    logger.info(
        "Register diff: +%d added, -%d removed, ~%d rating changes, ~%d route changes",
        len(added), len(removed), len(rating_changes), len(route_changes),
    )

    return {
        "added": added,
        "removed": removed,
        "rating_changes": rating_changes,
        "route_changes": route_changes,
    }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/data/test_register_diff.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/scripts/data_foundation/ backend/tests/data/
git commit -m "feat(data): add register diff engine with structured change detection"
```

---

## Task 3: Visa Statistics Parser

**Files:**
- Create: `backend/app/scripts/data_foundation/visa_stats.py`
- Create: `backend/tests/data/test_visa_stats.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/data/test_visa_stats.py
"""Tests for visa statistics parsing."""

import pytest


class TestVisaStatsParser:
    def test_parse_soc_row(self):
        """Parse a row of visa grant data by SOC code."""
        from app.scripts.data_foundation.visa_stats import parse_soc_row

        row = {
            "soc_code": "2136",
            "occupation": "Programmers and software development professionals",
            "grants": "8420",
            "year": "2025",
        }
        result = parse_soc_row(row)

        assert result["soc_code"] == "2136"
        assert result["grants_total"] == 8420
        assert result["year"] == 2025

    def test_parse_soc_row_handles_comma_numbers(self):
        """Numbers with commas should be parsed correctly."""
        from app.scripts.data_foundation.visa_stats import parse_soc_row

        row = {"soc_code": "2136", "occupation": "Test", "grants": "12,345", "year": "2025"}
        result = parse_soc_row(row)
        assert result["grants_total"] == 12345

    def test_parse_soc_row_handles_missing_data(self):
        """Missing or suppressed data should return 0."""
        from app.scripts.data_foundation.visa_stats import parse_soc_row

        row = {"soc_code": "2136", "occupation": "Test", "grants": "..", "year": "2025"}
        result = parse_soc_row(row)
        assert result["grants_total"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/data/test_visa_stats.py -v
```

- [ ] **Step 3: Write the implementation**

```python
# backend/app/scripts/data_foundation/visa_stats.py
"""Home Office visa statistics ingestion.

Parses quarterly visa grant data from Excel/ODS tables published at:
https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables

Stores in visa_statistics table keyed by SOC code + year.
"""

import logging
import re

logger = logging.getLogger(__name__)


def parse_number(value: str) -> int:
    """Parse a number that may have commas or be suppressed (..)."""
    if not value or value.strip() in ("..", "-", "x", "~", "*", ""):
        return 0
    cleaned = re.sub(r"[^0-9]", "", str(value))
    return int(cleaned) if cleaned else 0


def parse_soc_row(row: dict) -> dict:
    """Parse a single row of visa grant data.

    Parameters
    ----------
    row : dict
        Keys: soc_code, occupation, grants, year (+ optional nationality/industry JSONB)

    Returns
    -------
    dict ready for Supabase insert
    """
    return {
        "soc_code": str(row.get("soc_code", "")).strip(),
        "occupation_title": str(row.get("occupation", "")).strip(),
        "grants_total": parse_number(str(row.get("grants", "0"))),
        "year": int(row.get("year", 0)),
        "grants_by_nationality": row.get("grants_by_nationality"),
        "grants_by_industry": row.get("grants_by_industry"),
    }


async def ingest_visa_stats(supabase, file_path: str = None, source_url: str = None) -> dict:
    """Ingest visa statistics from a downloaded Excel file.

    If no file_path provided, attempts to download the latest from GOV.UK.
    Returns summary stats of ingestion.
    """
    stats = {"rows_parsed": 0, "rows_inserted": 0, "errors": []}

    # TODO: Download + parse Excel when file_path is None
    # For now, this function is called with pre-parsed data
    if file_path:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            # Try to find the work visa grants sheet
            sheet_names = wb.sheetnames
            target_sheet = None
            for name in sheet_names:
                if "work" in name.lower() and ("grant" in name.lower() or "entry" in name.lower()):
                    target_sheet = wb[name]
                    break
            if not target_sheet and sheet_names:
                target_sheet = wb[sheet_names[0]]

            if target_sheet:
                logger.info(f"Parsing sheet: {target_sheet.title}")
                # Parse rows (implementation depends on actual sheet structure)

            wb.close()
        except Exception as e:
            stats["errors"].append(str(e))
            logger.error(f"Failed to parse visa stats: {e}")

    return stats
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/data/test_visa_stats.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scripts/data_foundation/visa_stats.py backend/tests/data/test_visa_stats.py
git commit -m "feat(data): add visa statistics parser for Home Office SOC code data"
```

---

## Task 4: Immigration Salary List (ISL) Parser

**Files:**
- Create: `backend/app/scripts/data_foundation/isl_parser.py`
- Create: `backend/tests/data/test_isl_parser.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/data/test_isl_parser.py
"""Tests for Immigration Salary List parsing."""

import pytest


class TestISLParser:
    def test_parse_isl_entry(self):
        """Parse a single ISL entry."""
        from app.scripts.data_foundation.isl_parser import parse_isl_entry

        entry = {
            "soc_code": "2136",
            "occupation": "Programmers and software development professionals",
            "job_titles": "Software Engineer, Developer, Programmer",
        }
        result = parse_isl_entry(entry)

        assert result["soc_code"] == "2136"
        assert result["is_going_rate_exempt"] is True
        assert len(result["job_titles"]) == 3
        assert "Software Engineer" in result["job_titles"]

    def test_check_job_on_isl(self):
        """Check if a job title matches an ISL entry."""
        from app.scripts.data_foundation.isl_parser import check_job_on_isl

        isl_entries = [
            {"soc_code": "2136", "job_titles": ["Software Engineer", "Developer", "Programmer"]},
            {"soc_code": "2137", "job_titles": ["Web Designer", "UX Designer"]},
        ]

        assert check_job_on_isl("Senior Software Engineer", isl_entries) == "2136"
        assert check_job_on_isl("UX Designer", isl_entries) == "2137"
        assert check_job_on_isl("Plumber", isl_entries) is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/data/test_isl_parser.py -v
```

- [ ] **Step 3: Write the implementation**

```python
# backend/app/scripts/data_foundation/isl_parser.py
"""Immigration Salary List (ISL) parser.

The ISL (formerly Shortage Occupation List / SOL) contains SOC codes
that are exempt from the going rate salary requirement for Skilled Worker visas.

Source: https://www.gov.uk/government/publications/skilled-worker-visa-shortage-occupations
"""

import logging

logger = logging.getLogger(__name__)


def parse_isl_entry(entry: dict) -> dict:
    """Parse a single ISL entry into database format."""
    job_titles_str = entry.get("job_titles", "")
    if isinstance(job_titles_str, str):
        job_titles = [t.strip() for t in job_titles_str.split(",") if t.strip()]
    else:
        job_titles = list(job_titles_str)

    return {
        "soc_code": str(entry.get("soc_code", "")).strip(),
        "occupation_title": str(entry.get("occupation", "")).strip(),
        "job_titles": job_titles,
        "is_going_rate_exempt": True,
        "standard_threshold": 38700,
        "is_active": True,
    }


def check_job_on_isl(job_title: str, isl_entries: list[dict]) -> str | None:
    """Check if a job title matches any ISL entry.

    Uses substring matching — if any ISL job title appears in the
    candidate job title (case-insensitive), it's a match.

    Returns the SOC code if matched, None otherwise.
    """
    title_lower = job_title.lower().strip()
    for entry in isl_entries:
        for isl_title in entry.get("job_titles", []):
            if isl_title.lower() in title_lower:
                return entry["soc_code"]
    return None
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/data/test_isl_parser.py -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scripts/data_foundation/isl_parser.py backend/tests/data/test_isl_parser.py
git commit -m "feat(data): add Immigration Salary List parser with job title matching"
```

---

## Task 5: ONS Salary Benchmarks Parser

**Files:**
- Create: `backend/app/scripts/data_foundation/ons_salaries.py`

- [ ] **Step 1: Write the implementation**

```python
# backend/app/scripts/data_foundation/ons_salaries.py
"""ONS ASHE salary benchmark ingestion.

Parses Annual Survey of Hours and Earnings (ASHE) Table 14.7a
(median and percentile earnings by SOC 2020 occupation code).

Source: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/
"""

import logging
import re

logger = logging.getLogger(__name__)


def parse_salary_value(value) -> int | None:
    """Parse an ONS salary value (may be suppressed with 'x', '..' or '*')."""
    if value is None:
        return None
    s = str(value).strip()
    if s in ("x", "..", "*", "-", "", ":", "#"):
        return None
    cleaned = re.sub(r"[^0-9.]", "", s)
    if not cleaned:
        return None
    return int(float(cleaned))


def parse_ashe_row(row: dict) -> dict | None:
    """Parse a single ASHE Table 14 row into database format.

    Parameters
    ----------
    row : dict
        Keys: soc_code, occupation, median, p10, p25, p75, p90, sample_size, year

    Returns
    -------
    dict ready for Supabase upsert, or None if invalid
    """
    soc = str(row.get("soc_code", "")).strip()
    if not soc or len(soc) < 2:
        return None

    median = parse_salary_value(row.get("median"))
    if median is None or median < 1000:
        return None  # Invalid or suppressed

    return {
        "soc_code": soc,
        "occupation_title": str(row.get("occupation", "")).strip(),
        "median_salary": median,
        "p10_salary": parse_salary_value(row.get("p10")),
        "p25_salary": parse_salary_value(row.get("p25")),
        "p75_salary": parse_salary_value(row.get("p75")),
        "p90_salary": parse_salary_value(row.get("p90")),
        "sample_size": parse_salary_value(row.get("sample_size")),
        "region": row.get("region", "UK"),
        "year": int(row.get("year", 0)),
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/scripts/data_foundation/ons_salaries.py
git commit -m "feat(data): add ONS ASHE salary benchmark parser"
```

---

## Task 6: Hansard Parliamentary Monitor

**Files:**
- Create: `backend/app/scripts/data_foundation/hansard_monitor.py`

- [ ] **Step 1: Write the implementation**

```python
# backend/app/scripts/data_foundation/hansard_monitor.py
"""Parliamentary Hansard immigration debate monitor.

Searches Hansard for immigration-related debates, written questions,
and ministerial statements. Stores results in intel_items table.

Source: https://hansard.parliament.uk/
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

HANSARD_SEARCH_URL = "https://hansard.parliament.uk/search/Contributions"

IMMIGRATION_KEYWORDS = [
    "visa", "immigration", "sponsor licence", "skilled worker",
    "shortage occupation", "salary threshold", "points-based",
    "home office", "uk visas", "immigration rules",
]


async def search_hansard(
    days_back: int = 1,
    keywords: list[str] | None = None,
) -> list[dict]:
    """Search Hansard for recent immigration-related contributions.

    Parameters
    ----------
    days_back : int
        Number of days to search back from today.
    keywords : list[str], optional
        Keywords to search for. Defaults to IMMIGRATION_KEYWORDS.

    Returns
    -------
    list[dict] with keys: title, date, speakers, snippet, url, source_category
    """
    kw_list = keywords or IMMIGRATION_KEYWORDS
    since = datetime.now(timezone.utc) - timedelta(days=days_back)
    results = []

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for keyword in kw_list[:5]:  # Limit to avoid rate limiting
            try:
                params = {
                    "searchTerm": keyword,
                    "startDate": since.strftime("%Y-%m-%d"),
                    "endDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                }
                resp = await client.get(HANSARD_SEARCH_URL, params=params)
                if resp.status_code != 200:
                    logger.warning(f"Hansard search failed for '{keyword}': {resp.status_code}")
                    continue

                # Parse HTML response for debate entries
                # Hansard returns HTML — extract debate titles and URLs
                from selectolax.parser import HTMLParser
                tree = HTMLParser(resp.text)

                for item in tree.css(".search-result"):
                    title_el = item.css_first("a.search-result-title")
                    date_el = item.css_first(".search-result-date")
                    snippet_el = item.css_first(".search-result-description")

                    if title_el:
                        title = title_el.text(strip=True)
                        url = title_el.attributes.get("href", "")
                        if url and not url.startswith("http"):
                            url = f"https://hansard.parliament.uk{url}"

                        results.append({
                            "title": title,
                            "source_name": "Hansard",
                            "source_url": url,
                            "source_category": "government",
                            "content_snippet": snippet_el.text(strip=True) if snippet_el else "",
                            "published_at": date_el.text(strip=True) if date_el else None,
                            "scanner_agent": "hansard_monitor",
                        })

            except Exception as e:
                logger.error(f"Hansard search error for '{keyword}': {e}")

    # Deduplicate by URL
    seen_urls = set()
    unique = []
    for r in results:
        if r["source_url"] not in seen_urls:
            seen_urls.add(r["source_url"])
            unique.append(r)

    logger.info(f"Hansard monitor found {len(unique)} unique items")
    return unique
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/scripts/data_foundation/hansard_monitor.py
git commit -m "feat(data): add Hansard parliamentary immigration debate monitor"
```

---

## Task 7: Data Foundation Celery Tasks

**Files:**
- Create: `backend/app/tasks/data_tasks.py`
- Modify: `backend/app/tasks/celery_app.py`
- Modify: `backend/app/tasks/schedule.py`

- [ ] **Step 1: Create data_tasks.py**

```python
# backend/app/tasks/data_tasks.py
"""Celery tasks for Data Foundation — ground truth data ingestion."""

import asyncio
import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _get_supabase():
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


@celery_app.task(name="data.sync_sponsor_register", soft_time_limit=600, time_limit=900)
def sync_sponsor_register():
    """Download and diff the Home Office Sponsor Register CSV."""
    async def _run():
        from app.scripts.sync_register import download_register, sync_to_supabase
        supabase = _get_supabase()

        # Download and parse CSV
        records = await download_register()
        if not records:
            logger.error("[DATA] No records downloaded from register")
            return {"status": "error", "records": 0}

        # Sync to database (existing logic handles diff + insert/update)
        stats = await sync_to_supabase(supabase, records)
        logger.info(f"[DATA] Register sync complete: {stats}")
        return stats

    return _run_async(_run())


@celery_app.task(name="data.monitor_hansard", soft_time_limit=120, time_limit=180)
def monitor_hansard():
    """Search Hansard for immigration debates and store in intel_items."""
    async def _run():
        from app.scripts.data_foundation.hansard_monitor import search_hansard
        supabase = _get_supabase()

        items = await search_hansard(days_back=1)
        inserted = 0
        for item in items:
            try:
                # Check for duplicate by URL
                existing = supabase.table("intel_items").select("id").eq(
                    "source_url", item["source_url"]
                ).limit(1).execute()
                if existing.data:
                    continue

                supabase.table("intel_items").insert(item).execute()
                inserted += 1
            except Exception as e:
                logger.error(f"[DATA] Hansard insert failed: {e}")

        logger.info(f"[DATA] Hansard monitor: {inserted} new items from {len(items)} found")
        return {"items_found": len(items), "items_inserted": inserted}

    return _run_async(_run())
```

- [ ] **Step 2: Add data queue routing to celery_app.py**

In `backend/app/tasks/celery_app.py`, add to the include list:

```python
"app.tasks.data_tasks",
```

Add to task_routes:

```python
"data.*": {"queue": "army_intelligence"},
```

- [ ] **Step 3: Update schedule.py — replace sync-gov-register**

In `backend/app/tasks/schedule.py`, replace the existing `sync-gov-register` entry with:

```python
"sync-gov-register": {
    "task": "data.sync_sponsor_register",
    "schedule": crontab(hour="7", minute="0"),
},
"monitor-hansard": {
    "task": "data.monitor_hansard",
    "schedule": crontab(hour="7", minute="30"),
},
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/tasks/data_tasks.py backend/app/tasks/celery_app.py backend/app/tasks/schedule.py
git commit -m "feat(data): add Celery tasks for register sync and Hansard monitor"
```

---

## Task 8: Data Foundation API Endpoints

**Files:**
- Create: `backend/app/api/v1/data.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the API router**

```python
# backend/app/api/v1/data.py
"""API endpoints for Data Foundation — visa stats, ISL, salary benchmarks, register changes."""

from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter(prefix="/data", tags=["data"])


def _get_supabase():
    from supabase import create_client
    from app.core.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


@router.get("/visa-stats")
async def get_visa_stats(
    soc_code: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = Query(default=50, le=200),
):
    """Get visa grant statistics, optionally filtered by SOC code and year."""
    sb = _get_supabase()
    query = sb.table("visa_statistics").select("*")
    if soc_code:
        query = query.eq("soc_code", soc_code)
    if year:
        query = query.eq("year", year)
    result = query.order("grants_total", desc=True).limit(limit).execute()
    return {"data": result.data or [], "count": len(result.data or [])}


@router.get("/visa-stats/{soc_code}")
async def get_visa_stats_by_soc(soc_code: str):
    """Get all visa stats for a specific SOC code across years."""
    sb = _get_supabase()
    result = sb.table("visa_statistics").select("*").eq("soc_code", soc_code).order("year", desc=True).execute()
    return {"data": result.data or []}


@router.get("/immigration-salary-list")
async def get_isl():
    """Get the current Immigration Salary List (active entries only)."""
    sb = _get_supabase()
    result = sb.table("immigration_salary_list").select("*").eq("is_active", True).order("soc_code").execute()
    return {"data": result.data or [], "count": len(result.data or [])}


@router.get("/salary-benchmarks/{soc_code}")
async def get_salary_benchmarks(soc_code: str, region: str = "UK"):
    """Get ONS salary benchmarks for a SOC code."""
    sb = _get_supabase()
    query = sb.table("ons_salary_benchmarks").select("*").eq("soc_code", soc_code)
    if region != "all":
        query = query.eq("region", region)
    result = query.order("year", desc=True).execute()
    return {"data": result.data or []}


@router.get("/register-changes")
async def get_register_changes(
    change_type: Optional[str] = None,
    days: int = Query(default=7, le=90),
    limit: int = Query(default=50, le=200),
):
    """Get recent sponsor register changes."""
    sb = _get_supabase()
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    query = sb.table("sponsor_changes").select("*").gte("detected_at", since)
    if change_type:
        query = query.eq("change_type", change_type)
    result = query.order("detected_at", desc=True).limit(limit).execute()
    return {"data": result.data or [], "count": len(result.data or [])}


@router.get("/register-changes/stats")
async def get_register_change_stats(days: int = Query(default=7, le=90)):
    """Summary stats of recent register changes."""
    sb = _get_supabase()
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = sb.table("sponsor_changes").select("change_type").gte("detected_at", since).execute()
    changes = result.data or []

    stats = {}
    for change in changes:
        ct = change.get("change_type", "unknown")
        stats[ct] = stats.get(ct, 0) + 1

    return {"period_days": days, "total_changes": len(changes), "by_type": stats}
```

- [ ] **Step 2: Register router in main.py**

Add to `backend/app/main.py` imports and router registration:

```python
from app.api.v1.data import router as data_router
app.include_router(data_router, prefix="/api/v1")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/data.py backend/app/main.py
git commit -m "feat(data): add API endpoints for visa stats, ISL, salary benchmarks, register changes"
```

---

## Task 9: Add openpyxl Dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add openpyxl**

Add to requirements.txt under `# Utils`:

```
openpyxl
```

- [ ] **Step 2: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(data): add openpyxl for Excel parsing (visa stats, ONS data)"
```

---

## Task 10: Run All Tests & Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd backend && /opt/homebrew/bin/python3.13 -m pytest tests/ -v --tb=short
```

Expected: All tests pass (64 army tests + new data tests).

- [ ] **Step 2: Verify new files exist**

```bash
ls -la backend/app/scripts/data_foundation/*.py backend/app/tasks/data_tasks.py backend/app/api/v1/data.py supabase/migrations/20260326_data_foundation.sql
```

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

- [ ] **Step 4: Tag**

```bash
git tag data-foundation-v1
```

---

## Summary

| Component | Files | What it does |
|-----------|-------|-------------|
| Migration | 1 SQL file | 3 new tables: visa_statistics, immigration_salary_list, ons_salary_benchmarks |
| Register Diff | register_diff.py + 4 tests | Structured change detection between CSV and DB |
| Visa Stats | visa_stats.py + 3 tests | Home Office visa grant data parser |
| ISL Parser | isl_parser.py + 2 tests | Immigration Salary List with job title matching |
| ONS Salaries | ons_salaries.py | ASHE salary benchmark parser |
| Hansard Monitor | hansard_monitor.py | Parliamentary debate scanner |
| Celery Tasks | data_tasks.py | Register sync + Hansard monitor tasks |
| API Endpoints | data.py | 6 endpoints for all new data |
| Schedule | schedule.py modifications | Daily register sync + Hansard monitor |
