-- ===================================================================
-- MANUAL MIGRATION: Apply all essential database changes
-- ===================================================================
-- Apply this manually in Supabase SQL Editor if migrations fail
-- This combines all critical migrations into one file

-- 1. Create bot_config table for autonomous runtime configuration
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration values
INSERT INTO bot_config (key, value) VALUES 
    ('target_tweets_per_day', '8'),
    ('min_readability', '45'),
    ('enable_auto_adjustment', 'true'),
    ('consecutive_failures', '0'),
    ('consecutive_successes', '0')
ON CONFLICT (key) DO NOTHING;

-- 2. Create tweet_topics table for content categorization
CREATE TABLE IF NOT EXISTS tweet_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    keywords TEXT[],
    priority_score DECIMAL(3,2) DEFAULT 0.5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default health tech topics
INSERT INTO tweet_topics (topic_name, category, description, keywords, priority_score) VALUES
    ('AI Drug Discovery', 'health_tech', 'Artificial intelligence applications in pharmaceutical research and drug development', ARRAY['AI drug discovery', 'machine learning pharma', 'AI therapeutics'], 0.9),
    ('Digital Therapeutics', 'health_tech', 'Software-based therapeutic interventions and digital health solutions', ARRAY['digital therapeutics', 'DTx', 'health apps'], 0.8),
    ('Precision Medicine', 'health_tech', 'Personalized medical treatments based on individual genetic profiles', ARRAY['precision medicine', 'personalized healthcare', 'genomics'], 0.85),
    ('Telemedicine Innovation', 'health_tech', 'Remote healthcare delivery and virtual medical consultations', ARRAY['telemedicine', 'telehealth', 'remote care'], 0.7),
    ('Wearable Health Tech', 'health_tech', 'Wearable devices for health monitoring and medical applications', ARRAY['wearable tech', 'health sensors', 'fitness trackers'], 0.75),
    ('Healthcare AI Diagnostics', 'health_tech', 'AI-powered diagnostic tools and medical imaging analysis', ARRAY['AI diagnostics', 'medical imaging AI', 'healthcare AI'], 0.9),
    ('Biotech Innovations', 'health_tech', 'Biotechnology advances and breakthrough medical technologies', ARRAY['biotech', 'bioengineering', 'medical devices'], 0.8),
    ('Mental Health Tech', 'health_tech', 'Technology solutions for mental health and wellness', ARRAY['mental health apps', 'therapy tech', 'wellness platforms'], 0.75),
    ('Healthcare Data Security', 'health_tech', 'Cybersecurity and privacy in healthcare technology', ARRAY['healthcare cybersecurity', 'medical data privacy', 'HIPAA'], 0.65),
    ('Medical Robotics', 'health_tech', 'Robotic systems for surgery and medical procedures', ARRAY['medical robots', 'surgical robots', 'healthcare automation'], 0.8)
ON CONFLICT (topic_name) DO NOTHING;

-- 3. Create tweet_images table for image usage tracking
CREATE TABLE IF NOT EXISTS tweet_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    image_source TEXT NOT NULL,
    description TEXT,
    alt_text TEXT,
    used_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    topic_tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate image URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_tweet_images_url ON tweet_images(image_url);

-- 4. Update tweet_metrics table structure (if it exists with wrong schema)
-- Check current structure and update if needed
DO $$
BEGIN
    -- If tweet_metrics exists but has wrong structure, alter it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tweet_metrics') THEN
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'id') THEN
            ALTER TABLE tweet_metrics ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        END IF;
        
        -- Rename columns if they have different names
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'captured_at') THEN
            ALTER TABLE tweet_metrics RENAME COLUMN captured_at TO collected_at;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'json_payload') THEN
            ALTER TABLE tweet_metrics RENAME COLUMN json_payload TO metrics_json;
        END IF;
    ELSE
        -- Create tweet_metrics table with correct structure
        CREATE TABLE tweet_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tweet_id TEXT NOT NULL,
            collected_at TIMESTAMPTZ DEFAULT NOW(),
            metrics_json JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- 5. Update bot_dashboard table structure (if it exists with wrong schema)
DO $$
BEGIN
    -- If bot_dashboard exists but has wrong structure, alter it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_dashboard') THEN
        -- Add id column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_dashboard' AND column_name = 'id') THEN
            ALTER TABLE bot_dashboard ADD COLUMN id UUID DEFAULT gen_random_uuid();
        END IF;
        
        -- Rename date to plan_date if needed
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_dashboard' AND column_name = 'date') THEN
            ALTER TABLE bot_dashboard RENAME COLUMN date TO plan_date;
        END IF;
    ELSE
        -- Create bot_dashboard table with correct structure
        CREATE TABLE bot_dashboard (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            plan_date DATE NOT NULL,
            planned_posts_json JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id ON tweet_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_collected_at ON tweet_metrics(collected_at);
CREATE INDEX IF NOT EXISTS idx_bot_dashboard_plan_date ON bot_dashboard(plan_date);
CREATE INDEX IF NOT EXISTS idx_tweet_topics_category ON tweet_topics(category);
CREATE INDEX IF NOT EXISTS idx_tweet_topics_priority ON tweet_topics(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_images_last_used ON tweet_images(last_used_at);

-- 7. Create or update functions for autonomous configuration
CREATE OR REPLACE FUNCTION apply_pending_migrations()
RETURNS BOOLEAN AS $$
BEGIN
    -- This function is for compatibility - migrations are applied manually
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to get configuration values
CREATE OR REPLACE FUNCTION get_bot_config(config_key TEXT)
RETURNS JSONB AS $$
DECLARE
    config_value JSONB;
BEGIN
    SELECT value INTO config_value
    FROM bot_config
    WHERE key = config_key;
    
    RETURN COALESCE(config_value, 'null'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to set configuration values
CREATE OR REPLACE FUNCTION set_bot_config(config_key TEXT, config_value JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO bot_config (key, value, updated_at)
    VALUES (config_key, config_value, NOW())
    ON CONFLICT (key)
    DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 10. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Apply updated_at triggers to relevant tables
DROP TRIGGER IF EXISTS update_bot_config_updated_at ON bot_config;
CREATE TRIGGER update_bot_config_updated_at
    BEFORE UPDATE ON bot_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tweet_topics_updated_at ON tweet_topics;
CREATE TRIGGER update_tweet_topics_updated_at
    BEFORE UPDATE ON tweet_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tweet_images_updated_at ON tweet_images;
CREATE TRIGGER update_tweet_images_updated_at
    BEFORE UPDATE ON tweet_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Complete!
SELECT 'All essential database migrations applied successfully!' as result; 