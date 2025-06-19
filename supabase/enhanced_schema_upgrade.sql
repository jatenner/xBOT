-- =====================================================
-- ENHANCED BACKEND BRAIN DATABASE UPGRADE
-- =====================================================
-- This SQL upgrades your existing Supabase database to support
-- the enhanced AI bot with trending, mission objectives, and 
-- comprehensive learning capabilities.

-- Add missing columns to tweets table
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS content_category VARCHAR(50) DEFAULT 'health_tech',
ADD COLUMN IF NOT EXISTS source_attribution TEXT,
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mission_alignment_score DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ethical_compliance BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS visual_content BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trend_relevance_score DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS breaking_news BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS viral_potential DECIMAL(3,2) DEFAULT 0;

-- Create trending topics tracking table
CREATE TABLE IF NOT EXISTS trending_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'health_tech', 'ai', 'healthcare', 'general'
    volume INTEGER DEFAULT 0,
    relevance_score DECIMAL(3,2) DEFAULT 0,
    timeframe VARCHAR(20) DEFAULT 'trending', -- 'breaking', 'trending', 'emerging'
    source VARCHAR(100) DEFAULT 'news_api', -- 'twitter', 'news_api', 'manual'
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create current events tracking table
CREATE TABLE IF NOT EXISTS current_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    source VARCHAR(255) NOT NULL,
    url TEXT,
    category VARCHAR(50) NOT NULL, -- 'breaking', 'research', 'funding', 'regulatory', 'product'
    relevance_score DECIMAL(3,2) DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hashtags TEXT[], -- Array of hashtags
    processed BOOLEAN DEFAULT false,
    used_for_content BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create mission objectives tracking table
CREATE TABLE IF NOT EXISTS mission_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    overall_quality_score INTEGER NOT NULL,
    educational_value_score INTEGER DEFAULT 0,
    credibility_score INTEGER DEFAULT 0,
    engagement_quality_score INTEGER DEFAULT 0,
    professional_relevance_score INTEGER DEFAULT 0,
    source_verification BOOLEAN DEFAULT false,
    ethical_compliance BOOLEAN DEFAULT true,
    mission_alignment BOOLEAN DEFAULT true,
    verdict VARCHAR(20) NOT NULL, -- 'approved', 'needs_improvement', 'rejected'
    recommendations TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tweet_id) REFERENCES tweets(tweet_id)
);

-- Create AI decision tracking table (for visual decisions, content modes, etc.)
CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255),
    decision_type VARCHAR(50) NOT NULL, -- 'visual', 'content_mode', 'trending_topic', 'mission_eval'
    decision_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 0,
    reasoning TEXT,
    outcome_success BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tweet_id) REFERENCES tweets(tweet_id)
);

-- Create news articles cache table
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    url TEXT UNIQUE NOT NULL,
    source VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    content TEXT,
    image_url TEXT,
    health_tech_relevance DECIMAL(3,2) DEFAULT 0,
    credibility_score INTEGER DEFAULT 0,
    category VARCHAR(50) DEFAULT 'general',
    processed BOOLEAN DEFAULT false,
    used_for_content BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create learning feedback table for continuous improvement
CREATE TABLE IF NOT EXISTS learning_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    feedback_type VARCHAR(50) NOT NULL, -- 'engagement', 'quality', 'mission_alignment', 'user_feedback'
    feedback_score DECIMAL(3,2) NOT NULL,
    feedback_data JSONB,
    learning_applied BOOLEAN DEFAULT false,
    confidence_impact DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (tweet_id) REFERENCES tweets(tweet_id)
);

