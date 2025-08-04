-- 🔧 FIX MISSING DATABASE COLUMNS
-- Fix the missing semantic_embedding column and other issues

-- Add missing semantic_embedding column to post_history
ALTER TABLE post_history 
ADD COLUMN IF NOT EXISTS semantic_embedding VECTOR(1536);

-- Ensure all viral content tracking tables exist
DO $$
BEGIN
    -- viral_content_usage table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'viral_content_usage') THEN
        CREATE TABLE viral_content_usage (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tweet_id VARCHAR(255) NOT NULL,
            template_id VARCHAR(255),
            content TEXT NOT NULL,
            content_type VARCHAR(50) NOT NULL,
            viral_score DECIMAL(10,2) DEFAULT 0.0,
            controversy_level VARCHAR(50),
            psychological_triggers JSONB DEFAULT '[]',
            expected_engagement INTEGER DEFAULT 0,
            actual_engagement INTEGER DEFAULT 0,
            target_demographics JSONB DEFAULT '[]',
            posting_strategy TEXT,
            engagement_hooks JSONB DEFAULT '[]',
            call_to_action TEXT,
            posted_at TIMESTAMP DEFAULT NOW(),
            engagement_collected_at TIMESTAMP,
            follower_gain_24h INTEGER DEFAULT 0,
            performance_tier VARCHAR(50) DEFAULT 'pending'
        );
        
        CREATE INDEX IF NOT EXISTS idx_viral_content_usage_template ON viral_content_usage(template_id);
        CREATE INDEX IF NOT EXISTS idx_viral_content_usage_performance ON viral_content_usage(actual_engagement DESC);
    END IF;

    -- follower_growth_tracking table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_growth_tracking') THEN
        CREATE TABLE follower_growth_tracking (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
            follower_count INTEGER NOT NULL,
            follower_gain_daily INTEGER DEFAULT 0,
            follower_gain_weekly INTEGER DEFAULT 0,
            follower_gain_monthly INTEGER DEFAULT 0,
            engagement_rate_daily DECIMAL(10,4) DEFAULT 0.0,
            viral_tweets_count INTEGER DEFAULT 0,
            top_performing_tweet_id VARCHAR(255),
            growth_rate DECIMAL(10,4) DEFAULT 0.0,
            growth_trend VARCHAR(50) DEFAULT 'stable',
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_follower_growth_date ON follower_growth_tracking(date DESC);
    END IF;

    -- intelligent_engagement_actions table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intelligent_engagement_actions') THEN
        CREATE TABLE intelligent_engagement_actions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            action_type VARCHAR(50) NOT NULL,
            target_username VARCHAR(255) NOT NULL,
            target_tweet_id VARCHAR(255),
            our_response TEXT,
            engagement_hook TEXT,
            expected_reach INTEGER DEFAULT 0,
            expected_engagement INTEGER DEFAULT 0,
            expected_followers INTEGER DEFAULT 0,
            actual_engagement INTEGER DEFAULT 0,
            followers_gained INTEGER DEFAULT 0,
            roi_prediction DECIMAL(10,4) DEFAULT 0.0,
            roi_actual DECIMAL(10,4) DEFAULT 0.0,
            success BOOLEAN DEFAULT FALSE,
            lessons_learned JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_engagement_actions_target ON intelligent_engagement_actions(target_username);
        CREATE INDEX IF NOT EXISTS idx_engagement_actions_date ON intelligent_engagement_actions(created_at DESC);
    END IF;

END $$;

-- Update any existing tweet_analytics to ensure viral content tracking works
UPDATE tweet_analytics 
SET viral_score = CASE 
    WHEN (likes + retweets + replies) >= 50 THEN 85
    WHEN (likes + retweets + replies) >= 25 THEN 70
    WHEN (likes + retweets + replies) >= 10 THEN 50
    WHEN (likes + retweets + replies) >= 5 THEN 30
    ELSE 15
END
WHERE viral_score = 0 OR viral_score IS NULL;

-- Insert initial follower tracking data if none exists
INSERT INTO follower_growth_tracking (date, follower_count, follower_gain_daily, growth_trend)
VALUES (CURRENT_DATE, 0, 0, 'starting')
ON CONFLICT (date) DO NOTHING;

SELECT 'Database columns and tables fixed successfully!' as status;