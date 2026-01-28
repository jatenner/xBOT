-- ═══════════════════════════════════════════════════════════════════════════════
-- EMBEDDINGS CACHE TABLE
-- 
-- Purpose: Cache OpenAI embeddings to avoid redundant API calls
-- Keyed by text hash and/or tweet_id for efficient lookups
-- 
-- Date: January 27, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create embeddings_cache table
CREATE TABLE IF NOT EXISTS embeddings_cache (
  id BIGSERIAL PRIMARY KEY,
  
  -- Cache keys
  text_hash TEXT NOT NULL, -- SHA256 hash of normalized text
  tweet_id TEXT, -- Optional: tweet_id if available
  
  -- Cached data
  embedding JSONB NOT NULL, -- Embedding vector as JSON array
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small', -- Model used
  tokens INTEGER, -- Token count for cost tracking
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INTEGER DEFAULT 1, -- Track cache hits
  
  -- Constraints
  UNIQUE(text_hash, model) -- One embedding per text hash + model combination
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_embeddings_cache_text_hash 
  ON embeddings_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_cache_tweet_id 
  ON embeddings_cache(tweet_id) WHERE tweet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_embeddings_cache_model 
  ON embeddings_cache(model);
CREATE INDEX IF NOT EXISTS idx_embeddings_cache_last_accessed 
  ON embeddings_cache(last_accessed_at DESC);

-- Function to update last_accessed_at and access_count
CREATE OR REPLACE FUNCTION update_embeddings_cache_access()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  NEW.access_count = OLD.access_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update access tracking
CREATE TRIGGER update_embeddings_cache_access_trigger
  BEFORE UPDATE ON embeddings_cache
  FOR EACH ROW
  WHEN (OLD.last_accessed_at IS DISTINCT FROM NEW.last_accessed_at)
  EXECUTE FUNCTION update_embeddings_cache_access();

-- Comment
COMMENT ON TABLE embeddings_cache IS 'Cache for OpenAI embeddings to reduce API calls and costs';
COMMENT ON COLUMN embeddings_cache.text_hash IS 'SHA256 hash of normalized text (lowercase, trimmed)';
COMMENT ON COLUMN embeddings_cache.embedding IS 'Embedding vector as JSON array (1536 dimensions for text-embedding-3-small)';

COMMIT;
