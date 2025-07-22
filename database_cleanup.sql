
-- Remove duplicate and unnecessary tables
DROP TABLE IF EXISTS twitter_rate_limits;
DROP TABLE IF EXISTS real_twitter_rate_limits; 
DROP TABLE IF EXISTS monthly_api_usage;
DROP TABLE IF EXISTS api_usage;
DROP TABLE IF EXISTS budget_transactions;
DROP TABLE IF EXISTS daily_budget_accounting;
DROP TABLE IF EXISTS content_quality_cache;
DROP TABLE IF EXISTS intelligence_cache;
DROP TABLE IF EXISTS follower_growth_patterns;
DROP TABLE IF EXISTS competitive_intelligence;
DROP TABLE IF EXISTS learning_patterns;
DROP TABLE IF EXISTS content_embeddings;
DROP TABLE IF EXISTS viral_content_patterns;
DROP TABLE IF EXISTS engagement_optimization;

-- Keep only essential tables:
-- tweets (core)
-- tweet_performance (analytics)  
-- bot_config (settings)
-- system_logs (debugging)
