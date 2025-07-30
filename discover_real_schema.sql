-- 🔍 DISCOVER REAL SCHEMA
-- Find out what columns actually exist in the learning tables

-- First, let's see the actual structure of contextual_bandit_arms
SELECT 
    'contextual_bandit_arms table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'contextual_bandit_arms'
ORDER BY ordinal_position;

-- Then enhanced_timing_stats
SELECT 
    'enhanced_timing_stats table structure:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'enhanced_timing_stats'
ORDER BY ordinal_position;

-- Check all the learning tables we found
SELECT 
    'All learning tables summary:' as info,
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN (
    'learning_posts',
    'contextual_bandit_arms', 
    'contextual_bandit_history',
    'enhanced_timing_stats',
    'engagement_metrics',
    'budget_optimization_log',
    'content_generation_sessions',
    'viral_tweets_learned',
    'influencer_tweets',
    'engagement_feedback_tracking',
    'format_stats',
    'tweet_performance_analysis',
    'ai_learning_insights'
  )
GROUP BY table_name
ORDER BY table_name; 