-- BULLETPROOF SQL FIX - Copy and paste this into Supabase SQL Editor
-- This will completely fix all table issues

-- Step 1: Drop existing problematic tables (if they exist)
DROP TABLE IF EXISTS tweet_topics CASCADE;
DROP TABLE IF EXISTS tweet_images CASCADE;
DROP TABLE IF EXISTS bot_config CASCADE;

-- Step 2: Create bot_config table
CREATE TABLE bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create tweet_topics table
CREATE TABLE tweet_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    keywords TEXT[],
    priority_score NUMERIC(3,2) DEFAULT 0.5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create tweet_images table
CREATE TABLE tweet_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    image_source TEXT NOT NULL,
    keywords TEXT[],
    category TEXT,
    used_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Insert bot configuration data
INSERT INTO bot_config (key, value) VALUES 
    ('target_tweets_per_day', '"8"'::jsonb),
    ('min_readability', '"45"'::jsonb),
    ('enable_auto_adjustment', '"true"'::jsonb),
    ('consecutive_failures', '"0"'::jsonb),
    ('consecutive_successes', '"0"'::jsonb);

-- Step 6: Insert tweet topics data
INSERT INTO tweet_topics (topic_name, category, description, keywords, priority_score) VALUES
    ('AI Drug Discovery', 'health_tech', 'Artificial intelligence applications in pharmaceutical research and drug development', ARRAY['AI drug discovery', 'machine learning pharma', 'AI therapeutics'], 0.9),
    ('Digital Therapeutics', 'health_tech', 'Software-based therapeutic interventions and digital health solutions', ARRAY['digital therapeutics', 'DTx', 'health apps'], 0.8),
    ('Precision Medicine', 'health_tech', 'Personalized medical treatments based on individual genetic profiles', ARRAY['precision medicine', 'personalized healthcare', 'genomics'], 0.85),
    ('Telemedicine Innovation', 'health_tech', 'Remote healthcare delivery and virtual medical consultations', ARRAY['telemedicine', 'telehealth', 'remote care'], 0.7),
    ('Wearable Health Tech', 'health_tech', 'Wearable devices for health monitoring and medical applications', ARRAY['wearable tech', 'health monitoring', 'smartwatch health'], 0.75),
    ('Biotech Breakthroughs', 'biotech', 'Latest developments in biotechnology and life sciences', ARRAY['biotech', 'life sciences', 'bioengineering'], 0.8),
    ('Mental Health Tech', 'health_tech', 'Technology solutions for mental health and wellbeing', ARRAY['mental health apps', 'digital psychiatry', 'therapy tech'], 0.65),
    ('Medical AI Diagnostics', 'health_tech', 'AI-powered diagnostic tools and medical imaging', ARRAY['medical AI', 'AI diagnostics', 'medical imaging'], 0.85),
    ('Health Data Analytics', 'health_tech', 'Big data and analytics in healthcare', ARRAY['health analytics', 'medical data', 'healthcare AI'], 0.7),
    ('Robotics in Surgery', 'health_tech', 'Robotic systems and automation in surgical procedures', ARRAY['surgical robots', 'medical robotics', 'robotic surgery'], 0.75);

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweet_topics_category ON tweet_topics(category);
CREATE INDEX IF NOT EXISTS idx_tweet_topics_priority ON tweet_topics(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_images_category ON tweet_images(category);
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);

-- Success message
SELECT 'All tables created successfully!' as status; 