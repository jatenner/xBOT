-- 🚨 COMPREHENSIVE SCHEMA FIX - BULLETPROOF SOLUTION
-- =====================================================
-- This migration ensures ALL missing columns are added with proper types,
-- constraints, indexes, and cache invalidation for production stability
-- Date: 2025-08-08 (Critical Production Fix)

-- ===========================================
-- 1. POST_HISTORY TABLE COMPREHENSIVE FIX
-- ===========================================

-- Add idea_fingerprint with proper constraints
ALTER TABLE post_history 
ADD COLUMN IF NOT EXISTS idea_fingerprint TEXT;

-- Add all other missing columns from the codebase analysis
ALTER TABLE post_history 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS posting_strategy VARCHAR(50) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS success_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS learning_signals JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_impact INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS posting_hour INTEGER,
ADD COLUMN IF NOT EXISTS posting_day_of_week INTEGER,
ADD COLUMN IF NOT EXISTS format_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS hook_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS content_category VARCHAR(100) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS bandit_confidence DECIMAL(5,4) DEFAULT 0.5000,
ADD COLUMN IF NOT EXISTS predicted_engagement DECIMAL(5,4) DEFAULT 0.0000;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_history_idea_fingerprint ON post_history(idea_fingerprint);
CREATE INDEX IF NOT EXISTS idx_post_history_content_type ON post_history(content_type);
CREATE INDEX IF NOT EXISTS idx_post_history_posting_hour ON post_history(posting_hour);
CREATE INDEX IF NOT EXISTS idx_post_history_engagement_score ON post_history(engagement_score);

-- ===========================================
-- 2. TWEET_ANALYTICS TABLE COMPREHENSIVE FIX
-- ===========================================

-- Add profile_visit_rate with proper type
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS profile_visit_rate DECIMAL(8,4) DEFAULT 0.0000;

