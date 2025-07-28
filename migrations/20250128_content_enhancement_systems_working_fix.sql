-- ===============================================
-- CONTENT ENHANCEMENT SYSTEMS MIGRATION (WORKING FIX)
-- Implements 5 major upgrades for content quality and diversity
-- FIXED VERSION: Removes problematic column references
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
    extracted_concept TEXT,
    primary_concept TEXT,
    health_category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_fingerprint ON used_idea_fingerprints (fingerprint);
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_date_used ON used_idea_fingerprints (date_used);
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_health_category ON used_idea_fingerprints (health_category);

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
    difficulty_level TEXT DEFAULT 'intermediate',
    fact_type TEXT DEFAULT 'insight',
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

-- Track prompt template usage history (14-day window)
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

-- Indexes for prompt rotation
CREATE INDEX IF NOT EXISTS idx_prompt_templates_tone ON enhanced_prompt_templates (tone);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_time_pref ON enhanced_prompt_templates (time_preference);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_performance ON enhanced_prompt_templates (performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_rotation_history_template ON prompt_rotation_history (template_id);
CREATE INDEX IF NOT EXISTS idx_prompt_rotation_history_time ON prompt_rotation_history (time_used);

-- ===============================================
-- 4. TWEET PERFORMANCE ANALYSIS
-- ===============================================

-- Enhanced tweet performance tracking
CREATE TABLE IF NOT EXISTS tweet_performance_analysis (
    id BIGSERIAL PRIMARY KEY,
    tweet_id TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    tone TEXT,
    content_type TEXT,
    template_id TEXT,
    engagement_score DECIMAL(8,4) DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(6,4) DEFAULT 0,
    posting_time TIMESTAMPTZ NOT NULL,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    performance_category TEXT DEFAULT 'pending',
    learning_tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance analysis
CREATE INDEX IF NOT EXISTS idx_tweet_performance_tweet_id ON tweet_performance_analysis (tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_engagement ON tweet_performance_analysis (engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_posting_time ON tweet_performance_analysis (posting_time);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_tone ON tweet_performance_analysis (tone);

-- ===============================================
-- 5. LEARNING CYCLES & OPTIMIZATION
-- ===============================================

-- Learning cycles for performance optimization
CREATE TABLE IF NOT EXISTS learning_cycles (
    id BIGSERIAL PRIMARY KEY,
    cycle_date DATE NOT NULL,
    analyzed_tweets INTEGER DEFAULT 0,
    performance_insights JSONB DEFAULT '{}'::jsonb,
    content_recommendations JSONB DEFAULT '{}'::jsonb,
    template_adjustments JSONB DEFAULT '{}'::jsonb,
    engagement_patterns JSONB DEFAULT '{}'::jsonb,
    confidence_score DECIMAL(6,4) DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for learning cycles
CREATE INDEX IF NOT EXISTS idx_learning_cycles_date ON learning_cycles (cycle_date);
CREATE INDEX IF NOT EXISTS idx_learning_cycles_completed ON learning_cycles (completed);

-- ===============================================
-- 6. ENGAGEMENT ACTIONS TRACKING
-- ===============================================

-- Track smart engagement actions
CREATE TABLE IF NOT EXISTS engagement_actions (
    id BIGSERIAL PRIMARY KEY,
    action_type TEXT NOT NULL, -- 'like', 'follow', 'reply', 'unfollow'
    target_user TEXT NOT NULL,
    target_tweet_id TEXT,
    our_tweet_id TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    response_data JSONB DEFAULT '{}'::jsonb,
    relevance_score DECIMAL(6,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for engagement tracking
CREATE INDEX IF NOT EXISTS idx_engagement_actions_type ON engagement_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_engagement_actions_performed ON engagement_actions (performed_at);
CREATE INDEX IF NOT EXISTS idx_engagement_actions_target ON engagement_actions (target_user);

-- ===============================================
-- 7. GROWTH STRATEGIES
-- ===============================================

-- Growth strategy optimization
CREATE TABLE IF NOT EXISTS growth_strategies (
    id BIGSERIAL PRIMARY KEY,
    strategy_date DATE NOT NULL,
    daily_post_frequency INTEGER DEFAULT 17,
    preferred_times TEXT[],
    priority_content_types TEXT[],
    trending_topic_usage DECIMAL(4,2) DEFAULT 0.30,
    experimental_content DECIMAL(4,2) DEFAULT 0.20,
    reasoning TEXT,
    confidence_score DECIMAL(6,4) DEFAULT 0,
    active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for growth strategies
CREATE INDEX IF NOT EXISTS idx_growth_strategies_date ON growth_strategies (strategy_date);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_active ON growth_strategies (active);

-- ===============================================
-- 8. REAL TRENDING TOPICS
-- ===============================================

-- Real-time trending health topics
CREATE TABLE IF NOT EXISTS real_trending_topics (
    id BIGSERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    source TEXT NOT NULL,
    volume INTEGER DEFAULT 0,
    sentiment TEXT DEFAULT 'neutral',
    health_relevance DECIMAL(4,2) DEFAULT 0,
    usage_potential DECIMAL(4,2) DEFAULT 0,
    expires_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    used_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trending topics
CREATE INDEX IF NOT EXISTS idx_trending_topics_health_relevance ON real_trending_topics (health_relevance DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_fetched_at ON real_trending_topics (fetched_at);
CREATE INDEX IF NOT EXISTS idx_trending_topics_expires_at ON real_trending_topics (expires_at);

-- ===============================================
-- STORED PROCEDURES
-- ===============================================

-- Function to check idea fingerprint usage
CREATE OR REPLACE FUNCTION check_idea_fingerprint_usage(
    p_fingerprint TEXT,
    p_days_back INTEGER DEFAULT 60
) RETURNS TABLE (
    is_used BOOLEAN,
    last_used_date TIMESTAMPTZ,
    usage_count INTEGER,
    similar_content TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH fingerprint_usage AS (
        SELECT 
            COUNT(*) as usage_count,
            MAX(date_used) as last_used_date,
            ARRAY_AGG(original_content ORDER BY date_used DESC) as similar_content
        FROM used_idea_fingerprints 
        WHERE fingerprint = p_fingerprint 
        AND date_used >= NOW() - INTERVAL '1 day' * p_days_back
    )
    SELECT 
        (usage_count > 0)::BOOLEAN as is_used,
        last_used_date,
        usage_count::INTEGER,
        similar_content
    FROM fingerprint_usage;
END;
$$ LANGUAGE plpgsql;

-- Function to get unused knowledge base ideas
CREATE OR REPLACE FUNCTION get_unused_knowledge_base_ideas(
    p_topic TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    id BIGINT,
    idea_text TEXT,
    topic TEXT,
    fact_type TEXT,
    performance_score DECIMAL
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
    AND (p_topic IS NULL OR kb.topic = p_topic)
    ORDER BY kb.performance_score DESC, RANDOM()
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- SAMPLE DATA INSERTION
-- ===============================================

-- Insert sample prompt templates
INSERT INTO enhanced_prompt_templates (id, name, template, tone, content_type, time_preference) 
VALUES 
('health_tip_friendly', 'Friendly Health Tip', 'Here''s a simple health tip: {health_fact} Try incorporating this into your daily routine! #HealthTip #Wellness', 'friendly', 'tip', 'morning'),
('science_fact', 'Scientific Fact', 'Research shows: {health_fact} The science behind optimal health continues to amaze. #HealthScience #Research', 'scientific', 'fact', 'afternoon'),
('myth_buster', 'Myth Buster', 'Health myth busted: {health_fact} It''s time to update what we know about wellness. #MythBusted #HealthFacts', 'controversial', 'myth_bust', 'evening'),
('personal_insight', 'Personal Insight', 'Personal insight: {health_fact} Small changes can lead to big transformations. #HealthJourney #Mindfulness', 'personal', 'insight', 'any'),
('question_prompt', 'Engaging Question', 'Quick question: {health_fact} What''s your experience with this? Share below! #HealthCommunity #Discussion', 'friendly', 'question', 'any')
ON CONFLICT (id) DO NOTHING;

-- Insert sample knowledge base entries
INSERT INTO content_knowledge_base (idea_text, topic, fact_type, difficulty_level)
VALUES 
('Drinking cold water can boost metabolism by 8-30% for 90 minutes as your body works to warm it up', 'metabolism', 'fact', 'basic'),
('Intermittent fasting may help reduce inflammation markers and improve cellular repair processes', 'nutrition', 'insight', 'intermediate'),
('Blue light exposure in the evening can suppress melatonin production by up to 90%', 'sleep', 'fact', 'intermediate'),
('Regular strength training can increase bone density and reduce fracture risk by up to 40%', 'fitness', 'fact', 'basic'),
('Chronic stress can shrink the prefrontal cortex while enlarging the amygdala, affecting decision-making', 'mental_health', 'insight', 'advanced')
ON CONFLICT DO NOTHING;

-- ===============================================
-- SUCCESS MESSAGE
-- ===============================================

DO $$
BEGIN
    RAISE NOTICE 'Content Enhancement Systems migration completed successfully!';
    RAISE NOTICE 'Created tables: used_idea_fingerprints, content_knowledge_base, enhanced_prompt_templates, prompt_rotation_history, tweet_performance_analysis, learning_cycles, engagement_actions, growth_strategies, real_trending_topics';
    RAISE NOTICE 'Created functions: check_idea_fingerprint_usage, get_unused_knowledge_base_ideas';
    RAISE NOTICE 'Loaded sample data: 5 prompt templates, 5 knowledge base entries';
END $$; 