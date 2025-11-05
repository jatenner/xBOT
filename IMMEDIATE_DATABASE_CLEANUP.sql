-- =====================================================
-- IMMEDIATE DATABASE CLEANUP - Phase 1
-- Date: November 5, 2025
-- Purpose: Remove empty tables (0 rows)
-- =====================================================

-- SAFETY: Create backup first!
-- Run this before executing cleanup:
-- pg_dump $DATABASE_URL > backup_before_cleanup_$(date +%Y%m%d).sql

BEGIN;

-- =====================================================
-- EMPTY TABLES (0 rows) - Safe to delete
-- =====================================================

DROP TABLE IF EXISTS agent_actions CASCADE;
DROP TABLE IF EXISTS topic_performance CASCADE;
DROP TABLE IF EXISTS viral_content_usage CASCADE;
DROP TABLE IF EXISTS posted_tweets CASCADE;
DROP TABLE IF EXISTS template_usage CASCADE;
DROP TABLE IF EXISTS time_performance CASCADE;
DROP TABLE IF EXISTS real_trending_topics CASCADE;
DROP TABLE IF EXISTS tweet_performance_analysis CASCADE;
DROP TABLE IF EXISTS content_generations CASCADE;
DROP TABLE IF EXISTS engagement_analysis CASCADE;
DROP TABLE IF EXISTS content_embeddings CASCADE;
DROP TABLE IF EXISTS intelligent_engagement_actions CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS growth_strategies CASCADE;
DROP TABLE IF EXISTS decision_outcomes CASCADE;
DROP TABLE IF EXISTS learning_cycles CASCADE;
DROP TABLE IF EXISTS post_metrics CASCADE;
DROP TABLE IF EXISTS prompt_rotation_history CASCADE;
DROP TABLE IF EXISTS daily_optimization_reports CASCADE;
DROP TABLE IF EXISTS optimal_posting_windows CASCADE;
DROP TABLE IF EXISTS content_validation_logs CASCADE;
DROP TABLE IF EXISTS engagement_actions CASCADE;
DROP TABLE IF EXISTS twitter_relationships CASCADE;
DROP TABLE IF EXISTS system_health CASCADE;
DROP TABLE IF EXISTS algorithm_signals CASCADE;
DROP TABLE IF EXISTS bandit_posteriors CASCADE;
DROP TABLE IF EXISTS engagement_metrics CASCADE;
DROP TABLE IF EXISTS learned_performance_patterns CASCADE;
DROP TABLE IF EXISTS trending_topic_usage CASCADE;
DROP TABLE IF EXISTS trending_fetch_history CASCADE;
DROP TABLE IF EXISTS features CASCADE;
DROP TABLE IF EXISTS tweet_generation_sessions CASCADE;
DROP TABLE IF EXISTS topic_clusters CASCADE;
DROP TABLE IF EXISTS quota_utilization_log CASCADE;
DROP TABLE IF EXISTS learning_insights CASCADE;
DROP TABLE IF EXISTS performance_patterns CASCADE;
DROP TABLE IF EXISTS follower_growth_analytics CASCADE;
DROP TABLE IF EXISTS timing_effectiveness CASCADE;
DROP TABLE IF EXISTS content_guidance_tracking CASCADE;
DROP TABLE IF EXISTS content_cache CASCADE;
DROP TABLE IF EXISTS browser_cookies CASCADE;
DROP TABLE IF EXISTS content_performance_learning CASCADE;
DROP TABLE IF EXISTS style_ab_experiments CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS slot_performance CASCADE;
DROP TABLE IF EXISTS content_generation_sessions CASCADE;
DROP TABLE IF EXISTS used_idea_fingerprints CASCADE;
DROP TABLE IF EXISTS tweet_impressions CASCADE;
DROP TABLE IF EXISTS follower_attribution CASCADE;
DROP TABLE IF EXISTS api_usage_tracking CASCADE;

-- =====================================================
-- VERIFICATION: Check tables were dropped
-- =====================================================

-- Run this to verify cleanup:
-- SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

COMMIT;

-- =====================================================
-- POST-CLEANUP NOTES:
-- =====================================================

-- Before: 259 tables
-- After Phase 1: ~210 tables (removed 49+ empty tables)
-- 
-- Next Steps:
-- - Phase 2: Consolidate config tables
-- - Phase 3: Migrate legacy references
-- - Phase 4: Archive old data
-- 
-- Final Target: 30-40 core tables

