-- 🔧 CREATE MISSING DAILY POSTING STATE TABLE
-- This table is required for the Daily Posting Manager to function

-- Create the daily_posting_state table
CREATE TABLE IF NOT EXISTS daily_posting_state (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  tweets_posted INTEGER DEFAULT 0,
  posts_completed INTEGER DEFAULT 0,
  posts_target INTEGER DEFAULT 17,
  max_daily_tweets INTEGER DEFAULT 17,
  next_post_time TIMESTAMP WITH TIME ZONE,
  posting_schedule JSONB DEFAULT '[]'::jsonb,
  emergency_mode BOOLEAN DEFAULT false,
  last_post_time TIMESTAMP WITH TIME ZONE,
  strategy TEXT DEFAULT 'balanced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_posting_state_date ON daily_posting_state(date);
CREATE INDEX IF NOT EXISTS idx_daily_posting_state_next_post_time ON daily_posting_state(next_post_time);

-- Initialize today's posting state
INSERT INTO daily_posting_state (
  date,
  tweets_posted,
  posts_completed,
  posts_target,
  max_daily_tweets,
  next_post_time,
  posting_schedule,
  emergency_mode,
  last_post_time,
  strategy
) VALUES (
  CURRENT_DATE,
  0,
  0,
  17,
  17,
  NOW() + INTERVAL '1 hour',  -- Next post in 1 hour
  '[]'::jsonb,
  false,
  NULL,
  'balanced'
)
ON CONFLICT (date) DO UPDATE SET
  posts_completed = 0,
  tweets_posted = 0,
  emergency_mode = false,
  next_post_time = NOW() + INTERVAL '1 hour',
  updated_at = NOW();

-- Set immediate posting override flag
INSERT INTO bot_config (key, value, description) VALUES (
  'startup_posting_override',
  jsonb_build_object(
    'enabled', true,
    'force_immediate_post', true,
    'clear_phantom_times', true,
    'reason', 'Daily Posting Manager initialization - July 3rd',
    'timestamp', NOW()::text
  )::text,
  'Emergency flag to force immediate posting after Daily Posting Manager restart'
)
ON CONFLICT (key) DO UPDATE SET
  value = jsonb_build_object(
    'enabled', true,
    'force_immediate_post', true,
    'clear_phantom_times', true,
    'reason', 'Daily Posting Manager initialization - July 3rd',
    'timestamp', NOW()::text
  )::text,
  updated_at = NOW();

-- Verify the setup
SELECT 
  'DAILY POSTING MANAGER TABLE CREATED' as status,
  date,
  posts_completed,
  posts_target,
  next_post_time,
  emergency_mode
FROM daily_posting_state 
WHERE date = CURRENT_DATE; 