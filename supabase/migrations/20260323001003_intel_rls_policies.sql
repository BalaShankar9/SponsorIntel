-- supabase/migrations/20260323001003_intel_rls_policies.sql

-- intel_items: public read (classified/analyzed only), service role write
ALTER TABLE intel_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read analyzed items" ON intel_items FOR SELECT
    USING (status IN ('classified', 'analyzed'));
CREATE POLICY "Service role manages items" ON intel_items FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_policies: public read, service role write
ALTER TABLE intel_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read policies" ON intel_policies FOR SELECT USING (true);
CREATE POLICY "Service role manages policies" ON intel_policies FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_policy_follows: user-scoped
ALTER TABLE intel_policy_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON intel_policy_follows FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- intel_subscriptions: user-scoped
ALTER TABLE intel_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON intel_subscriptions FOR ALL
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- intel_notifications: user reads, service role writes
ALTER TABLE intel_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON intel_notifications FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON intel_notifications FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts notifications" ON intel_notifications FOR INSERT
    TO service_role WITH CHECK (true);

-- intel_calendar: public read, service role write
ALTER TABLE intel_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read calendar" ON intel_calendar FOR SELECT USING (true);
CREATE POLICY "Service role manages calendar" ON intel_calendar FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_statistics: public read, service role write
ALTER TABLE intel_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read statistics" ON intel_statistics FOR SELECT USING (true);
CREATE POLICY "Service role manages statistics" ON intel_statistics FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_source_health_log: service role only
ALTER TABLE intel_source_health_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages health log" ON intel_source_health_log FOR ALL
    TO service_role USING (true) WITH CHECK (true);

-- intel_quality_samples: service role only
ALTER TABLE intel_quality_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages quality samples" ON intel_quality_samples FOR ALL
    TO service_role USING (true) WITH CHECK (true);
