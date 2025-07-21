-- 🔧 COMPREHENSIVE DATABASE TWEET SAVING FIX
-- Fixes all identified issues to ensure 100% reliable autonomous operation

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- PHASE 1: FIX EXISTING TWEETS TABLE SCHEMA
-- ===================================================================

-- Add missing metadata column to tweets table
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add missing columns for comprehensive tweet storage
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS tweet_type VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS engagement_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_score DECIMAL(5,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,3) DEFAULT 0;

-- Ensure tweets table has proper indexes
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_twitter_id ON tweets(twitter_id);
CREATE INDEX IF NOT EXISTS idx_tweets_type ON tweets(tweet_type);
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);

-- ===================================================================
-- PHASE 2: CREATE MISSING CRITICAL TABLES
-- ===================================================================

-- Create tweet_content table for content storage
CREATE TABLE IF NOT EXISTS tweet_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    tweet_type VARCHAR(50) DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create tweet_metadata table for metadata storage
CREATE TABLE IF NOT EXISTS tweet_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    engagement_metrics JSONB DEFAULT '{}',
    performance_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posted_tweets table for tracking posted tweets
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

-- Create tweet_analytics table for performance tracking
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
-- PHASE 3: CREATE INDEXES FOR OPTIMAL PERFORMANCE
-- ===================================================================

-- tweet_content indexes
CREATE INDEX IF NOT EXISTS idx_tweet_content_tweet_id ON tweet_content(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_content_hash ON tweet_content(content_hash);
CREATE INDEX IF NOT EXISTS idx_tweet_content_created_at ON tweet_content(created_at DESC);

-- tweet_metadata indexes
CREATE INDEX IF NOT EXISTS idx_tweet_metadata_tweet_id ON tweet_metadata(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_metadata_created_at ON tweet_metadata(created_at DESC);

-- posted_tweets indexes
CREATE INDEX IF NOT EXISTS idx_posted_tweets_tweet_id ON posted_tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_twitter_id ON posted_tweets(twitter_id);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_posted_at ON posted_tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_tweets_status ON posted_tweets(status);

-- tweet_analytics indexes
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_viral_score ON tweet_analytics(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_created_at ON tweet_analytics(created_at DESC);

-- ===================================================================
-- PHASE 4: CREATE AUTONOMOUS LEARNING TABLES
-- ===================================================================

-- Create content_performance table for learning
CREATE TABLE IF NOT EXISTS content_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    engagement_rate DECIMAL(5,3) DEFAULT 0,
    viral_potential DECIMAL(5,3) DEFAULT 0,
    follower_growth INTEGER DEFAULT 0,
    performance_score DECIMAL(5,3) DEFAULT 0,
    learning_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create viral_patterns table for pattern recognition
CREATE TABLE IF NOT EXISTS viral_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type VARCHAR(100) NOT NULL,
    pattern_data JSONB NOT NULL,
    success_rate DECIMAL(5,3) DEFAULT 0,
    engagement_boost DECIMAL(5,3) DEFAULT 0,
    follower_conversion DECIMAL(5,3) DEFAULT 0,
    confidence_score DECIMAL(5,3) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- PHASE 5: CREATE TRIGGER FUNCTIONS FOR AUTO-UPDATES
-- ===================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating timestamps
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

DROP TRIGGER IF EXISTS update_content_performance_updated_at ON content_performance;
CREATE TRIGGER update_content_performance_updated_at
    BEFORE UPDATE ON content_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_viral_patterns_updated_at ON viral_patterns;
CREATE TRIGGER update_viral_patterns_updated_at
    BEFORE UPDATE ON viral_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- PHASE 6: CREATE AUTONOMOUS SYSTEM FUNCTIONS
-- ===================================================================

-- Function to safely insert tweets with conflict resolution
CREATE OR REPLACE FUNCTION safe_insert_tweet(
    p_content TEXT,
    p_tweet_type VARCHAR DEFAULT 'standard',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_tweet_id UUID;
    v_content_hash VARCHAR(64);
BEGIN
    -- Generate content hash for deduplication
    v_content_hash := encode(digest(p_content, 'sha256'), 'hex');
    
    -- Insert tweet with conflict handling
    INSERT INTO tweets (content, tweet_type, metadata, created_at)
    VALUES (p_content, p_tweet_type, p_metadata, NOW())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_tweet_id;
    
    -- If no conflict, also insert into tweet_content
    IF v_tweet_id IS NOT NULL THEN
        INSERT INTO tweet_content (tweet_id, content, content_hash, tweet_type, metadata)
        VALUES (v_tweet_id::text, p_content, v_content_hash, p_tweet_type, p_metadata)
        ON CONFLICT (content_hash) DO NOTHING;
    END IF;
    
    RETURN v_tweet_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record tweet performance
CREATE OR REPLACE FUNCTION record_tweet_performance(
    p_tweet_id VARCHAR,
    p_likes INTEGER DEFAULT 0,
    p_retweets INTEGER DEFAULT 0,
    p_replies INTEGER DEFAULT 0,
    p_impressions INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    v_engagement_rate DECIMAL(5,3);
BEGIN
    -- Calculate engagement rate
    IF p_impressions > 0 THEN
        v_engagement_rate := (p_likes + p_retweets + p_replies)::DECIMAL / p_impressions::DECIMAL;
    ELSE
        v_engagement_rate := 0;
    END IF;
    
    -- Insert or update analytics
    INSERT INTO tweet_analytics (
        tweet_id, likes, retweets, replies, impressions, engagement_rate
    ) VALUES (
        p_tweet_id, p_likes, p_retweets, p_replies, p_impressions, v_engagement_rate
    ) ON CONFLICT (tweet_id) DO UPDATE SET
        likes = EXCLUDED.likes,
        retweets = EXCLUDED.retweets,
        replies = EXCLUDED.replies,
        impressions = EXCLUDED.impressions,
        engagement_rate = EXCLUDED.engagement_rate,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- PHASE 7: SET UP ROW LEVEL SECURITY (RLS)
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE posted_tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_patterns ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service role
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
-- PHASE 8: INSERT SAMPLE DATA FOR TESTING
-- ===================================================================

-- Insert sample tweet for testing
INSERT INTO tweets (content, tweet_type, metadata) 
VALUES (
    '🤖 Autonomous system test - database optimized for 100% reliability!',
    'system_test',
    '{"test": true, "autonomous": true, "version": "1.0"}'
) ON CONFLICT DO NOTHING;

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Verify all tables exist and are accessible
SELECT 'tweets' as table_name, COUNT(*) as row_count FROM tweets
UNION ALL
SELECT 'tweet_content' as table_name, COUNT(*) as row_count FROM tweet_content
UNION ALL
SELECT 'tweet_metadata' as table_name, COUNT(*) as row_count FROM tweet_metadata
UNION ALL
SELECT 'posted_tweets' as table_name, COUNT(*) as row_count FROM posted_tweets
UNION ALL
SELECT 'tweet_analytics' as table_name, COUNT(*) as row_count FROM tweet_analytics
UNION ALL
SELECT 'engagement_data' as table_name, COUNT(*) as row_count FROM engagement_data
UNION ALL
SELECT 'content_performance' as table_name, COUNT(*) as row_count FROM content_performance
UNION ALL
SELECT 'viral_patterns' as table_name, COUNT(*) as row_count FROM viral_patterns;

-- Test the safe_insert_tweet function
SELECT safe_insert_tweet(
    '🧪 Testing autonomous tweet insertion system - ' || NOW()::text,
    'test',
    '{"test": true, "function_test": true}'
) as test_tweet_id; 