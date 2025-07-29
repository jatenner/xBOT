-- 🧠 TWEET LEARNING SYSTEM DATABASE MIGRATION - FIXED VERSION
-- ==================================================
-- Advanced AI learning system for Twitter bot optimization
-- Date: 2025-01-27 (Fixed)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ===================================================================
-- 1. VIRAL TWEET LEARNING TABLE
-- Stores high-performing tweets scraped from Twitter for analysis
-- ===================================================================
CREATE TABLE IF NOT EXISTS viral_tweets_learned (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    author_username VARCHAR(100) NOT NULL,
    author_follower_count INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    
    -- Performance metrics
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    viral_score DECIMAL(8,4) DEFAULT 0,
    
    -- Content structure analysis
    format_type VARCHAR(50), -- 'hook_value_cta', 'news_commentary', 'fact_dump', 'storytelling', 'thread'
    character_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
    word_count INTEGER,
    sentence_count INTEGER,
    paragraph_count INTEGER,
    has_emojis BOOLEAN DEFAULT false,
    emoji_count INTEGER DEFAULT 0,
    has_hashtags BOOLEAN DEFAULT false,
    hashtag_count INTEGER DEFAULT 0,
    has_mentions BOOLEAN DEFAULT false,
    mention_count INTEGER DEFAULT 0,
    has_media BOOLEAN DEFAULT false,
    media_type VARCHAR(50), -- 'image', 'video', 'gif', 'none'
    
    -- Style analysis
    tone VARCHAR(50), -- 'casual', 'professional', 'humorous', 'controversial', 'educational'
    sentiment_score DECIMAL(5,3) DEFAULT 0, -- -1 to 1
    readability_score DECIMAL(5,2) DEFAULT 0,
    urgency_level INTEGER DEFAULT 0, -- 1-10 scale
    authority_signals INTEGER DEFAULT 0, -- Count of credibility indicators
    
    -- Topic classification
    primary_topic VARCHAR(100),
    secondary_topic VARCHAR(100),
    health_category VARCHAR(50), -- 'fitness', 'nutrition', 'mental_health', 'medical', 'wellness'
    controversy_level INTEGER DEFAULT 0, -- 1-10 scale
    
    -- Learning metadata
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    last_analyzed TIMESTAMPTZ,
    analysis_version INTEGER DEFAULT 1,
    embedding vector(1536), -- OpenAI embedding for similarity
    
    -- Performance tracking
    performance_tier VARCHAR(20) DEFAULT 'high', -- 'viral', 'high', 'medium', 'low'
    growth_attribution JSONB DEFAULT '{}', -- What made this viral
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 2. CONTENT FORMAT FINGERPRINTS
-- Tracks successful content patterns and structures
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_format_fingerprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    format_name VARCHAR(100) UNIQUE NOT NULL,
    format_pattern TEXT NOT NULL, -- Template pattern like "Did you know {fact}? Here's why: {explanation}"
    
    -- Performance metrics
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,3) DEFAULT 0,
    avg_engagement DECIMAL(8,4) DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_retweets INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,
    
    -- Format characteristics
    optimal_length_min INTEGER,
    optimal_length_max INTEGER,
    works_best_with_media BOOLEAN DEFAULT false,
    preferred_time_slots INTEGER[], -- Hours 0-23 when this format works best
    audience_segments TEXT[], -- Which audiences respond best
    
    -- Learning data
    discovered_from_tweet_id VARCHAR(50),
    confidence_score DECIMAL(5,3) DEFAULT 0,
    last_successful_use TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 3. TWEET GENERATION SESSIONS
-- Tracks each AI generation session and its parameters
-- ===================================================================
CREATE TABLE IF NOT EXISTS tweet_generation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'experimental', 'a_b_test'
    
    -- Input parameters
    requested_topic VARCHAR(200),
    requested_format VARCHAR(50),
    requested_tone VARCHAR(50),
    template_used TEXT,
    prompt_version VARCHAR(20),
    
    -- AI parameters
    model_used VARCHAR(50) DEFAULT 'gpt-4o-mini',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 300,
    top_p DECIMAL(3,2) DEFAULT 1.0,
    
    -- Learning context
    successful_patterns_used JSONB DEFAULT '[]',
    viral_examples_referenced JSONB DEFAULT '[]',
    past_performance_context JSONB DEFAULT '{}',
    
    -- Generation results
    candidates_generated INTEGER DEFAULT 1,
    selected_content TEXT,
    content_quality_score DECIMAL(5,3) DEFAULT 0,
    uniqueness_score DECIMAL(5,3) DEFAULT 0,
    predicted_engagement DECIMAL(8,4) DEFAULT 0,
    
    -- Actual results (updated after posting)
    actual_tweet_id VARCHAR(50),
    actual_likes INTEGER DEFAULT 0,
    actual_retweets INTEGER DEFAULT 0,
    actual_replies INTEGER DEFAULT 0,
    actual_engagement_rate DECIMAL(8,4) DEFAULT 0,
    
    -- Learning outcomes
    prediction_accuracy DECIMAL(5,3) DEFAULT 0, -- How close prediction was to reality
    lessons_learned JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 4. ENGAGEMENT FEEDBACK LOOP
