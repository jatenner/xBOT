-- 🔧 MINIMAL DAILY POSTING FIX
-- Just create the table and basic entry - no complex JSON

-- Create the daily_posting_state table
CREATE TABLE IF NOT EXISTS daily_posting_state (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  tweets_posted INTEGER DEFAULT 0,
  posts_completed INTEGER DEFAULT 0,
  posts_target INTEGER DEFAULT 17,
  max_daily_tweets INTEGER DEFAULT 17,
  next_post_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour',
  posting_schedule JSONB DEFAULT '[]'::jsonb,
  emergency_mode BOOLEAN DEFAULT false,
  last_post_time TIMESTAMP WITH TIME ZONE,
  strategy TEXT DEFAULT 'balanced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_posting_state_date ON daily_posting_state(date);

-- Insert today's entry (simple version)
INSERT INTO daily_posting_state (date, tweets_posted, posts_completed, posts_target, max_daily_tweets, emergency_mode, strategy) 
VALUES (CURRENT_DATE, 0, 0, 17, 17, false, 'balanced')
ON CONFLICT (date) DO UPDATE SET
  posts_completed = 0,
  tweets_posted = 0,
  emergency_mode = false,
  updated_at = NOW();

-- Verify it worked
SELECT * FROM daily_posting_state WHERE date = CURRENT_DATE; 