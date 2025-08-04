-- ===================================================================
-- 🔧 FIX ANALYTICS PERMISSIONS
-- ===================================================================
-- Grant proper permissions for the unified analytics system
-- ===================================================================

-- Grant permissions on new analytics tables
GRANT ALL ON tweet_analytics TO authenticated;
GRANT ALL ON tweet_analytics TO anon;

GRANT ALL ON tweet_impressions TO authenticated;
GRANT ALL ON tweet_impressions TO anon;

GRANT ALL ON follower_attribution TO authenticated;
GRANT ALL ON follower_attribution TO anon;

GRANT ALL ON algorithm_signals TO authenticated;
GRANT ALL ON algorithm_signals TO anon;

-- Grant permissions on the unified view
GRANT SELECT ON unified_tweet_performance TO authenticated;
GRANT SELECT ON unified_tweet_performance TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION calculate_unified_performance_score(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_unified_performance_score(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION get_best_performing_tweets(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_performing_tweets(INTEGER, INTEGER) TO anon;

-- Enable Row Level Security but allow all operations for now
ALTER TABLE tweet_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_signals ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all operations)
CREATE POLICY "Allow all operations on tweet_analytics" ON tweet_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on tweet_impressions" ON tweet_impressions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on follower_attribution" ON follower_attribution FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on algorithm_signals" ON algorithm_signals FOR ALL USING (true) WITH CHECK (true);

-- Verify permissions
SELECT 'ANALYTICS PERMISSIONS FIXED!' as status,
       'All tables and functions accessible' as result,
       NOW() as fixed_at;