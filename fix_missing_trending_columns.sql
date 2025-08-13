-- Fix missing columns in trending_topics table
-- Add momentum_score and other missing columns

-- Check if trending_topics table exists and add missing columns
DO $$
BEGIN
    -- Add momentum_score column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trending_topics' AND column_name = 'momentum_score'
    ) THEN
        ALTER TABLE trending_topics ADD COLUMN momentum_score DECIMAL(10,2) DEFAULT 0.0;
    END IF;
    
    -- Add other potentially missing columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trending_topics' AND column_name = 'trend_velocity'
    ) THEN
        ALTER TABLE trending_topics ADD COLUMN trend_velocity DECIMAL(10,2) DEFAULT 0.0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trending_topics' AND column_name = 'engagement_potential'
    ) THEN
        ALTER TABLE trending_topics ADD COLUMN engagement_potential INTEGER DEFAULT 0;
    END IF;
    
END $$;