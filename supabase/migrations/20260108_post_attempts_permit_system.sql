-- Posting Permit System: Prevent ghost posts
-- Every post/reply must create a permit BEFORE posting

BEGIN;

-- Table: post_attempts (posting permits)
CREATE TABLE IF NOT EXISTS post_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id TEXT UNIQUE NOT NULL, -- Human-readable permit ID
  decision_id TEXT, -- Links to content_generation_metadata_comprehensive
  decision_type TEXT NOT NULL, -- 'single', 'thread', 'reply'
  
  -- Permit status
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED'
  
  -- Origin stamping
  railway_service_name TEXT,
  git_sha TEXT,
  run_id TEXT,
  pipeline_source TEXT,
  
  -- Posting details
  content_preview TEXT, -- First 200 chars
  target_tweet_id TEXT, -- For replies
  expected_tweet_id TEXT, -- If known
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'), -- Auto-expire after 10 min
  
  -- Result tracking
  actual_tweet_id TEXT, -- Filled after posting
  posting_success BOOLEAN,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_attempts_permit_id ON post_attempts(permit_id);
CREATE INDEX IF NOT EXISTS idx_post_attempts_decision_id ON post_attempts(decision_id);
CREATE INDEX IF NOT EXISTS idx_post_attempts_status ON post_attempts(status);
CREATE INDEX IF NOT EXISTS idx_post_attempts_created_at ON post_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_attempts_expires_at ON post_attempts(expires_at) WHERE status = 'PENDING';

-- Constraint: Only one APPROVED permit per decision_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_attempts_approved_decision 
  ON post_attempts(decision_id) 
  WHERE status = 'APPROVED';

-- Table: ghost_tweets (detected ghosts)
CREATE TABLE IF NOT EXISTS ghost_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  
  -- Detection metadata
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_by TEXT DEFAULT 'reconciliation_job',
  
  -- Origin tracking
  origin_commit_sha TEXT,
  origin_service_name TEXT,
  origin_run_id TEXT,
  
  -- Tweet details (scraped from X)
  content TEXT,
  posted_at TIMESTAMPTZ, -- Scraped timestamp
  in_reply_to_tweet_id TEXT,
  author_username TEXT DEFAULT 'Signal_Synapse',
  
  -- Status
  status TEXT DEFAULT 'detected', -- 'detected', 'reconciled', 'ignored'
  reconciled_at TIMESTAMPTZ,
  reconciled_decision_id TEXT, -- If we find the matching decision
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ghost_tweets_tweet_id ON ghost_tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_ghost_tweets_detected_at ON ghost_tweets(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_tweets_status ON ghost_tweets(status);

-- Function: Auto-expire pending permits
CREATE OR REPLACE FUNCTION expire_pending_permits()
RETURNS void AS $$
BEGIN
  UPDATE post_attempts
  SET status = 'EXPIRED'
  WHERE status = 'PENDING'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE post_attempts IS 'Posting permit system - every post must have an APPROVED permit before posting';
COMMENT ON TABLE ghost_tweets IS 'Detected ghost tweets (posted on X but missing in DB)';

COMMIT;

