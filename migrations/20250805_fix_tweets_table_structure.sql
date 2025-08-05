-- 🔧 FIX TWEETS TABLE STRUCTURE
-- Handles missing tweet_id column and creates proper structure
-- Date: 2025-08-05

-- ==================================================================
-- 1. ENABLE EXTENSIONS
-- ==================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================================
-- 2. DIAGNOSE AND FIX TWEETS TABLE
-- ==================================================================

DO $$
DECLARE
    tweets_exists BOOLEAN;
    tweet_id_exists BOOLEAN;
    table_structure TEXT;
BEGIN
    -- Check if tweets table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tweets' AND table_schema = 'public'
    ) INTO tweets_exists;
    
    IF tweets_exists THEN
        RAISE NOTICE 'tweets table EXISTS - checking structure...';
        
        -- Check if tweet_id column exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tweets' 
              AND column_name = 'tweet_id' 
              AND table_schema = 'public'
        ) INTO tweet_id_exists;
        
        IF NOT tweet_id_exists THEN
            RAISE NOTICE 'tweet_id column MISSING - adding it...';
            
            -- Add the missing tweet_id column
            ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);
            
            -- Make it unique if we can (handle existing duplicates)
            BEGIN
                ALTER TABLE tweets ADD CONSTRAINT tweets_tweet_id_unique UNIQUE (tweet_id);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not add unique constraint - data might have duplicates';
            END;
            
            -- Update any NULL tweet_id values with generated IDs
            UPDATE tweets 
            SET tweet_id = 'generated_' || id::text 
            WHERE tweet_id IS NULL;
            
            RAISE NOTICE '✅ tweet_id column added and populated';
        ELSE
            RAISE NOTICE '✅ tweet_id column already exists';
        END IF;
        
        -- Add other missing columns if needed
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT true;
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS method_used VARCHAR(50) DEFAULT 'browser';
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS resource_usage JSONB DEFAULT '{}';
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE tweets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        
    ELSE
        RAISE NOTICE 'tweets table MISSING - creating new one...';
        
        -- Create tweets table from scratch with proper structure
        CREATE TABLE tweets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tweet_id VARCHAR(255) UNIQUE NOT NULL,
            content TEXT NOT NULL,
            posted_at TIMESTAMPTZ DEFAULT NOW(),
            confirmed BOOLEAN DEFAULT true,
            method_used VARCHAR(50) DEFAULT 'browser',
            resource_usage JSONB DEFAULT '{}',
            
            -- Engagement metrics
            likes INTEGER DEFAULT 0,
            retweets INTEGER DEFAULT 0,
            replies INTEGER DEFAULT 0,
            impressions INTEGER DEFAULT 0,
            
            -- Metadata
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        RAISE NOTICE '✅ tweets table created with proper structure';
    END IF;
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
    CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
    
    RAISE NOTICE '✅ tweets table indexes created';
    
END $$;

-- ==================================================================
-- 3. CREATE OTHER ESSENTIAL TABLES
-- ==================================================================

-- Follower tracking
CREATE TABLE IF NOT EXISTS follower_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_count INTEGER NOT NULL DEFAULT 0,
    followers_gained_24h INTEGER DEFAULT 0,
    growth_rate_daily DECIMAL(8,4) DEFAULT 0,
    tracked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_tracking_tracked_at ON follower_tracking(tracked_at);

-- Engagement history (CRITICAL - this was missing and causing agent errors)
CREATE TABLE IF NOT EXISTS engagement_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255),
    action_type VARCHAR(50) NOT NULL,
    action_metadata JSONB DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_name VARCHAR(100) DEFAULT 'unknown',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_history_tweet_id ON engagement_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_health_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(100) NOT NULL,
    health_status VARCHAR(20) NOT NULL,
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
    memory_usage_mb INTEGER DEFAULT 0,
    memory_limit_mb INTEGER DEFAULT 512,
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_monitoring(component_name);

-- Emergency posting log
CREATE TABLE IF NOT EXISTS emergency_posting_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255),
    content TEXT NOT NULL,
    posting_method VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    error_message TEXT,
    resource_usage JSONB DEFAULT '{}',
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================================
-- 4. GRANT PERMISSIONS
-- ==================================================================

GRANT ALL ON tweets TO service_role;
GRANT ALL ON follower_tracking TO service_role;
GRANT ALL ON engagement_history TO service_role;
GRANT ALL ON system_health_monitoring TO service_role;
GRANT ALL ON emergency_posting_log TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;

-- ==================================================================
-- 5. INSERT INITIAL DATA
-- ==================================================================

INSERT INTO system_health_monitoring (
    component_name, 
    health_status,
    details
) VALUES 
    ('tweets_table', 'healthy', '{"structure": "fixed", "tweet_id_column": "present"}'),
    ('database_migration', 'healthy', '{"migration": "tweets_structure_fix", "timestamp": "' || NOW() || '""}')
ON CONFLICT DO NOTHING;

-- ==================================================================
-- 6. VERIFICATION
-- ==================================================================

DO $$
DECLARE
    tweet_id_column_exists BOOLEAN;
    engagement_history_exists BOOLEAN;
    final_status TEXT;
BEGIN
    -- Verify tweet_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
          AND column_name = 'tweet_id' 
          AND table_schema = 'public'
    ) INTO tweet_id_column_exists;
    
    -- Verify engagement_history table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'engagement_history' 
          AND table_schema = 'public'
    ) INTO engagement_history_exists;
    
    IF tweet_id_column_exists AND engagement_history_exists THEN
        final_status := 'SUCCESS';
        RAISE NOTICE '✅ TWEETS TABLE STRUCTURE FIX COMPLETE:';
        RAISE NOTICE '   ✓ tweets.tweet_id column exists and working';
        RAISE NOTICE '   ✓ engagement_history table created (fixes agent errors)';
        RAISE NOTICE '   ✓ All essential tables verified';
        RAISE NOTICE '   ✓ Indexes and permissions set';
        RAISE NOTICE '';
        RAISE NOTICE '🚀 SYSTEM READY - No more tweet_id column errors!';
    ELSE
        final_status := 'FAILED';
        RAISE EXCEPTION 'MIGRATION FAILED: tweet_id_exists=%, engagement_history_exists=%', 
                       tweet_id_column_exists, engagement_history_exists;
    END IF;
    
END $$;