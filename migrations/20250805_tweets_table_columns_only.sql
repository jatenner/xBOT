-- 🎯 TWEETS TABLE COLUMNS ONLY - Safe column additions
-- This focuses ONLY on adding missing columns to the existing tweets table
-- Date: 2025-08-05

-- ==================================================================
-- SAFE COLUMN ADDITIONS TO TWEETS TABLE
-- ==================================================================

-- Add confirmed column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tweets' 
          AND column_name = 'confirmed'
    ) THEN
        ALTER TABLE tweets ADD COLUMN confirmed BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added confirmed column to tweets table';
    ELSE
        RAISE NOTICE 'ℹ️ confirmed column already exists in tweets table';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not add confirmed column: %', SQLERRM;
END $$;

-- Add method_used column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tweets' 
          AND column_name = 'method_used'
    ) THEN
        ALTER TABLE tweets ADD COLUMN method_used VARCHAR(50) DEFAULT 'browser';
        RAISE NOTICE '✅ Added method_used column to tweets table';
    ELSE
        RAISE NOTICE 'ℹ️ method_used column already exists in tweets table';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not add method_used column: %', SQLERRM;
END $$;

-- Add resource_usage column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tweets' 
          AND column_name = 'resource_usage'
    ) THEN
        ALTER TABLE tweets ADD COLUMN resource_usage JSONB DEFAULT '{}';
        RAISE NOTICE '✅ Added resource_usage column to tweets table';
    ELSE
        RAISE NOTICE 'ℹ️ resource_usage column already exists in tweets table';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not add resource_usage column: %', SQLERRM;
END $$;

-- Add updated_at column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tweets' 
          AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE tweets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE '✅ Added updated_at column to tweets table';
    ELSE
        RAISE NOTICE 'ℹ️ updated_at column already exists in tweets table';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not add updated_at column: %', SQLERRM;
END $$;

-- Final verification
DO $$
DECLARE
    confirmed_exists BOOLEAN;
    method_used_exists BOOLEAN;
    resource_usage_exists BOOLEAN;
    updated_at_exists BOOLEAN;
    columns_added INTEGER := 0;
BEGIN
    -- Check all columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tweets' AND column_name = 'confirmed'
    ) INTO confirmed_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tweets' AND column_name = 'method_used'
    ) INTO method_used_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tweets' AND column_name = 'resource_usage'
    ) INTO resource_usage_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tweets' AND column_name = 'updated_at'
    ) INTO updated_at_exists;
    
    -- Count successes
    IF confirmed_exists THEN columns_added := columns_added + 1; END IF;
    IF method_used_exists THEN columns_added := columns_added + 1; END IF;
    IF resource_usage_exists THEN columns_added := columns_added + 1; END IF;
    IF updated_at_exists THEN columns_added := columns_added + 1; END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 === TWEETS TABLE COLUMN ADDITIONS ===';
    RAISE NOTICE '';
    RAISE NOTICE 'confirmed column: %', CASE WHEN confirmed_exists THEN 'EXISTS ✓' ELSE 'MISSING ❌' END;
    RAISE NOTICE 'method_used column: %', CASE WHEN method_used_exists THEN 'EXISTS ✓' ELSE 'MISSING ❌' END;
    RAISE NOTICE 'resource_usage column: %', CASE WHEN resource_usage_exists THEN 'EXISTS ✓' ELSE 'MISSING ❌' END;
    RAISE NOTICE 'updated_at column: %', CASE WHEN updated_at_exists THEN 'EXISTS ✓' ELSE 'MISSING ❌' END;
    RAISE NOTICE '';
    RAISE NOTICE '📊 SUCCESS RATE: %/4 columns ready', columns_added;
    
    IF columns_added = 4 THEN
        RAISE NOTICE '✅ ALL TWEETS TABLE COLUMNS READY!';
    ELSE
        RAISE NOTICE '⚠️ Some columns may still be missing';
    END IF;
    
END $$;