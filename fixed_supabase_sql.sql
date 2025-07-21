-- 🔧 FIXED SUPABASE SQL 
-- Corrects the syntax error from the screenshot and adds essential functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- PHASE 1: FIX TWEETS TABLE (ADD MISSING COLUMNS)
-- ===================================================================

-- Add missing metadata column to tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add other essential columns for complete functionality
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_type VARCHAR(50) DEFAULT 'standard';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS engagement_score DECIMAL(5,3) DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS viral_score DECIMAL(5,3) DEFAULT 0;

-- ===================================================================
-- PHASE 2: CREATE MISSING CORE TABLES
-- ===================================================================

-- Create tweet_content table
CREATE TABLE IF NOT EXISTS tweet_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    tweet_type VARCHAR(50) DEFAULT 'standard',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tweet_metadata table
CREATE TABLE IF NOT EXISTS tweet_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    engagement_metrics JSONB DEFAULT '{}',
    performance_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posted_tweets table
CREATE TABLE IF NOT EXISTS posted_tweets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    twitter_id VARCHAR(255) UNIQUE,
    content TEXT NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'posted',
    engagement_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tweet_analytics table
CREATE TABLE IF NOT EXISTS tweet_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,3) DEFAULT 0,
    viral_score DECIMAL(5,3) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- PHASE 3: FIX EXISTING TABLES (ADD MISSING COLUMNS)
-- ===================================================================

-- Fix engagement_data table
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,3) DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;

-- Fix ai_learning_data table
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,3) DEFAULT 0;
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS viral_potential DECIMAL(5,3) DEFAULT 0;

-- Fix viral_content_performance table
ALTER TABLE viral_content_performance ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE viral_content_performance ADD COLUMN IF NOT EXISTS viral_score DECIMAL(5,3) DEFAULT 0;
ALTER TABLE viral_content_performance ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}';

-- Fix learning_insights table
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS insight_type VARCHAR(100);
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS insight_data JSONB DEFAULT '{}';
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS confidence_level DECIMAL(5,3) DEFAULT 0;

-- Fix follower_tracking table
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS follower_growth INTEGER DEFAULT 0;
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS growth_rate DECIMAL(5,3) DEFAULT 0;

-- ===================================================================
-- PHASE 4: CREATE AUTONOMOUS INTELLIGENCE TABLES
-- ===================================================================

-- Create autonomous_decisions table
CREATE TABLE IF NOT EXISTS autonomous_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_type VARCHAR(100) NOT NULL,
    decision_data JSONB NOT NULL,
    reasoning JSONB DEFAULT '{}',
    confidence_score DECIMAL(5,3) DEFAULT 0,
    outcome_prediction JSONB DEFAULT '{}',
    actual_outcome JSONB DEFAULT '{}',
    success_rating DECIMAL(5,3) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create autonomous_growth_strategies table
CREATE TABLE IF NOT EXISTS autonomous_growth_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_name VARCHAR(200) NOT NULL,
    strategy_type VARCHAR(100) NOT NULL,
    strategy_data JSONB NOT NULL,
    target_metrics JSONB DEFAULT '{}',
    performance_history JSONB DEFAULT '{}',
    effectiveness_score DECIMAL(5,3) DEFAULT 0,
    usage_frequency INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_performance_metrics table
CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,3) NOT NULL,
    metric_data JSONB DEFAULT '{}',
    benchmark_comparison JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create system_health_metrics table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(200) NOT NULL,
    health_status VARCHAR(50) NOT NULL,
    health_score DECIMAL(5,3) DEFAULT 0,
    performance_data JSONB DEFAULT '{}',
    error_logs JSONB DEFAULT '{}',
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follower_growth_predictions table
CREATE TABLE IF NOT EXISTS follower_growth_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    predicted_growth INTEGER NOT NULL,
    confidence_level DECIMAL(5,3) DEFAULT 0,
    prediction_factors JSONB DEFAULT '{}',
    actual_growth INTEGER DEFAULT NULL,
    accuracy_score DECIMAL(5,3) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- PHASE 5: CREATE ESSENTIAL INDEXES
-- ===================================================================

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_type ON tweets(tweet_type);

CREATE INDEX IF NOT EXISTS idx_tweet_content_tweet_id ON tweet_content(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_content_hash ON tweet_content(content_hash);

CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate DESC);

-- ===================================================================
-- PHASE 6: CREATE ESSENTIAL FUNCTIONS
-- ===================================================================

-- Function to safely insert tweets with metadata
CREATE OR REPLACE FUNCTION safe_insert_tweet(
    p_content TEXT,
    p_tweet_type VARCHAR DEFAULT 'standard',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_tweet_id UUID;
    v_auto_tweet_id VARCHAR(255);
    v_content_hash VARCHAR(64);
BEGIN
    -- Generate auto tweet ID and content hash
    v_auto_tweet_id := 'auto_' || extract(epoch from now())::text || '_' || substr(md5(random()::text), 1, 8);
    v_content_hash := encode(digest(p_content, 'sha256'), 'hex');
    
    -- Insert tweet with all required fields
    INSERT INTO tweets (tweet_id, content, tweet_type, metadata, created_at)
    VALUES (v_auto_tweet_id, p_content, p_tweet_type, p_metadata, NOW())
    RETURNING id INTO v_tweet_id;
    
    -- Also insert into tweet_content for redundancy
    INSERT INTO tweet_content (tweet_id, content, content_hash, tweet_type, metadata)
    VALUES (v_auto_tweet_id, p_content, v_content_hash, p_tweet_type, p_metadata)
    ON CONFLICT (content_hash) DO NOTHING;
    
    RETURN v_tweet_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- PHASE 7: SET UP ROW LEVEL SECURITY (FIXED SYNTAX)
-- ===================================================================

-- Enable RLS on new tables
ALTER TABLE tweet_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE posted_tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_analytics ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service role (CORRECTED SYNTAX)
DROP POLICY IF EXISTS "Service role can do everything on tweets" ON tweets;
CREATE POLICY "Service role can do everything on tweets"
ON tweets FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do everything on tweet_content" ON tweet_content;
CREATE POLICY "Service role can do everything on tweet_content"
ON tweet_content FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do everything on tweet_metadata" ON tweet_metadata;
CREATE POLICY "Service role can do everything on tweet_metadata"
ON tweet_metadata FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do everything on posted_tweets" ON posted_tweets;
CREATE POLICY "Service role can do everything on posted_tweets"
ON posted_tweets FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do everything on tweet_analytics" ON tweet_analytics;
CREATE POLICY "Service role can do everything on tweet_analytics"
ON tweet_analytics FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- ===================================================================
-- PHASE 8: TEST THE FIX
-- ===================================================================

-- Test that the metadata column fix worked
SELECT safe_insert_tweet(
    '🔧 Complete database fix test - ' || now()::text,
    'system_test',
    '{"test": true, "complete_fix": true, "version": "fixed"}'
) AS test_tweet_id;

-- Verify all tables exist
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('tweets', 'tweet_content', 'tweet_analytics', 'engagement_data', 'ai_learning_data')
AND column_name IN ('metadata', 'likes', 'content_hash', 'performance_score')
ORDER BY table_name, column_name; 