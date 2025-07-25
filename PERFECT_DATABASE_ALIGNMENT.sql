-- 🎯 PERFECT DATABASE ALIGNMENT
-- ================================
-- This script ONLY adds what's missing to make your database perfect
-- No chaos, no duplicates, just what your TypeScript code expects

-- ✅ Step 1: Add missing columns to existing tables (only if they don't exist)

-- Fix tweets table to match FixedTweetStorage expectations
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS tweet_type VARCHAR(50) DEFAULT 'original',
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS content_category VARCHAR(50) DEFAULT 'health_tech',
ADD COLUMN IF NOT EXISTS source_attribution VARCHAR(100) DEFAULT 'AI Generated',
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_snap2health_cta BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS new_followers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix twitter_quota_tracking to match TwitterQuotaManager expectations
ALTER TABLE twitter_quota_tracking
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS daily_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 17,
ADD COLUMN IF NOT EXISTS daily_remaining INTEGER DEFAULT 17,
ADD COLUMN IF NOT EXISTS reset_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_exhausted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ✅ Step 2: Create missing tables that your code expects

-- Engagement History (expected by EngagementDatabaseLogger)
CREATE TABLE IF NOT EXISTS engagement_history (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  target_type VARCHAR(10) NOT NULL,
  content TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget tracking tables (expected by DailyBudgetAccounting)
CREATE TABLE IF NOT EXISTS budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  operation_type VARCHAR(100) NOT NULL,
  model_used VARCHAR(50) NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL(8,6) NOT NULL,
  remaining_budget DECIMAL(8,6) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS daily_budget_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  budget_limit DECIMAL(8,2) NOT NULL DEFAULT 3.00,
  total_spent DECIMAL(8,6) NOT NULL DEFAULT 0,
  remaining_budget DECIMAL(8,6) NOT NULL,
  transactions_count INTEGER DEFAULT 0,
  emergency_brake_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ✅ Step 3: Add essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_history_created_at ON engagement_history(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_twitter_quota_date ON twitter_quota_tracking(date);

-- ✅ Step 4: Initialize today's quota tracking (if not exists)
INSERT INTO twitter_quota_tracking (
  date, 
  daily_used, 
  daily_limit, 
  daily_remaining, 
  reset_time, 
  is_exhausted, 
  last_updated
) VALUES (
  CURRENT_DATE,
  0,
  17,
  17,
  (CURRENT_DATE + INTERVAL '1 day')::timestamp with time zone,
  false,
  NOW()
) ON CONFLICT (date) DO NOTHING;

-- ✅ Step 5: Initialize today's budget status (if not exists)
INSERT INTO daily_budget_status (
  date,
  budget_limit,
  total_spent,
  remaining_budget,
  transactions_count,
  emergency_brake_active
) VALUES (
  CURRENT_DATE,
  3.00,
  0.00,
  3.00,
  0,
  false
) ON CONFLICT (date) DO NOTHING;

-- 🎯 VERIFICATION: Check what we accomplished
SELECT '=== FINAL DATABASE STATUS ===' as status;

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name; 