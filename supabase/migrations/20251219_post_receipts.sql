-- Post Receipts: Immutable proof-of-posting
-- Records every successful post to X before DB persistence attempts
-- Enables reconciliation if content_metadata save fails

CREATE TABLE IF NOT EXISTS public.post_receipts (
  -- Primary identity
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linkage (nullable to allow orphan receipts)
  decision_id UUID NULL, -- Links to content_metadata.decision_id
  
  -- Tweet proof (immutable)
  tweet_ids TEXT[] NOT NULL, -- All tweet IDs (1 for single, N for thread)
  root_tweet_id TEXT NOT NULL, -- First/only tweet ID (for indexing)
  post_type TEXT NOT NULL CHECK (post_type IN ('single', 'thread', 'reply')),
  
  -- Timestamps
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When posted to X
  receipt_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When receipt written
  reconciled_at TIMESTAMPTZ NULL, -- When reconciled to content_metadata
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Extra context (target_tweet_id for replies, etc.)
  
  -- Reconciliation tracking
  reconciliation_attempts INTEGER DEFAULT 0,
  last_reconciliation_error TEXT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_post_receipts_decision_id 
  ON public.post_receipts(decision_id) WHERE decision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_receipts_root_tweet_id 
  ON public.post_receipts(root_tweet_id);

CREATE INDEX IF NOT EXISTS idx_post_receipts_unreconciled 
  ON public.post_receipts(posted_at DESC) 
  WHERE reconciled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_receipts_orphan 
  ON public.post_receipts(receipt_created_at DESC) 
  WHERE decision_id IS NULL AND reconciled_at IS NULL;

-- Enable RLS (but allow service role full access)
ALTER TABLE public.post_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to post_receipts"
  ON public.post_receipts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE public.post_receipts IS 
  'Immutable receipts for every successful post to X. Written immediately after Playwright returns tweet IDs, before content_metadata persistence. Enables reconciliation if DB save fails.';

