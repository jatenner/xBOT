-- Database initialization script to prevent spam errors
-- Run this after setting up the main schema

-- Ensure control_flags table has required entries
INSERT INTO control_flags (id, value) VALUES 
('DISABLE_BOT', false),
('MAINTENANCE_MODE', false),
('DEBUG_MODE', false)
ON CONFLICT (id) DO NOTHING;

-- Ensure prompt_features table exists and has initial data
CREATE TABLE IF NOT EXISTS prompt_features (
    id SERIAL PRIMARY KEY,
    variant_of_the_day TEXT DEFAULT 'default',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO prompt_features (id, variant_of_the_day) VALUES (1, 'default')
ON CONFLICT (id) DO UPDATE SET variant_of_the_day = EXCLUDED.variant_of_the_day;

-- Ensure api_usage table has today's entry
INSERT INTO api_usage (date, writes, reads) VALUES (CURRENT_DATE, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- Ensure learning_insights table exists for dashboard
CREATE TABLE IF NOT EXISTS learning_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insights JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add variant column to tweets table if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'variant') THEN
        ALTER TABLE tweets ADD COLUMN variant TEXT DEFAULT 'default';
    END IF;
END $$;

-- Add quality_score column to tweets table if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'quality_score') THEN
        ALTER TABLE tweets ADD COLUMN quality_score INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add posted_at column to tweets table if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'posted_at') THEN
        ALTER TABLE tweets ADD COLUMN posted_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE prompt_features ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_features' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON prompt_features FOR ALL USING (true);
    END IF;
END $$; 