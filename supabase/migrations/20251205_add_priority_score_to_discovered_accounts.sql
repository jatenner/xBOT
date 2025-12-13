-- =====================================================================================
-- xBOT v2 Upgrade: Add priority_score to discovered_accounts for reply targeting
-- Migration: 20251205_add_priority_score_to_discovered_accounts.sql
-- Phase: 3.1 - Reply System Enhancements
-- =====================================================================================
-- 
-- Purpose: Track account priority based on reply performance
-- Higher priority_score = better reply targets (more followers gained, engagement)
-- 
-- Dependencies: None (standalone enhancement)
-- =====================================================================================

BEGIN;

-- Add priority_score column to discovered_accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discovered_accounts' 
    AND column_name = 'priority_score'
  ) THEN
    ALTER TABLE discovered_accounts 
    ADD COLUMN priority_score NUMERIC(10,6) DEFAULT 0.0;
    
    COMMENT ON COLUMN discovered_accounts.priority_score IS 
      'Priority score for reply targeting (0-1 scale). Higher = better reply performance (followers gained, engagement). Updated by reply learning job.';
  END IF;
END $$;

-- Add last_successful_reply_at column (optional, helpful for tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discovered_accounts' 
    AND column_name = 'last_successful_reply_at'
  ) THEN
    ALTER TABLE discovered_accounts 
    ADD COLUMN last_successful_reply_at TIMESTAMPTZ DEFAULT NULL;
    
    COMMENT ON COLUMN discovered_accounts.last_successful_reply_at IS 
      'Timestamp of last successful reply to this account (status=posted). Used for recency weighting.';
  END IF;
END $$;

-- Add reply_performance_score column (optional, stores aggregated performance)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discovered_accounts' 
    AND column_name = 'reply_performance_score'
  ) THEN
    ALTER TABLE discovered_accounts 
    ADD COLUMN reply_performance_score NUMERIC(10,6) DEFAULT 0.0;
    
    COMMENT ON COLUMN discovered_accounts.reply_performance_score IS 
      'Aggregated reply performance score (0-1 scale). Based on v2 metrics: followers_gained_weighted and primary_objective_score.';
  END IF;
END $$;

-- Create indexes for efficient querying by priority
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_priority_score 
  ON discovered_accounts(priority_score DESC) 
  WHERE priority_score > 0;

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_priority_reply_at 
  ON discovered_accounts(priority_score DESC, last_successful_reply_at DESC NULLS LAST) 
  WHERE priority_score > 0;

-- Create index for reply_opportunities to join with discovered_accounts efficiently
-- (if account_username column exists and matches discovered_accounts.username)
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_account_username 
  ON reply_opportunities(account_username) 
  WHERE account_username IS NOT NULL;

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251205_add_priority_score_to_discovered_accounts.sql completed successfully';
  RAISE NOTICE 'Added columns: priority_score, last_successful_reply_at, reply_performance_score';
END $$;

