-- 🧠 Add semantic embedding column for duplicate detection
-- This column will store OpenAI embeddings as JSONB arrays

-- Add semantic_embedding column to tweets table
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS semantic_embedding JSONB;

-- Add index for faster embedding operations
CREATE INDEX IF NOT EXISTS idx_tweets_semantic_embedding 
ON tweets USING GIN (semantic_embedding);

-- Add comment for documentation
COMMENT ON COLUMN tweets.semantic_embedding IS 'OpenAI text embedding vector for semantic similarity detection';

-- Update existing tweets to have null semantic_embedding (will be populated on-demand)
UPDATE tweets 
SET semantic_embedding = NULL 
WHERE semantic_embedding IS NOT DISTINCT FROM '[]'::JSONB; 