-- 🏥 TWITTER MASTER SYSTEM - SQL DATABASE CHECKS
-- ================================================
-- Run these queries in your Supabase SQL Editor to monitor and check your system

-- ============================================================================
-- 1. SYSTEM HEALTH OVERVIEW
-- ============================================================================

-- Check all Twitter Master System components health
SELECT 
    component_name,
    status,
    readiness_score,
    last_check,
    EXTRACT(EPOCH FROM (NOW() - last_check))/60 as minutes_since_check
FROM system_health_status 
ORDER BY readiness_score DESC, last_check DESC;

-- ============================================================================
-- 2. CONFIGURATION STATUS
-- ============================================================================

-- View current Twitter Master System configuration
SELECT 
    config_key,
    config_value,
    config_type,
    description,
    last_updated_by,
    updated_at
FROM twitter_master_config 
ORDER BY 
    CASE config_key 
        WHEN 'system_enabled' THEN 1
        WHEN 'intelligence_level' THEN 2
        WHEN 'growth_goal' THEN 3
        ELSE 4 
    END,
    config_key;

-- Check if system is properly enabled
SELECT 
    CASE 
        WHEN config_value = 'true' THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as system_status,
    updated_at as last_changed
FROM twitter_master_config 
WHERE config_key = 'system_enabled';

-- ============================================================================
-- 3. AI DECISION ANALYSIS
-- ============================================================================

-- Recent AI decisions summary
SELECT 
    decision_type,
    COUNT(*) as decision_count,
    AVG(confidence_score) as avg_confidence,
    MAX(created_at) as latest_decision
FROM twitter_master_decisions 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY decision_type 
ORDER BY decision_count DESC, avg_confidence DESC;

-- Top confidence AI decisions today
SELECT 
    decision_type,
    confidence_score,
    reasoning,
    created_at
FROM twitter_master_decisions 
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY confidence_score DESC, created_at DESC
LIMIT 10;

-- AI decision patterns over time
SELECT 
    DATE(created_at) as decision_date,
    COUNT(*) as decisions_made,
    AVG(confidence_score) as avg_confidence,
    COUNT(DISTINCT decision_type) as decision_types
FROM twitter_master_decisions 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY decision_date DESC
LIMIT 14;

-- ============================================================================
-- 4. CONTENT PERFORMANCE TRACKING
-- ============================================================================

-- Learning system performance
SELECT 
    content_type,
    COUNT(*) as total_content,
    AVG((actual_performance->>'engagement')::numeric) as avg_actual_engagement,
    AVG((predicted_performance->>'engagement')::numeric) as avg_predicted_engagement,
    AVG(ABS((actual_performance->>'engagement')::numeric - (predicted_performance->>'engagement')::numeric)) as avg_prediction_error
FROM content_performance_learning 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY content_type
ORDER BY total_content DESC;

-- Best performing content types
SELECT 
    content_type,
    content_category,
    (actual_performance->>'engagement')::numeric as engagement,
    (actual_performance->>'followers')::numeric as followers_gained,
    tweet_id,
    created_at
FROM content_performance_learning 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY (actual_performance->>'engagement')::numeric DESC
LIMIT 10;

-- ============================================================================
-- 5. FOLLOWER GROWTH ANALYTICS
-- ============================================================================

-- Follower growth trends
SELECT 
    date,
    follower_count,
    follower_change,
    growth_source,
    growth_quality_score,
    (content_performance->>'viral_tweets')::numeric as viral_tweets
FROM follower_growth_analytics 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Growth source effectiveness
SELECT 
    growth_source,
    COUNT(*) as days_tracked,
    AVG(follower_change) as avg_daily_growth,
    SUM(follower_change) as total_growth,
    AVG(growth_quality_score) as avg_quality
FROM follower_growth_analytics 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  AND growth_source IS NOT NULL
GROUP BY growth_source
ORDER BY avg_daily_growth DESC;

-- ============================================================================
-- 6. NETWORK & ENGAGEMENT STRATEGY
-- ============================================================================

