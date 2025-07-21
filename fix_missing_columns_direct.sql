-- Direct fix for missing columns causing SQL errors

-- Fix autonomous_decisions table
ALTER TABLE autonomous_decisions ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE autonomous_decisions ADD COLUMN IF NOT EXISTS action VARCHAR(20) DEFAULT 'post';
ALTER TABLE autonomous_decisions ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,4) DEFAULT 0.8000;
ALTER TABLE autonomous_decisions ADD COLUMN IF NOT EXISTS reasoning JSONB;
ALTER TABLE autonomous_decisions ADD COLUMN IF NOT EXISTS expected_followers INTEGER;
ALTER TABLE autonomous_decisions ADD COLUMN IF NOT EXISTS expected_engagement_rate DECIMAL(5,4);

-- Fix follower_growth_predictions table  
ALTER TABLE follower_growth_predictions ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE follower_growth_predictions ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);
ALTER TABLE follower_growth_predictions ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,4) DEFAULT 0.7500;
ALTER TABLE follower_growth_predictions ADD COLUMN IF NOT EXISTS viral_score_predicted DECIMAL(5,4) DEFAULT 0.6000;
ALTER TABLE follower_growth_predictions ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,4) DEFAULT 0.7500;

-- Fix follower_tracking table
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS followers_after INTEGER DEFAULT 0;
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;
ALTER TABLE follower_tracking ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,4) DEFAULT 0.0000;

-- Fix autonomous_growth_strategies table
ALTER TABLE autonomous_growth_strategies ADD COLUMN IF NOT EXISTS strategy_config JSONB;
ALTER TABLE autonomous_growth_strategies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE autonomous_growth_strategies ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,4) DEFAULT 0.7500;
ALTER TABLE autonomous_growth_strategies ADD COLUMN IF NOT EXISTS average_followers_gained DECIMAL(8,2) DEFAULT 25.00;

-- Set default values for any existing NULL content
UPDATE autonomous_decisions SET content = 'Default content' WHERE content IS NULL;
UPDATE follower_growth_predictions SET content = 'Default prediction content' WHERE content IS NULL;

COMMIT; 