-- Create content strategies performance table
CREATE TABLE IF NOT EXISTS content_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_name VARCHAR(100) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL, -- 'trending', 'engagement', 'comprehensive', 'current_events'
    success_rate DECIMAL(3,2) DEFAULT 0,
    avg_quality_score DECIMAL(5,2) DEFAULT 0,
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    total_uses INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    effectiveness_trend VARCHAR(20) DEFAULT 'stable', -- 'improving', 'declining', 'stable'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create image usage tracking table
CREATE TABLE IF NOT EXISTS image_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_filename VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    effectiveness_score DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bot performance dashboard data
CREATE TABLE IF NOT EXISTS performance_dashboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'cumulative'
    measurement_date DATE NOT NULL,
    additional_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for monthly API usage tracking (X API monthly limits)
CREATE TABLE IF NOT EXISTS monthly_api_usage (
  id SERIAL PRIMARY KEY,
  month VARCHAR(7) NOT NULL UNIQUE, -- YYYY-MM format
  tweets INTEGER DEFAULT 0,
  reads INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast monthly lookups
CREATE INDEX IF NOT EXISTS idx_monthly_api_usage_month ON monthly_api_usage(month);

-- Function to increment monthly tweet count
CREATE OR REPLACE FUNCTION incr_monthly_tweet()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_month TEXT;
BEGIN
  current_month := to_char(CURRENT_DATE, 'YYYY-MM');
  
  INSERT INTO monthly_api_usage (month, tweets, reads)
  VALUES (current_month, 1, 0)
  ON CONFLICT (month)
  DO UPDATE SET 
    tweets = monthly_api_usage.tweets + 1,
    last_updated = CURRENT_TIMESTAMP;
END;
$$;

-- Function to increment monthly read count
CREATE OR REPLACE FUNCTION incr_monthly_read()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_month TEXT;
BEGIN
  current_month := to_char(CURRENT_DATE, 'YYYY-MM');
  
  INSERT INTO monthly_api_usage (month, tweets, reads)
  VALUES (current_month, 0, 1)
  ON CONFLICT (month)
  DO UPDATE SET 
    reads = monthly_api_usage.reads + 1,
    last_updated = CURRENT_TIMESTAMP;
END;
$$;

-- Update existing functions to also track monthly usage
CREATE OR REPLACE FUNCTION incr_write()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_date TEXT;
BEGIN
  today_date := CURRENT_DATE::text;
  
  -- Daily tracking
  INSERT INTO api_usage (date, writes, reads)
  VALUES (today_date, 1, 0)
  ON CONFLICT (date)
  DO UPDATE SET writes = api_usage.writes + 1;
  
  -- Monthly tracking
  PERFORM incr_monthly_tweet();
END;
$$;

CREATE OR REPLACE FUNCTION incr_read()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  today_date TEXT;
BEGIN
  today_date := CURRENT_DATE::text;
  
  -- Daily tracking
  INSERT INTO api_usage (date, writes, reads)
  VALUES (today_date, 0, 1)
  ON CONFLICT (date)
  DO UPDATE SET reads = api_usage.reads + 1;
  
  -- Monthly tracking
  PERFORM incr_monthly_read();
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweets_quality_score ON tweets(quality_score);
CREATE INDEX IF NOT EXISTS idx_tweets_content_type ON tweets(content_type);
CREATE INDEX IF NOT EXISTS idx_tweets_content_category ON tweets(content_category);
CREATE INDEX IF NOT EXISTS idx_tweets_viral_potential ON tweets(viral_potential);
CREATE INDEX IF NOT EXISTS idx_trending_topics_relevance ON trending_topics(relevance_score);
CREATE INDEX IF NOT EXISTS idx_trending_topics_expires ON trending_topics(expires_at);
CREATE INDEX IF NOT EXISTS idx_current_events_category ON current_events(category);
CREATE INDEX IF NOT EXISTS idx_current_events_published ON current_events(published_at);
CREATE INDEX IF NOT EXISTS idx_mission_metrics_quality ON mission_metrics(overall_quality_score);
CREATE INDEX IF NOT EXISTS idx_mission_metrics_verdict ON mission_metrics(verdict);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_type ON ai_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_news_articles_relevance ON news_articles(health_tech_relevance);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_type ON learning_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_content_strategies_success ON content_strategies(success_rate);
CREATE INDEX IF NOT EXISTS idx_image_usage_effectiveness ON image_usage(effectiveness_score);
CREATE INDEX IF NOT EXISTS idx_performance_dashboard_date ON performance_dashboard(measurement_date);

-- Insert initial content strategies
INSERT INTO content_strategies (strategy_name, strategy_type, success_rate, avg_quality_score, total_uses) VALUES
('Trending Health Tech Analysis', 'trending', 0.75, 80.0, 0),
('Breaking News Commentary', 'current_events', 0.70, 85.0, 0),
('Viral Educational Content', 'engagement', 0.65, 75.0, 0),
('Comprehensive Research Posts', 'comprehensive', 0.80, 90.0, 0)
ON CONFLICT DO NOTHING;

-- Insert initial image categories for tracking
INSERT INTO image_usage (image_filename, category, description, usage_count) VALUES
('health_ai_lab.jpg', 'lab', 'Modern AI health research lab', 0),
('medical_scanning.jpg', 'diagnostic', 'Advanced medical scanning technology', 0),
('wearable_devices.jpg', 'wearable', 'Smart health monitoring devices', 0),
('brain_imaging.jpg', 'brain', 'Brain imaging and neural networks', 0),
('data_visualization.jpg', 'data', 'Health data analytics dashboard', 0),
('telemedicine.jpg', 'digital', 'Digital healthcare consultation', 0),
('robotic_surgery.jpg', 'surgical', 'Robotic surgical systems', 0),
('genomic_sequencing.jpg', 'genomic', 'DNA sequencing technology', 0),
('ai_diagnosis.jpg', 'diagnostic', 'AI-powered diagnostic tools', 0),
('smart_hospital.jpg', 'facility', 'Smart hospital infrastructure', 0),
('biotech_research.jpg', 'lab', 'Biotechnology research lab', 0),
('digital_health.jpg', 'digital', 'Digital health ecosystem', 0)
ON CONFLICT DO NOTHING;

-- Add bot configuration for enhanced features
INSERT INTO bot_config (key, value, description) VALUES
('trending_analysis_enabled', 'true', 'Enable real-time trending topic analysis'),
('mission_objectives_enabled', 'true', 'Enable mission-driven quality control'),
('ai_visual_decisions', 'true', 'Enable AI-powered visual content decisions'),
('quality_threshold', '70', 'Minimum quality score for posting'),
('news_api_enabled', 'true', 'Enable NewsAPI integration for current events'),
('learning_feedback_enabled', 'true', 'Enable continuous learning from performance'),
('max_trending_topics', '10', 'Maximum trending topics to track'),
('current_events_hours', '24', 'Hours to consider for current events'),
('image_variety_tracking', 'true', 'Track image usage to ensure variety')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_dashboard ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
DO $$ BEGIN
    -- Trending topics policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trending_topics' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON trending_topics FOR ALL USING (true);
    END IF;
    
    -- Current events policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'current_events' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON current_events FOR ALL USING (true);
    END IF;
    
    -- Mission metrics policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mission_metrics' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON mission_metrics FOR ALL USING (true);
    END IF;
    
    -- AI decisions policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_decisions' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON ai_decisions FOR ALL USING (true);
    END IF;
    
    -- News articles policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'news_articles' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON news_articles FOR ALL USING (true);
    END IF;
    
    -- Learning feedback policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'learning_feedback' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON learning_feedback FOR ALL USING (true);
    END IF;
    
    -- Content strategies policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_strategies' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON content_strategies FOR ALL USING (true);
    END IF;
    
    -- Image usage policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'image_usage' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON image_usage FOR ALL USING (true);
    END IF;
    
    -- Performance dashboard policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'performance_dashboard' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON performance_dashboard FOR ALL USING (true);
    END IF;
END $$;

-- Create functions for automated cleanup and maintenance
CREATE OR REPLACE FUNCTION cleanup_expired_trends()
RETURNS void AS $$
BEGIN
    DELETE FROM trending_topics WHERE expires_at < NOW();
    DELETE FROM current_events WHERE created_at < NOW() - INTERVAL '7 days';
    DELETE FROM news_articles WHERE created_at < NOW() - INTERVAL '30 days' AND used_for_content = false;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate content strategy effectiveness
CREATE OR REPLACE FUNCTION update_strategy_effectiveness()
RETURNS void AS $$
DECLARE
    strategy_rec RECORD;
    strategy_performance RECORD;
BEGIN
    FOR strategy_rec IN SELECT DISTINCT strategy_type FROM content_strategies LOOP
        SELECT 
            AVG(mm.overall_quality_score) as avg_quality,
            AVG(t.engagement_score) as avg_engagement,
            COUNT(*) as total_count,
            SUM(CASE WHEN mm.verdict = 'approved' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) as success_rate
        INTO strategy_performance
        FROM tweets t
        JOIN mission_metrics mm ON t.tweet_id = mm.tweet_id
        WHERE t.tweet_type = strategy_rec.strategy_type
        AND t.created_at > NOW() - INTERVAL '30 days';
        
        UPDATE content_strategies 
        SET 
            avg_quality_score = COALESCE(strategy_performance.avg_quality, avg_quality_score),
            avg_engagement = COALESCE(strategy_performance.avg_engagement, avg_engagement),
            success_rate = COALESCE(strategy_performance.success_rate, success_rate),
            total_uses = COALESCE(strategy_performance.total_count, total_uses),
            updated_at = NOW()
        WHERE strategy_type = strategy_rec.strategy_type;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if you want to set up automated cleanup)
