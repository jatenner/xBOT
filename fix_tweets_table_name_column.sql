-- Fix missing table_name column in tweets table
-- Copy this into Supabase SQL Editor and run it

-- Add the missing table_name column
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS table_name VARCHAR(255) DEFAULT 'tweets';

-- Update all existing records to have the correct table_name
UPDATE tweets SET table_name = 'tweets' WHERE table_name IS NULL;

-- Verify the column was added
SELECT 'tweets.table_name column added successfully!' AS result;