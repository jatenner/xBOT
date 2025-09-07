-- 🛡️ BULLETPROOF POSTS TABLE
-- Tracks all posting attempts and successes

CREATE TABLE IF NOT EXISTS bulletproof_posts (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  tweet_id TEXT,
  status TEXT CHECK (status IN ('success', 'failed')) NOT NULL,
  error_message TEXT,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bulletproof_posts_status ON bulletproof_posts(status);
CREATE INDEX IF NOT EXISTS idx_bulletproof_posts_posted_at ON bulletproof_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulletproof_posts_tweet_id ON bulletproof_posts(tweet_id);

-- Enable RLS
ALTER TABLE bulletproof_posts ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations" ON bulletproof_posts FOR ALL USING (true);

COMMIT;
