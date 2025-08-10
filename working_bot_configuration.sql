-- ===== WORKING BOT CONFIGURATION =====
-- Fixed for your actual database structure

-- 1. UPDATE BOT CONFIG FOR PERFORMANCE
UPDATE bot_config SET config_value = '{"hours": [9, 15, 21]}' 
WHERE config_key = 'posting_schedule';

-- 2. ADD ENTERPRISE FEATURES (using proper conflict handling)
INSERT INTO bot_config (config_key, config_value, description) VALUES
('enable_ai_caching', 'true', 'Cache AI responses for performance'),
('max_learning_records', '1000', 'Limit learning data for memory efficiency'),
('viral_prediction_enabled', 'true', 'Use viral prediction system'),
('thread_optimization', 'true', 'Optimize thread posting'),
('engagement_tracking', 'true', 'Track all engagement metrics'),
('enterprise_mode', 'true', 'Enable all enterprise features'),
('redis_caching_ttl', '3600', 'Redis cache timeout in seconds'),
('ai_model_optimization', 'true', 'Use optimized AI models'),
('advanced_analytics', 'true', 'Enable advanced analytics'),
('real_time_learning', 'true', 'Enable real-time learning from engagement')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- 3. SAFE DATA CLEANUP (only if tables exist and have the right columns)
-- Check what columns actually exist first by running this query:
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_name IN ('viral_growth_metrics', 'content_performance_predictions', 'ai_call_logs', 'content_generation_log', 'system_logs')
AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 4. CONDITIONAL CLEANUP (run these individually after checking columns above)
-- Only run if the table and column exist:

-- For viral_growth_metrics (check if it has created_at, recorded_at, or date column)
-- DELETE FROM viral_growth_metrics WHERE created_at < NOW() - INTERVAL '30 days';

-- For content_performance_predictions (check if it has created_at column)
-- DELETE FROM content_performance_predictions WHERE created_at < NOW() - INTERVAL '7 days';

-- For ai_call_logs (check if it has created_at column)  
-- DELETE FROM ai_call_logs WHERE created_at < NOW() - INTERVAL '7 days';

-- For content_generation_log (check if it has created_at column)
-- DELETE FROM content_generation_log WHERE created_at < NOW() - INTERVAL '3 days';

-- For system_logs (check if it has created_at column)
-- DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '1 day';

-- 5. SAFE INDEX CREATION (only if tables exist)
-- Run these individually and ignore errors if table doesn't exist:

-- CREATE INDEX IF NOT EXISTS idx_viral_growth_performance ON viral_growth_metrics(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_content_predictions_recent ON content_performance_predictions(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_follower_growth_tracking ON follower_growth_tracking(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_engagement_optimization ON engagement_optimization_insights(created_at DESC);

-- 6. VERIFY CONFIGURATION
SELECT config_key, config_value, description, updated_at
FROM bot_config 
WHERE config_key IN (
    'enterprise_mode', 
    'posting_schedule', 
    'viral_prediction_enabled',
    'enable_ai_caching',
    'thread_optimization'
)
ORDER BY config_key;

-- 7. CHECK CURRENT DATABASE STATUS
SELECT 
    'Database ready for enterprise mode' as status,
    COUNT(*) as total_config_items
FROM bot_config;