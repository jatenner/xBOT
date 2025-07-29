-- 🎯 INFLUENCER REPLY SYSTEM MIGRATION
-- Creates tables for intelligent human-like replies and performance tracking

-- Table 1: Influencer tweets for reply targeting
CREATE TABLE IF NOT EXISTS influencer_tweets (
    id TEXT PRIMARY KEY,
    author_username TEXT NOT NULL,
    author_display_name TEXT,
    content TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    like_count INTEGER DEFAULT 0,
    retweet_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_reply_target BOOLEAN DEFAULT FALSE,
    replied_to BOOLEAN DEFAULT FALSE,
    reply_tweet_id TEXT,
    relevance_score FLOAT DEFAULT 0.0,
    topic_category TEXT,
    engagement_velocity FLOAT DEFAULT 0.0, -- likes/hour
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Table 2: Topic × Format Performance Matrix
CREATE TABLE IF NOT EXISTS topic_format_performance (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    format TEXT NOT NULL, -- 'Hook-Value-CTA', 'Research_Bomb', etc.
    avg_engagement FLOAT DEFAULT 0.0,
    sample_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    performance_trend FLOAT DEFAULT 0.0, -- +/- trend
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(topic, format)
);

-- Table 3: Reply history and context tracking
CREATE TABLE IF NOT EXISTS reply_history (
    id SERIAL PRIMARY KEY,
    target_tweet_id TEXT NOT NULL,
    target_author TEXT NOT NULL,
    target_content_excerpt TEXT,
    reply_tweet_id TEXT,
    reply_content TEXT,
    citation_used TEXT,
    response_tone TEXT, -- 'supportive', 'questioning', 'contrarian'
    engagement_received JSONB DEFAULT '{}'::jsonb,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    was_successful BOOLEAN DEFAULT FALSE,
    follow_back_received BOOLEAN DEFAULT FALSE,
    similarity_to_previous FLOAT DEFAULT 0.0
);

-- Table 4: Research citations database
CREATE TABLE IF NOT EXISTS research_citations (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    citation_text TEXT NOT NULL,
    source_url TEXT,
    pubmed_id TEXT,
    credibility_score FLOAT DEFAULT 0.8,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    effectiveness_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 5: Content style variations tracking
CREATE TABLE IF NOT EXISTS content_style_variations (
    id SERIAL PRIMARY KEY,
    style_label TEXT NOT NULL, -- '🧠 Data-driven', '🔥 Contrarian', etc.
    usage_count INTEGER DEFAULT 0,
    avg_engagement FLOAT DEFAULT 0.0,
    last_used TIMESTAMP WITH TIME ZONE,
    hour_performance JSONB DEFAULT '{}'::jsonb, -- performance by hour
    topic_performance JSONB DEFAULT '{}'::jsonb, -- performance by topic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(style_label)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_influencer_tweets_author ON influencer_tweets (author_username);
CREATE INDEX IF NOT EXISTS idx_influencer_tweets_engagement ON influencer_tweets (engagement_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_tweets_target ON influencer_tweets (is_reply_target, replied_to);
CREATE INDEX IF NOT EXISTS idx_influencer_tweets_created ON influencer_tweets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_tweets_topic ON influencer_tweets (topic_category);

CREATE INDEX IF NOT EXISTS idx_topic_format_performance ON topic_format_performance (avg_engagement DESC);
CREATE INDEX IF NOT EXISTS idx_topic_format_last_used ON topic_format_performance (last_used);

CREATE INDEX IF NOT EXISTS idx_reply_history_target ON reply_history (target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_history_posted ON reply_history (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_history_successful ON reply_history (was_successful);

CREATE INDEX IF NOT EXISTS idx_research_citations_topic ON research_citations (topic);
CREATE INDEX IF NOT EXISTS idx_research_citations_usage ON research_citations (usage_count);
CREATE INDEX IF NOT EXISTS idx_research_citations_effectiveness ON research_citations (effectiveness_score DESC);

CREATE INDEX IF NOT EXISTS idx_style_variations_engagement ON content_style_variations (avg_engagement DESC);
CREATE INDEX IF NOT EXISTS idx_style_variations_last_used ON content_style_variations (last_used);

-- Functions for intelligent selection
CREATE OR REPLACE FUNCTION get_best_reply_targets(
    limit_count INTEGER DEFAULT 5,
    min_engagement INTEGER DEFAULT 100
) RETURNS TABLE (
    tweet_id TEXT,
    author TEXT,
    content_excerpt TEXT,
    url TEXT,
    engagement_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id as tweet_id,
        i.author_username as author,
        LEFT(i.content, 80) as content_excerpt,
        i.url,
        i.engagement_velocity as engagement_score
    FROM influencer_tweets i
    WHERE i.created_at > NOW() - INTERVAL '4 hours'
        AND i.like_count > min_engagement
        AND i.reply_count < 50
        AND i.replied_to = FALSE
        AND i.is_reply_target = TRUE
    ORDER BY i.engagement_velocity DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_optimal_topic_format(
    current_hour INTEGER DEFAULT EXTRACT(HOUR FROM NOW())
) RETURNS TABLE (
    topic TEXT,
    format TEXT,
    expected_engagement FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tfp.topic,
        tfp.format,
        tfp.avg_engagement as expected_engagement
    FROM topic_format_performance tfp
    WHERE tfp.last_used < NOW() - INTERVAL '24 hours'
        OR tfp.last_used IS NULL
    ORDER BY tfp.avg_engagement DESC, tfp.last_used ASC NULLS FIRST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_format_performance(
    p_topic TEXT,
    p_format TEXT,
    p_engagement FLOAT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO topic_format_performance (topic, format, avg_engagement, sample_count, last_used)
    VALUES (p_topic, p_format, p_engagement, 1, NOW())
    ON CONFLICT (topic, format) 
    DO UPDATE SET
        avg_engagement = (topic_format_performance.avg_engagement * topic_format_performance.sample_count + p_engagement) / (topic_format_performance.sample_count + 1),
        sample_count = topic_format_performance.sample_count + 1,
        last_used = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Seed initial style variations
INSERT INTO content_style_variations (style_label, usage_count, avg_engagement) VALUES
('🧠 Data-driven', 0, 0.0),
('🔥 Contrarian', 0, 0.0),
('💡 Quick Tip', 0, 0.0),
('📝 Mini-Story', 0, 0.0),
('📊 Research Reveal', 0, 0.0),
('🎯 Action-Oriented', 0, 0.0)
ON CONFLICT (style_label) DO NOTHING;

-- Seed initial research citations
INSERT INTO research_citations (topic, citation_text, credibility_score) VALUES
('longevity', 'Studies show intermittent fasting may extend lifespan by 20-30% in animal models', 0.9),
('nutrition', 'Meta-analysis of 67 studies found Mediterranean diet reduces cardiovascular risk by 13%', 0.95),
('exercise', 'High-intensity interval training improves VO2 max 2x faster than steady-state cardio', 0.9),
('sleep', 'Sleep deprivation below 7 hours increases mortality risk by 12% according to 16-year study', 0.9),
('stress', 'Chronic stress elevates cortisol, leading to 40% increased risk of cognitive decline', 0.85),
('supplements', 'Vitamin D deficiency (<30 ng/mL) affects 41.6% of US adults according to national survey', 0.9)
ON CONFLICT DO NOTHING;

-- Seed initial topic-format combinations with baseline performance
INSERT INTO topic_format_performance (topic, format, avg_engagement, sample_count) VALUES
('longevity_science', 'Research_Bomb', 0.08, 1),
('nutrition_myths', 'Contrarian_Truth', 0.12, 1),
('biohacking', 'Hook-Value-CTA', 0.06, 1),
('mental_performance', 'Quick_Insight', 0.07, 1),
('health_optimization', 'Story_Revelation', 0.09, 1)
ON CONFLICT (topic, format) DO NOTHING;