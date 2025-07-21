-- 🔧 DATABASE SCHEMA ALIGNMENT FIX
-- This script ensures all database columns match application expectations

-- Fix autonomous_decisions table structure
DO $$
BEGIN
    -- Check if action column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_decisions' AND column_name = 'action') THEN
        ALTER TABLE autonomous_decisions ADD COLUMN action VARCHAR(20) DEFAULT 'post' 
        CHECK (action IN ('post', 'improve', 'reject', 'delay'));
    END IF;
    
    -- Check if confidence column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_decisions' AND column_name = 'confidence') THEN
        ALTER TABLE autonomous_decisions ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
    
    -- Check if reasoning column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_decisions' AND column_name = 'reasoning') THEN
        ALTER TABLE autonomous_decisions ADD COLUMN reasoning JSONB;
    END IF;
    
    -- Check if expected_followers column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_decisions' AND column_name = 'expected_followers') THEN
        ALTER TABLE autonomous_decisions ADD COLUMN expected_followers INTEGER;
    END IF;
    
    -- Check if expected_engagement_rate column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_decisions' AND column_name = 'expected_engagement_rate') THEN
        ALTER TABLE autonomous_decisions ADD COLUMN expected_engagement_rate DECIMAL(5,4);
    END IF;
END $$;

-- Fix follower_growth_predictions table structure
DO $$
BEGIN
    -- Check if confidence column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_growth_predictions' AND column_name = 'confidence') THEN
        ALTER TABLE follower_growth_predictions ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
    
    -- Check if viral_score_predicted column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_growth_predictions' AND column_name = 'viral_score_predicted') THEN
        ALTER TABLE follower_growth_predictions ADD COLUMN viral_score_predicted DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
    
    -- Check if quality_score column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_growth_predictions' AND column_name = 'quality_score') THEN
        ALTER TABLE follower_growth_predictions ADD COLUMN quality_score DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
END $$;

-- Fix follower_tracking table structure
DO $$
BEGIN
    -- Check if followers_after column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_tracking' AND column_name = 'followers_after') THEN
        ALTER TABLE follower_tracking ADD COLUMN followers_after INTEGER DEFAULT 0;
    END IF;
    
    -- Check if likes column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_tracking' AND column_name = 'likes') THEN
        ALTER TABLE follower_tracking ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;
    
    -- Check if retweets column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_tracking' AND column_name = 'retweets') THEN
        ALTER TABLE follower_tracking ADD COLUMN retweets INTEGER DEFAULT 0;
    END IF;
    
    -- Check if replies column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follower_tracking' AND column_name = 'replies') THEN
        ALTER TABLE follower_tracking ADD COLUMN replies INTEGER DEFAULT 0;
    END IF;
END $$;

-- Fix prediction_model_performance table structure
DO $$
BEGIN
    -- Check if accuracy column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prediction_model_performance' AND column_name = 'accuracy') THEN
        ALTER TABLE prediction_model_performance ADD COLUMN accuracy DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
    
    -- Check if follower_prediction_accuracy column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prediction_model_performance' AND column_name = 'follower_prediction_accuracy') THEN
        ALTER TABLE prediction_model_performance ADD COLUMN follower_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
    
    -- Check if engagement_prediction_accuracy column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'prediction_model_performance' AND column_name = 'engagement_prediction_accuracy') THEN
        ALTER TABLE prediction_model_performance ADD COLUMN engagement_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
END $$;

-- Fix autonomous_growth_strategies table structure
DO $$
BEGIN
    -- Check if is_active column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'is_active') THEN
        ALTER TABLE autonomous_growth_strategies ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Check if success_rate column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'success_rate') THEN
        ALTER TABLE autonomous_growth_strategies ADD COLUMN success_rate DECIMAL(5,4) DEFAULT 0.0000;
    END IF;
    
    -- Check if average_followers_gained column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'average_followers_gained') THEN
        ALTER TABLE autonomous_growth_strategies ADD COLUMN average_followers_gained DECIMAL(8,2) DEFAULT 0.00;
    END IF;
END $$;

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_action ON autonomous_decisions(action);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_confidence ON autonomous_decisions(confidence);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_confidence ON follower_growth_predictions(confidence);
CREATE INDEX IF NOT EXISTS idx_follower_tracking_tweet_id ON follower_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_prediction_performance_accuracy ON prediction_model_performance(accuracy);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_active ON autonomous_growth_strategies(is_active);

-- Update existing data to ensure consistency
UPDATE autonomous_decisions SET action = 'post' WHERE action IS NULL;
UPDATE follower_growth_predictions SET confidence = 0.75 WHERE confidence IS NULL;
UPDATE follower_tracking SET followers_after = followers_before WHERE followers_after IS NULL;
UPDATE prediction_model_performance SET accuracy = 0.0 WHERE accuracy IS NULL;
UPDATE autonomous_growth_strategies SET is_active = true WHERE is_active IS NULL;

COMMIT; 