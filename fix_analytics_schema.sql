-- Fix tweet_analytics table schema
-- Run this in Supabase SQL Editor

-- 1. Check if tweet_analytics table exists and its structure
DO $$
BEGIN
    -- Drop the problematic table if it exists with wrong schema
    DROP TABLE IF EXISTS tweet_analytics;
    
    -- Create the correct tweet_analytics table
    CREATE TABLE tweet_analytics (
        id BIGSERIAL PRIMARY KEY,
        tweet_id TEXT NOT NULL,
        snapshot_interval TEXT DEFAULT 'initial',
        snapshot_time TIMESTAMPTZ DEFAULT NOW(),
        
        -- Core engagement metrics
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        quotes INTEGER DEFAULT 0,
        bookmarks INTEGER DEFAULT 0,
        
        -- Discovery metrics  
        impressions INTEGER DEFAULT 0,
        profile_visits INTEGER DEFAULT 0,
        detail_expands INTEGER DEFAULT 0,
        url_clicks INTEGER DEFAULT 0,
        media_views INTEGER DEFAULT 0,
        
        -- Follower impact
        new_followers_attributed INTEGER DEFAULT 0,
        
        -- Data source tracking
        collected_via TEXT DEFAULT 'api',
        
        -- Content analysis (this was the missing column causing errors)
        content TEXT,
        content_type TEXT,
        hook_type TEXT,
        format_used TEXT,
        
        -- Performance scoring
        engagement_score DECIMAL(10,4) DEFAULT 0,
        viral_score INTEGER DEFAULT 0,
        
        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create indexes for performance
    CREATE INDEX idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
    CREATE INDEX idx_tweet_analytics_snapshot_time ON tweet_analytics(snapshot_time);
    CREATE INDEX idx_tweet_analytics_engagement_score ON tweet_analytics(engagement_score);
    
    -- Create unique constraint to prevent duplicate snapshots
    CREATE UNIQUE INDEX idx_tweet_analytics_unique_snapshot 
    ON tweet_analytics(tweet_id, snapshot_interval);
    
    RAISE NOTICE 'tweet_analytics table created successfully with all required columns';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating tweet_analytics table: %', SQLERRM;
END $$;

-- 2. Ensure tweets table exists with proper structure for foreign keys
DO $$
BEGIN
    -- Create tweets table if it doesn't exist
    CREATE TABLE IF NOT EXISTS tweets (
        id BIGSERIAL PRIMARY KEY,
        tweet_id TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        posted_at TIMESTAMPTZ DEFAULT NOW(),
        
        -- Engagement metrics
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        
        -- Content metadata
        format_used TEXT,
        hook_type TEXT,
        is_thread BOOLEAN DEFAULT FALSE,
        thread_position INTEGER,
        
        -- Performance tracking
        engagement_score DECIMAL(10,4) DEFAULT 0,
        
        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
    
    RAISE NOTICE 'tweets table verified/created successfully';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error with tweets table: %', SQLERRM;
END $$;

-- 3. Test the schema by inserting sample data
DO $$
BEGIN
    -- Test insert into tweet_analytics
    INSERT INTO tweet_analytics (
        tweet_id, 
        content, 
        likes, 
        impressions, 
        content_type
    ) VALUES (
        'test_tweet_123',
        'Test tweet content',
        5,
        100,
        'health_tip'
    ) ON CONFLICT (tweet_id, snapshot_interval) DO NOTHING;
    
    -- Clean up test data
    DELETE FROM tweet_analytics WHERE tweet_id = 'test_tweet_123';
    
    RAISE NOTICE 'Schema test successful - analytics collection should now work';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Schema test failed: %', SQLERRM;
END $$;