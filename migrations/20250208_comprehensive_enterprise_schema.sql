-- 🏢 COMPREHENSIVE ENTERPRISE SCHEMA MIGRATION
-- ===============================================
-- Creates all missing tables for autonomous Twitter bot learning system
-- Migration: 20250208_comprehensive_enterprise_schema

-- ========================================
-- 1. LEARNING SYSTEM TABLES
-- ========================================

-- Learning Posts Table - Core learning data storage
CREATE TABLE IF NOT EXISTS learning_posts (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    content_type VARCHAR(50) DEFAULT 'tweet',
    posting_strategy VARCHAR(100),
    predicted_likes INTEGER DEFAULT 0,
    predicted_retweets INTEGER DEFAULT 0,
    predicted_replies INTEGER DEFAULT 0,
    predicted_followers INTEGER DEFAULT 0,
    actual_likes INTEGER DEFAULT 0,
    actual_retweets INTEGER DEFAULT 0,
    actual_replies INTEGER DEFAULT 0,
    actual_impressions INTEGER DEFAULT 0,
    follower_count_before INTEGER DEFAULT 0,
    follower_count_after INTEGER DEFAULT 0,
    converted_followers INTEGER DEFAULT 0,
    viral_potential_score DECIMAL(5,4) DEFAULT 0.0000,
    engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    performance_score DECIMAL(5,4) DEFAULT 0.0000,
    learning_metadata JSONB DEFAULT '{}',
    success_metrics JSONB DEFAULT '{}',
    learning_signals JSONB DEFAULT '{}',
    posted_at TIMESTAMP WITH TIME ZONE,
    tracked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Insights Table - Extracted patterns and insights
CREATE TABLE IF NOT EXISTS learning_insights (
    id BIGSERIAL PRIMARY KEY,
    insight_type VARCHAR(100) NOT NULL,
    insight_key VARCHAR(255) NOT NULL,
    insight_value JSONB NOT NULL,
    confidence_score DECIMAL(5,4) DEFAULT 0.5000,
    supporting_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    validation_count INTEGER DEFAULT 1,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    last_validated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(insight_type, insight_key)
);

-- ========================================
-- 2. ENGAGEMENT & POSTING OPTIMIZATION
-- ========================================

-- Engagement Windows Table - Optimal posting times
CREATE TABLE IF NOT EXISTS engagement_windows (
    id BIGSERIAL PRIMARY KEY,
    window_name VARCHAR(100) NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
    start_hour INTEGER NOT NULL,
    end_hour INTEGER NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    engagement_multiplier DECIMAL(5,4) DEFAULT 1.0000,
    follower_acquisition_rate DECIMAL(5,4) DEFAULT 0.0500,
    confidence_score DECIMAL(5,4) DEFAULT 0.5000,
    sample_size INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(day_of_week, start_hour, end_hour)
);

-- Optimal Posting Windows Table - Detailed time analysis
CREATE TABLE IF NOT EXISTS optimal_posting_windows (
    id BIGSERIAL PRIMARY KEY,
    window_start TIME NOT NULL,
    window_end TIME NOT NULL,
    day_of_week INTEGER NOT NULL,
    average_engagement DECIMAL(8,4) DEFAULT 0.0000,
    follower_conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    sample_tweets INTEGER DEFAULT 0,
    confidence_level DECIMAL(5,4) DEFAULT 0.0000,
    trending_topics JSONB DEFAULT '{}',
    audience_activity_score DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3. FOLLOWER GROWTH TRACKING
-- ========================================

-- Follower Growth Tracking Table - Detailed growth attribution
CREATE TABLE IF NOT EXISTS follower_growth_tracking (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255),
    content_snippet TEXT,
    content_hash VARCHAR(64),
    followers_before INTEGER NOT NULL,
    followers_after INTEGER NOT NULL,
    followers_gained INTEGER GENERATED ALWAYS AS (followers_after - followers_before) STORED,
    growth_rate DECIMAL(8,6) GENERATED ALWAYS AS (
        CASE WHEN followers_before > 0 
        THEN (followers_after - followers_before)::DECIMAL / followers_before 
        ELSE 0 END
    ) STORED,
    attribution_confidence DECIMAL(5,4) DEFAULT 0.8000,
    time_window_hours INTEGER DEFAULT 24,
    engagement_metrics JSONB DEFAULT '{}',
    viral_indicators JSONB DEFAULT '{}',
    tracking_metadata JSONB DEFAULT '{}',
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follower Attribution Table - Which content drives followers
CREATE TABLE IF NOT EXISTS follower_attribution (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    content_category VARCHAR(100),
    posting_strategy VARCHAR(100),
    followers_attributed INTEGER NOT NULL,
    attribution_method VARCHAR(100) DEFAULT 'time_window',
    confidence_score DECIMAL(5,4) DEFAULT 0.7500,
    supporting_metrics JSONB DEFAULT '{}',
    tracked_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    tracked_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 4. VIRAL CONTENT ANALYSIS
-- ========================================

-- Viral Content Patterns Table - What makes content viral
CREATE TABLE IF NOT EXISTS viral_content_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL,
    pattern_name VARCHAR(200) NOT NULL,
    pattern_description TEXT,
    viral_indicators JSONB NOT NULL,
    success_metrics JSONB NOT NULL,
    follower_conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    engagement_multiplier DECIMAL(5,4) DEFAULT 1.0000,
    reach_amplification DECIMAL(5,4) DEFAULT 1.0000,
    confidence_score DECIMAL(8,6) DEFAULT 0.5000,
    sample_size INTEGER DEFAULT 0,
    last_validated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(pattern_type, pattern_name)
);

-- Content Performance Predictions Table - ML predictions
CREATE TABLE IF NOT EXISTS content_performance_predictions (
    id BIGSERIAL PRIMARY KEY,
    content_text TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    predicted_likes INTEGER DEFAULT 0,
    predicted_retweets INTEGER DEFAULT 0,
    predicted_replies INTEGER DEFAULT 0,
    predicted_impressions INTEGER DEFAULT 0,
    predicted_followers INTEGER DEFAULT 0,
    viral_score DECIMAL(5,4) DEFAULT 0.0000,
    quality_score DECIMAL(5,4) DEFAULT 0.0000,
    engagement_score DECIMAL(5,4) DEFAULT 0.0000,
    follower_score DECIMAL(5,4) DEFAULT 0.0000,
    prediction_model VARCHAR(100) DEFAULT 'learning_engine_v1',
    prediction_confidence DECIMAL(5,4) DEFAULT 0.5000,
    prediction_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 5. PERFORMANCE TRACKING
-- ========================================

-- Tweet Performance History Table - Comprehensive tracking
CREATE TABLE IF NOT EXISTS tweet_performance_history (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Performance snapshots at different intervals
    performance_1h JSONB DEFAULT '{}',
    performance_6h JSONB DEFAULT '{}',
    performance_24h JSONB DEFAULT '{}',
    performance_7d JSONB DEFAULT '{}',
    
    -- Final metrics
    final_likes INTEGER DEFAULT 0,
    final_retweets INTEGER DEFAULT 0,
    final_replies INTEGER DEFAULT 0,
    final_impressions INTEGER DEFAULT 0,
    final_engagement_rate DECIMAL(8,6) DEFAULT 0.000000,
    
    -- Follower impact
    followers_before INTEGER DEFAULT 0,
    followers_after INTEGER DEFAULT 0,
    follower_attribution INTEGER DEFAULT 0,
    
    -- Learning signals
    viral_signals JSONB DEFAULT '{}',
    learning_metadata JSONB DEFAULT '{}',
    
    last_tracked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 6. GROWTH STRATEGY TABLES
-- ========================================

-- Growth Strategy Performance Table
CREATE TABLE IF NOT EXISTS growth_strategy_performance (
    id BIGSERIAL PRIMARY KEY,
    strategy_name VARCHAR(200) NOT NULL,
    strategy_type VARCHAR(100) NOT NULL,
    implementation_date DATE NOT NULL,
    tweets_count INTEGER DEFAULT 0,
    total_followers_gained INTEGER DEFAULT 0,
    average_engagement_rate DECIMAL(8,6) DEFAULT 0.000000,
    conversion_rate DECIMAL(8,6) DEFAULT 0.000000,
    roi_score DECIMAL(8,4) DEFAULT 0.0000,
    success_indicators JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. INDEXES FOR PERFORMANCE
-- ========================================

-- Learning Posts Indexes
CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_content_hash ON learning_posts(content_hash);
CREATE INDEX IF NOT EXISTS idx_learning_posts_posted_at ON learning_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_learning_posts_performance ON learning_posts(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_posts_followers ON learning_posts(converted_followers DESC);

-- Learning Insights Indexes
CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_learning_insights_confidence ON learning_insights(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_insights_success ON learning_insights(success_rate DESC);

-- Engagement Windows Indexes
CREATE INDEX IF NOT EXISTS idx_engagement_windows_active ON engagement_windows(is_active, day_of_week, start_hour);
CREATE INDEX IF NOT EXISTS idx_engagement_windows_multiplier ON engagement_windows(engagement_multiplier DESC);

-- Follower Growth Indexes
CREATE INDEX IF NOT EXISTS idx_follower_growth_tweet ON follower_growth_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_growth_gained ON follower_growth_tracking(followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_follower_growth_rate ON follower_growth_tracking(growth_rate DESC);

-- Performance History Indexes
CREATE INDEX IF NOT EXISTS idx_performance_tweet_id ON tweet_performance_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_performance_posted_at ON tweet_performance_history(posted_at);
CREATE INDEX IF NOT EXISTS idx_performance_engagement ON tweet_performance_history(final_engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_performance_followers ON tweet_performance_history(follower_attribution DESC);

-- ========================================
-- 8. DEFAULT DATA SEEDING
-- ========================================

-- Insert default engagement windows (based on Twitter best practices)
INSERT INTO engagement_windows (window_name, day_of_week, start_hour, end_hour, engagement_multiplier, follower_acquisition_rate) VALUES
('Monday Morning Peak', 1, 9, 11, 1.2, 0.08),
('Monday Evening', 1, 17, 19, 1.1, 0.06),
('Tuesday Peak', 2, 10, 12, 1.3, 0.09),
('Tuesday Evening', 2, 18, 20, 1.15, 0.07),
('Wednesday Prime', 3, 9, 11, 1.4, 0.10),
('Wednesday Afternoon', 3, 14, 16, 1.2, 0.08),
('Thursday Morning', 4, 8, 10, 1.3, 0.09),
('Thursday Peak', 4, 11, 13, 1.5, 0.12),
('Friday Social', 5, 10, 14, 1.6, 0.14),
('Saturday Casual', 6, 12, 16, 1.1, 0.05),
('Sunday Reflection', 0, 14, 18, 1.2, 0.07)
ON CONFLICT (day_of_week, start_hour, end_hour) DO NOTHING;

-- Insert viral content patterns (proven patterns)
INSERT INTO viral_content_patterns (pattern_type, pattern_name, pattern_description, viral_indicators, success_metrics) VALUES
('hook', 'Controversial Question', 'Ask polarizing questions that demand responses', '{"hooks": ["What if I told you...", "Unpopular opinion:", "Hot take:"], "triggers": ["controversy", "debate", "polarizing"]}', '{"avg_replies": 25, "avg_retweets": 15, "follower_rate": 0.08}'),
('value', 'Numbered Lists', 'Actionable tips in numbered format', '{"format": "numbered_list", "length": "3-7_items", "actionable": true}', '{"avg_likes": 50, "avg_saves": 20, "follower_rate": 0.12}'),
('story', 'Personal Transformation', 'Before/after success stories', '{"elements": ["before_state", "catalyst", "transformation", "result"], "emotion": "inspiration"}', '{"avg_engagement": 0.08, "follower_rate": 0.15}'),
('psychology', 'Curiosity Gap', 'Create knowledge gaps that demand resolution', '{"hooks": ["The secret to...", "What nobody tells you...", "I wish I knew this earlier"], "gap_type": "knowledge"}', '{"avg_clicks": 40, "follower_rate": 0.10}'),
('social_proof', 'Authority Positioning', 'Demonstrate expertise and credibility', '{"elements": ["credentials", "results", "social_proof"], "tone": "confident"}', '{"avg_trust": 0.85, "follower_rate": 0.11}')
ON CONFLICT (pattern_type, pattern_name) DO NOTHING;

-- ========================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimal_posting_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_growth_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_content_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_strategy_performance ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (bot operations)
CREATE POLICY "Service role can manage learning_posts" ON learning_posts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage learning_insights" ON learning_insights FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage engagement_windows" ON engagement_windows FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage optimal_posting_windows" ON optimal_posting_windows FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage follower_growth_tracking" ON follower_growth_tracking FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage follower_attribution" ON follower_attribution FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage viral_content_patterns" ON viral_content_patterns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage content_performance_predictions" ON content_performance_predictions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage tweet_performance_history" ON tweet_performance_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage growth_strategy_performance" ON growth_strategy_performance FOR ALL USING (auth.role() = 'service_role');

-- ========================================
-- 10. MIGRATION VERIFICATION
-- ========================================

-- Verify all tables were created
DO $$
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY[
        'learning_posts',
        'learning_insights', 
        'engagement_windows',
        'optimal_posting_windows',
        'follower_growth_tracking',
        'follower_attribution',
        'viral_content_patterns',
        'content_performance_predictions',
        'tweet_performance_history',
        'growth_strategy_performance'
    ];
    table_name TEXT;
BEGIN
    RAISE NOTICE '🔍 VERIFYING ENTERPRISE DATABASE SCHEMA...';
    
    FOREACH table_name IN ARRAY expected_tables
    LOOP
        SELECT COUNT(*) INTO table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = table_name;
        
        IF table_count > 0 THEN
            RAISE NOTICE '✅ TABLE CREATED: %', table_name;
        ELSE
            RAISE NOTICE '❌ TABLE MISSING: %', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🎉 ENTERPRISE DATABASE SCHEMA MIGRATION COMPLETE!';
END $$;
