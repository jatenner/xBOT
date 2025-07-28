-- ===============================================
-- CONTENT ENHANCEMENT SYSTEMS MIGRATION
-- Implements 5 major upgrades for content quality and diversity
-- ===============================================

-- ===============================================
-- 1. IDEA FINGERPRINT DEDUPLICATION SYSTEM
-- ===============================================

-- Table to track used idea fingerprints with 60-day lookback
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

-- Indexes for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_fingerprint ON used_idea_fingerprints (fingerprint);
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_date_used ON used_idea_fingerprints (date_used);
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_topic ON used_idea_fingerprints (topic_category);

-- ===============================================
-- 2. CONTENT KNOWLEDGE BASE EXPANSION
-- ===============================================

-- Knowledge base of 300+ health facts and insights
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
    difficulty_level TEXT DEFAULT 'intermediate', -- basic, intermediate, advanced
    fact_type TEXT DEFAULT 'insight', -- fact, myth, tip, insight, controversy
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient knowledge base queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_topic ON content_knowledge_base (topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_approved ON content_knowledge_base (approved);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_used ON content_knowledge_base (used);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_performance ON content_knowledge_base (performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_fact_type ON content_knowledge_base (fact_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON content_knowledge_base USING GIN (tags);

-- ===============================================
-- 3. PROMPT TEMPLATE ROTATION SYSTEM
-- ===============================================

-- Enhanced prompt templates with tone and timing
CREATE TABLE IF NOT EXISTS enhanced_prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    tone TEXT NOT NULL, -- friendly, controversial, scientific, personal
    content_type TEXT NOT NULL, -- tip, fact, myth_bust, insight, question
    time_preference TEXT DEFAULT 'any', -- morning, afternoon, evening, any
    performance_score DECIMAL(6,4) DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track prompt template usage history (14-day window)
CREATE TABLE IF NOT EXISTS prompt_rotation_history (
    id BIGSERIAL PRIMARY KEY,
    template_id TEXT REFERENCES enhanced_prompt_templates(id),
    tone TEXT NOT NULL,
    content_type TEXT NOT NULL,
    time_used TIMESTAMPTZ DEFAULT NOW(),
    tweet_id TEXT,
    performance_score DECIMAL(6,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prompt rotation
CREATE INDEX IF NOT EXISTS idx_enhanced_templates_tone ON enhanced_prompt_templates (tone);
CREATE INDEX IF NOT EXISTS idx_enhanced_templates_time ON enhanced_prompt_templates (time_preference);
CREATE INDEX IF NOT EXISTS idx_enhanced_templates_performance ON enhanced_prompt_templates (performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_rotation_history_time ON prompt_rotation_history (time_used);
CREATE INDEX IF NOT EXISTS idx_rotation_history_tone ON prompt_rotation_history (tone);

-- ===============================================
-- 4. ENGAGEMENT-BASED LEARNING SYSTEM
-- ===============================================

-- Detailed tweet performance analysis
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

-- Learning cycles for performance optimization
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
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learned performance patterns
CREATE TABLE IF NOT EXISTS learned_performance_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_type TEXT NOT NULL, -- tone, keyword, format, timing
    pattern_value TEXT NOT NULL,
    performance_score DECIMAL(6,4) NOT NULL,
    confidence_level DECIMAL(4,3) NOT NULL,
    sample_size INTEGER NOT NULL,
    learning_cycle_id INTEGER REFERENCES learning_cycles(id),
    active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for learning system
CREATE INDEX IF NOT EXISTS idx_performance_analysis_tweet_id ON tweet_performance_analysis (tweet_id);
CREATE INDEX IF NOT EXISTS idx_performance_analysis_engagement ON tweet_performance_analysis (engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_performance_analysis_posting_time ON tweet_performance_analysis (posting_time);
CREATE INDEX IF NOT EXISTS idx_learning_cycles_completed ON learning_cycles (completed);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON learned_performance_patterns (pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_active ON learned_performance_patterns (active);

-- ===============================================
-- 5. REAL TRENDING TOPICS INTEGRATION
-- ===============================================

-- Enhanced trending topics with real-time data
CREATE TABLE IF NOT EXISTS real_trending_topics (
    id BIGSERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    source TEXT NOT NULL, -- google_news, twitter, manual
    relevance_score DECIMAL(4,3) DEFAULT 0,
    search_volume INTEGER DEFAULT 0,
    trend_velocity TEXT DEFAULT 'stable', -- rising, stable, declining
    health_relevance DECIMAL(4,3) DEFAULT 0,
    used BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    raw_data JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trending topic usage tracking
CREATE TABLE IF NOT EXISTS trending_topic_usage (
    id BIGSERIAL PRIMARY KEY,
    topic_id INTEGER REFERENCES real_trending_topics(id),
    tweet_id TEXT NOT NULL,
    usage_type TEXT DEFAULT 'primary', -- primary, secondary, context
    performance_score DECIMAL(6,4) DEFAULT 0,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trending topic fetch history
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

-- Indexes for trending topics
CREATE INDEX IF NOT EXISTS idx_trending_topics_source ON real_trending_topics (source);
CREATE INDEX IF NOT EXISTS idx_trending_topics_used ON real_trending_topics (used);
CREATE INDEX IF NOT EXISTS idx_trending_topics_relevance ON real_trending_topics (relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_expires ON real_trending_topics (expires_at);
CREATE INDEX IF NOT EXISTS idx_trending_usage_topic_id ON trending_topic_usage (topic_id);
CREATE INDEX IF NOT EXISTS idx_fetch_history_source ON trending_fetch_history (source);

-- ===============================================
-- STORED PROCEDURES FOR ANALYTICS
-- ===============================================

-- Get unused idea fingerprints in the last 60 days
CREATE OR REPLACE FUNCTION check_idea_fingerprint_usage(
    fingerprint_to_check TEXT
) RETURNS TABLE (
    is_used BOOLEAN,
    days_since_use INTEGER,
    last_tweet_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as is_used,
        CASE 
            WHEN COUNT(*) > 0 THEN EXTRACT(DAY FROM NOW() - MAX(date_used))::INTEGER
            ELSE NULL 
        END as days_since_use,
        CASE 
            WHEN COUNT(*) > 0 THEN (SELECT tweet_id FROM used_idea_fingerprints WHERE fingerprint = fingerprint_to_check ORDER BY date_used DESC LIMIT 1)
            ELSE NULL 
        END as last_tweet_id
    FROM used_idea_fingerprints 
    WHERE fingerprint = fingerprint_to_check 
    AND date_used >= NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- Get unused knowledge base ideas by topic
CREATE OR REPLACE FUNCTION get_unused_knowledge_ideas(
    topic_filter TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
    id BIGINT,
    idea_text TEXT,
    topic TEXT,
    fact_type TEXT,
    performance_score DECIMAL(6,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.idea_text,
        kb.topic,
        kb.fact_type,
        kb.performance_score
    FROM content_knowledge_base kb
    WHERE kb.approved = true 
    AND kb.used = false
    AND (topic_filter IS NULL OR kb.topic = topic_filter)
    ORDER BY kb.performance_score DESC, RANDOM()
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get optimal prompt template for current conditions
CREATE OR REPLACE FUNCTION get_optimal_prompt_template(
    current_hour INTEGER,
    recent_tones TEXT[] DEFAULT NULL
) RETURNS TABLE (
    id TEXT,
    template TEXT,
    tone TEXT,
    content_type TEXT
) AS $$
DECLARE
    time_preference TEXT;
BEGIN
    -- Determine time preference
    IF current_hour BETWEEN 6 AND 11 THEN
        time_preference := 'morning';
    ELSIF current_hour BETWEEN 12 AND 17 THEN
        time_preference := 'afternoon';
    ELSIF current_hour BETWEEN 18 AND 23 THEN
        time_preference := 'evening';
    ELSE
        time_preference := 'any';
    END IF;

    RETURN QUERY
    SELECT 
        ept.id,
        ept.template,
        ept.tone,
        ept.content_type
    FROM enhanced_prompt_templates ept
    WHERE ept.active = true
    AND (ept.time_preference = time_preference OR ept.time_preference = 'any')
    AND (recent_tones IS NULL OR NOT (ept.tone = ANY(recent_tones)))
    AND ept.last_used IS NULL OR ept.last_used < NOW() - INTERVAL '7 days'
    ORDER BY ept.performance_score DESC, ept.usage_count ASC, RANDOM()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get top performing patterns for learning
CREATE OR REPLACE FUNCTION get_top_performance_patterns()
RETURNS TABLE (
    pattern_type TEXT,
    pattern_value TEXT,
    avg_engagement DECIMAL(6,4),
    sample_size BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH performance_stats AS (
        SELECT 
            tpa.tone,
            AVG(tpa.engagement_score) as avg_engagement,
            COUNT(*) as sample_size
        FROM tweet_performance_analysis tpa
        WHERE tpa.analyzed_at >= NOW() - INTERVAL '30 days'
        AND tpa.engagement_score > 0
        GROUP BY tpa.tone
        HAVING COUNT(*) >= 3
    )
    SELECT 
        'tone'::TEXT as pattern_type,
        ps.tone as pattern_value,
        ps.avg_engagement::DECIMAL(6,4),
        ps.sample_size
    FROM performance_stats ps
    ORDER BY ps.avg_engagement DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Get trending topics for content injection
CREATE OR REPLACE FUNCTION get_trending_topics_for_content(
    limit_count INTEGER DEFAULT 3
) RETURNS TABLE (
    id BIGINT,
    topic TEXT,
    source TEXT,
    relevance_score DECIMAL(4,3),
    health_relevance DECIMAL(4,3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rtt.id,
        rtt.topic,
        rtt.source,
        rtt.relevance_score,
        rtt.health_relevance
    FROM real_trending_topics rtt
    WHERE rtt.used = false
    AND rtt.expires_at > NOW()
    AND rtt.health_relevance >= 0.3
    ORDER BY rtt.health_relevance DESC, rtt.relevance_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- INITIAL DATA SETUP
-- ===============================================

-- Insert initial enhanced prompt templates
INSERT INTO enhanced_prompt_templates (id, name, template, tone, content_type, time_preference) VALUES
('morning_friendly_tip', 'Morning Health Tip', 'Start your day right! 🌅 {health_fact} Try this: {actionable_tip}. Your morning routine matters! What''s your favorite morning health habit?', 'friendly', 'tip', 'morning'),
('controversial_myth', 'Controversial Health Myth', 'Unpopular opinion: {controversial_statement} 🔥 Here''s why: {scientific_reasoning} Most people don''t realize {surprising_insight}. Thoughts?', 'controversial', 'myth_bust', 'evening'),
('scientific_insight', 'Scientific Health Insight', 'New research reveals: {scientific_finding} 🧬 The mechanism: {explanation} This could change how we think about {health_topic}.', 'scientific', 'insight', 'any'),
('personal_story', 'Personal Health Story', 'Personal confession: {relatable_struggle} 💭 What I learned: {lesson_learned} Now I understand {deeper_insight}. Can anyone relate?', 'personal', 'insight', 'afternoon'),
('friendly_question', 'Engaging Health Question', 'Quick question: {thought_provoking_question} 🤔 I''ve been thinking about {health_concept} because {reasoning}. What''s your take?', 'friendly', 'question', 'any'),
('evening_controversial', 'Evening Health Debate', 'Let''s settle this: {debatable_health_topic} ⚡ Team A says {position_a}. Team B says {position_b}. Science says: {evidence}. Which team are you on?', 'controversial', 'myth_bust', 'evening'),
('morning_motivation', 'Morning Health Motivation', 'Monday motivation: {inspiring_health_fact} 💪 Remember: {encouraging_message} Small changes lead to big results. What''s one thing you''re improving this week?', 'friendly', 'tip', 'morning'),
('scientific_controversy', 'Scientific Health Controversy', 'Plot twist: {surprising_reversal} 🔬 Recent studies show {new_evidence} This contradicts {old_belief}. Science evolves - our habits should too.', 'scientific', 'myth_bust', 'any')
ON CONFLICT (id) DO UPDATE SET
    template = EXCLUDED.template,
    updated_at = NOW();

-- Insert sample content knowledge base entries
INSERT INTO content_knowledge_base (idea_text, topic, fact_type, tags) VALUES
('Most fitness trackers overestimate calorie burn by 15-30% because they use population averages instead of individual metabolic rates', 'fitness_tracking', 'myth', '["fitness", "calories", "accuracy", "metabolism"]'),
('Drinking cold water can boost metabolism by 8-30% for 90 minutes as your body works to warm it', 'metabolism', 'fact', '["water", "metabolism", "thermogenesis", "weight_loss"]'),
('Taking vitamin D with K2 increases absorption by 200% compared to D3 alone', 'supplements', 'tip', '["vitamin_d", "k2", "absorption", "synergy"]'),
('Blue light exposure after 9 PM reduces melatonin production by up to 90%', 'sleep', 'fact', '["blue_light", "melatonin", "sleep", "circadian"]'),
('Intermittent fasting may reduce inflammation markers more than continuous calorie restriction', 'nutrition', 'insight', '["fasting", "inflammation", "diet", "health"]'),
('Your gut microbiome changes completely every 3-4 days based on what you eat', 'gut_health', 'fact', '["microbiome", "gut", "diet", "bacteria"]'),
('Chronic stress increases cortisol, which blocks fat burning even with perfect diet and exercise', 'stress', 'insight', '["stress", "cortisol", "fat_loss", "hormones"]'),
('Most people need 15-20 minutes of morning sunlight to regulate circadian rhythm', 'sleep', 'tip', '["sunlight", "circadian", "morning", "routine"]'),
('Magnesium deficiency affects 75% of adults and causes fatigue, anxiety, and poor sleep', 'supplements', 'fact', '["magnesium", "deficiency", "fatigue", "anxiety"]'),
('Eating protein within 30 minutes after exercise increases muscle synthesis by 25%', 'fitness', 'tip', '["protein", "exercise", "muscle", "timing"]')
ON CONFLICT DO NOTHING;

-- ===============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ===============================================

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON content_knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
    BEFORE UPDATE ON content_knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_enhanced_templates_updated_at ON enhanced_prompt_templates;
CREATE TRIGGER update_enhanced_templates_updated_at
    BEFORE UPDATE ON enhanced_prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- COMMENTS AND DOCUMENTATION
-- ===============================================

COMMENT ON TABLE used_idea_fingerprints IS 'Tracks idea fingerprints to prevent conceptual duplication within 60 days';
COMMENT ON TABLE content_knowledge_base IS 'Curated library of 300+ health facts and insights for content generation';
COMMENT ON TABLE enhanced_prompt_templates IS 'Prompt templates with tone and timing awareness for diverse content';
COMMENT ON TABLE prompt_rotation_history IS 'Tracks prompt usage to ensure variety and prevent overuse';
COMMENT ON TABLE tweet_performance_analysis IS 'Detailed analysis of tweet performance for learning optimization';
COMMENT ON TABLE learning_cycles IS 'Learning cycles that analyze performance and generate insights';
COMMENT ON TABLE learned_performance_patterns IS 'Extracted patterns from high-performing content';
COMMENT ON TABLE real_trending_topics IS 'Real-time trending health topics from external sources';
COMMENT ON TABLE trending_topic_usage IS 'Tracks usage of trending topics in content generation';
COMMENT ON TABLE trending_fetch_history IS 'History of trending topic fetch operations';

-- Grant necessary permissions (adjust schema as needed)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_bot_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_bot_user; 