-- 🔧 COMPLETE DATABASE SCHEMA FIX
-- Fixes ALL database issues to restore complete functionality
-- Creates missing tables, columns, and ensures full autonomous operation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- PHASE 1: FIX EXISTING TWEETS TABLE
-- ===================================================================

-- Add missing columns to tweets table
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tweet_type VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS engagement_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';

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
    ai_analysis JSONB DEFAULT '{}',
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
    analytics_data JSONB DEFAULT '{}',
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
    clicks INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    follows INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix engagement_data table - add missing columns
ALTER TABLE engagement_data 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0;

-- ===================================================================
-- PHASE 3: CREATE AUTONOMOUS LEARNING TABLES
-- ===================================================================

-- Fix ai_learning_data table - add missing columns
ALTER TABLE ai_learning_data 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS content_text TEXT,
ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_prediction DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_potential DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS learning_metadata JSONB DEFAULT '{}';

-- Create content_performance table
CREATE TABLE IF NOT EXISTS content_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    content_snippet TEXT,
    engagement_rate DECIMAL(5,3) DEFAULT 0,
    viral_potential DECIMAL(5,3) DEFAULT 0,
    follower_growth INTEGER DEFAULT 0,
    performance_score DECIMAL(5,3) DEFAULT 0,
    learning_data JSONB DEFAULT '{}',
    improvement_suggestions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create viral_patterns table
CREATE TABLE IF NOT EXISTS viral_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type VARCHAR(100) NOT NULL,
    pattern_data JSONB NOT NULL,
    success_rate DECIMAL(5,3) DEFAULT 0,
    engagement_boost DECIMAL(5,3) DEFAULT 0,
    follower_conversion DECIMAL(5,3) DEFAULT 0,
    confidence_score DECIMAL(5,3) DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix viral_content_performance table - add missing columns
ALTER TABLE viral_content_performance 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS viral_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS follower_impact INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reach_multiplier DECIMAL(5,3) DEFAULT 0;

-- Fix learning_insights table - add missing columns
ALTER TABLE learning_insights 
ADD COLUMN IF NOT EXISTS insight_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS insight_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS confidence_level DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS application_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,3) DEFAULT 0;

-- Fix follower_tracking table - add missing columns
ALTER TABLE follower_tracking 
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_growth INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS growth_rate DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS growth_source VARCHAR(100),
ADD COLUMN IF NOT EXISTS attribution_data JSONB DEFAULT '{}';

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
    learning_feedback JSONB DEFAULT '{}',
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
    last_applied TIMESTAMP WITH TIME ZONE DEFAULT NULL,
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
    trend_analysis JSONB DEFAULT '{}',
    improvement_suggestions JSONB DEFAULT '{}',
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
    recovery_actions JSONB DEFAULT '{}',
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
    model_version VARCHAR(50) DEFAULT 'v1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- PHASE 5: CREATE INDEXES FOR PERFORMANCE
-- ===================================================================

-- Tweets table indexes
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_twitter_id ON tweets(twitter_id);
CREATE INDEX IF NOT EXISTS idx_tweets_type ON tweets(tweet_type);
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);

