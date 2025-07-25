-- 🚨 EMERGENCY COLUMN FIX
-- =======================
-- FIXES THE SPECIFIC "category does not exist" ERROR

-- First, let's see what columns actually exist in bot_config
DO $$
DECLARE
    col_name TEXT;
    existing_columns TEXT[] := '{}';
BEGIN
    RAISE NOTICE '🔍 CHECKING EXISTING COLUMNS IN bot_config...';
    
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'bot_config' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
    LOOP
        existing_columns := array_append(existing_columns, col_name);
    END LOOP;
    
    RAISE NOTICE '📊 EXISTING COLUMNS: %', existing_columns;
END $$;

-- Create bot_config table if it doesn't exist (basic version)
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns ONE BY ONE with error handling
DO $$
BEGIN
    -- Add category column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN category VARCHAR(50) DEFAULT 'general';
        RAISE NOTICE '✅ Added category column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Category column already exists';
    END;
    
    -- Add data_type column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN data_type VARCHAR(20) DEFAULT 'string';
        RAISE NOTICE '✅ Added data_type column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Data_type column already exists';
    END;
    
    -- Add is_critical column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN is_critical BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ Added is_critical column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Is_critical column already exists';
    END;
    
    -- Add requires_restart column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN requires_restart BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ Added requires_restart column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Requires_restart column already exists';
    END;
    
    -- Add validation_rules column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN validation_rules JSONB DEFAULT '{}';
        RAISE NOTICE '✅ Added validation_rules column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Validation_rules column already exists';
    END;
    
    -- Add default_value column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN default_value TEXT;
        RAISE NOTICE '✅ Added default_value column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Default_value column already exists';
    END;
    
    -- Add last_changed_by column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN last_changed_by VARCHAR(100) DEFAULT 'system';
        RAISE NOTICE '✅ Added last_changed_by column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Last_changed_by column already exists';
    END;
    
    -- Add change_reason column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN change_reason TEXT;
        RAISE NOTICE '✅ Added change_reason column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Change_reason column already exists';
    END;
    
    -- Add version column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN version INTEGER DEFAULT 1;
        RAISE NOTICE '✅ Added version column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Version column already exists';
    END;
    
    -- Add environment column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN environment VARCHAR(20) DEFAULT 'production';
        RAISE NOTICE '✅ Added environment column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Environment column already exists';
    END;
    
    -- Add feature_flag column
    BEGIN
        ALTER TABLE bot_config ADD COLUMN feature_flag BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Added feature_flag column';
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'ℹ️ Feature_flag column already exists';
    END;
END $$;

-- Verify all columns now exist
DO $$
DECLARE
    col_name TEXT;
    final_columns TEXT[] := '{}';
BEGIN
    RAISE NOTICE '🔍 VERIFYING ALL COLUMNS NOW EXIST...';
    
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'bot_config' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
    LOOP
        final_columns := array_append(final_columns, col_name);
    END LOOP;
    
    RAISE NOTICE '✅ FINAL COLUMNS: %', final_columns;
END $$;

-- NOW insert the configuration (all columns should exist)
INSERT INTO bot_config (key, value, description, category, is_critical, data_type) VALUES
('bot_enabled', 'true', 'Master bot enable/disable switch', 'core', true, 'boolean'),
('daily_tweet_limit', '17', 'Free tier daily tweet limit', 'quota', true, 'integer'),
('intelligent_quota_enabled', 'true', 'Enable intelligent quota management', 'quota', true, 'boolean'),
('quota_reset_monitoring', 'true', 'Enable automatic quota reset detection', 'quota', true, 'boolean'),
('current_tier', 'free', 'Twitter API tier', 'api', false, 'string'),
('max_retries', '3', 'Maximum retry attempts for failed operations', 'reliability', false, 'integer'),
('retry_delay_seconds', '5', 'Delay between retry attempts in seconds', 'reliability', false, 'integer'),
('engagement_check_interval', '3600', 'Seconds between engagement checks', 'monitoring', false, 'integer'),
('viral_threshold', '100', 'Minimum engagement for viral classification', 'analytics', false, 'integer'),
('optimal_posting_hours', '[6,7,8,9,12,13,17,18,19,20,21]', 'Best hours for posting EST', 'ai', false, 'json'),
('content_quality_threshold', '7.0', 'Minimum quality score for posting', 'ai', false, 'decimal'),
('auto_optimization_enabled', 'true', 'Enable automatic strategy optimization', 'ai', false, 'boolean'),
('learning_rate', '0.1', 'AI learning adjustment rate', 'ai', false, 'decimal'),
('confidence_threshold', '75.0', 'Minimum confidence for AI decisions', 'ai', false, 'decimal'),
('budget_limit_daily', '2.00', 'Daily budget limit in USD', 'budget', true, 'decimal'),
('emergency_mode_enabled', 'false', 'Emergency mode flag', 'emergency', true, 'boolean'),
('maintenance_mode', 'false', 'Maintenance mode flag', 'system', true, 'boolean'),
('debug_logging', 'false', 'Enable debug logging', 'logging', false, 'boolean'),
('performance_monitoring', 'true', 'Enable performance monitoring', 'monitoring', false, 'boolean'),
('advanced_analytics', 'true', 'Enable advanced analytics', 'analytics', false, 'boolean'),
('bulletproof_mode', 'true', 'Enable bulletproof error handling', 'system', true, 'boolean')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_critical = EXCLUDED.is_critical,
    data_type = EXCLUDED.data_type,
    updated_at = NOW(),
    version = COALESCE(bot_config.version, 0) + 1;

-- Final verification
DO $$
DECLARE
    config_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM bot_config;
    RAISE NOTICE '🎯 SUCCESS! Bot config entries created: %', config_count;
    RAISE NOTICE '✅ EMERGENCY COLUMN FIX COMPLETE!';
END $$;

SELECT 
    '🚨 EMERGENCY FIX COMPLETE' as status,
    'COLUMN ISSUES RESOLVED' as result,
    'BOT CONFIG READY' as next_step; 