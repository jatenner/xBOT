-- Forensic pipeline: reply_decisions table
-- Records every reply decision (ALLOW/DENY) with ancestry depth and root tweet tracking

CREATE TABLE IF NOT EXISTS reply_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES content_metadata(decision_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Tweet identifiers
  target_tweet_id text NOT NULL,
  target_in_reply_to_tweet_id text, -- What the target tweet is replying to (if any)
  root_tweet_id text NOT NULL, -- The root tweet in the thread
  
  -- Ancestry analysis
  ancestry_depth int NOT NULL DEFAULT 0, -- 0 = root tweet, 1+ = reply depth
  is_root boolean NOT NULL DEFAULT true, -- true if target_tweet_id == root_tweet_id
  
  -- Decision
  decision text NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
  reason text, -- Why ALLOW/DENY
  
  -- Traceability
  trace_id text, -- feed_run_id, scheduler_run_id, etc.
  job_run_id text,
  pipeline_source text,
  
  -- Posting attempt tracking
  playwright_post_attempted boolean NOT NULL DEFAULT false,
  posted_reply_tweet_id text, -- The tweet ID we posted (if successful)
  error text, -- Error message if posting failed
  
  -- Metadata
  build_sha text,
  created_by text DEFAULT 'reply_system_v2'
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_target_tweet_id ON reply_decisions(target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_root_tweet_id ON reply_decisions(root_tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_decision_id ON reply_decisions(decision_id);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_created_at ON reply_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_decision ON reply_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_reply_decisions_is_root ON reply_decisions(is_root);

-- Index for ancestry depth queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_depth ON reply_decisions(ancestry_depth);

COMMENT ON TABLE reply_decisions IS 'Forensic pipeline: Records every reply decision with ancestry depth and root tweet tracking';
COMMENT ON COLUMN reply_decisions.ancestry_depth IS '0 = root tweet, 1+ = reply depth (how many levels deep in thread)';
COMMENT ON COLUMN reply_decisions.is_root IS 'true if target_tweet_id == root_tweet_id (we are replying to root)';
COMMENT ON COLUMN reply_decisions.decision IS 'ALLOW = approved for posting, DENY = blocked (e.g., non-root reply)';
