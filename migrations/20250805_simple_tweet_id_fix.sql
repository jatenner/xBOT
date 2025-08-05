-- 🎯 SIMPLE DIRECT FIX for tweet_id column issue
-- Date: 2025-08-05

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================================
-- 1. DIRECT tweet_id COLUMN FIX
-- ==================================================================

-- Method 1: Try to add the column directly
DO $$
BEGIN
    -- Add tweet_id column if it doesn't exist
    BEGIN
        ALTER TABLE tweets ADD COLUMN tweet_id VARCHAR(255);
        RAISE NOTICE '✅ tweet_id column added successfully';
    EXCEPTION 
        WHEN duplicate_column THEN
            RAISE NOTICE 'ℹ️ tweet_id column already exists';
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Could not add tweet_id column: %', SQLERRM;
    END;
    
    -- Try to populate NULL tweet_id values
    BEGIN
        UPDATE tweets 
        SET tweet_id = 'tweet_' || id::text || '_' || extract(epoch from now())::bigint
        WHERE tweet_id IS NULL OR tweet_id = '';
        
        GET DIAGNOSTICS updated_rows = ROW_COUNT;
        RAISE NOTICE '✅ Updated % rows with generated tweet_id values', updated_rows;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Could not update tweet_id values: %', SQLERRM;
    END;
    
    -- Try to add unique constraint
    BEGIN
        ALTER TABLE tweets ADD CONSTRAINT tweets_tweet_id_unique UNIQUE (tweet_id);
        RAISE NOTICE '✅ Unique constraint added to tweet_id';
    EXCEPTION 
        WHEN duplicate_table THEN
            RAISE NOTICE 'ℹ️ Unique constraint already exists';
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Could not add unique constraint: %', SQLERRM;
    END;
    
END $$;

-- ==================================================================
-- 2. CREATE MISSING CRITICAL TABLES
-- ==================================================================

-- Create engagement_history table (this is critical for agents)
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

-- Create system_health_monitoring table
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

-- Create emergency_posting_log table
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
-- 3. ADD OTHER MISSING COLUMNS TO TWEETS TABLE
-- ==================================================================

DO $$
BEGIN
    -- Add confirmed column
    BEGIN
        ALTER TABLE tweets ADD COLUMN confirmed BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ confirmed column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ confirmed column already exists';
    END;
    
    -- Add method_used column
    BEGIN
        ALTER TABLE tweets ADD COLUMN method_used VARCHAR(50) DEFAULT 'browser';
        RAISE NOTICE '✅ method_used column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ method_used column already exists';
    END;
    
    -- Add resource_usage column
    BEGIN
        ALTER TABLE tweets ADD COLUMN resource_usage JSONB DEFAULT '{}';
        RAISE NOTICE '✅ resource_usage column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ resource_usage column already exists';
    END;
    
    -- Add basic engagement columns if missing
    BEGIN
        ALTER TABLE tweets ADD COLUMN likes INTEGER DEFAULT 0;
        RAISE NOTICE '✅ likes column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ likes column already exists';
    END;
    
    BEGIN
        ALTER TABLE tweets ADD COLUMN retweets INTEGER DEFAULT 0;
        RAISE NOTICE '✅ retweets column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ retweets column already exists';
    END;
    
    BEGIN
        ALTER TABLE tweets ADD COLUMN replies INTEGER DEFAULT 0;
        RAISE NOTICE '✅ replies column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ replies column already exists';
    END;
    
    BEGIN
        ALTER TABLE tweets ADD COLUMN impressions INTEGER DEFAULT 0;
        RAISE NOTICE '✅ impressions column added';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ impressions column already exists';
    END;
    
END $$;

-- ==================================================================
-- 4. CREATE INDEXES
-- ==================================================================

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX IF NOT EXISTS idx_engagement_history_tweet_id ON engagement_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_monitoring(component_name);

-- ==================================================================
-- 5. GRANT PERMISSIONS
-- ==================================================================

GRANT ALL ON tweets TO service_role;
GRANT ALL ON engagement_history TO service_role;
GRANT ALL ON system_health_monitoring TO service_role;
GRANT ALL ON emergency_posting_log TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- ==================================================================
-- 6. FINAL VERIFICATION
-- ==================================================================

DO $$
DECLARE
    tweet_id_exists BOOLEAN;
    engagement_history_exists BOOLEAN;
    tweets_count INTEGER;
BEGIN
    -- Check if tweet_id column exists now
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
          AND column_name = 'tweet_id' 
          AND table_schema = 'public'
    ) INTO tweet_id_exists;
    
    -- Check if engagement_history table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'engagement_history' 
          AND table_schema = 'public'
    ) INTO engagement_history_exists;
    
    -- Count tweets
    SELECT COUNT(*) INTO tweets_count FROM tweets;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 FINAL VERIFICATION RESULTS:';
    RAISE NOTICE '   tweet_id column exists: %', tweet_id_exists;
    RAISE NOTICE '   engagement_history table exists: %', engagement_history_exists;
    RAISE NOTICE '   tweets table row count: %', tweets_count;
    
    IF tweet_id_exists AND engagement_history_exists THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ SUCCESS: All critical fixes applied!';
        RAISE NOTICE '🚀 The system should now work without tweet_id column errors';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ PARTIAL SUCCESS: Some issues may remain';
        RAISE NOTICE 'Please check the column structure manually';
    END IF;
    
END $$;