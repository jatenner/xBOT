-- SIMPLE FIX for tweet_topics table error
-- Copy and paste this into Supabase SQL Editor

-- Step 1: Create the tweet_topics table first
CREATE TABLE IF NOT EXISTS tweet_topics (
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

-- Step 2: Now insert the data
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

-- Step 3: Create bot_config for autonomous features
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO bot_config (key, value) VALUES 
    ('target_tweets_per_day', '"8"'::jsonb),
    ('min_readability', '"45"'::jsonb),
    ('enable_auto_adjustment', '"true"'::jsonb),
    ('consecutive_failures', '"0"'::jsonb),
    ('consecutive_successes', '"0"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Step 4: Create tweet_images table
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_tweet_images_url ON tweet_images(image_url);

SELECT 'Tables created successfully!' as result; 