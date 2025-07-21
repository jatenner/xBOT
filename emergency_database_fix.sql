-- 🚨 EMERGENCY DATABASE FIX
-- Addresses the specific "column does not exist" errors directly

-- Step 1: Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS autonomous_decisions (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follower_growth_predictions (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    followers_predicted INTEGER DEFAULT 0,
    engagement_rate_predicted DECIMAL(5,4) DEFAULT 0.0500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follower_tracking (
    id BIGSERIAL PRIMARY KEY,
    followers_before INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    tracked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autonomous_growth_strategies (
    id BIGSERIAL PRIMARY KEY,
    strategy_name VARCHAR(200) NOT NULL UNIQUE,
    strategy_type VARCHAR(100) NOT NULL,
    strategy_config JSONB,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add the specific missing columns that are causing errors

-- Add action column to autonomous_decisions
ALTER TABLE autonomous_decisions 
ADD COLUMN IF NOT EXISTS action VARCHAR(20) DEFAULT 'post';

-- Add confidence column to follower_growth_predictions  
ALTER TABLE follower_growth_predictions 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,4) DEFAULT 0.7500;

-- Add followers_after column to follower_tracking
ALTER TABLE follower_tracking 
ADD COLUMN IF NOT EXISTS followers_after INTEGER DEFAULT 0;

-- Add is_active column to autonomous_growth_strategies
ALTER TABLE autonomous_growth_strategies 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Step 3: Add additional missing columns
ALTER TABLE autonomous_decisions 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,4) DEFAULT 0.8000;

ALTER TABLE autonomous_decisions 
ADD COLUMN IF NOT EXISTS reasoning JSONB;

ALTER TABLE autonomous_decisions 
ADD COLUMN IF NOT EXISTS expected_followers INTEGER;

ALTER TABLE autonomous_decisions 
ADD COLUMN IF NOT EXISTS expected_engagement_rate DECIMAL(5,4);

ALTER TABLE follower_growth_predictions 
ADD COLUMN IF NOT EXISTS viral_score_predicted DECIMAL(5,4) DEFAULT 0.6000;

ALTER TABLE follower_growth_predictions 
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,4) DEFAULT 0.7500;

ALTER TABLE follower_growth_predictions 
ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);

ALTER TABLE follower_tracking 
ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);

ALTER TABLE follower_tracking 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

ALTER TABLE follower_tracking 
ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;

ALTER TABLE follower_tracking 
ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;

ALTER TABLE autonomous_growth_strategies 
ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,4) DEFAULT 0.7500;

ALTER TABLE autonomous_growth_strategies 
ADD COLUMN IF NOT EXISTS average_followers_gained DECIMAL(8,2) DEFAULT 25.00;

-- Step 4: Set default values for existing NULL records
UPDATE autonomous_decisions SET action = 'post' WHERE action IS NULL;
UPDATE autonomous_decisions SET confidence = 0.8000 WHERE confidence IS NULL;
UPDATE follower_growth_predictions SET confidence = 0.7500 WHERE confidence IS NULL;
UPDATE follower_tracking SET followers_after = 0 WHERE followers_after IS NULL;
UPDATE autonomous_growth_strategies SET is_active = true WHERE is_active IS NULL;

-- Step 5: Create essential indexes
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_action ON autonomous_decisions(action);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_confidence ON follower_growth_predictions(confidence);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_active ON autonomous_growth_strategies(is_active);

COMMIT; 