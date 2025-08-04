-- SIMPLE FIX - Just add the missing column causing the error

-- Add the missing click_through_rate column
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS click_through_rate DECIMAL(10,4) DEFAULT 0.0;

-- Verify the fix worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tweet_analytics' 
AND column_name = 'click_through_rate';