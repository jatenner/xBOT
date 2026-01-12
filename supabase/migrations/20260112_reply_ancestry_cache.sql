-- Reply ancestry cache: Store resolved ancestry to reduce UNCERTAIN/ERROR rates
-- TTL: 24 hours (reuse cache if updated_at within 24h)

CREATE TABLE IF NOT EXISTS reply_ancestry_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('OK', 'UNCERTAIN', 'ERROR')),
  depth int, -- null = uncertain, 0 = root, 1+ = reply depth
  root_tweet_id text, -- null if uncertain
  confidence text NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  method text NOT NULL, -- 'metadata', 'json', 'dom', 'cache', etc.
  signals_json jsonb, -- Store signals as JSON
  error text, -- Error message if status=ERROR
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reply_ancestry_cache_tweet_id ON reply_ancestry_cache(tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_ancestry_cache_updated_at ON reply_ancestry_cache(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_ancestry_cache_status ON reply_ancestry_cache(status);

-- Note: Partial index for cleanup would require IMMUTABLE function - skip for now
-- Can use simple query: DELETE FROM reply_ancestry_cache WHERE updated_at < now() - interval '7 days';

COMMENT ON TABLE reply_ancestry_cache IS 'Cache for resolved tweet ancestry to reduce UNCERTAIN/ERROR rates';
COMMENT ON COLUMN reply_ancestry_cache.depth IS 'null = uncertain, 0 = root tweet, 1+ = reply depth';
COMMENT ON COLUMN reply_ancestry_cache.updated_at IS 'Cache TTL: reuse if updated_at within 24h';
