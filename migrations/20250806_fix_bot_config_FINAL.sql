-- FINAL bot_config fix - Based on actual database structure analysis
-- The table EXISTS with 'key' column, we just need to add 'config_value'

DO $$
BEGIN
    -- We know the table exists with 'key' column, just add what's missing
    
    -- Add config_value column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bot_config' AND column_name = 'config_value'
    ) THEN
        ALTER TABLE bot_config ADD COLUMN config_value JSONB DEFAULT '{}';
        RAISE NOTICE 'Added config_value column to bot_config table';
    ELSE
        RAISE NOTICE 'config_value column already exists';
    END IF;
    
    -- Add description column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bot_config' AND column_name = 'description'
    ) THEN
        ALTER TABLE bot_config ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to bot_config table';
    ELSE
        RAISE NOTICE 'description column already exists';
    END IF;
    
    -- Insert default configuration values using the existing 'key' column
    INSERT INTO bot_config (key, config_value, description) VALUES
        ('growth_metrics', '{"reset_count": 0, "last_reset": null}', 'Growth metrics tracking'),
        ('viral_mode', '{"enabled": false, "activated_at": null}', 'Viral posting mode configuration'),
        ('posting_strategy', '{"current": "conservative", "updated_at": null}', 'Current posting strategy')
    ON CONFLICT (key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = EXCLUDED.description
    WHERE bot_config.config_value IS NULL OR bot_config.config_value = '{}';
    
    RAISE NOTICE 'Bot config setup completed successfully using existing key column';
END $$;