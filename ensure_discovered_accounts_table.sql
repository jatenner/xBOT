-- ═══════════════════════════════════════════════════════════
-- BATCH 2: Ensure discovered_accounts table exists
-- ═══════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor if table doesn't exist
-- OR via Supabase CLI: supabase db execute --file ensure_discovered_accounts_table.sql

BEGIN;

-- Create discovered_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS discovered_accounts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  bio TEXT,
  verified BOOLEAN DEFAULT false,
  discovery_method TEXT CHECK (discovery_method IN ('hashtag', 'network', 'content', 'follower_overlap')),
  discovery_date TIMESTAMP DEFAULT NOW(),
  
  -- Quality scores (0-100)
  quality_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  content_score INTEGER DEFAULT 0,
  audience_relevance INTEGER DEFAULT 0,
  growth_score INTEGER DEFAULT 0,
  final_score INTEGER DEFAULT 0,
  
  last_scored TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_final_score 
ON discovered_accounts(final_score DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_username 
ON discovered_accounts(username);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_updated
ON discovered_accounts(last_updated);

-- Create reply_learning_insights table if it doesn't exist
CREATE TABLE IF NOT EXISTS reply_learning_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_type TEXT CHECK (insight_type IN ('generator', 'timing', 'target', 'topic')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.0,
  sample_size INTEGER DEFAULT 0,
  discovered_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(insight_type, key)
);

CREATE INDEX IF NOT EXISTS idx_reply_insights_type 
ON reply_learning_insights(insight_type);

CREATE INDEX IF NOT EXISTS idx_reply_insights_confidence 
ON reply_learning_insights(confidence DESC);

-- Verify tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'discovered_accounts') THEN
    RAISE NOTICE '✅ discovered_accounts table exists';
  ELSE
    RAISE EXCEPTION '❌ discovered_accounts table creation failed';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reply_learning_insights') THEN
    RAISE NOTICE '✅ reply_learning_insights table exists';
  ELSE
    RAISE EXCEPTION '❌ reply_learning_insights table creation failed';
  END IF;
END $$;

COMMIT;

-- Show table info
SELECT 
  'discovered_accounts' as table_name,
  COUNT(*) as row_count
FROM discovered_accounts
UNION ALL
SELECT 
  'reply_learning_insights',
  COUNT(*)
FROM reply_learning_insights;

