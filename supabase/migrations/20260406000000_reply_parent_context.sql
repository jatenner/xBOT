-- Add parent tweet context columns to brain_tweets
-- These capture WHAT an account replied to (not just who), enabling
-- deep reply strategy analysis: what kind of tweets get the best replies?

ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS parent_content TEXT;
ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS parent_author TEXT;
ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS parent_likes INTEGER;
