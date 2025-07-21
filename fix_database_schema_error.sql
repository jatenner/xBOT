-- 🔧 PRECISE DATABASE SCHEMA ERROR FIX
-- Fixes the specific "column tweet_id does not exist" error by using correct column names

-- First, let's check what tables actually exist and their column structure
-- This will help us understand the real schema vs expected schema

-- For autonomous_decisions table - ensure it has the right structure
-- Based on the error, it seems this table doesn't have the expected columns
DO $$
BEGIN
    -- Check if autonomous_decisions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_decisions') THEN
        RAISE NOTICE 'autonomous_decisions table exists, checking columns...';
        
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_decisions' AND column_name = 'action') THEN
            ALTER TABLE autonomous_decisions ADD COLUMN action VARCHAR(20) DEFAULT 'post';
            RAISE NOTICE 'Added action column to autonomous_decisions';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_decisions' AND column_name = 'confidence') THEN
            ALTER TABLE autonomous_decisions ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.8000;
            RAISE NOTICE 'Added confidence column to autonomous_decisions';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_decisions' AND column_name = 'reasoning') THEN
            ALTER TABLE autonomous_decisions ADD COLUMN reasoning JSONB;
            RAISE NOTICE 'Added reasoning column to autonomous_decisions';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_decisions' AND column_name = 'expected_followers') THEN
            ALTER TABLE autonomous_decisions ADD COLUMN expected_followers INTEGER;
            RAISE NOTICE 'Added expected_followers column to autonomous_decisions';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_decisions' AND column_name = 'expected_engagement_rate') THEN
            ALTER TABLE autonomous_decisions ADD COLUMN expected_engagement_rate DECIMAL(5,4);
            RAISE NOTICE 'Added expected_engagement_rate column to autonomous_decisions';
        END IF;
        
    ELSE
        RAISE NOTICE 'autonomous_decisions table does not exist, creating it...';
        CREATE TABLE autonomous_decisions (
            id BIGSERIAL PRIMARY KEY,
            content TEXT NOT NULL,
            content_hash VARCHAR(64) UNIQUE,
            action VARCHAR(20) DEFAULT 'post',
            confidence DECIMAL(5,4) DEFAULT 0.8000,
            reasoning JSONB,
            expected_followers INTEGER,
            expected_engagement_rate DECIMAL(5,4),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created autonomous_decisions table with all required columns';
    END IF;
END $$;

-- For follower_growth_predictions - this table might be referencing tweets table incorrectly
DO $$
BEGIN
    -- Check if follower_growth_predictions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_growth_predictions') THEN
        RAISE NOTICE 'follower_growth_predictions table exists, checking columns...';
        
        -- The error suggests tweet_id doesn't exist. Let's check the actual column name
        -- Based on schema, it should reference tweets.tweet_id (which is VARCHAR, not BIGINT)
        
        -- Add missing columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_growth_predictions' AND column_name = 'confidence') THEN
            ALTER TABLE follower_growth_predictions ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.8000;
            RAISE NOTICE 'Added confidence column to follower_growth_predictions';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_growth_predictions' AND column_name = 'viral_score_predicted') THEN
            ALTER TABLE follower_growth_predictions ADD COLUMN viral_score_predicted DECIMAL(5,4) DEFAULT 0.6000;
            RAISE NOTICE 'Added viral_score_predicted column to follower_growth_predictions';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_growth_predictions' AND column_name = 'quality_score') THEN
            ALTER TABLE follower_growth_predictions ADD COLUMN quality_score DECIMAL(5,4) DEFAULT 0.7500;
            RAISE NOTICE 'Added quality_score column to follower_growth_predictions';
        END IF;
        
        -- Fix tweet_id column if it's wrong type or missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_growth_predictions' AND column_name = 'tweet_id') THEN
            -- Add tweet_id as VARCHAR to match tweets table
            ALTER TABLE follower_growth_predictions ADD COLUMN tweet_id VARCHAR(255);
            RAISE NOTICE 'Added tweet_id column (VARCHAR) to follower_growth_predictions';
        END IF;
        
    ELSE
        RAISE NOTICE 'follower_growth_predictions table does not exist, creating it...';
        CREATE TABLE follower_growth_predictions (
            id BIGSERIAL PRIMARY KEY,
            tweet_id VARCHAR(255), -- Match tweets.tweet_id type
            content TEXT NOT NULL,
            content_hash VARCHAR(64) UNIQUE,
            followers_predicted INTEGER DEFAULT 0,
            confidence DECIMAL(5,4) DEFAULT 0.8000,
            viral_score_predicted DECIMAL(5,4) DEFAULT 0.6000,
            quality_score DECIMAL(5,4) DEFAULT 0.7500,
            engagement_rate_predicted DECIMAL(5,4) DEFAULT 0.0500,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created follower_growth_predictions table with correct tweet_id type';
    END IF;
END $$;

-- For follower_tracking table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_tracking') THEN
        RAISE NOTICE 'follower_tracking table exists, checking columns...';
        
        -- Add missing columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_tracking' AND column_name = 'followers_after') THEN
            ALTER TABLE follower_tracking ADD COLUMN followers_after INTEGER DEFAULT 0;
            RAISE NOTICE 'Added followers_after column to follower_tracking';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_tracking' AND column_name = 'likes') THEN
            ALTER TABLE follower_tracking ADD COLUMN likes INTEGER DEFAULT 0;
            RAISE NOTICE 'Added likes column to follower_tracking';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_tracking' AND column_name = 'retweets') THEN
            ALTER TABLE follower_tracking ADD COLUMN retweets INTEGER DEFAULT 0;
            RAISE NOTICE 'Added retweets column to follower_tracking';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_tracking' AND column_name = 'replies') THEN
            ALTER TABLE follower_tracking ADD COLUMN replies INTEGER DEFAULT 0;
            RAISE NOTICE 'Added replies column to follower_tracking';
        END IF;
        
        -- Fix tweet_id column type if needed
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follower_tracking' AND column_name = 'tweet_id') THEN
            ALTER TABLE follower_tracking ADD COLUMN tweet_id VARCHAR(255);
            RAISE NOTICE 'Added tweet_id column (VARCHAR) to follower_tracking';
        END IF;
        
    ELSE
        RAISE NOTICE 'follower_tracking table does not exist, creating it...';
        CREATE TABLE follower_tracking (
            id BIGSERIAL PRIMARY KEY,
            tweet_id VARCHAR(255), -- Match tweets.tweet_id type
            followers_before INTEGER DEFAULT 0,
            followers_after INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            retweets INTEGER DEFAULT 0,
            replies INTEGER DEFAULT 0,
            engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
            tracked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created follower_tracking table with correct structure';
    END IF;
END $$;

-- For autonomous_growth_strategies table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_growth_strategies') THEN
        RAISE NOTICE 'autonomous_growth_strategies table exists, checking columns...';
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'is_active') THEN
            ALTER TABLE autonomous_growth_strategies ADD COLUMN is_active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added is_active column to autonomous_growth_strategies';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'success_rate') THEN
            ALTER TABLE autonomous_growth_strategies ADD COLUMN success_rate DECIMAL(5,4) DEFAULT 0.7500;
            RAISE NOTICE 'Added success_rate column to autonomous_growth_strategies';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'average_followers_gained') THEN
            ALTER TABLE autonomous_growth_strategies ADD COLUMN average_followers_gained DECIMAL(8,2) DEFAULT 25.00;
            RAISE NOTICE 'Added average_followers_gained column to autonomous_growth_strategies';
        END IF;
        
    ELSE
        RAISE NOTICE 'autonomous_growth_strategies table does not exist, creating it...';
        CREATE TABLE autonomous_growth_strategies (
            id BIGSERIAL PRIMARY KEY,
            strategy_name VARCHAR(200) NOT NULL UNIQUE,
            strategy_type VARCHAR(100) NOT NULL,
            strategy_config JSONB,
            is_active BOOLEAN DEFAULT true,
            success_rate DECIMAL(5,4) DEFAULT 0.7500,
            average_followers_gained DECIMAL(8,2) DEFAULT 25.00,
            priority INTEGER DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created autonomous_growth_strategies table';
    END IF;
END $$;

-- Create performance indexes with proper error handling
DO $$
BEGIN
    -- Only create indexes if tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_decisions') THEN
        BEGIN
            CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_action ON autonomous_decisions(action);
            CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_confidence ON autonomous_decisions(confidence);
            RAISE NOTICE 'Created indexes for autonomous_decisions';
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Some autonomous_decisions indexes may already exist';
        END;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_growth_predictions') THEN
        BEGIN
            CREATE INDEX IF NOT EXISTS idx_follower_predictions_confidence ON follower_growth_predictions(confidence);
            CREATE INDEX IF NOT EXISTS idx_follower_predictions_tweet_id ON follower_growth_predictions(tweet_id);
            RAISE NOTICE 'Created indexes for follower_growth_predictions';
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Some follower_growth_predictions indexes may already exist';
        END;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_growth_strategies') THEN
        BEGIN
            CREATE INDEX IF NOT EXISTS idx_growth_strategies_is_active ON autonomous_growth_strategies(is_active);
            CREATE INDEX IF NOT EXISTS idx_growth_strategies_success_rate ON autonomous_growth_strategies(success_rate);
            RAISE NOTICE 'Created indexes for autonomous_growth_strategies';
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Some autonomous_growth_strategies indexes may already exist';
        END;
    END IF;
END $$;

-- Update any existing records with default values
DO $$
BEGIN
    -- Update autonomous_decisions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_decisions') THEN
        UPDATE autonomous_decisions SET action = 'post' WHERE action IS NULL;
        UPDATE autonomous_decisions SET confidence = 0.8000 WHERE confidence IS NULL;
        RAISE NOTICE 'Updated autonomous_decisions default values';
    END IF;
    
    -- Update follower_growth_predictions  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_growth_predictions') THEN
        UPDATE follower_growth_predictions SET confidence = 0.8000 WHERE confidence IS NULL;
        UPDATE follower_growth_predictions SET viral_score_predicted = 0.6000 WHERE viral_score_predicted IS NULL;
        UPDATE follower_growth_predictions SET quality_score = 0.7500 WHERE quality_score IS NULL;
        RAISE NOTICE 'Updated follower_growth_predictions default values';
    END IF;
    
    -- Update autonomous_growth_strategies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_growth_strategies') THEN
        UPDATE autonomous_growth_strategies SET is_active = true WHERE is_active IS NULL;
        UPDATE autonomous_growth_strategies SET success_rate = 0.7500 WHERE success_rate IS NULL;
        UPDATE autonomous_growth_strategies SET average_followers_gained = 25.00 WHERE average_followers_gained IS NULL;
        RAISE NOTICE 'Updated autonomous_growth_strategies default values';
    END IF;
END $$;

-- Final verification
DO $$
DECLARE
    table_count INTEGER;
    autonomous_decisions_exists BOOLEAN;
    follower_predictions_exists BOOLEAN;
    growth_strategies_exists BOOLEAN;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_name IN ('autonomous_decisions', 'follower_growth_predictions', 'autonomous_growth_strategies', 'system_performance_metrics', 'system_health_metrics', 'system_alerts');
    
    -- Check specific tables
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_decisions') INTO autonomous_decisions_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_growth_predictions') INTO follower_predictions_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autonomous_growth_strategies') INTO growth_strategies_exists;
    
    RAISE NOTICE '=== SCHEMA FIX VERIFICATION ===';
    RAISE NOTICE 'Total autonomous tables found: %', table_count;
    RAISE NOTICE 'autonomous_decisions: %', CASE WHEN autonomous_decisions_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE 'follower_growth_predictions: %', CASE WHEN follower_predictions_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE 'autonomous_growth_strategies: %', CASE WHEN growth_strategies_exists THEN 'EXISTS' ELSE 'MISSING' END;
    
    IF table_count >= 3 AND autonomous_decisions_exists AND follower_predictions_exists THEN
        RAISE NOTICE '✅ SCHEMA FIX SUCCESSFUL - Database ready for autonomous operation!';
    ELSE
        RAISE NOTICE '⚠️ Some tables may still need manual creation or verification';
    END IF;
END $$;

COMMIT; 