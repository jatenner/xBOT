-- 🏢 ENTERPRISE DATABASE OVERHAUL
-- ==================================
-- Complete database rebuild for advanced AI Twitter bot

-- 1. DROP AND RECREATE TWEETS TABLE WITH PROPER SCHEMA
DROP TABLE IF EXISTS tweets CASCADE;

CREATE TABLE tweets (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    content_type VARCHAR(50) DEFAULT 'tweet',
    tweet_type VARCHAR(50) DEFAULT 'original',
    success BOOLEAN DEFAULT false,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Twitter API Response Data
    twitter_response JSONB,
    retweet_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    quote_count INTEGER DEFAULT 0,
    impression_count INTEGER DEFAULT 0,
    
    -- AI System Data
    ai_prompt_used TEXT,
    ai_template_type VARCHAR(50),
    content_quality_score INTEGER DEFAULT 0,
    engagement_prediction DECIMAL(5,2) DEFAULT 0,
    actual_engagement_score INTEGER DEFAULT 0,
    
    -- Content Analysis
    character_count INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
    word_count INTEGER,
    sentiment_score DECIMAL(5,2) DEFAULT 0,
    readability_score DECIMAL(5,2) DEFAULT 0,
    
    -- Learning & Optimization Data
    template_performance_impact DECIMAL(5,2) DEFAULT 0,
    topic_resonance_score DECIMAL(5,2) DEFAULT 0,
    viral_potential_score DECIMAL(5,2) DEFAULT 0,
    
    -- Metadata
    device_used VARCHAR(50) DEFAULT 'render_bot',
    ip_address INET,
    user_agent TEXT,
    
    -- Constraints
    CONSTRAINT valid_content_length CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 280),
    CONSTRAINT valid_scores CHECK (
        engagement_prediction >= 0 AND 
        sentiment_score >= -1 AND sentiment_score <= 1 AND
        readability_score >= 0
    )
);

-- 2. CREATE COMPREHENSIVE INDEXES FOR PERFORMANCE
CREATE INDEX idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX idx_tweets_content_hash ON tweets(content_hash);
CREATE INDEX idx_tweets_success ON tweets(success);
CREATE INDEX idx_tweets_engagement ON tweets(actual_engagement_score DESC);
CREATE INDEX idx_tweets_quality ON tweets(content_quality_score DESC);
CREATE INDEX idx_tweets_type ON tweets(tweet_type, content_type);
CREATE INDEX idx_tweets_viral_potential ON tweets(viral_potential_score DESC);

-- Full-text search index for content
CREATE INDEX idx_tweets_content_search ON tweets USING gin(to_tsvector('english', content));

-- 3. ADVANCED CONTENT UNIQUENESS SYSTEM
DROP TABLE IF EXISTS content_uniqueness CASCADE;

