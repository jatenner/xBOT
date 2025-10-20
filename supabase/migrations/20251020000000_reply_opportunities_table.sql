-- Reply Opportunities Table for Real Twitter Discovery
-- This table stores scraped tweet opportunities for the reply system

CREATE TABLE IF NOT EXISTS reply_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_username TEXT NOT NULL,
  tweet_id TEXT UNIQUE NOT NULL,
  tweet_url TEXT NOT NULL,
  tweet_content TEXT NOT NULL,
  tweet_author TEXT NOT NULL,
  reply_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  posted_minutes_ago INTEGER DEFAULT 0,
  opportunity_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'expired', 'skipped')),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_status ON reply_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_score ON reply_opportunities(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_discovered ON reply_opportunities(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_tweet_id ON reply_opportunities(tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_author ON reply_opportunities(tweet_author);

-- Comment
COMMENT ON TABLE reply_opportunities IS 'Real scraped Twitter reply opportunities for AI-driven engagement system';

