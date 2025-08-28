-- Enhanced Duplicate Content Prevention Migration
-- Adds similarity hash columns and constraints to prevent exact duplicates

-- Add similarity_hash column to tweets table if it doesn't exist
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS similarity_hash text;

-- Create function to calculate similarity hash
CREATE OR REPLACE FUNCTION calculate_similarity_hash(content TEXT)
RETURNS text AS $$
BEGIN
  -- Normalize content: lowercase, remove punctuation, trim whitespace
  RETURN encode(
    digest(
      regexp_replace(
        lower(trim(coalesce(content, ''))), 
        '[^a-z0-9\s]', 
        '', 
        'g'
      ), 
      'sha256'
    ), 
    'hex'
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-calculate similarity hash
CREATE OR REPLACE FUNCTION tweets_set_similarity_hash()
RETURNS trigger AS $$
BEGIN
  NEW.similarity_hash := calculate_similarity_hash(NEW.content);
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_tweets_similarity ON tweets;

-- Create trigger to auto-calculate similarity hash on insert/update
CREATE TRIGGER trg_tweets_similarity
  BEFORE INSERT OR UPDATE ON tweets
  FOR EACH ROW 
  EXECUTE FUNCTION tweets_set_similarity_hash();

-- Create partial unique index to prevent exact duplicates within the same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_tweets_simhash_day
  ON tweets (similarity_hash, date_trunc('day', created_at))
  WHERE similarity_hash IS NOT NULL;

-- Create index for faster duplicate lookups
CREATE INDEX IF NOT EXISTS idx_tweets_similarity_hash 
  ON tweets (similarity_hash)
  WHERE similarity_hash IS NOT NULL;

-- Update existing records to have similarity hashes
UPDATE tweets 
SET similarity_hash = calculate_similarity_hash(content)
WHERE similarity_hash IS NULL AND content IS NOT NULL;

-- Add similarity_hash column to learning_posts table if it doesn't exist
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS similarity_hash text;

-- Create trigger for learning_posts table
CREATE OR REPLACE FUNCTION learning_posts_set_similarity_hash()
RETURNS trigger AS $$
BEGIN
  NEW.similarity_hash := calculate_similarity_hash(NEW.content);
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_learning_posts_similarity ON learning_posts;

-- Create trigger for learning_posts
CREATE TRIGGER trg_learning_posts_similarity
  BEFORE INSERT OR UPDATE ON learning_posts
  FOR EACH ROW 
  EXECUTE FUNCTION learning_posts_set_similarity_hash();

-- Create index for learning_posts similarity hash
CREATE INDEX IF NOT EXISTS idx_learning_posts_similarity_hash 
  ON learning_posts (similarity_hash)
  WHERE similarity_hash IS NOT NULL;

-- Update existing learning_posts records
UPDATE learning_posts 
SET similarity_hash = calculate_similarity_hash(content)
WHERE similarity_hash IS NULL AND content IS NOT NULL;

-- Create view for unified duplicate checking across both tables
CREATE OR REPLACE VIEW all_content_hashes AS
SELECT 
  tweet_id,
  content,
  similarity_hash,
  created_at,
  'tweets' as source_table
FROM tweets 
WHERE similarity_hash IS NOT NULL

UNION ALL

SELECT 
  tweet_id,
  content,
  similarity_hash,
  created_at,
  'learning_posts' as source_table
FROM learning_posts 
WHERE similarity_hash IS NOT NULL;

-- Create function for duplicate detection across both tables
CREATE OR REPLACE FUNCTION detect_content_duplicate(
  new_content TEXT,
  exclude_tweet_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  is_duplicate BOOLEAN,
  existing_tweet_id TEXT,
  existing_content TEXT,
  similarity_hash TEXT,
  source_table TEXT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  new_hash TEXT;
BEGIN
  -- Calculate hash for new content
  new_hash := calculate_similarity_hash(new_content);
  
  -- Find matching content
  RETURN QUERY
  SELECT 
    TRUE as is_duplicate,
    h.tweet_id,
    h.content,
    h.similarity_hash,
    h.source_table,
    h.created_at
  FROM all_content_hashes h
  WHERE h.similarity_hash = new_hash
    AND (exclude_tweet_id IS NULL OR h.tweet_id != exclude_tweet_id)
    AND h.created_at > NOW() - INTERVAL '30 days'  -- Only check recent content
  ORDER BY h.created_at DESC
  LIMIT 1;
  
  -- If no duplicates found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, new_hash, NULL::TEXT, NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql;
