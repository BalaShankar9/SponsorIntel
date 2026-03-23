-- supabase/migrations/20260323000002_saved_searches.sql
-- Saved search filters with new-result detection

CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    filters JSONB NOT NULL,
    result_count_at_save INTEGER,
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_saved_searches_user
    ON saved_searches (user_id, created_at DESC);

-- RLS: users can only manage their own searches
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own searches"
    ON saved_searches FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages searches"
    ON saved_searches FOR ALL
    USING (true);

COMMENT ON TABLE saved_searches IS 'User-pinned search filter sets with new-result detection via result_count_at_save delta.';
