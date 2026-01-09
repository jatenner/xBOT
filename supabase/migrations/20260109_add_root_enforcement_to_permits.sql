-- Add root enforcement columns to post_attempts (permits table)
-- Enables hard enforcement of ROOT-ONLY rule at permit approval

BEGIN;

-- Add columns for root verification
ALTER TABLE post_attempts
  ADD COLUMN IF NOT EXISTS target_is_root BOOLEAN,
  ADD COLUMN IF NOT EXISTS target_in_reply_to_tweet_id TEXT,
  ADD COLUMN IF NOT EXISTS reason_code TEXT;

-- Index for root enforcement queries
CREATE INDEX IF NOT EXISTS idx_post_attempts_target_is_root 
  ON post_attempts(target_is_root) 
  WHERE decision_type = 'reply';

-- Index for reconciliation
CREATE INDEX IF NOT EXISTS idx_post_attempts_reason_code 
  ON post_attempts(reason_code) 
  WHERE reason_code IS NOT NULL;

COMMENT ON COLUMN post_attempts.target_is_root IS 'For replies: true if target is root tweet, false if target is a reply';
COMMENT ON COLUMN post_attempts.target_in_reply_to_tweet_id IS 'For replies: tweet_id that target is replying to (null if root)';
COMMENT ON COLUMN post_attempts.reason_code IS 'Rejection reason code (e.g., target_not_root)';

COMMIT;

