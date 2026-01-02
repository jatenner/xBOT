-- Add root tweet tracking fields for reply visibility fix
-- Ensures replies target ROOT tweets, not other replies

BEGIN;

-- Add root_tweet_id to content_metadata for replies
ALTER TABLE content_generation_metadata_comprehensive 
  ADD COLUMN IF NOT EXISTS root_tweet_id TEXT;

ALTER TABLE content_generation_metadata_comprehensive 
  ADD COLUMN IF NOT EXISTS original_candidate_tweet_id TEXT;

ALTER TABLE content_generation_metadata_comprehensive 
  ADD COLUMN IF NOT EXISTS resolved_via_root BOOLEAN DEFAULT FALSE;

-- Add index for root_tweet_id lookups
CREATE INDEX IF NOT EXISTS idx_content_root_tweet_id 
  ON content_generation_metadata_comprehensive(root_tweet_id)
  WHERE decision_type = 'reply';

-- Add comment
COMMENT ON COLUMN content_generation_metadata_comprehensive.root_tweet_id 
  IS 'The actual root/original tweet being replied to (resolved from candidate)';

COMMENT ON COLUMN content_generation_metadata_comprehensive.original_candidate_tweet_id 
  IS 'The original candidate tweet ID before root resolution';

COMMENT ON COLUMN content_generation_metadata_comprehensive.resolved_via_root 
  IS 'Whether this reply was resolved to a root tweet (vs direct candidate)';

-- Add fields to reply_opportunities for root tracking
ALTER TABLE reply_opportunities 
  ADD COLUMN IF NOT EXISTS is_root_tweet BOOLEAN DEFAULT TRUE;

ALTER TABLE reply_opportunities 
  ADD COLUMN IF NOT EXISTS root_tweet_id TEXT;

COMMENT ON COLUMN reply_opportunities.is_root_tweet 
  IS 'Whether this opportunity is already a root tweet (vs a reply)';

COMMENT ON COLUMN reply_opportunities.root_tweet_id 
  IS 'The root tweet ID if this candidate is a reply (same as tweet_id if root)';

COMMIT;