-- Strategic relationships overview
SELECT 
    relationship_type,
    COUNT(*) as total_relationships,
    AVG(influence_score) as avg_influence,
    AVG(relationship_value_score) as avg_value,
    COUNT(CASE WHEN last_engagement_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_engagement
FROM twitter_relationships 
GROUP BY relationship_type
ORDER BY avg_value DESC;

-- Most valuable relationships
SELECT 
    twitter_username,
    relationship_type,
    follower_count,
    influence_score,
    relationship_value_score,
    engagement_count,
    last_engagement_date
FROM twitter_relationships 
WHERE relationship_value_score >= 70
ORDER BY relationship_value_score DESC, influence_score DESC
LIMIT 15;

-- Recent strategic engagements
SELECT 
    target_username,
    engagement_type,
    strategic_value,
    expected_reach,
    actual_reach,
    relationship_impact,
    created_at
FROM strategic_engagements 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY strategic_value DESC, created_at DESC
LIMIT 20;

-- ============================================================================
-- 7. TRENDING OPPORTUNITIES
-- ============================================================================

-- Current trending opportunities
SELECT 
    topic,
    momentum,
    health_relevance,
    opportunity_score,
    competition_level,
    capitalized,
    time_window_start,
    time_window_end
FROM trending_opportunities 
WHERE (time_window_end IS NULL OR time_window_end > NOW())
  AND momentum IN ('rising', 'peak')
ORDER BY opportunity_score DESC, health_relevance DESC;

-- Capitalized vs missed opportunities
SELECT 
    CASE 
        WHEN capitalized THEN 'Capitalized'
        ELSE 'Missed'
    END as opportunity_status,
    COUNT(*) as total_opportunities,
    AVG(opportunity_score) as avg_opportunity_score,
    AVG(health_relevance) as avg_health_relevance
FROM trending_opportunities 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY capitalized
ORDER BY capitalized DESC;

-- ============================================================================
-- 8. SYSTEM PERFORMANCE METRICS
-- ============================================================================

-- Database table sizes and activity
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables 
WHERE tablename LIKE '%twitter%' OR tablename IN ('tweets', 'bot_config', 'system_logs')
ORDER BY n_live_tup DESC;

-- Recent system activity
SELECT 
    'tweets' as table_name,
    COUNT(*) as recent_records,
    MAX(created_at) as latest_record
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'ai_decisions' as table_name,
    COUNT(*) as recent_records,
    MAX(created_at) as latest_record
FROM twitter_master_decisions 
WHERE created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    'strategic_engagements' as table_name,
    COUNT(*) as recent_records,
    MAX(created_at) as latest_record
FROM strategic_engagements 
WHERE created_at >= NOW() - INTERVAL '24 hours'

ORDER BY recent_records DESC;

-- ============================================================================
-- 9. BOT VS AI SYSTEM INTEGRATION
-- ============================================================================

-- Compare traditional bot activity vs AI decisions
SELECT 
    DATE(created_at) as activity_date,
    'Traditional Bot' as system_type,
    COUNT(*) as activities
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)

UNION ALL

SELECT 
    DATE(created_at) as activity_date,
    'AI System' as system_type,
    COUNT(*) as activities
FROM twitter_master_decisions 
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(created_at)

ORDER BY activity_date DESC, system_type;

-- Integration health score
SELECT 
    'System Integration Health' as metric,
    CASE 
        WHEN COUNT(DISTINCT DATE(t.created_at)) > 0 
         AND COUNT(DISTINCT DATE(d.created_at)) > 0 
        THEN '✅ INTEGRATED'
        ELSE '⚠️ NOT INTEGRATED'
    END as status,
    COUNT(DISTINCT DATE(t.created_at)) as bot_active_days,
    COUNT(DISTINCT DATE(d.created_at)) as ai_active_days
FROM tweets t
FULL OUTER JOIN twitter_master_decisions d ON DATE(t.created_at) = DATE(d.created_at)
WHERE t.created_at >= NOW() - INTERVAL '7 days' 
   OR d.created_at >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- 10. QUICK HEALTH CHECK QUERIES
-- ============================================================================

-- Overall system status (run this first)
SELECT 
    'Twitter Master System' as system,
    CASE 
        WHEN EXISTS (SELECT 1 FROM twitter_master_config WHERE config_key = 'system_enabled' AND config_value = 'true')
        THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as status,
    (SELECT COUNT(*) FROM system_health_status WHERE status = 'optimal') as optimal_components,
    (SELECT COUNT(*) FROM system_health_status) as total_components,
    (SELECT COUNT(*) FROM twitter_master_decisions WHERE created_at >= CURRENT_DATE) as decisions_today,
    (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE) as tweets_today;

-- Database health summary
SELECT 
    'Database Health' as check_type,
    CASE 
        WHEN COUNT(*) = 15 THEN '✅ ALL TABLES PRESENT'
        ELSE '⚠️ MISSING TABLES: ' || (15 - COUNT(*))::text
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'tweets', 'api_usage_tracking', 'bot_usage_tracking', 'bot_config', 'system_logs',
    'twitter_master_config', 'twitter_master_decisions', 'system_health_status',
    'twitter_platform_intelligence', 'content_strategy_decisions', 'twitter_relationships',
    'strategic_engagements', 'follower_growth_analytics', 'content_performance_learning',
    'trending_opportunities'
  );

-- Recent AI activity summary (most important)
SELECT 
    decision_type,
    COUNT(*) as count,
    AVG(confidence_score) as avg_confidence,
    MAX(created_at) as latest
FROM twitter_master_decisions 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY decision_type
ORDER BY count DESC;

-- ============================================================================
-- USAGE INSTRUCTIONS:
-- ============================================================================
-- 1. Copy any query above
-- 2. Paste into Supabase SQL Editor
-- 3. Click "RUN" to execute
-- 4. View results in the Results tab
--
-- RECOMMENDED MONITORING QUERIES (run daily):
-- - Overall system status
-- - Recent AI decisions summary  
-- - System health overview
-- - Follower growth trends
-- ============================================================================ 