-- Real-time tracking of tweet performance for learning
-- ===================================================================
CREATE TABLE IF NOT EXISTS engagement_feedback_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    tracking_session_id UUID,
    
    -- Timestamp tracking
    posted_at TIMESTAMPTZ NOT NULL,
    first_tracked_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Performance snapshots (time series)
    engagement_snapshots JSONB DEFAULT '[]', -- Array of {timestamp, likes, retweets, etc}
    
    -- Current metrics
    current_likes INTEGER DEFAULT 0,
    current_retweets INTEGER DEFAULT 0,
    current_replies INTEGER DEFAULT 0,
    current_quotes INTEGER DEFAULT 0,
    current_views INTEGER DEFAULT 0,
    current_engagement_rate DECIMAL(8,4) DEFAULT 0,
    
    -- Growth analysis
    likes_growth_rate DECIMAL(8,4) DEFAULT 0, -- Per hour
    retweets_growth_rate DECIMAL(8,4) DEFAULT 0,
    engagement_velocity DECIMAL(8,4) DEFAULT 0, -- Overall engagement speed
    peak_engagement_hour INTEGER, -- Hour when engagement peaked
    
    -- Learning flags
    is_viral BOOLEAN DEFAULT false, -- Marked as viral if metrics exceed thresholds
    is_successful BOOLEAN DEFAULT false, -- Above average performance
    requires_analysis BOOLEAN DEFAULT true, -- Needs AI analysis
    analysis_completed BOOLEAN DEFAULT false,
    
    -- Content context (copied for easy analysis)
    content TEXT,
    format_type VARCHAR(50),
    tone VARCHAR(50),
    topic VARCHAR(200),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 5. PERFORMANCE PATTERN LEARNING
-- AI-discovered patterns about what works
-- ===================================================================
CREATE TABLE IF NOT EXISTS performance_patterns_learned (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type VARCHAR(50) NOT NULL, -- 'timing', 'format', 'topic', 'style', 'length'
    pattern_name VARCHAR(200) NOT NULL,
    pattern_description TEXT NOT NULL,
    
    -- Pattern strength
    confidence_score DECIMAL(5,3) DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    statistical_significance DECIMAL(5,3) DEFAULT 0,
    
    -- Performance impact
    performance_boost DECIMAL(8,4) DEFAULT 0, -- How much this pattern improves engagement
    baseline_comparison DECIMAL(8,4) DEFAULT 0,
    
    -- Pattern details
    pattern_data JSONB NOT NULL, -- Specific pattern parameters
    conditions JSONB DEFAULT '{}', -- When this pattern applies
    examples JSONB DEFAULT '[]', -- Example tweets that demonstrate this pattern
    
    -- Validation
    discovered_date TIMESTAMPTZ DEFAULT NOW(),
    last_validated TIMESTAMPTZ,
    validation_count INTEGER DEFAULT 0,
    still_effective BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(pattern_type, pattern_name)
);

-- ===================================================================
-- 6. TOPIC RESONANCE TRACKING
-- Learn which topics work best with your audience
-- ===================================================================
CREATE TABLE IF NOT EXISTS topic_resonance_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic VARCHAR(200) UNIQUE NOT NULL,
    category VARCHAR(100), -- health_category grouping
    
    -- Engagement metrics
    total_tweets INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_retweets INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,
    avg_engagement_rate DECIMAL(8,4) DEFAULT 0,
    
    -- Performance analysis
    best_performing_tweet_id VARCHAR(50),
    worst_performing_tweet_id VARCHAR(50),
    consistency_score DECIMAL(5,3) DEFAULT 0, -- How consistently this topic performs
    trend_direction VARCHAR(20) DEFAULT 'stable', -- 'rising', 'falling', 'stable'
    
    -- Timing insights
    best_posting_hours INTEGER[], -- Hours when this topic performs best
    best_posting_days INTEGER[], -- Days of week (0-6)
    
    -- Audience insights
    audience_segments JSONB DEFAULT '{}', -- Which audience types engage most
    demographics_data JSONB DEFAULT '{}',
    
    -- Learning metadata
    last_posted TIMESTAMPTZ,
    last_analyzed TIMESTAMPTZ,
    next_suggested_post TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 7. INTELLIGENT PROMPT EVOLUTION
