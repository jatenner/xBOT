-- ═══════════════════════════════════════════════════════════════════════════════
-- REPLIED_TWEETS TABLE
-- 
-- Tracks which tweets we've already replied to (deduplication)
-- Prevents replying to same tweet_id twice
-- 
-- Date: January 8, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create replied_tweets table
CREATE TABLE IF NOT EXISTS public.replied_tweets (
  tweet_id TEXT PRIMARY KEY,
  author_handle TEXT NOT NULL,
  replied_at TIMESTAMPTZ DEFAULT now(),
  decision_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient author queries (daily cap check)
CREATE INDEX IF NOT EXISTS idx_replied_tweets_author_time 
  ON public.replied_tweets(author_handle, replied_at DESC);

-- Add comment
COMMENT ON TABLE public.replied_tweets IS 'Tracks tweets we have already replied to. Prevents duplicate replies and enables author daily cap enforcement.';

COMMIT;

