-- supabase/migrations/20260323000004_gamification_tables.sql
-- Gamification: activity points, achievements, streaks

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_user_activity_user ON user_activity (user_id, created_at DESC);
CREATE INDEX idx_user_activity_daily ON user_activity (user_id, (created_at::date));

CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_key VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS user_streaks (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_check_in DATE,
    total_points INTEGER DEFAULT 0
);

-- RLS Policies
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own activity" ON user_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages activity" ON user_activity FOR ALL USING (true);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read achievements" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Service role manages achievements" ON user_achievements FOR ALL USING (true);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own streaks" ON user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages streaks" ON user_streaks FOR ALL USING (true);
