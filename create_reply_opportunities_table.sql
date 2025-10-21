-- Create reply_opportunities table
CREATE TABLE IF NOT EXISTS public.reply_opportunities (
  id BIGSERIAL PRIMARY KEY,
  
  -- Target info
  target_username TEXT NOT NULL,
  target_tweet_id TEXT NOT NULL,
  target_tweet_url TEXT NOT NULL,
  target_tweet_content TEXT,
  target_followers INTEGER,
  
  -- Metrics
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  posted_minutes_ago INTEGER,
  tweet_posted_at TIMESTAMP WITH TIME ZONE,
  
  -- Scoring
  opportunity_score DECIMAL(10, 2) DEFAULT 0,
  estimated_reach INTEGER DEFAULT 0,
  
  -- Discovery
  discovery_method TEXT DEFAULT 'scraper',
  account_username TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'skipped', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  replied_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(target_tweet_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reply_opps_status ON public.reply_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_reply_opps_score ON public.reply_opportunities(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_reply_opps_created ON public.reply_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_opps_username ON public.reply_opportunities(account_username);
CREATE INDEX IF NOT EXISTS idx_reply_opps_tweet_age ON public.reply_opportunities(tweet_posted_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_reply_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reply_opportunities_updated_at
BEFORE UPDATE ON public.reply_opportunities
FOR EACH ROW
EXECUTE FUNCTION update_reply_opportunities_updated_at();

COMMENT ON TABLE public.reply_opportunities IS 'Stores potential tweets to reply to for growth';
