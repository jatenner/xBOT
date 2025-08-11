-- ===== OPTIONAL SECURITY SETUP FOR SUPABASE =====
-- Run this ONLY if you want to enable Row Level Security
-- This is separate from the main table creation to avoid syntax errors

-- Enable Row Level Security (RLS) for security
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can manage tweets" ON tweets;
DROP POLICY IF EXISTS "Service role can manage bot_config" ON bot_config;
DROP POLICY IF EXISTS "Service role can manage daily_budgets" ON daily_budgets;
DROP POLICY IF EXISTS "Service role can manage learning_posts" ON learning_posts;
DROP POLICY IF EXISTS "Service role can manage engagement_metrics" ON engagement_metrics;

-- Create policies for service role access
CREATE POLICY "Service role can manage tweets" ON tweets
    FOR ALL USING (true);

CREATE POLICY "Service role can manage bot_config" ON bot_config
    FOR ALL USING (true);

CREATE POLICY "Service role can manage daily_budgets" ON daily_budgets
    FOR ALL USING (true);

CREATE POLICY "Service role can manage learning_posts" ON learning_posts
    FOR ALL USING (true);

CREATE POLICY "Service role can manage engagement_metrics" ON engagement_metrics
    FOR ALL USING (true);

SELECT 'Security policies configured successfully!' AS status;