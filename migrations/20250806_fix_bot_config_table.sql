-- Fix bot_config table missing columns
-- This addresses the "column bot_config.config_value does not exist" errors

-- Create bot_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB DEFAULT '{}',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Check and add config_key column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bot_config' AND column_name = 'config_key'
    ) THEN
        ALTER TABLE bot_config ADD COLUMN config_key VARCHAR(100) UNIQUE NOT NULL DEFAULT 'default_key';
    END IF;

    -- Check and add config_value column  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bot_config' AND column_name = 'config_value'
    ) THEN
        ALTER TABLE bot_config ADD COLUMN config_value JSONB DEFAULT '{}';
    END IF;

    -- Check and add description column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bot_config' AND column_name = 'description'
    ) THEN
        ALTER TABLE bot_config ADD COLUMN description TEXT;
    END IF;
END $$;

-- Insert default configuration values
INSERT INTO bot_config (config_key, config_value, description) VALUES
    ('growth_metrics', '{"reset_count": 0, "last_reset": null}', 'Growth metrics tracking'),
    ('viral_mode', '{"enabled": false, "activated_at": null}', 'Viral posting mode configuration'),
    ('posting_strategy', '{"current": "conservative", "updated_at": null}', 'Current posting strategy')
ON CONFLICT (config_key) DO NOTHING;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(config_key);