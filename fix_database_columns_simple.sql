-- Simple SQL to fix missing database columns
-- Run this directly in Supabase SQL Editor

-- Add missing bandit_confidence column to learning_posts table
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS bandit_confidence REAL DEFAULT 0.5;

-- Add missing posted column to tweets table  
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted BOOLEAN DEFAULT TRUE;

-- Update existing tweets to have posted=true
UPDATE tweets SET posted = TRUE WHERE posted IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweets_posted ON tweets(posted);
CREATE INDEX IF NOT EXISTS idx_learning_posts_bandit_confidence ON learning_posts(bandit_confidence);