CREATE TABLE content_uniqueness (
    id BIGSERIAL PRIMARY KEY,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    original_content TEXT NOT NULL,
    normalized_content TEXT NOT NULL,
    content_keywords TEXT[],
    content_topics TEXT[],
    semantic_fingerprint JSONB,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 1,
    first_used_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    tweet_ids TEXT[] DEFAULT '{}',
    
    -- Similarity analysis
    similar_content_hashes TEXT[] DEFAULT '{}',
    uniqueness_score DECIMAL(5,2) DEFAULT 100,
    
    -- Performance tracking
    avg_engagement DECIMAL(10,2) DEFAULT 0,
    best_engagement INTEGER DEFAULT 0,
    worst_engagement INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_uniqueness_hash ON content_uniqueness(content_hash);
CREATE INDEX idx_content_uniqueness_keywords ON content_uniqueness USING gin(content_keywords);
CREATE INDEX idx_content_uniqueness_topics ON content_uniqueness USING gin(content_topics);
CREATE INDEX idx_content_uniqueness_performance ON content_uniqueness(avg_engagement DESC);

-- 4. AI LEARNING & PERFORMANCE SYSTEM
DROP TABLE IF EXISTS ai_learning_data CASCADE;

CREATE TABLE ai_learning_data (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(50) REFERENCES tweets(tweet_id),
    
    -- Learning metrics
    content_template VARCHAR(100),
    topic_category VARCHAR(100),
    engagement_actual INTEGER DEFAULT 0,
    engagement_predicted INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5,2) DEFAULT 0,
    
    -- Performance insights
    viral_indicators JSONB,
    audience_resonance JSONB,
    timing_effectiveness JSONB,
    content_optimization_suggestions TEXT[],
    
    -- Learning outcomes
    template_effectiveness_score DECIMAL(5,2) DEFAULT 0,
    topic_performance_score DECIMAL(5,2) DEFAULT 0,
    overall_learning_value DECIMAL(5,2) DEFAULT 0,
    
    -- Meta-learning
    learning_confidence DECIMAL(5,2) DEFAULT 0,
    actionable_insights TEXT[],
    future_recommendations TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. REAL-TIME TWITTER DATA SYNC
DROP TABLE IF EXISTS twitter_sync_log CASCADE;

CREATE TABLE twitter_sync_log (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(50),
    sync_type VARCHAR(50), -- 'post', 'engagement_update', 'error'
    sync_status VARCHAR(50), -- 'success', 'failed', 'pending'
    
    -- API Response Data
    twitter_api_response JSONB,
    api_rate_limit_remaining INTEGER,
    api_rate_limit_reset TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    error_code VARCHAR(20),
    retry_count INTEGER DEFAULT 0,
    
    -- Timing
    api_call_duration_ms INTEGER,
    sync_timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CONTENT GENERATION TRACKING
DROP TABLE IF EXISTS content_generation_log CASCADE;

CREATE TABLE content_generation_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- Generation details
    prompt_used TEXT NOT NULL,
    template_type VARCHAR(100),
    topic_focus VARCHAR(200),
    generation_attempt INTEGER DEFAULT 1,
    
    -- AI Response
    raw_ai_response TEXT,
    processed_content TEXT,
    content_hash VARCHAR(64),
    
    -- Quality metrics
    content_length INTEGER,
    readability_score DECIMAL(5,2),
    uniqueness_score DECIMAL(5,2),
    quality_passed BOOLEAN DEFAULT false,
    
    -- Generation metadata
    openai_model VARCHAR(50) DEFAULT 'gpt-4',
    tokens_used INTEGER,
    generation_cost_usd DECIMAL(10,6),
    generation_duration_ms INTEGER,
    
    -- Outcome
    was_posted BOOLEAN DEFAULT false,
    posted_tweet_id VARCHAR(50),
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TRIGGER FUNCTIONS FOR DATA INTEGRITY

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tweets_updated_at BEFORE UPDATE ON tweets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate content hash
CREATE OR REPLACE FUNCTION generate_content_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_hash = encode(digest(lower(trim(NEW.content)), 'sha256'), 'hex');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_tweets_content_hash BEFORE INSERT OR UPDATE ON tweets
    FOR EACH ROW EXECUTE FUNCTION generate_content_hash();

-- Auto-track content uniqueness
CREATE OR REPLACE FUNCTION track_content_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO content_uniqueness (
        content_hash, 
        original_content, 
        normalized_content,
        tweet_ids
    ) VALUES (
        NEW.content_hash,
        NEW.content,
        lower(regexp_replace(NEW.content, '[^a-zA-Z0-9\s]', '', 'g')),
        ARRAY[NEW.tweet_id]
    )
    ON CONFLICT (content_hash) 
    DO UPDATE SET 
        usage_count = content_uniqueness.usage_count + 1,
        last_used_at = NOW(),
        tweet_ids = array_append(content_uniqueness.tweet_ids, NEW.tweet_id);
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_tweets_uniqueness AFTER INSERT ON tweets
    FOR EACH ROW EXECUTE FUNCTION track_content_uniqueness();

-- 8. INITIALIZE WITH EXISTING DATA
INSERT INTO tweets (tweet_id, content, success, posted_at)
SELECT tweet_id, content, true, created_at
FROM (VALUES 
    ('system_test_175346005143', 'System integration test tweet'),
    ('test_system_175346042961011', 'System test tweet - AI intelligence verification')
) AS existing_data(tweet_id, content);

-- 9. CREATE PERFORMANCE VIEWS
CREATE OR REPLACE VIEW high_performance_content AS
SELECT 
    t.content,
    t.actual_engagement_score,
    t.content_quality_score,
    t.ai_template_type,
    cu.usage_count,
    cu.avg_engagement
FROM tweets t
JOIN content_uniqueness cu ON t.content_hash = cu.content_hash
WHERE t.actual_engagement_score > 10
ORDER BY t.actual_engagement_score DESC;

CREATE OR REPLACE VIEW content_performance_summary AS
SELECT 
    ai_template_type,
    COUNT(*) as total_tweets,
    AVG(actual_engagement_score) as avg_engagement,
    MAX(actual_engagement_score) as best_engagement,
    AVG(content_quality_score) as avg_quality
FROM tweets
WHERE success = true
GROUP BY ai_template_type
ORDER BY avg_engagement DESC;

-- 10. VERIFICATION
SELECT 'ENTERPRISE DATABASE OVERHAUL COMPLETE!' as status;

SELECT 'VERIFICATION: TABLE STRUCTURES' as check_section;
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('tweets', 'content_uniqueness', 'ai_learning_data', 'twitter_sync_log', 'content_generation_log')
ORDER BY table_name;

SELECT 'VERIFICATION: SAMPLE DATA' as check_section;
SELECT tweet_id, LEFT(content, 50) || '...' as content_preview, content_hash, success
FROM tweets ORDER BY created_at DESC LIMIT 3; 