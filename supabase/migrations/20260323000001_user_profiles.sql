-- supabase/migrations/20260323000001_user_profiles.sql
-- User profile for dashboard personalization (visa route, target industries, locations)

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    visa_route VARCHAR(100),
    target_industries TEXT[],
    target_locations TEXT[],
    current_status VARCHAR(100) CHECK (
        current_status IN (
            'outside_uk',
            'uk_different_visa',
            'uk_graduate',
            'uk_sponsored',
            'uk_citizen_pr',
            'other'
        )
    ),
    nationality VARCHAR(100),
    setup_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only manage their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
    ON user_profiles FOR ALL
    USING (auth.uid() = user_id);

-- Allow service role full access (for backend writes)
CREATE POLICY "Service role manages profiles"
    ON user_profiles FOR ALL
    USING (true);

COMMENT ON TABLE user_profiles IS 'User preferences for personalized dashboard, intel relevance scoring, and route-specific data.';
