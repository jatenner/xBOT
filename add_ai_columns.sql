-- Add AI metrics columns to tweets table
-- Run this in Supabase SQL Editor

ALTER TABLE tweets ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 5;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS ai_growth_prediction INTEGER DEFAULT 5;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS ai_optimized BOOLEAN DEFAULT false;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'standard';

-- Create index for AI metrics
CREATE INDEX IF NOT EXISTS idx_tweets_viral_score ON tweets(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_ai_growth_prediction ON tweets(ai_growth_prediction DESC);

SELECT 'AI metrics columns added successfully!' as status; 