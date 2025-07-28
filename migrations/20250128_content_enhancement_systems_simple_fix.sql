-- ===============================================
-- CONTENT ENHANCEMENT SYSTEMS - SIMPLE FIX
-- Fixes column reference issues and creates tables properly
-- ===============================================

-- First, let's create the learning_cycles table with just the basic columns
CREATE TABLE IF NOT EXISTS learning_cycles (
    id BIGSERIAL PRIMARY KEY,
    cycle_start TIMESTAMPTZ DEFAULT NOW(),
    cycle_end TIMESTAMPTZ,
    tweets_analyzed INTEGER DEFAULT 0,
    top_performing_count INTEGER DEFAULT 0,
    insights_generated JSONB DEFAULT '{}'::jsonb,
    tone_recommendations JSONB DEFAULT '{}'::jsonb,
    keyword_recommendations JSONB DEFAULT '[]'::jsonb,
    format_recommendations JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the completed column separately to avoid conflicts
ALTER TABLE learning_cycles ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Now create the other tables without complex references
CREATE TABLE IF NOT EXISTS used_idea_fingerprints (
    id BIGSERIAL PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    date_used TIMESTAMPTZ DEFAULT NOW(),
    tweet_id TEXT NOT NULL,
    original_content TEXT NOT NULL,
    extracted_idea TEXT,
    topic_category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_knowledge_base (
    id BIGSERIAL PRIMARY KEY,
    idea_text TEXT NOT NULL,
    topic TEXT NOT NULL,
    source TEXT DEFAULT 'curated',
    approved BOOLEAN DEFAULT true,
    used BOOLEAN DEFAULT false,
    performance_score DECIMAL(6,4) DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    difficulty_level TEXT DEFAULT 'intermediate',
    fact_type TEXT DEFAULT 'insight',
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enhanced_prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    tone TEXT NOT NULL,
    content_type TEXT NOT NULL,
    time_preference TEXT DEFAULT 'any',
    performance_score DECIMAL(6,4) DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_rotation_history (
    id BIGSERIAL PRIMARY KEY,
    template_id TEXT,
    tone TEXT NOT NULL,
    content_type TEXT NOT NULL,
    time_used TIMESTAMPTZ DEFAULT NOW(),
    tweet_id TEXT,
    performance_score DECIMAL(6,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tweet_performance_analysis (
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT NOT NULL,
    content TEXT NOT NULL,
    tone TEXT,
    content_type TEXT,
    keywords JSONB DEFAULT '[]'::jsonb,
    hashtags JSONB DEFAULT '[]'::jsonb,
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(6,4) DEFAULT 0,
    posting_time TIMESTAMPTZ,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    learning_cycle_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learned_performance_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_type TEXT NOT NULL,
    pattern_value TEXT NOT NULL,
    performance_score DECIMAL(6,4) NOT NULL,
    confidence_level DECIMAL(4,3) NOT NULL,
    sample_size INTEGER NOT NULL,
    learning_cycle_id INTEGER,
    active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS real_trending_topics (
    id BIGSERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    source TEXT NOT NULL,
    relevance_score DECIMAL(4,3) DEFAULT 0,
    search_volume INTEGER DEFAULT 0,
    trend_velocity TEXT DEFAULT 'stable',
    health_relevance DECIMAL(4,3) DEFAULT 0,
    used BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    raw_data JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trending_topic_usage (
    id BIGSERIAL PRIMARY KEY,
    topic_id INTEGER,
    tweet_id TEXT NOT NULL,
    usage_type TEXT DEFAULT 'primary',
    performance_score DECIMAL(6,4) DEFAULT 0,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trending_fetch_history (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    topics_fetched INTEGER DEFAULT 0,
    fetch_success BOOLEAN DEFAULT true,
    fetch_duration_ms INTEGER,
    error_message TEXT,
    next_fetch_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_fingerprint ON used_idea_fingerprints (fingerprint);
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_date_used ON used_idea_fingerprints (date_used);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_topic ON content_knowledge_base (topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_used ON content_knowledge_base (used);
CREATE INDEX IF NOT EXISTS idx_enhanced_templates_tone ON enhanced_prompt_templates (tone);
CREATE INDEX IF NOT EXISTS idx_learning_cycles_completed ON learning_cycles (completed);
CREATE INDEX IF NOT EXISTS idx_trending_topics_used ON real_trending_topics (used);

-- Insert sample data
INSERT INTO enhanced_prompt_templates (id, name, template, tone, content_type, time_preference) VALUES
('morning_friendly_tip', 'Morning Health Tip', 'Start your day right! 🌅 {health_fact} Try this: {actionable_tip}. Your morning routine matters! What''s your favorite morning health habit?', 'friendly', 'tip', 'morning'),
('controversial_myth', 'Controversial Health Myth', 'Unpopular opinion: {controversial_statement} 🔥 Here''s why: {scientific_reasoning} Most people don''t realize {surprising_insight}. Thoughts?', 'controversial', 'myth_bust', 'evening'),
('scientific_insight', 'Scientific Health Insight', 'New research reveals: {scientific_finding} 🧬 The mechanism: {explanation} This could change how we think about {health_topic}.', 'scientific', 'insight', 'any'),
('personal_story', 'Personal Health Story', 'Personal confession: {relatable_struggle} 💭 What I learned: {lesson_learned} Now I understand {deeper_insight}. Can anyone relate?', 'personal', 'insight', 'afternoon')
ON CONFLICT (id) DO UPDATE SET
    template = EXCLUDED.template,
    updated_at = NOW();

INSERT INTO content_knowledge_base (idea_text, topic, fact_type, tags) VALUES
('Most fitness trackers overestimate calorie burn by 15-30% because they use population averages instead of individual metabolic rates', 'fitness_tracking', 'myth', '["fitness", "calories", "accuracy", "metabolism"]'),
('Drinking cold water can boost metabolism by 8-30% for 90 minutes as your body works to warm it', 'metabolism', 'fact', '["water", "metabolism", "thermogenesis", "weight_loss"]'),
('Taking vitamin D with K2 increases absorption by 200% compared to D3 alone', 'supplements', 'tip', '["vitamin_d", "k2", "absorption", "synergy"]'),
('Blue light exposure after 9 PM reduces melatonin production by up to 90%', 'sleep', 'fact', '["blue_light", "melatonin", "sleep", "circadian"]'),
('Intermittent fasting may reduce inflammation markers more than continuous calorie restriction', 'nutrition', 'insight', '["fasting", "inflammation", "diet", "health"]')
ON CONFLICT DO NOTHING;

-- Simple stored procedures without complex logic
CREATE OR REPLACE FUNCTION get_unused_knowledge_ideas(
    topic_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
    id BIGINT,
    idea_text TEXT,
    topic TEXT,
    fact_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.idea_text,
        kb.topic,
        kb.fact_type
    FROM content_knowledge_base kb
    WHERE kb.approved = true 
    AND kb.used = false
    AND (topic_filter IS NULL OR kb.topic = topic_filter)
    ORDER BY RANDOM()
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_idea_fingerprint_usage(
    fingerprint_to_check TEXT
) RETURNS TABLE (
    is_used BOOLEAN,
    days_since_use INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as is_used,
        CASE 
            WHEN COUNT(*) > 0 THEN EXTRACT(DAY FROM NOW() - MAX(date_used))::INTEGER
            ELSE 0 
        END as days_since_use
    FROM used_idea_fingerprints 
    WHERE fingerprint = fingerprint_to_check 
    AND date_used >= NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Content Enhancement Systems created successfully!' as status; 