-- Track how prompts evolve and perform over time
-- ===================================================================
CREATE TABLE IF NOT EXISTS intelligent_prompt_evolution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_version VARCHAR(50) NOT NULL,
    prompt_type VARCHAR(100) NOT NULL, -- 'tweet_generation', 'reply_generation', 'analysis'
    
    -- Prompt content
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    parameters JSONB DEFAULT '{}',
    
    -- Performance tracking
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,3) DEFAULT 0,
    avg_quality_score DECIMAL(5,3) DEFAULT 0,
    avg_engagement_achieved DECIMAL(8,4) DEFAULT 0,
    
    -- Evolution tracking
    parent_prompt_id UUID, -- What prompt this evolved from
    evolution_reason TEXT, -- Why this prompt was created
    improvements_made TEXT[],
    
    -- Effectiveness
    is_active BOOLEAN DEFAULT true,
    is_experimental BOOLEAN DEFAULT false,
    a_b_test_results JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(prompt_version, prompt_type)
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================

-- Viral tweets learning
CREATE INDEX IF NOT EXISTS idx_viral_tweets_engagement_rate ON viral_tweets_learned(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_viral_tweets_viral_score ON viral_tweets_learned(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_tweets_topic ON viral_tweets_learned(primary_topic);
CREATE INDEX IF NOT EXISTS idx_viral_tweets_format ON viral_tweets_learned(format_type);
CREATE INDEX IF NOT EXISTS idx_viral_tweets_scraped_at ON viral_tweets_learned(scraped_at DESC);

-- Content format fingerprints
CREATE INDEX IF NOT EXISTS idx_format_fingerprints_success_rate ON content_format_fingerprints(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_format_fingerprints_usage ON content_format_fingerprints(usage_count DESC);

-- Tweet generation sessions
CREATE INDEX IF NOT EXISTS idx_generation_sessions_created ON tweet_generation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_sessions_accuracy ON tweet_generation_sessions(prediction_accuracy DESC);

-- Engagement feedback
CREATE INDEX IF NOT EXISTS idx_engagement_feedback_tweet_id ON engagement_feedback_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_feedback_posted_at ON engagement_feedback_tracking(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_feedback_viral ON engagement_feedback_tracking(is_viral, is_successful);

-- Performance patterns
CREATE INDEX IF NOT EXISTS idx_performance_patterns_confidence ON performance_patterns_learned(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_performance_patterns_type ON performance_patterns_learned(pattern_type);

-- Topic resonance
CREATE INDEX IF NOT EXISTS idx_topic_resonance_engagement ON topic_resonance_tracking(avg_engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_topic_resonance_topic ON topic_resonance_tracking(topic);

-- Prompt evolution
CREATE INDEX IF NOT EXISTS idx_prompt_evolution_success_rate ON intelligent_prompt_evolution(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_evolution_active ON intelligent_prompt_evolution(is_active, prompt_type);

-- ===================================================================
-- FUNCTIONS FOR AUTOMATED LEARNING
-- ===================================================================

-- Function to calculate viral score
CREATE OR REPLACE FUNCTION calculate_viral_score(
    likes INTEGER,
    retweets INTEGER,
    replies INTEGER,
    views INTEGER,
    follower_count INTEGER
) RETURNS DECIMAL(8,4) AS $$
BEGIN
    -- Viral score formula: engagement rate * reach factor * interaction quality
    RETURN CASE 
        WHEN views > 0 AND follower_count > 0 THEN
            ((likes + retweets + replies)::DECIMAL / views) * 
            (LEAST(views::DECIMAL / follower_count, 10)) * 
            ((retweets * 2 + replies * 3 + likes)::DECIMAL / (likes + retweets + replies + 1))
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to update engagement rate
CREATE OR REPLACE FUNCTION update_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.engagement_rate := CASE
        WHEN NEW.views > 0 THEN 
            (NEW.likes + NEW.retweets + NEW.replies)::DECIMAL / NEW.views
        ELSE 0
    END;
    
    NEW.viral_score := calculate_viral_score(
        NEW.likes, NEW.retweets, NEW.replies, NEW.views, 
        COALESCE(NEW.author_follower_count, 0)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate engagement rates for viral tweets
DROP TRIGGER IF EXISTS trigger_viral_tweets_engagement_rate ON viral_tweets_learned;
CREATE TRIGGER trigger_viral_tweets_engagement_rate
    BEFORE INSERT OR UPDATE ON viral_tweets_learned
    FOR EACH ROW
    EXECUTE FUNCTION update_engagement_rate();

-- Function for engagement feedback tracking
CREATE OR REPLACE FUNCTION update_feedback_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_engagement_rate := CASE
        WHEN NEW.current_views > 0 THEN 
            (NEW.current_likes + NEW.current_retweets + NEW.current_replies)::DECIMAL / NEW.current_views
        ELSE 0
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for feedback tracking
DROP TRIGGER IF EXISTS trigger_feedback_engagement_rate ON engagement_feedback_tracking;
CREATE TRIGGER trigger_feedback_engagement_rate
    BEFORE INSERT OR UPDATE ON engagement_feedback_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_engagement_rate();

-- ===================================================================
-- INITIAL SETUP DATA
-- ===================================================================

-- Insert some baseline format fingerprints
INSERT INTO content_format_fingerprints (format_name, format_pattern, confidence_score) VALUES
('Hook_Value_CTA', 'Did you know {surprising_fact}? Here''s what this means for you: {explanation}', 0.8),
('News_Commentary', '{news_headline} This changes everything because {analysis}', 0.7),
('Fact_Dump', '{number} {category} facts that will {benefit}: {list_items}', 0.6),
('Storytelling', 'I used to {old_belief} until I discovered {new_insight}. Now {transformation}', 0.9),
('Question_Hook', 'Why do {common_behavior} when {better_alternative}? The answer: {explanation}', 0.8),
('Controversy', 'Unpopular opinion: {controversial_statement}. The data shows {supporting_evidence}', 0.7),
('Research_Reveal', 'New study reveals {finding}. The mechanism: {scientific_explanation}', 0.8),
('Personal_Discovery', 'After {experience/research}, I discovered {insight}. Game changer: {impact}', 0.9)
ON CONFLICT (format_name) DO UPDATE SET 
    format_pattern = EXCLUDED.format_pattern,
    confidence_score = EXCLUDED.confidence_score;

-- Insert baseline prompt evolution
INSERT INTO intelligent_prompt_evolution (prompt_version, prompt_type, system_prompt, user_prompt_template, is_active) VALUES
('v1.0', 'tweet_generation', 
'You are an expert health content creator specializing in viral, engaging Twitter content that educates and inspires.',
'Create a high-engagement health tweet about {topic} using the format: {format}. Make it surprising, actionable, and scientifically accurate.',
true),
('v1.0', 'analysis',
'You are an AI that analyzes tweet performance to extract learning insights.',
'Analyze this tweet''s performance and extract 3 key learnings: {tweet_data}',
true)
ON CONFLICT (prompt_version, prompt_type) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    is_active = EXCLUDED.is_active;

-- Add helpful comments
COMMENT ON TABLE viral_tweets_learned IS 'Stores high-performing tweets scraped from Twitter for structure and style learning';
COMMENT ON TABLE content_format_fingerprints IS 'Tracks successful content patterns and templates discovered through analysis';
COMMENT ON TABLE tweet_generation_sessions IS 'Records each AI generation session with parameters and results for learning';
COMMENT ON TABLE engagement_feedback_tracking IS 'Real-time performance tracking for immediate learning feedback';
COMMENT ON TABLE performance_patterns_learned IS 'AI-discovered patterns about what content strategies work best';
COMMENT ON TABLE topic_resonance_tracking IS 'Tracks which topics resonate most with the audience';
COMMENT ON TABLE intelligent_prompt_evolution IS 'Evolution of AI prompts based on performance learning';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Tweet Learning System migration completed successfully! 🧠✅';
    RAISE NOTICE 'Created 7 tables, 15 indexes, 3 functions, and 2 triggers for AI learning.';
END $$;