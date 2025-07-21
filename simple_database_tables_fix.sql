-- 🔧 SIMPLE DATABASE TABLES FIX
-- Creates essential tables without foreign key constraints to avoid compatibility issues

-- ===== AI LEARNING DATA TABLE =====
CREATE TABLE IF NOT EXISTS ai_learning_data (
    id BIGSERIAL PRIMARY KEY,
    learning_type TEXT NOT NULL,
    context_data JSONB NOT NULL,
    performance_metrics JSONB,
    insights JSONB,
    confidence_score DECIMAL(5,3),
    source_tweet_id BIGINT, -- No foreign key constraint
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- ===== VIRAL CONTENT PERFORMANCE TABLE =====
CREATE TABLE IF NOT EXISTS viral_content_performance (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT, -- No foreign key constraint
    content_type TEXT NOT NULL,
    viral_elements JSONB,
    performance_data JSONB NOT NULL,
    viral_score DECIMAL(5,3),
    engagement_rate DECIMAL(5,3),
    reach_metrics JSONB,
    time_to_peak INTERVAL,
    peak_engagement_time TIMESTAMPTZ,
    content_analysis JSONB,
    learning_extracted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ENGAGEMENT DATA TABLE =====
CREATE TABLE IF NOT EXISTS engagement_data (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT, -- No foreign key constraint
    engagement_type TEXT NOT NULL,
    engagement_count INTEGER NOT NULL DEFAULT 0,
    engagement_rate DECIMAL(5,3),
    timestamp TIMESTAMPTZ NOT NULL,
    source TEXT,
    metadata JSONB,
    hourly_bucket TIMESTAMPTZ,
    daily_bucket DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CONTENT UNIQUENESS TRACKING =====
CREATE TABLE IF NOT EXISTS content_uniqueness (
    id BIGSERIAL PRIMARY KEY,
    content_hash TEXT UNIQUE NOT NULL,
    original_content TEXT NOT NULL,
    normalized_content TEXT NOT NULL,
    first_used_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1,
    tweet_ids BIGINT[] DEFAULT '{}',
    similarity_group TEXT,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== LEARNING INSIGHTS AGGREGATION =====
CREATE TABLE IF NOT EXISTS learning_insights (
    id BIGSERIAL PRIMARY KEY,
    insight_type TEXT NOT NULL,
    insight_data JSONB NOT NULL,
    confidence_level DECIMAL(5,3) NOT NULL,
    supporting_data_points INTEGER DEFAULT 0,
    last_validated TIMESTAMPTZ,
    performance_impact JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== CREATE INDEXES FOR PERFORMANCE =====
CREATE INDEX IF NOT EXISTS idx_ai_learning_data_type ON ai_learning_data(learning_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_data_created ON ai_learning_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_performance_score ON viral_content_performance(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_performance_type ON viral_content_performance(content_type);
CREATE INDEX IF NOT EXISTS idx_engagement_data_tweet ON engagement_data(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_data_type ON engagement_data(engagement_type);
CREATE INDEX IF NOT EXISTS idx_engagement_data_timestamp ON engagement_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_hash ON content_uniqueness(content_hash);
CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON learning_insights(insight_type);

-- ===== ENABLE ROW LEVEL SECURITY =====
ALTER TABLE ai_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_uniqueness ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;

-- ===== CREATE PERMISSIVE POLICIES =====
CREATE POLICY "Allow all operations on ai_learning_data" ON ai_learning_data FOR ALL USING (true);
CREATE POLICY "Allow all operations on viral_content_performance" ON viral_content_performance FOR ALL USING (true);
CREATE POLICY "Allow all operations on engagement_data" ON engagement_data FOR ALL USING (true);
CREATE POLICY "Allow all operations on content_uniqueness" ON content_uniqueness FOR ALL USING (true);
CREATE POLICY "Allow all operations on learning_insights" ON learning_insights FOR ALL USING (true);

-- ===== VERIFICATION =====
SELECT 'Learning tables created successfully' as status; 