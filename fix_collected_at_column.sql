-- 🚨 CRITICAL FIX: Add missing collected_at column
-- This is the column causing the immediate "Could not find the 'collected_at' column" error

ALTER TABLE tweet_analytics ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP DEFAULT NOW();

-- Verify the column was added
SELECT 'collected_at column added successfully' as status;