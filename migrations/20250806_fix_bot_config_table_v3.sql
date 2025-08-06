-- Fix bot_config table missing columns (Version 3 - Handle existing table structure)
-- This addresses the "column bot_config.config_value does not exist" errors

-- First, let's see what we're working with and fix it properly
DO $$
DECLARE
    has_key_column BOOLEAN := FALSE;
    has_config_key_column BOOLEAN := FALSE;
    has_config_value_column BOOLEAN := FALSE;
    table_exists BOOLEAN := FALSE;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'bot_config'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'bot_config table exists, checking columns...';
        
        -- Check for existing columns
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bot_config' AND column_name = 'key'
        ) INTO has_key_column;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bot_config' AND column_name = 'config_key'
        ) INTO has_config_key_column;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bot_config' AND column_name = 'config_value'
        ) INTO has_config_value_column;
        
        RAISE NOTICE 'Column check: key=%, config_key=%, config_value=%', 
            has_key_column, has_config_key_column, has_config_value_column;
        
        -- Add missing config_value column if needed
        IF NOT has_config_value_column THEN
            ALTER TABLE bot_config ADD COLUMN config_value JSONB DEFAULT '{}';
            RAISE NOTICE 'Added config_value column';
        END IF;
        
        -- If we have 'key' column but not 'config_key', use 'key' as the primary identifier
        IF has_key_column AND NOT has_config_key_column THEN
            RAISE NOTICE 'Using existing key column for configuration';
            
            -- Insert default configs using the existing 'key' column
            INSERT INTO bot_config (key, config_value) VALUES
                ('growth_metrics', '{"reset_count": 0, "last_reset": null}'),
                ('viral_mode', '{"enabled": false, "activated_at": null}'),
                ('posting_strategy', '{"current": "conservative", "updated_at": null}')
            ON CONFLICT (key) DO UPDATE SET
                config_value = EXCLUDED.config_value
            WHERE bot_config.config_value IS NULL OR bot_config.config_value = '{}';
            
            RAISE NOTICE 'Updated bot_config with default values using key column';
            
        -- If we need to add config_key column  
        ELSIF NOT has_config_key_column THEN
            ALTER TABLE bot_config ADD COLUMN config_key VARCHAR(100);
            
            -- Update existing rows
            UPDATE bot_config SET config_key = 'legacy_' || COALESCE(key::text, id::text) 
            WHERE config_key IS NULL;
            
            -- Make it unique and not null
            ALTER TABLE bot_config ALTER COLUMN config_key SET NOT NULL;
            ALTER TABLE bot_config ADD CONSTRAINT bot_config_config_key_unique UNIQUE (config_key);
            
            -- Insert defaults
            INSERT INTO bot_config (config_key, config_value) VALUES
                ('growth_metrics', '{"reset_count": 0, "last_reset": null}'),
                ('viral_mode', '{"enabled": false, "activated_at": null}'),
                ('posting_strategy', '{"current": "conservative", "updated_at": null}')
            ON CONFLICT (config_key) DO NOTHING;
            
            RAISE NOTICE 'Added config_key column and default values';
        END IF;
        
    ELSE
        -- Create fresh table
        CREATE TABLE bot_config (
            id SERIAL PRIMARY KEY,
            config_key VARCHAR(100) UNIQUE NOT NULL,
            config_value JSONB DEFAULT '{}',
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        INSERT INTO bot_config (config_key, config_value, description) VALUES
            ('growth_metrics', '{"reset_count": 0, "last_reset": null}', 'Growth metrics tracking'),
            ('viral_mode', '{"enabled": false, "activated_at": null}', 'Viral posting mode configuration'),
            ('posting_strategy', '{"current": "conservative", "updated_at": null}', 'Current posting strategy');
            
        RAISE NOTICE 'Created new bot_config table with default values';
    END IF;
    
    RAISE NOTICE 'Bot config table setup completed successfully';
END $$;