-- 🔧 FIXED SQL QUERIES FOR SUPABASE
-- ===================================
-- These queries are corrected to work with PostgreSQL/Supabase

-- ============================================================================
-- 1. SYSTEM STATUS CHECK (WORKS!)
-- ============================================================================

-- Check if Twitter Master System is enabled
SELECT 
    config_key,
    config_value as status,
    updated_at
FROM twitter_master_config 
WHERE config_key = 'system_enabled';

-- ============================================================================
-- 2. SYSTEM HEALTH OVERVIEW (WORKS!)
-- ============================================================================

-- Check all system components
SELECT 
    component_name,
    status,
    readiness_score,
    last_check
FROM system_health_status 
ORDER BY readiness_score DESC;

-- ============================================================================
-- 3. RECENT AI DECISIONS (WORKS!)
-- ============================================================================

-- Show recent AI decisions
SELECT 
    decision_type,
    confidence_score,
    reasoning,
    created_at
FROM twitter_master_decisions 
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. CONFIGURATION OVERVIEW (WORKS!)
-- ============================================================================

-- View all Twitter Master configurations
SELECT 
    config_key,
    config_value,
    description,
    last_updated_by,
    updated_at
FROM twitter_master_config 
ORDER BY config_key;

-- ============================================================================
-- 5. DATABASE TABLES CHECK (FIXED!)
-- ============================================================================

-- Check which tables exist (CORRECTED VERSION)
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'tweets', 
    'api_usage_tracking', 
    'bot_usage_tracking', 
    'bot_config', 
    'system_logs',
    'twitter_master_config', 
    'twitter_master_decisions', 
    'system_health_status',
    'twitter_platform_intelligence', 
    'content_strategy_decisions', 
    'twitter_relationships',
    'strategic_engagements', 
    'follower_growth_analytics', 
    'content_performance_learning',
    'trending_opportunities'
  )
ORDER BY table_name;

-- ============================================================================
-- 6. RECENT TWEETS (WORKS!)
-- ============================================================================

-- Show recent tweets from bot
SELECT 
    tweet_id,
    content,
    tweet_type,
    engagement_score,
    created_at
FROM tweets 
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. BOT ACTIVITY TODAY (WORKS!)
-- ============================================================================

-- Count today's activity
SELECT 
    'tweets' as activity_type,
    COUNT(*) as count_today
FROM tweets 
WHERE DATE(created_at) = CURRENT_DATE

UNION ALL

SELECT 
    'ai_decisions' as activity_type,
    COUNT(*) as count_today
FROM twitter_master_decisions 
WHERE DATE(created_at) = CURRENT_DATE;

-- ============================================================================
-- 8. SYSTEM INTEGRATION CHECK (WORKS!)
-- ============================================================================

-- Check if old and new systems are working together
SELECT 
    'System Integration' as check_name,
    (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as tweets_last_7_days,
    (SELECT COUNT(*) FROM twitter_master_decisions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as ai_decisions_last_7_days,
    (SELECT COUNT(*) FROM twitter_master_config) as total_configs,
    (SELECT COUNT(*) FROM system_health_status WHERE status = 'optimal') as optimal_components;

-- ============================================================================
-- 9. AI DECISION SUMMARY (WORKS!)
-- ============================================================================

-- Summarize AI decision types
SELECT 
    decision_type,
    COUNT(*) as total_decisions,
    AVG(confidence_score) as avg_confidence,
    MAX(created_at) as latest_decision
FROM twitter_master_decisions 
GROUP BY decision_type 
ORDER BY total_decisions DESC;

-- ============================================================================
-- 10. QUICK HEALTH DASHBOARD (WORKS!)
-- ============================================================================

-- Single query to see overall health
SELECT 
    'Twitter Master System Health' as dashboard,
    (SELECT config_value FROM twitter_master_config WHERE config_key = 'system_enabled') as system_enabled,
    (SELECT COUNT(*) FROM system_health_status WHERE status = 'optimal') as optimal_components,
    (SELECT COUNT(*) FROM system_health_status) as total_components,
    (SELECT COUNT(*) FROM twitter_master_decisions WHERE created_at >= CURRENT_DATE) as decisions_today,
    (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE) as tweets_today,
    (SELECT COUNT(*) FROM twitter_master_config) as total_configs;

-- ============================================================================
-- 11. LEARNING SYSTEM STATUS (WORKS!)
-- ============================================================================

-- Check learning system activity
SELECT 
    'Learning System' as system,
    COUNT(*) as total_learning_records,
    MAX(created_at) as latest_learning_entry
FROM content_performance_learning;

-- ============================================================================
-- 12. TRENDING OPPORTUNITIES (WORKS!)
-- ============================================================================

-- Check trending opportunities tracking
SELECT 
    topic,
    momentum,
    opportunity_score,
    health_relevance,
    capitalized,
    created_at
FROM trending_opportunities 
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Copy ONE query at a time
-- 2. Paste into Supabase SQL Editor  
-- 3. Click "Run" button
-- 4. Check Results tab
--
-- START WITH THESE QUERIES:
-- - Query #1: System Status Check
-- - Query #2: System Health Overview  
-- - Query #10: Quick Health Dashboard
-- ============================================================================ 