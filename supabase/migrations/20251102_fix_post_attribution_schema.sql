-- ═══════════════════════════════════════════════════════════
-- FIX POST_ATTRIBUTION SCHEMA
-- Add missing columns so attribution system works
-- Date: November 2, 2025
-- ═══════════════════════════════════════════════════════════

-- Add missing columns to post_attribution table
ALTER TABLE post_attribution 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hook_pattern TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS generator_used TEXT,
ADD COLUMN IF NOT EXISTS format TEXT,
ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_post_attribution_last_updated ON post_attribution(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);

COMMENT ON TABLE post_attribution IS 'Tracks post performance for learning system - FIXED SCHEMA Nov 2, 2025';

