-- Data Foundation: visa statistics, ISL, ONS salary benchmarks
-- Part of Sub-Project 1: Ground Truth Layer

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

ALTER TABLE visa_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read visa stats" ON visa_statistics FOR SELECT USING (true);
CREATE POLICY "Service role manages visa stats" ON visa_statistics FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- 2. Immigration Salary List (ISL) — replaces old SOL
-- ISL roles are exempt from going rate requirement
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
