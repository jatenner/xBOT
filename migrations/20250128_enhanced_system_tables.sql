-- 🚀 ENHANCED AUTONOMOUS TWITTER BOT SYSTEM TABLES
-- Database schema for advanced OpenAI integration improvements

-- ===============================================
-- ENHANCED SEMANTIC UNIQUENESS SYSTEM
-- ===============================================

-- Table for logging uniqueness attempts and results
CREATE TABLE IF NOT EXISTS uniqueness_logs (
    id BIGSERIAL PRIMARY KEY,
    candidate_text TEXT NOT NULL,
    is_unique BOOLEAN NOT NULL,
    max_similarity DECIMAL(4,3) NOT NULL,
    attempt_number INTEGER NOT NULL,
    similar_tweet_id TEXT,
    threshold_used DECIMAL(4,3) NOT NULL DEFAULT 0.88,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_uniqueness_logs_created_at ON uniqueness_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_uniqueness_logs_is_unique ON uniqueness_logs (is_unique);
CREATE INDEX IF NOT EXISTS idx_uniqueness_logs_similarity ON uniqueness_logs (max_similarity);

-- ===============================================
-- TRENDING TOPICS ENGINE
-- ===============================================

-- Table for storing trending topics
CREATE TABLE IF NOT EXISTS trending_topics (
    id BIGSERIAL PRIMARY KEY,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT CHECK (category IN ('health', 'wellness', 'nutrition', 'fitness', 'mental_health')) NOT NULL,
    popularity_score INTEGER NOT NULL CHECK (popularity_score >= 0 AND popularity_score <= 100),
    hashtag TEXT,
    context TEXT,
    source TEXT CHECK (source IN ('twitter', 'google', 'news', 'mock', 'engagement_learning')) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trending topics
CREATE INDEX IF NOT EXISTS idx_trending_topics_popularity ON trending_topics (popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_category ON trending_topics (category);
CREATE INDEX IF NOT EXISTS idx_trending_topics_updated ON trending_topics (last_updated DESC);

-- ===============================================
-- PROMPT TEMPLATE A/B TESTING SYSTEM
-- ===============================================

-- Enhanced prompt templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    type TEXT CHECK (type IN ('health_tip', 'myth_buster', 'discovery', 'controversial', 'viral_hook', 'data_driven')) NOT NULL,
    tone TEXT CHECK (tone IN ('authoritative', 'friendly', 'controversial', 'scientific', 'conversational')) NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('active', 'testing', 'retired', 'champion')) DEFAULT 'active',
    created_by TEXT CHECK (created_by IN ('human', 'ai')) DEFAULT 'human',
    parent_template TEXT REFERENCES prompt_templates(id),
    target_audience TEXT,
    expected_engagement TEXT CHECK (expected_engagement IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template usage tracking
CREATE TABLE IF NOT EXISTS template_usage (
    id BIGSERIAL PRIMARY KEY,
    template_id TEXT REFERENCES prompt_templates(id) ON DELETE CASCADE,
    tweet_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template performance metrics
CREATE TABLE IF NOT EXISTS template_performance (
    id BIGSERIAL PRIMARY KEY,
    template_id TEXT REFERENCES prompt_templates(id) ON DELETE CASCADE,
    tweet_id TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(6,4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, tweet_id)
);

-- A/B testing framework
CREATE TABLE IF NOT EXISTS ab_tests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template_a TEXT REFERENCES prompt_templates(id),
    template_b TEXT REFERENCES prompt_templates(id),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'completed', 'paused')) DEFAULT 'running',
    winner TEXT,
    statistical_significance DECIMAL(4,3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template optimizations log
CREATE TABLE IF NOT EXISTS template_optimizations (
    id BIGSERIAL PRIMARY KEY,
    template_id TEXT REFERENCES prompt_templates(id),
    old_template TEXT NOT NULL,
    new_template TEXT NOT NULL,
    optimization_reason TEXT,
    expected_improvement DECIMAL(5,2),
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for template system
CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage (template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_used_at ON template_usage (used_at);
CREATE INDEX IF NOT EXISTS idx_template_performance_template_id ON template_performance (template_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_engagement ON template_performance (engagement_rate DESC);

-- ===============================================
-- ENHANCED AI CLIENT SYSTEM
-- ===============================================

-- Content caching for AI responses
CREATE TABLE IF NOT EXISTS content_cache (
    id BIGSERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 10),
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI call logging and analytics
CREATE TABLE IF NOT EXISTS ai_call_logs (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL,
    model TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(8,4) DEFAULT 0,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content generation logging
CREATE TABLE IF NOT EXISTS content_generation_log (
    id BIGSERIAL PRIMARY KEY,
    template_id TEXT,
    content_preview TEXT,
    trending_topic TEXT,
    content_type TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for AI system
CREATE INDEX IF NOT EXISTS idx_content_cache_quality ON content_cache (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_created_at ON ai_call_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_success ON ai_call_logs (success);
CREATE INDEX IF NOT EXISTS idx_ai_call_logs_model ON ai_call_logs (model);

-- ===============================================
-- ENGAGEMENT-DRIVEN LEARNING SYSTEM
-- ===============================================

-- Content strategies storage
CREATE TABLE IF NOT EXISTS content_strategies (
    id BIGSERIAL PRIMARY KEY,
    strategy_type TEXT NOT NULL UNIQUE,
    strategy_value TEXT NOT NULL,
    performance_score DECIMAL(6,4),
    confidence_level DECIMAL(4,3),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning cycles tracking
CREATE TABLE IF NOT EXISTS learning_cycles (
    id BIGSERIAL PRIMARY KEY,
    patterns_count INTEGER DEFAULT 0,
    insights_count INTEGER DEFAULT 0,
    optimizations_count INTEGER DEFAULT 0,
    cycle_duration_ms INTEGER,
    cycle_completed_at TIMESTAMPTZ DEFAULT NOW(),
    results_summary JSONB
);

-- Engagement patterns analysis
CREATE TABLE IF NOT EXISTS engagement_patterns_log (
    id BIGSERIAL PRIMARY KEY,
    pattern_type TEXT NOT NULL,
    pattern_value TEXT NOT NULL,
    avg_engagement_rate DECIMAL(6,4),
    sample_size INTEGER,
    confidence_score DECIMAL(4,3),
    trend TEXT CHECK (trend IN ('improving', 'declining', 'stable')),
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for learning system
CREATE INDEX IF NOT EXISTS idx_learning_cycles_completed_at ON learning_cycles (cycle_completed_at);
CREATE INDEX IF NOT EXISTS idx_engagement_patterns_type ON engagement_patterns_log (pattern_type);
CREATE INDEX IF NOT EXISTS idx_engagement_patterns_engagement ON engagement_patterns_log (avg_engagement_rate DESC);

-- ===============================================
-- ENHANCED TWEETS TABLE UPDATES
-- ===============================================

-- Ensure tweets table has semantic embedding column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'semantic_embedding'
    ) THEN
        ALTER TABLE tweets ADD COLUMN semantic_embedding JSONB;
        CREATE INDEX IF NOT EXISTS idx_tweets_semantic_embedding ON tweets USING GIN (semantic_embedding);
        COMMENT ON COLUMN tweets.semantic_embedding IS 'OpenAI text embedding vector for semantic similarity detection';
    END IF;
END $$;

-- ===============================================
-- STORED PROCEDURES FOR ANALYTICS
-- ===============================================

-- Function to analyze engagement patterns
CREATE OR REPLACE FUNCTION analyze_engagement_patterns(
    days_back INTEGER DEFAULT 7,
    min_sample_size INTEGER DEFAULT 5
)
RETURNS TABLE (
    pattern_type TEXT,
    pattern_value TEXT,
    avg_engagement_rate DECIMAL,
    sample_size BIGINT,
    confidence_score DECIMAL,
    historical_performance DECIMAL[]
) AS $$
BEGIN
    -- This is a placeholder - actual implementation would analyze tweet patterns
    RETURN QUERY
    SELECT 
        'structure'::TEXT as pattern_type,
        'Question + Data + CTA'::TEXT as pattern_value,
        0.045::DECIMAL as avg_engagement_rate,
        15::BIGINT as sample_size,
        0.85::DECIMAL as confidence_score,
        ARRAY[0.03, 0.04, 0.045]::DECIMAL[] as historical_performance;
END;
$$ LANGUAGE plpgsql;

-- Function to get best performing template
CREATE OR REPLACE FUNCTION get_best_performing_template(
    content_type TEXT,
    tone_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    template TEXT,
    type TEXT,
    tone TEXT,
    avg_engagement_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.name,
        pt.template,
        pt.type,
        pt.tone,
        COALESCE(AVG(tp.engagement_rate), 0) as avg_engagement_rate
    FROM prompt_templates pt
    LEFT JOIN template_performance tp ON pt.id = tp.template_id
    WHERE pt.type = content_type
        AND pt.status = 'active'
        AND (tone_filter IS NULL OR pt.tone = tone_filter)
    GROUP BY pt.id, pt.name, pt.template, pt.type, pt.tone
    ORDER BY avg_engagement_rate DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get underperforming templates
CREATE OR REPLACE FUNCTION get_underperforming_templates(
    threshold DECIMAL DEFAULT 0.02
)
RETURNS TABLE (
    id TEXT,
    template TEXT,
    type TEXT,
    tone TEXT,
    avg_engagement_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.template,
        pt.type,
        pt.tone,
        COALESCE(AVG(tp.engagement_rate), 0) as avg_engagement_rate
    FROM prompt_templates pt
    LEFT JOIN template_performance tp ON pt.id = tp.template_id
    WHERE pt.status IN ('active', 'testing')
    GROUP BY pt.id, pt.template, pt.type, pt.tone
    HAVING COALESCE(AVG(tp.engagement_rate), 0) < threshold
    ORDER BY avg_engagement_rate ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get AI performance metrics
CREATE OR REPLACE FUNCTION get_ai_performance_metrics()
RETURNS TABLE (
    total_calls BIGINT,
    success_rate DECIMAL,
    average_response_time DECIMAL,
    total_cost DECIMAL,
    top_models JSONB,
    error_rate_by_model JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_calls,
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*) * 100) as success_rate,
        AVG(response_time_ms)::DECIMAL as average_response_time,
        SUM(cost)::DECIMAL as total_cost,
        jsonb_agg(jsonb_build_object('model', model, 'usage_count', usage_count)) as top_models,
        jsonb_agg(jsonb_build_object('model', model, 'error_rate', error_rate)) as error_rate_by_model
    FROM (
        SELECT 
            model,
            COUNT(*) as usage_count,
            (COUNT(*) FILTER (WHERE success = false)::DECIMAL / COUNT(*) * 100) as error_rate
        FROM ai_call_logs 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY model
        ORDER BY usage_count DESC
        LIMIT 5
    ) subq, ai_call_logs
    WHERE ai_call_logs.created_at >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get content generation analytics
CREATE OR REPLACE FUNCTION get_content_generation_analytics()
RETURNS TABLE (
    total_generations BIGINT,
    success_rate DECIMAL,
    average_attempts DECIMAL,
    top_templates JSONB,
    trending_topic_usage JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_generations,
        85.5::DECIMAL as success_rate, -- Placeholder
        12.3::DECIMAL as average_attempts, -- Placeholder
        '[]'::JSONB as top_templates, -- Placeholder
        '[]'::JSONB as trending_topic_usage -- Placeholder
    FROM content_generation_log
    WHERE generated_at >= NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get learning analytics
CREATE OR REPLACE FUNCTION get_learning_analytics()
RETURNS TABLE (
    total_cycles BIGINT,
    avg_patterns_per_cycle DECIMAL,
    avg_optimizations_per_cycle DECIMAL,
    total_template_improvements BIGINT,
    learning_effectiveness DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_cycles,
        AVG(patterns_count)::DECIMAL as avg_patterns_per_cycle,
        AVG(optimizations_count)::DECIMAL as avg_optimizations_per_cycle,
        (SELECT COUNT(*) FROM template_optimizations)::BIGINT as total_template_improvements,
        75.8::DECIMAL as learning_effectiveness -- Placeholder calculated metric
    FROM learning_cycles
    WHERE cycle_completed_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- INITIAL DATA SETUP
-- ===============================================

-- Insert some initial trending topics
INSERT INTO trending_topics (keyword, category, popularity_score, hashtag, context, source) VALUES
('intermittent fasting', 'nutrition', 85, '#IntermittentFasting', 'Popular eating pattern for weight management', 'mock'),
('cold therapy', 'wellness', 78, '#ColdTherapy', 'Ice baths and cold exposure benefits', 'mock'),
('sleep optimization', 'wellness', 82, '#SleepOptimization', 'Techniques for better sleep quality', 'mock'),
('gut health', 'health', 89, '#GutHealth', 'Microbiome and digestive wellness', 'mock'),
('stress management', 'mental_health', 75, '#StressManagement', 'Techniques for reducing chronic stress', 'mock')
ON CONFLICT (keyword) DO UPDATE SET
    popularity_score = EXCLUDED.popularity_score,
    last_updated = NOW();

-- Insert initial prompt templates
INSERT INTO prompt_templates (id, name, template, type, tone, status) VALUES
('template_health_tip_01', 'Health Tip with Data', 'Health insight: {insight}. Research shows {data_point}. Try this: {action}. What''s your experience?', 'health_tip', 'friendly', 'champion'),
('template_myth_buster_01', 'Myth Buster Format', 'Myth: {myth_statement}. Reality: {truth_statement}. The science: {explanation}. Have you believed this myth?', 'myth_buster', 'authoritative', 'active'),
('template_discovery_01', 'Discovery Hook', 'Surprising discovery: {finding}. The mechanism: {explanation}. This changes how we think about {topic}.', 'discovery', 'scientific', 'active'),
('template_viral_hook_01', 'Viral Question Hook', 'Did you know {surprising_fact}? Most people don''t realize {explanation}. What other health myths should we bust?', 'viral_hook', 'conversational', 'testing')
ON CONFLICT (id) DO UPDATE SET
    template = EXCLUDED.template,
    updated_at = NOW();

-- Insert initial content strategies
INSERT INTO content_strategies (strategy_type, strategy_value, performance_score) VALUES
('optimal_structure', 'Hook + Data + Action + Question', 0.045),
('optimal_hashtags', '#Health, #Wellness, #Science', 0.038),
('optimal_length', '240-270 characters', 0.042),
('best_posting_times', '8AM, 2PM, 7PM EST', 0.041)
ON CONFLICT (strategy_type) DO UPDATE SET
    strategy_value = EXCLUDED.strategy_value,
    performance_score = EXCLUDED.performance_score,
    updated_at = NOW();

-- ===============================================
-- COMMENTS AND DOCUMENTATION
-- ===============================================

COMMENT ON TABLE uniqueness_logs IS 'Logs semantic uniqueness checks for content generation';
COMMENT ON TABLE trending_topics IS 'Stores trending health topics for content enhancement';
COMMENT ON TABLE prompt_templates IS 'A/B testing framework for prompt templates';
COMMENT ON TABLE template_usage IS 'Tracks which templates are used for which tweets';
COMMENT ON TABLE template_performance IS 'Stores engagement metrics per template usage';
COMMENT ON TABLE content_cache IS 'Caches AI-generated content for reuse';
COMMENT ON TABLE ai_call_logs IS 'Comprehensive logging of all AI API calls';
COMMENT ON TABLE content_strategies IS 'Stores learned optimal content strategies';
COMMENT ON TABLE learning_cycles IS 'Tracks engagement-driven learning cycles';

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_bot_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_bot_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_bot_user; 