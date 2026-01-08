-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD RELEVANCE AND REPLYABILITY SCORES TO REPLY_OPPORTUNITIES
-- 
-- Adds relevance_score and replyability_score columns for better opportunity filtering
-- 
-- Date: January 8, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Add relevance_score column (0-1, health relevance)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'relevance_score'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN relevance_score REAL NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add replyability_score column (0-1, how replyable the tweet is)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'replyability_score'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN replyability_score REAL NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add selection_reason column (optional, for debugging)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'selection_reason'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN selection_reason TEXT;
  END IF;
END $$;

COMMIT;

