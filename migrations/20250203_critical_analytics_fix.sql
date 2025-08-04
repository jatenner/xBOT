-- 🔧 CRITICAL ANALYTICS SYSTEM FIX
-- Resolves schema mismatches causing analytics upsert failures
-- Date: 2025-02-03

-- ==================================================================
-- 1. FIX TWEET_ID TYPE CONSISTENCY (VARCHAR vs BIGINT conflict)
-- ==================================================================

-- First fix the tweets table tweet_id type
DO $$ 
BEGIN
    -- Check if tweet_id is currently integer/bigint type
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name='tweets' AND column_name='tweet_id') IN ('integer', 'bigint') THEN
        
        -- Create backup before modification
        CREATE TABLE IF NOT EXISTS tweets_backup_20250203 AS 
        SELECT * FROM tweets;
        
        -- Convert tweet_id from integer to VARCHAR
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255) USING tweet_id::VARCHAR;
        
        -- Update any constraints or indexes
        DROP INDEX IF EXISTS tweets_tweet_id_key;
        CREATE UNIQUE INDEX IF NOT EXISTS tweets_tweet_id_unique ON tweets(tweet_id);
        
        RAISE NOTICE 'SUCCESS: tweets.tweet_id converted to VARCHAR(255)';
    ELSE
        RAISE NOTICE 'INFO: tweets.tweet_id is already VARCHAR - no changes needed';
    END IF;
END $$;

-- ==================================================================
-- 2. CREATE UNIFIED TWEET_ANALYTICS TABLE
-- ==================================================================

-- Drop conflicting tables
DROP TABLE IF EXISTS tweet_analytics CASCADE;
DROP TABLE IF EXISTS tweet_metrics CASCADE;

-- Create unified analytics table with all required columns
CREATE TABLE tweet_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    
    -- Snapshot tracking (REQUIRED - was missing causing upserts to fail)
    snapshot_interval VARCHAR(20) NOT NULL DEFAULT 'initial',
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Core Engagement Data (from Twitter scraping)
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    bookmarks INTEGER DEFAULT 0,
    
    -- Reach & Discovery Metrics (from Twitter API or estimated)
    impressions INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    detail_expands INTEGER DEFAULT 0,
    url_clicks INTEGER DEFAULT 0,
    media_views INTEGER DEFAULT 0,
    
    -- Calculated Performance Metrics
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    profile_visit_rate DECIMAL(8,4) DEFAULT 0,
    click_through_rate DECIMAL(8,4) DEFAULT 0,
    viral_score INTEGER DEFAULT 0,
    
    -- Follower Impact (most critical for learning)
    new_followers_attributed INTEGER DEFAULT 0,
    follower_conversion_rate DECIMAL(8,4) DEFAULT 0,
    
    -- Collection Metadata
    collected_via VARCHAR(50) DEFAULT 'browser', -- 'api', 'browser', 'estimated'
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Content Context (for learning algorithms)
    content TEXT,
    content_type VARCHAR(50),
    hook_type VARCHAR(50),
    format_used VARCHAR(50),
    
    -- Unique constraint per tweet per snapshot interval
    UNIQUE(tweet_id, snapshot_interval)
);

-- ==================================================================
-- 3. CREATE PERFORMANCE INDEXES
-- ==================================================================

CREATE INDEX idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX idx_tweet_analytics_snapshot_time ON tweet_analytics(snapshot_time);
CREATE INDEX idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate);
CREATE INDEX idx_tweet_analytics_viral_score ON tweet_analytics(viral_score);
CREATE INDEX idx_tweet_analytics_collected_at ON tweet_analytics(collected_at);

-- ==================================================================
-- 4. CREATE FOLLOWER TRACKING TABLE (missing impression->follower attribution)
-- ==================================================================

CREATE TABLE IF NOT EXISTS follower_attribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    follower_count_before INTEGER NOT NULL,
    follower_count_after INTEGER NOT NULL,
    new_followers INTEGER GENERATED ALWAYS AS (follower_count_after - follower_count_before) STORED,
    measurement_window_hours INTEGER DEFAULT 24,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tweet_id, measurement_window_hours)
);

CREATE INDEX idx_follower_attribution_tweet_id ON follower_attribution(tweet_id);
CREATE INDEX idx_follower_attribution_measured_at ON follower_attribution(measured_at);

-- ==================================================================
-- 5. CREATE IMPRESSIONS TRACKING TABLE (dedicated for high-frequency updates)
-- ==================================================================

CREATE TABLE IF NOT EXISTS tweet_impressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    impressions INTEGER NOT NULL,
    views INTEGER DEFAULT 0, -- Twitter "views" metric
    reach INTEGER DEFAULT 0, -- Unique accounts reached
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    collection_method VARCHAR(20) DEFAULT 'browser' -- 'api', 'browser', 'estimated'
);

CREATE INDEX idx_tweet_impressions_tweet_id ON tweet_impressions(tweet_id);
CREATE INDEX idx_tweet_impressions_collected_at ON tweet_impressions(collected_at);

-- ==================================================================
-- 6. GRANT PERMISSIONS
-- ==================================================================

-- Grant access to service role (used by realEngagementCollector)
GRANT ALL ON tweet_analytics TO service_role;
GRANT ALL ON follower_attribution TO service_role;
GRANT ALL ON tweet_impressions TO service_role;

-- Grant usage on UUID extension
GRANT USAGE ON SCHEMA public TO service_role;

-- ==================================================================
-- 7. VERIFICATION QUERIES
-- ==================================================================

-- Verify table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('tweet_analytics', 'tweets', 'follower_attribution', 'tweet_impressions')
ORDER BY table_name, ordinal_position;

-- Test insert to ensure schema works
INSERT INTO tweet_analytics (
    tweet_id, 
    snapshot_interval, 
    likes, 
    retweets, 
    replies, 
    impressions,
    collected_via
) VALUES (
    'test_' || extract(epoch from now()),
    'initial',
    5,
    1,
    2,
    100,
    'test'
) ON CONFLICT (tweet_id, snapshot_interval) DO UPDATE SET
    likes = EXCLUDED.likes,
    retweets = EXCLUDED.retweets,
    replies = EXCLUDED.replies,
    impressions = EXCLUDED.impressions,
    updated_at = NOW();

-- Clean up test data
DELETE FROM tweet_analytics WHERE tweet_id LIKE 'test_%';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ CRITICAL ANALYTICS FIX COMPLETE:';
    RAISE NOTICE '   - tweet_analytics table recreated with all required columns';
    RAISE NOTICE '   - tweet_id type consistency fixed (VARCHAR(255))';
    RAISE NOTICE '   - snapshot_interval column added (was causing upsert failures)';
    RAISE NOTICE '   - Impressions tracking table created';
    RAISE NOTICE '   - Follower attribution tracking added';
    RAISE NOTICE '   - Performance indexes created';
    RAISE NOTICE '   - Permissions granted to service_role';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for realEngagementCollector to start working properly!';
END $$;