-- Tweet content indexes
CREATE INDEX IF NOT EXISTS idx_tweet_content_tweet_id ON tweet_content(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_content_hash ON tweet_content(content_hash);
CREATE INDEX IF NOT EXISTS idx_tweet_content_created_at ON tweet_content(created_at DESC);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_viral_score ON tweet_analytics(viral_score DESC);

-- Learning data indexes
CREATE INDEX IF NOT EXISTS idx_ai_learning_content_hash ON ai_learning_data(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_performance_hash ON content_performance(content_hash);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_type ON viral_patterns(pattern_type);

-- Autonomous system indexes
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_type ON autonomous_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_created_at ON autonomous_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_type ON autonomous_growth_strategies(strategy_type);
CREATE INDEX IF NOT EXISTS idx_system_performance_type ON system_performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_metrics(component_name);

-- ===================================================================
-- PHASE 6: CREATE AUTONOMOUS SYSTEM FUNCTIONS
-- ===================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to safely insert tweets with full metadata
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
    v_auto_tweet_id := 'auto_' || extract(epoch from now()) || '_' || substr(md5(random()::text), 1, 8);
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

-- Function to record comprehensive tweet performance
CREATE OR REPLACE FUNCTION record_comprehensive_tweet_performance(
    p_tweet_id VARCHAR,
    p_likes INTEGER DEFAULT 0,
    p_retweets INTEGER DEFAULT 0,
    p_replies INTEGER DEFAULT 0,
    p_impressions INTEGER DEFAULT 0,
    p_reach INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    v_engagement_rate DECIMAL(5,3);
    v_viral_score DECIMAL(5,3);
BEGIN
    -- Calculate engagement metrics
    IF p_impressions > 0 THEN
        v_engagement_rate := (p_likes + p_retweets + p_replies)::DECIMAL / p_impressions::DECIMAL;
    ELSE
        v_engagement_rate := 0;
    END IF;
    
    -- Calculate viral score
    v_viral_score := LEAST(
        (p_retweets::DECIMAL / GREATEST(p_impressions::DECIMAL, 1)) * 10 + 
        (p_likes::DECIMAL / GREATEST(p_impressions::DECIMAL, 1)) * 5,
        10.0
    );
    
    -- Insert comprehensive analytics
    INSERT INTO tweet_analytics (
        tweet_id, likes, retweets, replies, impressions, 
        engagement_rate, viral_score, reach
    ) VALUES (
        p_tweet_id, p_likes, p_retweets, p_replies, p_impressions,
        v_engagement_rate, v_viral_score, p_reach
    ) ON CONFLICT (tweet_id) DO UPDATE SET
        likes = EXCLUDED.likes,
        retweets = EXCLUDED.retweets,
        replies = EXCLUDED.replies,
        impressions = EXCLUDED.impressions,
        engagement_rate = EXCLUDED.engagement_rate,
        viral_score = EXCLUDED.viral_score,
        reach = EXCLUDED.reach,
        updated_at = NOW();
        
    -- Also update engagement_data table
    INSERT INTO engagement_data (
        tweet_id, likes, retweets, replies, impressions, 
        engagement_rate, reach
    ) VALUES (
        p_tweet_id, p_likes, p_retweets, p_replies, p_impressions,
        v_engagement_rate, p_reach
    ) ON CONFLICT (tweet_id) DO UPDATE SET
        likes = EXCLUDED.likes,
        retweets = EXCLUDED.retweets,
        replies = EXCLUDED.replies,
        impressions = EXCLUDED.impressions,
        engagement_rate = EXCLUDED.engagement_rate,
        reach = EXCLUDED.reach,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to record autonomous learning data
CREATE OR REPLACE FUNCTION record_autonomous_learning(
    p_content_hash VARCHAR,
    p_content_text TEXT,
    p_performance_score DECIMAL DEFAULT 0,
    p_learning_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO ai_learning_data (
        content_hash, content_text, performance_score, learning_metadata
    ) VALUES (
        p_content_hash, p_content_text, p_performance_score, p_learning_metadata
    ) ON CONFLICT (content_hash) DO UPDATE SET
        performance_score = EXCLUDED.performance_score,
        learning_metadata = EXCLUDED.learning_metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- PHASE 7: CREATE TRIGGERS FOR AUTO-UPDATES
-- ===================================================================

-- Create triggers for timestamp updates
DROP TRIGGER IF EXISTS update_tweet_content_updated_at ON tweet_content;
CREATE TRIGGER update_tweet_content_updated_at
    BEFORE UPDATE ON tweet_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tweet_metadata_updated_at ON tweet_metadata;
CREATE TRIGGER update_tweet_metadata_updated_at
    BEFORE UPDATE ON tweet_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_posted_tweets_updated_at ON posted_tweets;
CREATE TRIGGER update_posted_tweets_updated_at
    BEFORE UPDATE ON posted_tweets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tweet_analytics_updated_at ON tweet_analytics;
CREATE TRIGGER update_tweet_analytics_updated_at
    BEFORE UPDATE ON tweet_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- PHASE 8: SET UP ROW LEVEL SECURITY (FIXED SYNTAX)
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE posted_tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_patterns ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service role (FIXED SYNTAX)
CREATE POLICY IF NOT EXISTS "Service role can do everything on tweets"
ON tweets FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on tweet_content"
ON tweet_content FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on tweet_metadata"
ON tweet_metadata FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on posted_tweets"
ON posted_tweets FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on tweet_analytics"
ON tweet_analytics FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on content_performance"
ON content_performance FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can do everything on viral_patterns"
ON viral_patterns FOR ALL 
USING (true) 
WITH CHECK (true);

-- ===================================================================
-- PHASE 9: INSERT INITIAL DATA FOR TESTING
-- ===================================================================

-- Insert test data to verify functionality
SELECT safe_insert_tweet(
    '🤖 Complete database schema successfully deployed - all systems operational!',
    'system_test',
    '{"test": true, "complete_schema": true, "version": "2.0"}'
);

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Verify all tables exist and are populated
SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'tweets', 'tweet_content', 'tweet_metadata', 'posted_tweets', 
    'tweet_analytics', 'engagement_data', 'ai_learning_data',
    'viral_content_performance', 'learning_insights', 'follower_tracking',
    'content_performance', 'viral_patterns', 'autonomous_decisions',
    'autonomous_growth_strategies', 'system_performance_metrics',
    'system_health_metrics', 'follower_growth_predictions'
)
ORDER BY tablename; 