-- Add all other missing analytics columns
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS click_through_rate DECIMAL(8,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(8,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS viral_coefficient DECIMAL(8,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS reach_efficiency DECIMAL(8,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS audience_quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS trend_alignment_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS optimal_timing_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_freshness_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_retention_impact DECIMAL(8,4) DEFAULT 0.0000;

-- Add indexes for analytics performance
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_profile_visit_rate ON tweet_analytics(profile_visit_rate);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_click_through_rate ON tweet_analytics(click_through_rate);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_viral_coefficient ON tweet_analytics(viral_coefficient);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_audience_quality ON tweet_analytics(audience_quality_score);

-- ===========================================
-- 3. LEARNING_POSTS TABLE COMPREHENSIVE FIX
-- ===========================================

-- Ensure learning_posts has all required columns
ALTER TABLE learning_posts 
ADD COLUMN IF NOT EXISTS content_length INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_hook BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_call_to_action BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quality_issues TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS audience_growth_potential DECIMAL(5,4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS post_reason TEXT DEFAULT 'automated_post',
ADD COLUMN IF NOT EXISTS bandit_confidence DECIMAL(5,4) DEFAULT 0.5000,
ADD COLUMN IF NOT EXISTS predicted_engagement DECIMAL(5,4) DEFAULT 0.0000;

-- Add indexes for learning performance
CREATE INDEX IF NOT EXISTS idx_learning_posts_content_length ON learning_posts(content_length);
CREATE INDEX IF NOT EXISTS idx_learning_posts_has_hook ON learning_posts(has_hook);
CREATE INDEX IF NOT EXISTS idx_learning_posts_quality_score ON learning_posts(quality_score);

-- ===========================================
-- 4. CONTENT_FEATURES TABLE COMPREHENSIVE FIX
-- ===========================================

-- Ensure content_features table exists and has all AI analysis columns
CREATE TABLE IF NOT EXISTS content_features (
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT NOT NULL UNIQUE,
    primary_topic TEXT,
    secondary_topics TEXT[] DEFAULT '{}',
    key_phrases TEXT[] DEFAULT '{}',
    sentiment_score DECIMAL(3,2) DEFAULT 0.00,
    complexity_score INTEGER DEFAULT 5,
    engagement_hooks TEXT[] DEFAULT '{}',
    viral_elements TEXT[] DEFAULT '{}',
    audience_signals TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for content features
CREATE INDEX IF NOT EXISTS idx_content_features_tweet_id ON content_features(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_features_primary_topic ON content_features(primary_topic);
CREATE INDEX IF NOT EXISTS idx_content_features_sentiment ON content_features(sentiment_score);

-- ===========================================
-- 5. BANDIT_ARMS TABLE COMPREHENSIVE FIX
-- ===========================================

-- Ensure bandit_arms table exists for contextual bandit optimization
CREATE TABLE IF NOT EXISTS bandit_arms (
    id BIGSERIAL PRIMARY KEY,
    arm_id TEXT NOT NULL UNIQUE,
    arm_type TEXT NOT NULL, -- 'format', 'hook', 'timing', etc.
    arm_name TEXT NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    total_selections INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    confidence_interval DECIMAL(5,4) DEFAULT 0.0000,
    alpha_param DECIMAL(8,4) DEFAULT 1.0000,
    beta_param DECIMAL(8,4) DEFAULT 1.0000,
    last_selected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for bandit performance
CREATE INDEX IF NOT EXISTS idx_bandit_arms_arm_id ON bandit_arms(arm_id);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_type ON bandit_arms(arm_type);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_success_rate ON bandit_arms(success_rate DESC);

-- ===========================================
-- 6. COMPREHENSIVE VALIDATION & VERIFICATION
-- ===========================================

DO $$
DECLARE
    missing_columns TEXT[] := '{}';
    col_count INTEGER;
    table_name TEXT;
    column_name TEXT;
    expected_columns TEXT[][] := ARRAY[
        ['post_history', 'idea_fingerprint'],
        ['post_history', 'content_type'],
        ['post_history', 'posting_strategy'],
        ['post_history', 'engagement_score'],
        ['post_history', 'viral_score'],
        ['tweet_analytics', 'profile_visit_rate'],
        ['tweet_analytics', 'click_through_rate'],
        ['tweet_analytics', 'viral_coefficient'],
        ['learning_posts', 'has_hook'],
        ['learning_posts', 'has_call_to_action'],
        ['learning_posts', 'bandit_confidence']
    ];
BEGIN
    -- Check all expected columns exist
    FOR i IN 1..array_length(expected_columns, 1) LOOP
        table_name := expected_columns[i][1];
        column_name := expected_columns[i][2];
        
        SELECT COUNT(*) INTO col_count 
        FROM information_schema.columns 
        WHERE table_name = expected_columns[i][1] AND column_name = expected_columns[i][2];
        
        IF col_count = 0 THEN
            missing_columns := missing_columns || (table_name || '.' || column_name);
        END IF;
    END LOOP;
    
    -- Report results
    IF array_length(missing_columns, 1) IS NULL THEN
        RAISE NOTICE '✅ SUCCESS: All required columns exist and are properly configured';
        RAISE NOTICE '📊 Tables updated: post_history, tweet_analytics, learning_posts, content_features, bandit_arms';
        RAISE NOTICE '⚡ Indexes created for optimal performance';
        RAISE NOTICE '🎯 Schema is now fully compatible with all system components';
    ELSE
        RAISE NOTICE '❌ MISSING COLUMNS: %', array_to_string(missing_columns, ', ');
        RAISE EXCEPTION 'Migration incomplete - missing columns detected';
    END IF;
END $$;

-- ===========================================
-- 7. FORCE SCHEMA CACHE REFRESH
-- ===========================================

-- Update table comments to force cache refresh
COMMENT ON TABLE post_history IS 'Posts with comprehensive tracking and idea fingerprints - schema updated 2025-08-08';
COMMENT ON TABLE tweet_analytics IS 'Comprehensive tweet analytics with all performance metrics - schema updated 2025-08-08';
COMMENT ON TABLE learning_posts IS 'Learning database for AI content optimization - schema updated 2025-08-08';
COMMENT ON TABLE content_features IS 'AI-extracted content features for analysis - schema updated 2025-08-08';
COMMENT ON TABLE bandit_arms IS 'Contextual bandit arms for optimization - schema updated 2025-08-08';

-- ===========================================
-- 8. PERFORMANCE OPTIMIZATION
-- ===========================================

-- Analyze tables for optimal query performance
ANALYZE post_history;
ANALYZE tweet_analytics;
ANALYZE learning_posts;
ANALYZE content_features;
ANALYZE bandit_arms;

-- Final success confirmation
SELECT 
    'COMPREHENSIVE SCHEMA FIX COMPLETED SUCCESSFULLY' AS status,
    NOW() AS completed_at,
    'All missing columns added, indexes created, cache refreshed' AS summary;