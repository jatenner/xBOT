-- 🔧 FIX MISSING DATABASE TABLES
-- Creates essential tables for learning systems and viral content tracking

-- ===== AI LEARNING DATA TABLE =====
CREATE TABLE IF NOT EXISTS ai_learning_data (
    id BIGSERIAL PRIMARY KEY,
    learning_type TEXT NOT NULL, -- 'content_performance', 'engagement_pattern', 'timing_optimization', etc.
    context_data JSONB NOT NULL, -- Learning context and metadata
    performance_metrics JSONB, -- Performance data like engagement rates, viral scores
    insights JSONB, -- Generated insights and patterns
    confidence_score DECIMAL(5,3), -- Confidence in the learning (0.000-1.000)
    source_tweet_id BIGINT REFERENCES tweets(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_learning_data_type ON ai_learning_data(learning_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_data_created ON ai_learning_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_data_confidence ON ai_learning_data(confidence_score DESC);

-- ===== VIRAL CONTENT PERFORMANCE TABLE =====
CREATE TABLE IF NOT EXISTS viral_content_performance (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT REFERENCES tweets(id),
    content_type TEXT NOT NULL, -- 'viral_hook', 'educational', 'controversial', 'story', etc.
    viral_elements JSONB, -- Array of viral elements used: ['urgency', 'emotion', 'curiosity']
    performance_data JSONB NOT NULL, -- likes, retweets, replies, impressions, clicks
    viral_score DECIMAL(5,3), -- Calculated viral score (0.000-1.000)
    engagement_rate DECIMAL(5,3), -- Engagement rate percentage
    reach_metrics JSONB, -- Reach and impression data
    time_to_peak INTERVAL, -- Time from post to peak engagement
    peak_engagement_time TIMESTAMPTZ, -- When peak engagement occurred
    content_analysis JSONB, -- AI analysis of why content performed well/poorly
    learning_extracted BOOLEAN DEFAULT false, -- Whether learning was extracted from this data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for viral content analysis
CREATE INDEX IF NOT EXISTS idx_viral_performance_score ON viral_content_performance(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_performance_type ON viral_content_performance(content_type);
CREATE INDEX IF NOT EXISTS idx_viral_performance_created ON viral_content_performance(created_at DESC);

-- ===== ENGAGEMENT DATA TABLE =====
CREATE TABLE IF NOT EXISTS engagement_data (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT REFERENCES tweets(id),
    engagement_type TEXT NOT NULL, -- 'like', 'retweet', 'reply', 'quote_tweet', 'click', 'view'
    engagement_count INTEGER NOT NULL DEFAULT 0,
    engagement_rate DECIMAL(5,3), -- Percentage rate for this engagement type
    timestamp TIMESTAMPTZ NOT NULL,
    source TEXT, -- 'twitter_api', 'manual_tracking', 'webhook'
    metadata JSONB, -- Additional engagement metadata
    hourly_bucket TIMESTAMPTZ, -- Hour bucket for aggregation
    daily_bucket DATE, -- Date bucket for daily aggregation
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for engagement tracking
CREATE INDEX IF NOT EXISTS idx_engagement_data_tweet ON engagement_data(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_data_type ON engagement_data(engagement_type);
CREATE INDEX IF NOT EXISTS idx_engagement_data_timestamp ON engagement_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_data_hourly ON engagement_data(hourly_bucket);
CREATE INDEX IF NOT EXISTS idx_engagement_data_daily ON engagement_data(daily_bucket);

-- ===== CONTENT UNIQUENESS TRACKING =====
CREATE TABLE IF NOT EXISTS content_uniqueness (
    id BIGSERIAL PRIMARY KEY,
    content_hash TEXT UNIQUE NOT NULL, -- Hash of normalized content for duplicate detection
    original_content TEXT NOT NULL,
    normalized_content TEXT NOT NULL, -- Cleaned content for comparison
    first_used_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1,
    tweet_ids BIGINT[] DEFAULT '{}', -- Array of tweet IDs that used this content
    similarity_group TEXT, -- Group ID for similar content
    is_template BOOLEAN DEFAULT false, -- Whether this is a reusable template
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_hash ON content_uniqueness(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_normalized ON content_uniqueness(normalized_content);

-- ===== LEARNING INSIGHTS AGGREGATION =====
CREATE TABLE IF NOT EXISTS learning_insights (
    id BIGSERIAL PRIMARY KEY,
    insight_type TEXT NOT NULL, -- 'optimal_timing', 'viral_pattern', 'engagement_strategy', etc.
    insight_data JSONB NOT NULL, -- The actual insight data
    confidence_level DECIMAL(5,3) NOT NULL, -- How confident we are in this insight
    supporting_data_points INTEGER DEFAULT 0, -- Number of data points supporting this
    last_validated TIMESTAMPTZ, -- Last time this insight was validated
    performance_impact JSONB, -- Measured impact of applying this insight
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for insights
CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_learning_insights_confidence ON learning_insights(confidence_level DESC);

-- ===== UPDATE EXISTING TWEETS TABLE =====
-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add viral_score if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'viral_score') THEN
        ALTER TABLE tweets ADD COLUMN viral_score DECIMAL(5,3);
    END IF;
    
    -- Add engagement_data if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'engagement_data') THEN
        ALTER TABLE tweets ADD COLUMN engagement_data JSONB;
    END IF;
    
    -- Add content_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'content_type') THEN
        ALTER TABLE tweets ADD COLUMN content_type TEXT;
    END IF;
    
    -- Add learning_extracted if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'learning_extracted') THEN
        ALTER TABLE tweets ADD COLUMN learning_extracted BOOLEAN DEFAULT false;
    END IF;
    
    -- Add content_hash for duplicate detection
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'content_hash') THEN
        ALTER TABLE tweets ADD COLUMN content_hash TEXT;
    END IF;
END $$;

-- ===== FUNCTIONS FOR CONTENT UNIQUENESS =====
CREATE OR REPLACE FUNCTION normalize_content(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Normalize content for duplicate detection
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(input_text, '[^\w\s]', '', 'g'), -- Remove punctuation
            '\s+', ' ', 'g' -- Normalize whitespace
        )
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_content_hash(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Generate hash for content
    RETURN encode(digest(normalize_content(input_text), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ===== POPULATE EXISTING TWEETS WITH HASHES =====
UPDATE tweets 
SET content_hash = generate_content_hash(content)
WHERE content_hash IS NULL AND content IS NOT NULL;

-- ===== POPULATE CONTENT UNIQUENESS TABLE =====
INSERT INTO content_uniqueness (content_hash, original_content, normalized_content, first_used_at, tweet_ids)
SELECT 
    content_hash,
    content,
    normalize_content(content),
    MIN(created_at),
    ARRAY_AGG(id)
FROM tweets 
WHERE content_hash IS NOT NULL 
GROUP BY content_hash, content
ON CONFLICT (content_hash) DO NOTHING;

-- ===== RLS POLICIES =====
-- Enable RLS on new tables
ALTER TABLE ai_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_uniqueness ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for bot operations
CREATE POLICY "Allow bot operations on ai_learning_data" ON ai_learning_data FOR ALL USING (true);
CREATE POLICY "Allow bot operations on viral_content_performance" ON viral_content_performance FOR ALL USING (true);
CREATE POLICY "Allow bot operations on engagement_data" ON engagement_data FOR ALL USING (true);
CREATE POLICY "Allow bot operations on content_uniqueness" ON content_uniqueness FOR ALL USING (true);
CREATE POLICY "Allow bot operations on learning_insights" ON learning_insights FOR ALL USING (true);

-- ===== SUMMARY =====
SELECT 
    'Database tables created successfully' as status,
    COUNT(*) as existing_tweets
FROM tweets; 