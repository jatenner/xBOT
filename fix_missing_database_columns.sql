-- 🎯 TARGETED DATABASE COLUMN FIXES
-- Adds the specific missing columns identified in the fluency validation

-- Fix autonomous_decisions table - add missing action column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_decisions' 
        AND column_name = 'action'
    ) THEN
        ALTER TABLE autonomous_decisions 
        ADD COLUMN action VARCHAR(20) DEFAULT 'post';
        
        -- Add constraint for valid actions
        ALTER TABLE autonomous_decisions 
        ADD CONSTRAINT check_action_valid 
        CHECK (action IN ('post', 'improve', 'reject', 'delay'));
        
        RAISE NOTICE 'Added action column to autonomous_decisions';
    ELSE
        RAISE NOTICE 'Action column already exists in autonomous_decisions';
    END IF;
END $$;

-- Fix autonomous_decisions table - add other missing columns
DO $$
BEGIN
    -- Add confidence column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_decisions' 
        AND column_name = 'confidence'
    ) THEN
        ALTER TABLE autonomous_decisions 
        ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added confidence column to autonomous_decisions';
    END IF;
    
    -- Add reasoning column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_decisions' 
        AND column_name = 'reasoning'
    ) THEN
        ALTER TABLE autonomous_decisions 
        ADD COLUMN reasoning JSONB;
        RAISE NOTICE 'Added reasoning column to autonomous_decisions';
    END IF;
    
    -- Add expected_followers column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_decisions' 
        AND column_name = 'expected_followers'
    ) THEN
        ALTER TABLE autonomous_decisions 
        ADD COLUMN expected_followers INTEGER;
        RAISE NOTICE 'Added expected_followers column to autonomous_decisions';
    END IF;
    
    -- Add expected_engagement_rate column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_decisions' 
        AND column_name = 'expected_engagement_rate'
    ) THEN
        ALTER TABLE autonomous_decisions 
        ADD COLUMN expected_engagement_rate DECIMAL(5,4);
        RAISE NOTICE 'Added expected_engagement_rate column to autonomous_decisions';
    END IF;
END $$;

-- Fix follower_growth_predictions table - add missing confidence column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follower_growth_predictions' 
        AND column_name = 'confidence'
    ) THEN
        ALTER TABLE follower_growth_predictions 
        ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added confidence column to follower_growth_predictions';
    ELSE
        RAISE NOTICE 'Confidence column already exists in follower_growth_predictions';
    END IF;
END $$;

-- Fix follower_growth_predictions table - add other missing columns
DO $$
BEGIN
    -- Add viral_score_predicted column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follower_growth_predictions' 
        AND column_name = 'viral_score_predicted'
    ) THEN
        ALTER TABLE follower_growth_predictions 
        ADD COLUMN viral_score_predicted DECIMAL(5,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added viral_score_predicted column to follower_growth_predictions';
    END IF;
    
    -- Add quality_score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follower_growth_predictions' 
        AND column_name = 'quality_score'
    ) THEN
        ALTER TABLE follower_growth_predictions 
        ADD COLUMN quality_score DECIMAL(5,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added quality_score column to follower_growth_predictions';
    END IF;
END $$;

-- Fix autonomous_growth_strategies table - add missing is_active column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_growth_strategies' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE autonomous_growth_strategies 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_active column to autonomous_growth_strategies';
    ELSE
        RAISE NOTICE 'is_active column already exists in autonomous_growth_strategies';
    END IF;
END $$;

-- Fix autonomous_growth_strategies table - add other missing columns
DO $$
BEGIN
    -- Add success_rate column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_growth_strategies' 
        AND column_name = 'success_rate'
    ) THEN
        ALTER TABLE autonomous_growth_strategies 
        ADD COLUMN success_rate DECIMAL(5,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added success_rate column to autonomous_growth_strategies';
    END IF;
    
    -- Add average_followers_gained column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_growth_strategies' 
        AND column_name = 'average_followers_gained'
    ) THEN
        ALTER TABLE autonomous_growth_strategies 
        ADD COLUMN average_followers_gained DECIMAL(8,2) DEFAULT 0.00;
        RAISE NOTICE 'Added average_followers_gained column to autonomous_growth_strategies';
    END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_action ON autonomous_decisions(action);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_confidence ON autonomous_decisions(confidence);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_confidence ON follower_growth_predictions(confidence);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_is_active ON autonomous_growth_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_success_rate ON autonomous_growth_strategies(success_rate);

-- Update existing data with default values where appropriate
UPDATE autonomous_decisions SET action = 'post' WHERE action IS NULL;
UPDATE follower_growth_predictions SET confidence = 0.75 WHERE confidence IS NULL;
UPDATE autonomous_growth_strategies SET is_active = true WHERE is_active IS NULL;

-- Verify the changes
DO $$
DECLARE
    action_exists BOOLEAN;
    confidence_exists BOOLEAN;
    is_active_exists BOOLEAN;
BEGIN
    -- Check autonomous_decisions.action
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_decisions' AND column_name = 'action'
    ) INTO action_exists;
    
    -- Check follower_growth_predictions.confidence  
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'follower_growth_predictions' AND column_name = 'confidence'
    ) INTO confidence_exists;
    
    -- Check autonomous_growth_strategies.is_active
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'autonomous_growth_strategies' AND column_name = 'is_active'
    ) INTO is_active_exists;
    
    -- Report results
    RAISE NOTICE '=== COLUMN FIX VERIFICATION ===';
    RAISE NOTICE 'autonomous_decisions.action: %', CASE WHEN action_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE 'follower_growth_predictions.confidence: %', CASE WHEN confidence_exists THEN 'EXISTS' ELSE 'MISSING' END;
    RAISE NOTICE 'autonomous_growth_strategies.is_active: %', CASE WHEN is_active_exists THEN 'EXISTS' ELSE 'MISSING' END;
    
    IF action_exists AND confidence_exists AND is_active_exists THEN
        RAISE NOTICE '✅ ALL CRITICAL COLUMNS NOW EXIST - FLUENCY ACHIEVED!';
    ELSE
        RAISE NOTICE '⚠️ Some columns still missing - manual verification needed';
    END IF;
END $$;

COMMIT; 