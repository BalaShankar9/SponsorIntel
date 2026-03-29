-- Sponsor Name Aliases
-- Maps registered company names (from Home Office register) to trading names,
-- previous names, and domains used on job boards.
--
-- This is critical because:
-- - "ALPHABET INC" trades as "Google"
-- - "META PLATFORMS IRELAND LIMITED" trades as "Facebook"/"Meta"
-- - Job boards use trading names, not registered names

CREATE TABLE IF NOT EXISTS sponsor_name_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    registered_name TEXT NOT NULL,
    trading_name TEXT,
    previous_names TEXT[],
    domain TEXT,
    ch_number TEXT,
    normalized_registered TEXT NOT NULL,
    normalized_trading TEXT,
    alias_source TEXT DEFAULT 'auto',  -- 'auto', 'manual', 'ch_api'
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sponsor_id)
);

-- Indexes for fast lookups during job matching
CREATE INDEX IF NOT EXISTS idx_aliases_normalized_reg ON sponsor_name_aliases(normalized_registered);
CREATE INDEX IF NOT EXISTS idx_aliases_normalized_trd ON sponsor_name_aliases(normalized_trading) WHERE normalized_trading IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aliases_domain ON sponsor_name_aliases(domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aliases_ch ON sponsor_name_aliases(ch_number) WHERE ch_number IS NOT NULL;

-- Enable RLS
ALTER TABLE sponsor_name_aliases ENABLE ROW LEVEL SECURITY;

-- Allow read access via anon key (for frontend queries)
CREATE POLICY "Allow public read on sponsor_name_aliases"
    ON sponsor_name_aliases FOR SELECT
    USING (true);

-- Allow service role full access (for backend writes)
CREATE POLICY "Allow service role full access on sponsor_name_aliases"
    ON sponsor_name_aliases FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE sponsor_name_aliases IS 'Maps sponsor registered names to trading names, domains, and previous names for job matching';
COMMENT ON COLUMN sponsor_name_aliases.registered_name IS 'Name as it appears in the Home Office sponsor register';
COMMENT ON COLUMN sponsor_name_aliases.trading_name IS 'Trading/brand name extracted from T/A patterns or manual mapping';
COMMENT ON COLUMN sponsor_name_aliases.previous_names IS 'Previous company names from Companies House history';
COMMENT ON COLUMN sponsor_name_aliases.domain IS 'Primary website domain (e.g. google.com) for career page matching';
COMMENT ON COLUMN sponsor_name_aliases.normalized_registered IS 'Normalized registered name for fuzzy matching';
COMMENT ON COLUMN sponsor_name_aliases.normalized_trading IS 'Normalized trading name for fuzzy matching';