-- This would require pg_cron extension, uncomment if available:
-- SELECT cron.schedule('cleanup-expired-data', '0 2 * * *', 'SELECT cleanup_expired_trends();');
-- SELECT cron.schedule('update-strategy-metrics', '0 3 * * *', 'SELECT update_strategy_effectiveness();');

-- Create views for easy dashboard access
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM tweets WHERE created_at > NOW() - INTERVAL '24 hours') as tweets_last_24h,
    (SELECT AVG(overall_quality_score) FROM mission_metrics WHERE created_at > NOW() - INTERVAL '7 days') as avg_quality_7d,
    (SELECT AVG(engagement_score) FROM tweets WHERE created_at > NOW() - INTERVAL '7 days') as avg_engagement_7d,
    (SELECT COUNT(*) FROM trending_topics WHERE expires_at > NOW()) as active_trends,
    (SELECT COUNT(*) FROM current_events WHERE created_at > NOW() - INTERVAL '24 hours') as current_events_24h,
    (SELECT strategy_name FROM content_strategies ORDER BY success_rate DESC LIMIT 1) as best_strategy;

CREATE OR REPLACE VIEW quality_trends AS
SELECT 
    DATE(created_at) as date,
    AVG(overall_quality_score) as avg_quality,
    COUNT(*) as tweet_count,
    SUM(CASE WHEN verdict = 'approved' THEN 1 ELSE 0 END) as approved_count
FROM mission_metrics 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- UPGRADE COMPLETE!
-- =====================================================
-- Your database now supports:
-- ✅ Enhanced tweet metadata (quality scores, mission alignment)
-- ✅ Real-time trending topics tracking
-- ✅ Current events processing and storage
-- ✅ Mission objectives and quality metrics
-- ✅ AI decision tracking and learning
-- ✅ News articles caching for relevance
-- ✅ Learning feedback loops
-- ✅ Content strategy performance tracking
-- ✅ Image usage and variety tracking
-- ✅ Performance dashboard data
-- ✅ Automated cleanup and maintenance functions
-- ✅ Dashboard views for monitoring
-- 
-- Your bot now has a comprehensive "backend brain" for:
-- - Quality-driven content generation
-- - Real-time trend analysis
-- - Continuous learning and improvement
-- - Mission-aligned decision making
-- - Performance optimization
-- ===================================================== 