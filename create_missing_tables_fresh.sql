-- 🔥 FRESH DATABASE SCHEMA CREATION
-- This approach recreates tables with all required columns

-- Drop existing problematic tables and recreate them fresh
DROP TABLE IF EXISTS autonomous_decisions CASCADE;
DROP TABLE IF EXISTS follower_growth_predictions CASCADE; 
DROP TABLE IF EXISTS follower_tracking CASCADE;
DROP TABLE IF EXISTS autonomous_growth_strategies CASCADE;

-- Create autonomous_decisions with all required columns
CREATE TABLE autonomous_decisions (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    action VARCHAR(20) DEFAULT 'post',
    confidence DECIMAL(5,4) DEFAULT 0.8000,
    reasoning JSONB,
    expected_followers INTEGER,
    expected_engagement_rate DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follower_growth_predictions with all required columns
CREATE TABLE follower_growth_predictions (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255),
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    followers_predicted INTEGER DEFAULT 0,
    confidence DECIMAL(5,4) DEFAULT 0.7500,
    viral_score_predicted DECIMAL(5,4) DEFAULT 0.6000,
    quality_score DECIMAL(5,4) DEFAULT 0.7500,
    engagement_rate_predicted DECIMAL(5,4) DEFAULT 0.0500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follower_tracking with all required columns
CREATE TABLE follower_tracking (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255),
    followers_before INTEGER DEFAULT 0,
    followers_after INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    tracked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create autonomous_growth_strategies with all required columns
CREATE TABLE autonomous_growth_strategies (
    id BIGSERIAL PRIMARY KEY,
    strategy_name VARCHAR(200) NOT NULL UNIQUE,
    strategy_type VARCHAR(100) NOT NULL,
    strategy_config JSONB,
    is_active BOOLEAN DEFAULT true,
    success_rate DECIMAL(5,4) DEFAULT 0.7500,
    average_followers_gained DECIMAL(8,2) DEFAULT 25.00,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX idx_autonomous_decisions_action ON autonomous_decisions(action);
CREATE INDEX idx_autonomous_decisions_confidence ON autonomous_decisions(confidence);
CREATE INDEX idx_follower_predictions_confidence ON follower_growth_predictions(confidence);
CREATE INDEX idx_follower_predictions_tweet_id ON follower_growth_predictions(tweet_id);
CREATE INDEX idx_follower_tracking_tweet_id ON follower_tracking(tweet_id);
CREATE INDEX idx_growth_strategies_active ON autonomous_growth_strategies(is_active);
CREATE INDEX idx_growth_strategies_success_rate ON autonomous_growth_strategies(success_rate);

-- Enable Row Level Security
ALTER TABLE autonomous_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_growth_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_growth_strategies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for service role)
CREATE POLICY "autonomous_decisions_policy" ON autonomous_decisions FOR ALL USING (true);
CREATE POLICY "follower_predictions_policy" ON follower_growth_predictions FOR ALL USING (true);
CREATE POLICY "follower_tracking_policy" ON follower_tracking FOR ALL USING (true);
CREATE POLICY "growth_strategies_policy" ON autonomous_growth_strategies FOR ALL USING (true);

-- Insert some initial data to test
INSERT INTO autonomous_growth_strategies (strategy_name, strategy_type, strategy_config, is_active, success_rate, average_followers_gained) VALUES
('Engagement Question Strategy', 'content_generation', '{"focus": "questions", "tone": "engaging", "call_to_action": true}', true, 0.8200, 35.50),
('Viral Health Tips Strategy', 'viral_content', '{"focus": "health_tips", "tone": "authoritative", "use_statistics": true}', true, 0.7800, 28.75),
('Educational Content Strategy', 'educational', '{"focus": "education", "tone": "informative", "include_examples": true}', true, 0.7500, 22.30)
ON CONFLICT (strategy_name) DO NOTHING;

COMMIT; 