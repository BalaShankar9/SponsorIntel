-- supabase/migrations/20260323000004_intel_lawyers.sql

CREATE TABLE intel_lawyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(300) NOT NULL,
    firm_name VARCHAR(500),
    registration_type VARCHAR(20) NOT NULL CHECK (registration_type IN ('oisc', 'sra')),
    registration_number VARCHAR(50) NOT NULL,
    oisc_level INTEGER CHECK (oisc_level IN (1, 2, 3)),
    practising_status VARCHAR(30) NOT NULL DEFAULT 'active',
    accreditations TEXT[],
    practice_areas TEXT[] NOT NULL,
    languages TEXT[],
    fee_initial_consultation VARCHAR(100),
    fee_hourly_range VARCHAR(100),
    fee_fixed_range VARCHAR(200),
    offers_legal_aid BOOLEAN DEFAULT FALSE,
    address TEXT,
    city VARCHAR(200),
    postcode VARCHAR(20),
    latitude FLOAT,
    longitude FLOAT,
    offers_remote BOOLEAN DEFAULT TRUE,
    google_rating FLOAT,
    google_review_count INTEGER DEFAULT 0,
    trustpilot_rating FLOAT,
    trustpilot_review_count INTEGER DEFAULT 0,
    combined_rating FLOAT,
    website VARCHAR(500),
    email VARCHAR(300),
    phone VARCHAR(50),
    bio TEXT,
    profile_photo_url VARCHAR(1000),
    disciplinary_history JSONB DEFAULT '[]',
    last_verified_at TIMESTAMPTZ,
    source_url VARCHAR(2000),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_intel_lawyers_status ON intel_lawyers (is_active, practising_status);
CREATE INDEX idx_intel_lawyers_areas ON intel_lawyers USING gin (practice_areas);
CREATE INDEX idx_intel_lawyers_city ON intel_lawyers (city);
CREATE INDEX idx_intel_lawyers_rating ON intel_lawyers (combined_rating DESC NULLS LAST);
CREATE INDEX idx_intel_lawyers_type ON intel_lawyers (registration_type, oisc_level);
CREATE INDEX idx_intel_lawyers_geo ON intel_lawyers (latitude, longitude) WHERE latitude IS NOT NULL;

CREATE TABLE intel_lawyer_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id UUID NOT NULL REFERENCES intel_lawyers(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL CHECK (source IN ('google', 'trustpilot', 'user')),
    author_name VARCHAR(200),
    rating FLOAT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMPTZ,
    visa_route_mentioned VARCHAR(100),
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lawyer_reviews_lawyer ON intel_lawyer_reviews (lawyer_id, source, review_date DESC);
CREATE INDEX idx_lawyer_reviews_route ON intel_lawyer_reviews (visa_route_mentioned) WHERE visa_route_mentioned IS NOT NULL;

CREATE TABLE intel_lawyer_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    visa_route VARCHAR(100),
    nationality VARCHAR(100),
    location VARCHAR(200),
    case_complexity VARCHAR(30),
    budget_range VARCHAR(100),
    language_pref VARCHAR(100),
    results_returned INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lawyer_searches_user ON intel_lawyer_searches (user_id, created_at DESC);

-- RLS
ALTER TABLE intel_lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lawyers" ON intel_lawyers FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Service role manages lawyers" ON intel_lawyers FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE intel_lawyer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lawyer reviews" ON intel_lawyer_reviews FOR SELECT USING (true);
CREATE POLICY "Service role manages lawyer reviews" ON intel_lawyer_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE intel_lawyer_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own searches" ON intel_lawyer_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages searches" ON intel_lawyer_searches FOR ALL TO service_role USING (true) WITH CHECK (true);
