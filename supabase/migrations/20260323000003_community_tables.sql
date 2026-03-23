-- supabase/migrations/20260323000003_community_tables.sql
-- Community layer: ratings, salary reports, success stories

-- 1. Community Ratings
CREATE TABLE IF NOT EXISTS community_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL CHECK (
        interaction_type IN ('applied', 'interviewed', 'sponsored', 'worked_here')
    ),
    rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
    rating_process INTEGER CHECK (rating_process BETWEEN 1 AND 5),
    rating_interview INTEGER CHECK (rating_interview BETWEEN 1 AND 5),
    rating_sponsorship INTEGER CHECK (rating_sponsorship BETWEEN 1 AND 5),
    rating_culture INTEGER CHECK (rating_culture BETWEEN 1 AND 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    UNIQUE (user_id, sponsor_id)
);

ALTER TABLE community_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved ratings" ON community_ratings FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users read own ratings" ON community_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own ratings" ON community_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ratings" ON community_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages ratings" ON community_ratings FOR ALL USING (true);

-- 2. Salary Reports
CREATE TABLE IF NOT EXISTS salary_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    role_title VARCHAR(300) NOT NULL,
    salary_annual INTEGER NOT NULL,
    visa_route VARCHAR(100),
    year INTEGER NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE salary_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read salary reports" ON salary_reports FOR SELECT USING (true);
CREATE POLICY "Users create own reports" ON salary_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages reports" ON salary_reports FOR ALL USING (true);

-- 3. Success Stories
CREATE TABLE IF NOT EXISTS success_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    story_text TEXT NOT NULL,
    visa_route VARCHAR(100),
    year INTEGER,
    is_anonymous BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved stories" ON success_stories FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users read own stories" ON success_stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own stories" ON success_stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages stories" ON success_stories FOR ALL USING (true);
