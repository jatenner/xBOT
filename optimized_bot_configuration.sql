-- ===== OPTIMIZED BOT CONFIGURATION =====
-- Based on database analysis - focus on performance

-- 1. UPDATE BOT CONFIG FOR PERFORMANCE
UPDATE bot_config SET config_value = '{"hours": [9, 15, 21]}' 
WHERE config_key = 'posting_schedule';

INSERT INTO bot_config (config_key, config_value, description) VALUES
('enable_ai_caching', 'true', 'Cache AI responses for performance'),
('max_learning_records', '1000', 'Limit learning data for memory efficiency'),
('viral_prediction_enabled', 'true', 'Use viral prediction system'),
('thread_optimization', 'true', 'Optimize thread posting'),
('engagement_tracking', 'true', 'Track all engagement metrics')
ON CONFLICT (config_key) DO UPDATE SET 
config_value = EXCLUDED.config_value,
updated_at = NOW();

-- 2. OPTIMIZE EXISTING VIRAL SYSTEMS
-- Clean old viral data to improve performance
DELETE FROM viral_growth_metrics WHERE recorded_at < NOW() - INTERVAL '30 days';
DELETE FROM content_performance_predictions WHERE created_at < NOW() - INTERVAL '7 days';

-- 3. INDEX OPTIMIZATION FOR SPEED
CREATE INDEX IF NOT EXISTS idx_viral_content_performance ON viral_growth_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_predictions_recent ON content_performance_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follower_growth_tracking ON follower_growth_tracking(date DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_optimization ON engagement_optimization_insights(created_at DESC);

-- 4. ENABLE ENTERPRISE FEATURES
INSERT INTO bot_config (config_key, config_value, description) VALUES
('enterprise_mode', 'true', 'Enable all enterprise features'),
('redis_caching_ttl', '3600', 'Redis cache timeout in seconds'),
('ai_model_optimization', 'true', 'Use optimized AI models'),
('advanced_analytics', 'true', 'Enable advanced analytics'),
('real_time_learning', 'true', 'Enable real-time learning from engagement')
ON CONFLICT (config_key) DO UPDATE SET 
config_value = EXCLUDED.config_value;

-- 5. CLEAN UP OLD DATA FOR PERFORMANCE
DELETE FROM ai_call_logs WHERE created_at < NOW() - INTERVAL '7 days';
DELETE FROM content_generation_log WHERE created_at < NOW() - INTERVAL '3 days';
DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '1 day';

-- Verify configuration
SELECT config_key, config_value, description 
FROM bot_config 
WHERE config_key IN ('enterprise_mode', 'posting_schedule', 'viral_prediction_enabled')
ORDER BY config_key;