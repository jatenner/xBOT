-- Fix bot_config table missing columns (Version 2 - Fixed unique constraint issue)
-- This addresses the "column bot_config.config_value does not exist" errors

-- First, let's check if the table exists and what columns it has
DO $$
BEGIN
    -- If bot_config table doesn't exist, create it fresh
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config') THEN
        CREATE TABLE bot_config (
            id SERIAL PRIMARY KEY,
            config_key VARCHAR(100) UNIQUE NOT NULL,
            config_value JSONB DEFAULT '{}',
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        -- Insert default configuration values
        INSERT INTO bot_config (config_key, config_value, description) VALUES
            ('growth_metrics', '{"reset_count": 0, "last_reset": null}', 'Growth metrics tracking'),
            ('viral_mode', '{"enabled": false, "activated_at": null}', 'Viral posting mode configuration'),
            ('posting_strategy', '{"current": "conservative", "updated_at": null}', 'Current posting strategy');
            
        RAISE NOTICE 'Created bot_config table with default values';
    ELSE
        -- Table exists, check and add missing columns
        
        -- Add config_key column if missing (handling existing rows)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bot_config' AND column_name = 'config_key'
        ) THEN
            -- First add the column as nullable
            ALTER TABLE bot_config ADD COLUMN config_key VARCHAR(100);
            
            -- Update existing rows with unique keys
            UPDATE bot_config SET config_key = 'legacy_config_' || id WHERE config_key IS NULL;
            
            -- Now make it NOT NULL and UNIQUE
            ALTER TABLE bot_config ALTER COLUMN config_key SET NOT NULL;
            ALTER TABLE bot_config ADD CONSTRAINT bot_config_config_key_unique UNIQUE (config_key);
            
            RAISE NOTICE 'Added config_key column to existing bot_config table';
        END IF;

        -- Add config_value column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bot_config' AND column_name = 'config_value'
        ) THEN
            ALTER TABLE bot_config ADD COLUMN config_value JSONB DEFAULT '{}';
            RAISE NOTICE 'Added config_value column to bot_config table';
        END IF;

        -- Add description column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bot_config' AND column_name = 'description'
        ) THEN
            ALTER TABLE bot_config ADD COLUMN description TEXT;
            RAISE NOTICE 'Added description column to bot_config table';
        END IF;
        
        -- Insert default configuration values if they don't exist
        INSERT INTO bot_config (config_key, config_value, description) VALUES
            ('growth_metrics', '{"reset_count": 0, "last_reset": null}', 'Growth metrics tracking'),
            ('viral_mode', '{"enabled": false, "activated_at": null}', 'Viral posting mode configuration'),
            ('posting_strategy', '{"current": "conservative", "updated_at": null}', 'Current posting strategy')
        ON CONFLICT (config_key) DO NOTHING;
        
        RAISE NOTICE 'Ensured default config values exist';
    END IF;
END $$;

-- Add index for performance (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(config_key);