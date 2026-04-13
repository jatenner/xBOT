-- Algorithm signal columns on brain_tweets
-- These help us understand HOW the algorithm treated each tweet

-- Engagement ratios that signal algorithm behavior
DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS bookmark_save_rate REAL;  -- bookmarks/likes — "save-worthy" signal
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS conversation_ratio REAL;  -- replies/likes — "conversation-starting" signal
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS share_ratio REAL;  -- retweets/likes — "share-worthy" signal
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS is_ratiod BOOLEAN DEFAULT false;  -- replies >> likes = negative reception
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS algo_score REAL;  -- composite: viral_multiplier weighted by save_rate + conversation_ratio
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Velocity tracking (from rescrapes)
DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS first_scrape_likes INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS first_scrape_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Index for algorithm analysis
CREATE INDEX IF NOT EXISTS idx_brain_tweets_algo ON brain_tweets(algo_score DESC NULLS LAST) WHERE algo_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brain_tweets_save_rate ON brain_tweets(bookmark_save_rate DESC NULLS LAST) WHERE bookmark_save_rate IS NOT NULL;
